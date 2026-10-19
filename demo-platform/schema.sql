CREATE TABLE IF NOT EXISTS demo_environment (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  project_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  database_service_id TEXT NOT NULL,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_organizations (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_locations (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES demo_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL,
  audience INTEGER NOT NULL CHECK (audience >= 0),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS demo_advertisers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES demo_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prospect', 'active', 'renewal')),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (organization_id, name)
);

ALTER TABLE demo_advertisers
  ADD COLUMN IF NOT EXISTS sales_rep TEXT NOT NULL DEFAULT 'Unassigned';

CREATE TABLE IF NOT EXISTS demo_inventory (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES demo_locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  format TEXT NOT NULL,
  annual_price_cents INTEGER NOT NULL CHECK (annual_price_cents >= 0),
  estimated_impressions INTEGER NOT NULL CHECK (estimated_impressions >= 0),
  status TEXT NOT NULL CHECK (status IN ('available', 'pending', 'sold')),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (location_id, name)
);

ALTER TABLE demo_inventory
  ADD COLUMN IF NOT EXISTS tracking_code TEXT NOT NULL DEFAULT 'VVD-DEMO';

ALTER TABLE demo_inventory
  ADD COLUMN IF NOT EXISTS destination_url TEXT NOT NULL DEFAULT 'https://example.invalid';

CREATE TABLE IF NOT EXISTS demo_requests (
  id BIGSERIAL PRIMARY KEY,
  inventory_id BIGINT NOT NULL REFERENCES demo_inventory(id) ON DELETE CASCADE,
  advertiser_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_contracts (
  id BIGSERIAL PRIMARY KEY,
  advertiser_id BIGINT NOT NULL REFERENCES demo_advertisers(id) ON DELETE CASCADE,
  inventory_id BIGINT NOT NULL REFERENCES demo_inventory(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  value_cents INTEGER NOT NULL CHECK (value_cents >= 0),
  fulfillment_percent INTEGER NOT NULL CHECK (fulfillment_percent BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('active', 'renewal', 'complete')),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (advertiser_id, inventory_id, starts_on)
);

ALTER TABLE demo_contracts
  ADD COLUMN IF NOT EXISTS next_action TEXT NOT NULL DEFAULT 'Review account';

ALTER TABLE demo_contracts
  ADD COLUMN IF NOT EXISTS renewal_owner TEXT NOT NULL DEFAULT 'Unassigned';

CREATE TABLE IF NOT EXISTS demo_contract_benefits (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES demo_contracts(id) ON DELETE CASCADE,
  benefit TEXT NOT NULL,
  due_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'fulfilled')),
  notes TEXT NOT NULL DEFAULT '',
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (contract_id, benefit)
);

CREATE TABLE IF NOT EXISTS demo_campaigns (
  id BIGSERIAL PRIMARY KEY,
  advertiser_id BIGINT NOT NULL REFERENCES demo_advertisers(id) ON DELETE CASCADE,
  inventory_id BIGINT NOT NULL REFERENCES demo_inventory(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'complete')),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (advertiser_id, inventory_id, name)
);

CREATE TABLE IF NOT EXISTS demo_performance (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES demo_campaigns(id) ON DELETE CASCADE,
  recorded_on DATE NOT NULL,
  scans INTEGER NOT NULL CHECK (scans >= 0),
  clicks INTEGER NOT NULL CHECK (clicks >= 0),
  conversions INTEGER NOT NULL CHECK (conversions >= 0),
  revenue_cents INTEGER NOT NULL CHECK (revenue_cents >= 0),
  is_sample BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_sample = TRUE),
  UNIQUE (campaign_id, recorded_on)
);

CREATE INDEX IF NOT EXISTS demo_inventory_status_idx ON demo_inventory(status);
CREATE INDEX IF NOT EXISTS demo_contracts_status_idx ON demo_contracts(status);
CREATE INDEX IF NOT EXISTS demo_contract_benefits_contract_idx ON demo_contract_benefits(contract_id);
CREATE INDEX IF NOT EXISTS demo_performance_campaign_idx ON demo_performance(campaign_id, recorded_on);
