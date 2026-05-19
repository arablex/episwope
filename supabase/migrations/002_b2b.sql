-- Vigilo.cc — B2B multi-tenant extension
-- Run after: 001_initial.sql
-- Adds companies, B2B roles, credit system, team activity log.

-- ─── COMPANIES ────────────────────────────────────────────────────────────────
-- One row per corporate customer. Billing is deposit-based (credits).

CREATE TABLE companies (
  company_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  billing_address  TEXT,
  tax_id           TEXT,
  available_credits INT NOT NULL DEFAULT 0,
  stripe_customer  TEXT,                        -- for future Stripe invoice integration
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit top-up log (append-only for audit trail)
CREATE TABLE credit_top_ups (
  topup_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  credits      INT NOT NULL,
  amount_usd   NUMERIC(10,2),
  reference    TEXT,                            -- invoice number or Stripe payment intent
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES profiles(user_id)
);

-- ─── B2B ROLES ON PROFILES ────────────────────────────────────────────────────

CREATE TYPE b2b_role AS ENUM ('b2b_admin', 'b2b_employee');

ALTER TABLE profiles
  ADD COLUMN company_id UUID REFERENCES companies(company_id) ON DELETE SET NULL,
  ADD COLUMN b2b_role   b2b_role;

CREATE INDEX ON profiles (company_id) WHERE company_id IS NOT NULL;

-- ─── REPORT DOWNLOADS ─────────────────────────────────────────────────────────
-- Each report download decrements company credits (B2B) or checks personal quota (B2C).

CREATE TYPE report_type AS ENUM ('traveler', 'business_trip_safe', 'location_deep_dive');

CREATE TABLE report_downloads (
  download_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(user_id),
  company_id     UUID REFERENCES companies(company_id),
  country        CHAR(2) NOT NULL,
  report_type    report_type NOT NULL,
  credits_spent  INT NOT NULL DEFAULT 1,
  downloaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON report_downloads (user_id, downloaded_at DESC);
CREATE INDEX ON report_downloads (company_id, downloaded_at DESC) WHERE company_id IS NOT NULL;

-- ─── CREDIT DECREMENT FUNCTION ────────────────────────────────────────────────
-- Called in a transaction when a B2B user generates a report.
-- Returns FALSE if insufficient credits.

CREATE OR REPLACE FUNCTION spend_credits(
  p_company_id UUID,
  p_user_id    UUID,
  p_country    CHAR(2),
  p_type       report_type,
  p_cost       INT DEFAULT 1
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_credits INT;
BEGIN
  SELECT available_credits INTO current_credits
    FROM companies WHERE company_id = p_company_id FOR UPDATE;

  IF current_credits IS NULL OR current_credits < p_cost THEN
    RETURN FALSE;
  END IF;

  UPDATE companies
    SET available_credits = available_credits - p_cost,
        updated_at = NOW()
    WHERE company_id = p_company_id;

  INSERT INTO report_downloads (user_id, company_id, country, report_type, credits_spent)
    VALUES (p_user_id, p_company_id, p_country, p_type, p_cost);

  RETURN TRUE;
END;
$$;

-- ─── TEAM ACTIVITY LOG ────────────────────────────────────────────────────────
-- Shared view for B2B admins: who downloaded what and when.

CREATE VIEW company_activity AS
  SELECT
    rd.download_id,
    p.email         AS employee_email,
    p.b2b_role,
    rd.country,
    rd.report_type,
    rd.credits_spent,
    rd.downloaded_at
  FROM report_downloads rd
  JOIN profiles p ON p.user_id = rd.user_id
  WHERE rd.company_id IS NOT NULL
  ORDER BY rd.downloaded_at DESC;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_top_ups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_downloads ENABLE ROW LEVEL SECURITY;

-- Company members can see their own company
CREATE POLICY "company members" ON companies FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Only admin can update company
CREATE POLICY "admin update company" ON companies FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND b2b_role = 'b2b_admin'
  ));

-- Users see their own downloads
CREATE POLICY "own downloads" ON report_downloads FOR SELECT
  USING (user_id = auth.uid());

-- Admins see all company downloads
CREATE POLICY "admin sees all company downloads" ON report_downloads FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND b2b_role = 'b2b_admin'
  ));

-- Top-up log: admins only
CREATE POLICY "admin top-ups" ON credit_top_ups FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND b2b_role = 'b2b_admin'
  ));
