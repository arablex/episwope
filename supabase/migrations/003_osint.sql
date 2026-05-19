-- Vigilo.cc — OSINT behavioral signals & covert-risk journal
-- Run after: 002_b2b.sql
-- STATUS: forward-prep for Phase 3. NOT wired yet — the running journal
-- uses Netlify Blobs (osint store). Apply this only when building the
-- human-review queue + SQL audit dashboard.

-- ─── OSINT OBSERVATIONS (durable journal) ─────────────────────────────────────
-- Append-only. One row per country per day when a signal fires.
-- Mirrors the Blob journal so it can be migrated in 1:1.

CREATE TABLE osint_observations (
  obs_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day               DATE NOT NULL,
  iso2              CHAR(2) NOT NULL,
  tier              TEXT NOT NULL CHECK (tier IN
                      ('elevated_watch','covert_elevated')),
  behavioral        NUMERIC(4,2) NOT NULL,
  official_activity NUMERIC(4,2) NOT NULL,
  divergence        NUMERIC(5,2) NOT NULL,
  adj_divergence    NUMERIC(5,2) NOT NULL,
  transparency      NUMERIC(3,2) NOT NULL,
  opacity_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  reasons           JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome           TEXT,                       -- filled later by validation review
  outcome_at        TIMESTAMPTZ,
  source            TEXT NOT NULL DEFAULT 'server',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day, iso2)
);
CREATE INDEX idx_osint_obs_country ON osint_observations (iso2, day DESC);
CREATE INDEX idx_osint_obs_tier    ON osint_observations (tier);
CREATE INDEX idx_osint_obs_reasons ON osint_observations USING GIN (reasons jsonb_path_ops);
CREATE INDEX idx_osint_obs_pending ON osint_observations (day) WHERE outcome IS NULL;

-- ─── COVERT CORRELATIONS (human-review queue, Phase 3) ────────────────────────
-- The liability firewall: covert_elevated never auto-dispatches — it lands
-- here as 'awaiting_human' with a tight SLA.

CREATE TABLE osint_correlations (
  correlation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2               CHAR(2) NOT NULL,
  rule_id            TEXT NOT NULL DEFAULT 'covert_lockdown_v1',
  composite_tier     TEXT NOT NULL CHECK (composite_tier IN
                       ('elevated_watch','catastrophic_override')),
  verification_status TEXT NOT NULL DEFAULT 'not_demonstrated'
                       CHECK (verification_status IN
                       ('demonstrated','not_demonstrated')),
  contributing       JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispatch_state     TEXT NOT NULL DEFAULT 'pending' CHECK (dispatch_state IN
                       ('pending','auto_dispatched','awaiting_human',
                        'confirmed','rejected')),
  reviewed_by        UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ
);
CREATE INDEX idx_osint_corr_country ON osint_correlations (iso2, created_at DESC);
CREATE INDEX idx_osint_corr_queue   ON osint_correlations (dispatch_state)
                                      WHERE dispatch_state = 'awaiting_human';

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE osint_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE osint_correlations ENABLE ROW LEVEL SECURITY;

-- Owner / internal admin only (OSINT is not a customer-facing dataset)
CREATE POLICY "internal admin reads observations" ON osint_observations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE user_id = auth.uid() AND b2b_role = 'b2b_admin'));

CREATE POLICY "internal admin reads correlations" ON osint_correlations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE user_id = auth.uid() AND b2b_role = 'b2b_admin'));
