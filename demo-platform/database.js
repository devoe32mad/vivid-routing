'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function money(cents) {
  return Number(cents || 0) / 100;
}

function createDatabase(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000
  });

  async function seed(client, organizationId) {
    const locations = [
      ['Main Campus', 'Campus', 1250],
      ['Athletics Complex', 'Athletics', 5200],
      ['Community Magazine', 'Publication', 8500]
    ];
    const locationIds = {};
    for (const row of locations) {
      const result = await client.query(
        `INSERT INTO demo_locations (organization_id, name, location_type, audience)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, name) DO UPDATE SET audience = EXCLUDED.audience
         RETURNING id`,
        [organizationId, ...row]
      );
      locationIds[row[0]] = result.rows[0].id;
    }

    const advertisers = [
      ['Peak Community Bank', 'Financial Services', 'active'],
      ['Harbor Health Group', 'Healthcare', 'active'],
      ['Coastal Home Services', 'Home Services', 'renewal']
    ];
    const advertiserIds = {};
    for (const row of advertisers) {
      const result = await client.query(
        `INSERT INTO demo_advertisers (organization_id, name, category, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, name) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [organizationId, ...row]
      );
      advertiserIds[row[0]] = result.rows[0].id;
    }

    const inventory = [
      ['Main Campus', 'Welcome Center Display', 'High-traffic entrance display with a dynamic campaign destination.', 'Digital display', 240000, 92000, 'sold'],
      ['Main Campus', 'Community Newsletter Sponsor', 'Monthly newsletter placement reaching families and community members.', 'Email and web', 180000, 54000, 'pending'],
      ['Athletics Complex', 'Stadium Fence Partnership', 'Year-round fence placement with a reusable Vivid-powered code.', 'Outdoor signage', 300000, 150000, 'sold'],
      ['Athletics Complex', 'Gymnasium Scoreboard Sponsor', 'Indoor athletics visibility across basketball, volleyball and events.', 'Indoor signage', 250000, 78000, 'available'],
      ['Community Magazine', 'Inside Front Cover', 'Premium full-page placement across four annual issues.', 'Print', 480000, 34000, 'sold'],
      ['Community Magazine', 'Half-Page Advertiser', 'Repeat-issue half-page placement with optional attribution.', 'Print', 220000, 34000, 'available']
    ];
    const inventoryIds = {};
    for (const row of inventory) {
      const [location, ...values] = row;
      const result = await client.query(
        `INSERT INTO demo_inventory (location_id, name, description, format, annual_price_cents, estimated_impressions, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (location_id, name) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [locationIds[location], ...values]
      );
      inventoryIds[values[0]] = result.rows[0].id;
    }

    const contracts = [
      ['Peak Community Bank', 'Stadium Fence Partnership', '2026-08-01', '2027-07-31', 300000, 82, 'active'],
      ['Harbor Health Group', 'Welcome Center Display', '2026-09-01', '2027-08-31', 240000, 65, 'active'],
      ['Coastal Home Services', 'Inside Front Cover', '2026-01-01', '2026-12-31', 480000, 100, 'renewal']
    ];
    for (const row of contracts) {
      const [advertiser, placement, ...values] = row;
      await client.query(
        `INSERT INTO demo_contracts (advertiser_id, inventory_id, starts_on, ends_on, value_cents, fulfillment_percent, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (advertiser_id, inventory_id, starts_on) DO UPDATE SET fulfillment_percent = EXCLUDED.fulfillment_percent, status = EXCLUDED.status`,
        [advertiserIds[advertiser], inventoryIds[placement], ...values]
      );
    }

    const campaigns = [
      ['Peak Community Bank', 'Stadium Fence Partnership', 'Community Checking Offer', 'https://example.invalid/community-checking', '2026-08-01', '2027-07-31', 'active'],
      ['Harbor Health Group', 'Welcome Center Display', 'Same-Day Care', 'https://example.invalid/same-day-care', '2026-09-01', '2027-08-31', 'active'],
      ['Coastal Home Services', 'Inside Front Cover', 'Seasonal Maintenance', 'https://example.invalid/seasonal-maintenance', '2026-01-01', '2026-12-31', 'active']
    ];
    const campaignIds = {};
    for (const row of campaigns) {
      const [advertiser, placement, ...values] = row;
      const result = await client.query(
        `INSERT INTO demo_campaigns (advertiser_id, inventory_id, name, destination_url, starts_on, ends_on, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (advertiser_id, inventory_id, name) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [advertiserIds[advertiser], inventoryIds[placement], ...values]
      );
      campaignIds[values[0]] = result.rows[0].id;
    }

    const performance = [
      ['Community Checking Offer', '2026-10-01', 148, 91, 12, 420000],
      ['Community Checking Offer', '2026-10-08', 176, 110, 15, 525000],
      ['Same-Day Care', '2026-10-01', 92, 64, 9, 270000],
      ['Same-Day Care', '2026-10-08', 117, 79, 11, 330000],
      ['Seasonal Maintenance', '2026-10-01', 74, 51, 7, 210000],
      ['Seasonal Maintenance', '2026-10-08', 86, 58, 8, 240000]
    ];
    for (const row of performance) {
      const [campaign, ...values] = row;
      await client.query(
        `INSERT INTO demo_performance (campaign_id, recorded_on, scans, clicks, conversions, revenue_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (campaign_id, recorded_on) DO UPDATE SET scans = EXCLUDED.scans, clicks = EXCLUDED.clicks, conversions = EXCLUDED.conversions, revenue_cents = EXCLUDED.revenue_cents`,
        [campaignIds[campaign], ...values]
      );
    }
  }

  async function initialize(runtime, manifest) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [783912451]);
      await client.query(schema);
      const environment = await client.query('SELECT * FROM demo_environment WHERE id = 1');
      if (environment.rowCount) {
        const row = environment.rows[0];
        const mismatch = row.project_id !== runtime.projectId || row.environment_id !== runtime.environmentId || row.database_service_id !== runtime.databaseServiceId || row.tenant_slug !== runtime.tenantSlug;
        if (mismatch) throw new Error('Demo database identity does not match the approved runtime');
      } else {
        await client.query(
          'INSERT INTO demo_environment (id, project_id, environment_id, database_service_id, tenant_slug) VALUES (1, $1, $2, $3, $4)',
          [runtime.projectId, runtime.environmentId, runtime.databaseServiceId, runtime.tenantSlug]
        );
      }
      const organization = await client.query(
        `INSERT INTO demo_organizations (slug, name, organization_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [manifest.slug, 'Harbor Community Network', 'Community organization']
      );
      await seed(client, organization.rows[0].id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function health() {
    const result = await pool.query('SELECT project_id, environment_id, database_service_id, tenant_slug FROM demo_environment WHERE id = 1');
    return result.rows[0] || null;
  }

  async function organizationDashboard() {
    const [summary, locations, contracts] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM demo_inventory) AS placements,
        (SELECT COUNT(*)::int FROM demo_advertisers WHERE status IN ('active','renewal')) AS advertisers,
        (SELECT COALESCE(SUM(value_cents),0)::bigint FROM demo_contracts WHERE status IN ('active','renewal')) AS contract_value_cents,
        (SELECT COALESCE(SUM(scans),0)::bigint FROM demo_performance) AS scans,
        (SELECT COALESCE(SUM(conversions),0)::bigint FROM demo_performance) AS conversions,
        (SELECT COALESCE(SUM(revenue_cents),0)::bigint FROM demo_performance) AS revenue_cents`),
      pool.query(`SELECT l.name, l.location_type, l.audience,
        COUNT(i.id)::int AS placements,
        COUNT(i.id) FILTER (WHERE i.status = 'available')::int AS available
        FROM demo_locations l LEFT JOIN demo_inventory i ON i.location_id = l.id
        GROUP BY l.id ORDER BY l.id`),
      pool.query(`SELECT a.name AS advertiser, i.name AS placement, c.ends_on, c.value_cents, c.fulfillment_percent, c.status
        FROM demo_contracts c JOIN demo_advertisers a ON a.id = c.advertiser_id JOIN demo_inventory i ON i.id = c.inventory_id
        ORDER BY c.ends_on`)
    ]);
    const totals = summary.rows[0];
    return { totals: { ...totals, contractValue: money(totals.contract_value_cents), revenue: money(totals.revenue_cents) }, locations: locations.rows, contracts: contracts.rows.map(row => ({ ...row, value: money(row.value_cents) })) };
  }

  async function marketplace() {
    const result = await pool.query(`SELECT i.id, i.name, i.description, i.format, i.annual_price_cents, i.estimated_impressions, i.status,
      l.name AS location, l.location_type
      FROM demo_inventory i JOIN demo_locations l ON l.id = i.location_id ORDER BY l.id, i.id`);
    return result.rows.map(row => ({ ...row, annualPrice: money(row.annual_price_cents) }));
  }

  async function advertiserDashboard() {
    const result = await pool.query(`SELECT a.name AS advertiser, a.category, c.name AS campaign, i.name AS placement,
      COALESCE(SUM(p.scans),0)::int AS scans, COALESCE(SUM(p.clicks),0)::int AS clicks,
      COALESCE(SUM(p.conversions),0)::int AS conversions, COALESCE(SUM(p.revenue_cents),0)::bigint AS revenue_cents,
      ct.value_cents AS investment_cents
      FROM demo_campaigns c JOIN demo_advertisers a ON a.id = c.advertiser_id
      JOIN demo_inventory i ON i.id = c.inventory_id
      LEFT JOIN demo_performance p ON p.campaign_id = c.id
      LEFT JOIN demo_contracts ct ON ct.advertiser_id = c.advertiser_id AND ct.inventory_id = c.inventory_id
      GROUP BY a.id, c.id, i.id, ct.value_cents ORDER BY a.id`);
    return result.rows.map(row => {
      const revenue = money(row.revenue_cents);
      const investment = money(row.investment_cents);
      return { ...row, revenue, investment, roi: investment ? Math.round(((revenue - investment) / investment) * 100) : 0 };
    });
  }

  async function createRequest(input) {
    await pool.query(
      `INSERT INTO demo_requests (inventory_id, advertiser_name, contact_name, contact_email)
       SELECT id, $2, $3, $4 FROM demo_inventory WHERE id = $1 AND status = 'available'`,
      [input.inventoryId, input.advertiserName, input.contactName, input.contactEmail]
    );
  }

  return { advertiserDashboard, createRequest, health, initialize, marketplace, organizationDashboard, pool };
}

module.exports = { createDatabase, money };
