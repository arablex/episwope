-- Vigilo.cc — initial Supabase schema
-- Run: supabase db push
-- Current storage: Netlify Blobs (serverless KV).
-- This schema is for future migration to Supabase / PostgreSQL.

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE account_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE zone_type    AS ENUM ('country', 'radius', 'polygon');
CREATE TYPE signal_sev   AS ENUM ('signal', 'alert', 'urgent');

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- One row per authenticated user. Created on first sign-in via magic link.

CREATE TABLE profiles (
  user_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  tier             account_tier NOT NULL DEFAULT 'free',
  stripe_customer  TEXT,                      -- set when upgraded to Pro/Enterprise
  assess_quota     INT NOT NULL DEFAULT 10,   -- remaining on-demand risk assessments
  country_limit    INT NOT NULL DEFAULT 3,    -- max watched countries (free tier)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ
);

-- ─── API KEYS ────────────────────────────────────────────────────────────────
-- Partners get a hashed key; raw key delivered once at creation.

CREATE TABLE api_keys (
  key_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  hashed_key   TEXT NOT NULL UNIQUE,           -- SHA-256 hex of the raw key
  label        TEXT,
  rpm_limit    INT  NOT NULL DEFAULT 60,       -- requests per minute
  rph_limit    INT  NOT NULL DEFAULT 3600,     -- requests per hour
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ─── WEBHOOK ENDPOINTS ───────────────────────────────────────────────────────
-- HMAC-signed POST to callback_url on risk threshold events.

CREATE TABLE webhook_endpoints (
  endpoint_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  callback_url      TEXT NOT NULL,
  secret_key        TEXT NOT NULL,             -- used to sign X-Vigilo-Signature
  manage_token      TEXT NOT NULL,             -- DELETE/GET auth token
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  threshold         NUMERIC(3,2) NOT NULL DEFAULT 2.0,   -- 0–5 composite score
  last_fired_at     TIMESTAMPTZ,
  last_status       INT,
  last_attempts     INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_ip        TEXT
);

-- ─── GEO ZONES ───────────────────────────────────────────────────────────────
-- A subscription can watch a country, a radius around a point, or a polygon.

CREATE TABLE geo_zones (
  zone_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id    UUID NOT NULL REFERENCES webhook_endpoints(endpoint_id) ON DELETE CASCADE,
  type           zone_type NOT NULL,
  country_iso2   CHAR(2),                     -- used when type = 'country'
  categories     TEXT[],                      -- null = all 7 domains
  -- For radius: center point + radius_km.  For polygon: array of [lng,lat] pairs.
  coordinates    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LIVE SIGNALS ────────────────────────────────────────────────────────────
-- Atomic ingestible events from the 44 verified feeds.
-- Written by scripts/risk_aggregate.py; read by the risk API and dispatcher.

CREATE TABLE live_signals (
  signal_id      TEXT PRIMARY KEY,            -- e.g. 'who.don#9821', 'acled#5502'
  country_iso2   CHAR(2)  NOT NULL,
  domain         TEXT     NOT NULL,           -- health|conflict|civil_unrest|transport|border|infrastructure|climate
  severity       signal_sev NOT NULL,
  confidence     NUMERIC(4,3) NOT NULL DEFAULT 0.5,  -- 0–1
  title          TEXT NOT NULL,
  source_url     TEXT NOT NULL,               -- verifiable provenance link
  source_class   TEXT NOT NULL DEFAULT 'tier2_official',
  geo_lat        DOUBLE PRECISION,
  geo_lng        DOUBLE PRECISION,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ                  -- null = permanent
);

CREATE INDEX ON live_signals (country_iso2);
CREATE INDEX ON live_signals (domain);
CREATE INDEX ON live_signals (last_updated DESC);
CREATE INDEX ON live_signals (geo_lat, geo_lng) WHERE geo_lat IS NOT NULL;

-- ─── RISK INDEX SNAPSHOTS ────────────────────────────────────────────────────
-- Pre-computed composite scores written every 15 min; served by /api/v1/risk.

CREATE TABLE risk_snapshots (
  snapshot_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_iso2    CHAR(2) NOT NULL,
  composite_score NUMERIC(4,2) NOT NULL,       -- 0–5
  composite_band  TEXT NOT NULL,               -- minimal|low|moderate|elevated|severe|critical
  dominant_cat    TEXT,
  breakdown       JSONB NOT NULL DEFAULT '{}',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON risk_snapshots (country_iso2, generated_at DESC);

-- Latest snapshot per country (materialized to serve API without full table scan)
CREATE UNIQUE INDEX risk_snapshots_latest ON risk_snapshots (country_iso2, generated_at DESC);

-- ─── RLS: users only see their own rows ──────────────────────────────────────

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_zones          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile"     ON profiles           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own api keys"    ON api_keys           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own webhooks"    ON webhook_endpoints  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own zones"       ON geo_zones          FOR ALL USING (
  endpoint_id IN (SELECT endpoint_id FROM webhook_endpoints WHERE user_id = auth.uid())
);

-- live_signals and risk_snapshots are public read-only (served via API function, no direct client access)
