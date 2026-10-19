'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildProspectPackage } = require('./prospect-package');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function money(cents) {
  return Number(cents || 0) / 100;
}

function priceCents(value) {
  const match = String(value || '').match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? Math.round(Number(match[1].replaceAll(',', '')) * 100) : 0;
}

function createDatabase(connectionString) {
  const { Pool } = require('pg');
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
      ['Peak Community Bank', 'Financial Services', 'active', 'Jordan Lee'],
      ['Harbor Health Group', 'Healthcare', 'active', 'Morgan Ellis'],
      ['Coastal Home Services', 'Home Services', 'renewal', 'Jordan Lee']
    ];
    const advertiserIds = {};
    for (const row of advertisers) {
      const result = await client.query(
        `INSERT INTO demo_advertisers (organization_id, name, category, status, sales_rep)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, name) DO UPDATE SET status = EXCLUDED.status, sales_rep = EXCLUDED.sales_rep
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
      const trackingCode = `VVD-HCN-${String(result.rows[0].id).padStart(3, '0')}`;
      const destination = `https://example.invalid/${String(values[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
      await client.query('UPDATE demo_inventory SET tracking_code=$1, destination_url=$2 WHERE id=$3', [trackingCode, destination, result.rows[0].id]);
    }

    const contracts = [
      ['Peak Community Bank', 'Stadium Fence Partnership', '2026-08-01', '2027-07-31', 300000, 82, 'active', 'Confirm winter creative', 'Jordan Lee'],
      ['Harbor Health Group', 'Welcome Center Display', '2026-09-01', '2027-08-31', 240000, 65, 'active', 'Review benefit fulfillment', 'Morgan Ellis'],
      ['Coastal Home Services', 'Inside Front Cover', '2026-01-01', '2026-12-31', 480000, 100, 'renewal', 'Send renewal proposal', 'Jordan Lee']
    ];
    const contractIds = {};
    for (const row of contracts) {
      const [advertiser, placement, ...values] = row;
      const result = await client.query(
        `INSERT INTO demo_contracts (advertiser_id, inventory_id, starts_on, ends_on, value_cents, fulfillment_percent, status, next_action, renewal_owner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (advertiser_id, inventory_id, starts_on) DO UPDATE SET fulfillment_percent = EXCLUDED.fulfillment_percent, status = EXCLUDED.status, next_action = EXCLUDED.next_action, renewal_owner = EXCLUDED.renewal_owner
         RETURNING id`,
        [advertiserIds[advertiser], inventoryIds[placement], ...values]
      );
      contractIds[advertiser] = result.rows[0].id;
    }

    const benefits = [
      ['Peak Community Bank', 'Year-round stadium fence placement', '2026-08-01', 'fulfilled', 'Installed and photographed'],
      ['Peak Community Bank', 'Two campaign creative changes', '2027-01-15', 'scheduled', 'Winter creative review'],
      ['Harbor Health Group', 'Welcome Center display rotation', '2026-09-01', 'fulfilled', 'Initial creative live'],
      ['Harbor Health Group', 'Quarterly performance review', '2026-12-15', 'in_progress', 'First report being prepared'],
      ['Coastal Home Services', 'Four magazine issue placements', '2026-10-01', 'fulfilled', 'All issues delivered'],
      ['Coastal Home Services', 'Renewal performance summary', '2026-11-15', 'in_progress', 'Results ready for proposal']
    ];
    for (const [advertiser, benefit, dueOn, benefitStatus, notes] of benefits) {
      await client.query(`INSERT INTO demo_contract_benefits (contract_id, benefit, due_on, status, notes)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (contract_id, benefit) DO UPDATE SET due_on=EXCLUDED.due_on, status=EXCLUDED.status, notes=EXCLUDED.notes`,
      [contractIds[advertiser], benefit, dueOn, benefitStatus, notes]);
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
    const [summary, locationRows, contractRows, requestRows] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM demo_inventory) AS placements,
        (SELECT COUNT(*)::int FROM demo_advertisers WHERE status IN ('active','renewal')) AS advertisers,
        (SELECT COALESCE(SUM(value_cents),0)::bigint FROM demo_contracts WHERE status IN ('active','renewal')) AS contract_value_cents,
        (SELECT COALESCE(SUM(scans),0)::bigint FROM demo_performance) AS scans,
        (SELECT COALESCE(SUM(conversions),0)::bigint FROM demo_performance) AS conversions,
        (SELECT COALESCE(SUM(revenue_cents),0)::bigint FROM demo_performance) AS revenue_cents`),
      locations(),
      contracts(),
      requests()
    ]);
    const totals = summary.rows[0];
    return {
      totals: { ...totals, contractValue: money(totals.contract_value_cents), revenue: money(totals.revenue_cents) },
      locations: locationRows,
      contracts: contractRows,
      requests: requestRows
    };
  }

  async function marketplace() {
    const result = await pool.query(`SELECT i.id, i.name, i.description, i.format, i.annual_price_cents, i.estimated_impressions, i.status, i.tracking_code, i.destination_url,
      i.source_url, i.image_url, i.responsible_rep, i.display_price, i.prospect_import_id,
      l.name AS location, l.location_type
      FROM demo_inventory i JOIN demo_locations l ON l.id = i.location_id ORDER BY l.id, i.id`);
    return result.rows.map(row => ({ ...row, annualPrice: money(row.annual_price_cents) }));
  }

  async function inventory() {
    const result = await pool.query(`SELECT i.id, i.name, i.description, i.format, i.annual_price_cents, i.estimated_impressions, i.status,
      i.source_url, i.image_url, i.responsible_rep, i.display_price, i.prospect_import_id, i.tracking_code, i.destination_url,
      l.id AS location_id, l.name AS location, l.location_type,
      a.id AS advertiser_id, a.name AS advertiser, a.sales_rep
      FROM demo_inventory i JOIN demo_locations l ON l.id = i.location_id
      LEFT JOIN demo_contracts ct ON ct.inventory_id = i.id AND ct.status IN ('active','renewal')
      LEFT JOIN demo_advertisers a ON a.id = ct.advertiser_id
      ORDER BY l.id, i.id`);
    return result.rows.map(row => ({ ...row, annualPrice: money(row.annual_price_cents) }));
  }

  async function locations() {
    const result = await pool.query(`SELECT l.id, l.name, l.location_type, l.audience,
      COUNT(DISTINCT i.id)::int AS placements,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status='available')::int AS available,
      COALESCE(SUM(DISTINCT ct.value_cents),0)::bigint AS contract_value_cents,
      COALESCE(SUM(p.scans),0)::int AS scans,
      COALESCE(SUM(p.conversions),0)::int AS conversions,
      COALESCE(SUM(p.revenue_cents),0)::bigint AS revenue_cents
      FROM demo_locations l
      LEFT JOIN demo_inventory i ON i.location_id=l.id
      LEFT JOIN demo_contracts ct ON ct.inventory_id=i.id AND ct.status IN ('active','renewal')
      LEFT JOIN demo_campaigns c ON c.inventory_id=i.id
      LEFT JOIN demo_performance p ON p.campaign_id=c.id
      GROUP BY l.id ORDER BY l.id`);
    return result.rows.map(row => ({...row, contractValue: money(row.contract_value_cents), revenue: money(row.revenue_cents)}));
  }

  async function locationDetail(id) {
    const location = (await pool.query('SELECT * FROM demo_locations WHERE id=$1', [id])).rows[0];
    if (!location) return null;
    const items = (await inventory()).filter(row => Number(row.location_id) === Number(id));
    return { location, items };
  }

  async function placementDetail(id) {
    const placement = (await pool.query(`SELECT i.*, l.name AS location, l.location_type, l.audience
      FROM demo_inventory i JOIN demo_locations l ON l.id=i.location_id WHERE i.id=$1`, [id])).rows[0];
    if (!placement) return null;
    const [contractRows, campaignRows] = await Promise.all([
      pool.query(`SELECT ct.id, ct.starts_on, ct.ends_on, ct.value_cents, ct.fulfillment_percent, ct.status,
        a.id AS advertiser_id, a.name AS advertiser, a.sales_rep
        FROM demo_contracts ct JOIN demo_advertisers a ON a.id=ct.advertiser_id WHERE ct.inventory_id=$1`, [id]),
      pool.query(`SELECT c.id, c.name, c.destination_url, c.starts_on, c.ends_on, c.status, a.name AS advertiser,
        COALESCE(SUM(p.scans),0)::int AS scans, COALESCE(SUM(p.clicks),0)::int AS clicks,
        COALESCE(SUM(p.conversions),0)::int AS conversions, COALESCE(SUM(p.revenue_cents),0)::bigint AS revenue_cents
        FROM demo_campaigns c JOIN demo_advertisers a ON a.id=c.advertiser_id
        LEFT JOIN demo_performance p ON p.campaign_id=c.id WHERE c.inventory_id=$1 GROUP BY c.id,a.id ORDER BY c.id`, [id])
    ]);
    return { placement: {...placement, annualPrice: money(placement.annual_price_cents)}, contracts: contractRows.rows.map(x=>({...x,value:money(x.value_cents)})), campaigns: campaignRows.rows.map(x=>({...x,revenue:money(x.revenue_cents)})) };
  }

  async function campaignDetail(id) {
    const campaign = (await pool.query(`SELECT c.*, a.id AS advertiser_id, a.name AS advertiser, i.id AS inventory_id, i.name AS placement,
      i.tracking_code, l.id AS location_id, l.name AS location
      FROM demo_campaigns c JOIN demo_advertisers a ON a.id=c.advertiser_id
      JOIN demo_inventory i ON i.id=c.inventory_id JOIN demo_locations l ON l.id=i.location_id WHERE c.id=$1`, [id])).rows[0];
    if (!campaign) return null;
    const performance = (await pool.query('SELECT recorded_on, scans, clicks, conversions, revenue_cents FROM demo_performance WHERE campaign_id=$1 ORDER BY recorded_on', [id])).rows.map(x=>({...x,revenue:money(x.revenue_cents)}));
    return { campaign, performance };
  }

  async function advertisers() {
    const result = await pool.query(`SELECT a.id, a.name, a.category, a.status, a.sales_rep,
      COUNT(DISTINCT c.id)::int AS campaigns,
      COUNT(DISTINCT ct.id)::int AS contracts,
      COALESCE(SUM(DISTINCT ct.value_cents),0)::bigint AS investment_cents,
      COALESCE(SUM(p.scans),0)::int AS scans,
      COALESCE(SUM(p.clicks),0)::int AS clicks,
      COALESCE(SUM(p.conversions),0)::int AS conversions,
      COALESCE(SUM(p.revenue_cents),0)::bigint AS revenue_cents
      FROM demo_advertisers a
      LEFT JOIN demo_campaigns c ON c.advertiser_id=a.id
      LEFT JOIN demo_performance p ON p.campaign_id=c.id
      LEFT JOIN demo_contracts ct ON ct.advertiser_id=a.id
      GROUP BY a.id ORDER BY a.id`);
    return result.rows.map(row => ({...row, investment: money(row.investment_cents), revenue: money(row.revenue_cents)}));
  }

  async function advertiserDetail(id) {
    const advertiser = (await advertisers()).find(row => Number(row.id) === Number(id));
    if (!advertiser) return null;
    const campaigns = await advertiserDashboard(id);
    return { advertiser, campaigns };
  }

  async function requests() {
    return (await pool.query(`SELECT r.id, r.advertiser_name, r.contact_name, r.contact_email, r.status, r.created_at,
      i.name AS placement, i.annual_price_cents, l.name AS location
      FROM demo_requests r JOIN demo_inventory i ON i.id=r.inventory_id JOIN demo_locations l ON l.id=i.location_id
      ORDER BY r.created_at DESC, r.id DESC`)).rows.map(row => ({...row, price: money(row.annual_price_cents)}));
  }

  async function contracts() {
    return (await pool.query(`SELECT ct.id, ct.starts_on, ct.ends_on, ct.value_cents, ct.fulfillment_percent, ct.status, ct.next_action, ct.renewal_owner,
      a.id AS advertiser_id, a.name AS advertiser, a.sales_rep, i.id AS inventory_id, i.name AS placement, l.id AS location_id, l.name AS location
      FROM demo_contracts ct JOIN demo_advertisers a ON a.id=ct.advertiser_id
      JOIN demo_inventory i ON i.id=ct.inventory_id JOIN demo_locations l ON l.id=i.location_id
      ORDER BY ct.ends_on`)).rows.map(row => ({...row, value: money(row.value_cents)}));
  }

  async function contractDetail(id) {
    const contract = (await contracts()).find(row => Number(row.id) === Number(id));
    if (!contract) return null;
    const benefits = (await pool.query('SELECT * FROM demo_contract_benefits WHERE contract_id=$1 ORDER BY due_on,id', [id])).rows;
    return { contract, benefits };
  }

  async function revenuePipeline() {
    const [items, requestRows, contractRows] = await Promise.all([inventory(), requests(), contracts()]);
    return { items, requests: requestRows, contracts: contractRows };
  }

  async function advertiserDashboard(advertiserId = null, fromDate = null, toDate = null) {
    const result = await pool.query(`SELECT a.id AS advertiser_id, a.name AS advertiser, a.category, c.id AS campaign_id, c.name AS campaign, c.destination_url, c.starts_on, c.ends_on, c.status, i.id AS inventory_id, i.name AS placement, l.name AS location,
      COALESCE(SUM(p.scans),0)::int AS scans, COALESCE(SUM(p.clicks),0)::int AS clicks,
      COALESCE(SUM(p.conversions),0)::int AS conversions, COALESCE(SUM(p.revenue_cents),0)::bigint AS revenue_cents,
      ct.value_cents AS investment_cents
      FROM demo_campaigns c JOIN demo_advertisers a ON a.id = c.advertiser_id
      JOIN demo_inventory i ON i.id = c.inventory_id JOIN demo_locations l ON l.id=i.location_id
      LEFT JOIN demo_performance p ON p.campaign_id = c.id
        AND ($2::date IS NULL OR p.recorded_on >= $2)
        AND ($3::date IS NULL OR p.recorded_on <= $3)
      LEFT JOIN demo_contracts ct ON ct.advertiser_id = c.advertiser_id AND ct.inventory_id = c.inventory_id
      WHERE ($1::bigint IS NULL OR a.id=$1)
      GROUP BY a.id, c.id, i.id, l.id, ct.value_cents ORDER BY a.id`, [advertiserId, fromDate, toDate]);
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

  async function updateRequestStatus(id, status) {
    const result = await pool.query(`UPDATE demo_requests SET status=$2 WHERE id=$1 AND status='pending' RETURNING id`, [id, status]);
    return result.rowCount === 1;
  }

  async function createProspectImport(analysis) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const organization = await client.query('SELECT id FROM demo_organizations ORDER BY id LIMIT 1');
      if (!organization.rowCount) throw new Error('The canonical demo organization is not initialized.');
      const created = await client.query(
        `INSERT INTO demo_prospect_imports
          (organization_id, source_url, website_title, website_description, brand_name, logo_url)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [organization.rows[0].id, analysis.sourceUrl, analysis.title, analysis.description || '', analysis.title, analysis.images[0] || '']
      );
      const importId = created.rows[0].id;
      for (const [index, item] of analysis.opportunities.entries()) {
        await client.query(
          `INSERT INTO demo_prospect_drafts
            (import_id, title, description, category, price_text, source_url, image_url, responsible_rep)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (import_id, title) DO NOTHING`,
          [importId, item.title, `Draft opportunity discovered from ${item.sourceUrl}. Review the title, offer, audience, price and fulfillment details before publishing.`, item.category, item.price, item.sourceUrl, analysis.images[index] || analysis.images[0] || '', 'Demo Sales Rep']
        );
      }
      await client.query('COMMIT');
      return importId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function prospectImports() {
    return (await pool.query(`SELECT p.*,
      COUNT(d.id)::int AS draft_count,
      COUNT(d.id) FILTER (WHERE d.review_status='approved')::int AS approved_count,
      COUNT(d.id) FILTER (WHERE d.review_status='published')::int AS published_count
      FROM demo_prospect_imports p LEFT JOIN demo_prospect_drafts d ON d.import_id=p.id
      GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC LIMIT 20`)).rows;
  }

  async function prospectImport(id) {
    const prospect = (await pool.query('SELECT * FROM demo_prospect_imports WHERE id=$1 AND is_sample=TRUE', [id])).rows[0];
    if (!prospect) return null;
    const drafts = (await pool.query('SELECT * FROM demo_prospect_drafts WHERE import_id=$1 AND is_sample=TRUE ORDER BY id', [id])).rows;
    return { prospect, drafts };
  }

  async function prospectPackages(importId) {
    return (await pool.query(`SELECT id, import_id, version, slug, manifest_sha256, status, external_effects_enabled, created_at
      FROM demo_provision_packages WHERE import_id=$1 AND is_sample=TRUE ORDER BY version DESC`, [importId])).rows;
  }

  async function prospectPackage(importId, packageId) {
    return (await pool.query(`SELECT * FROM demo_provision_packages
      WHERE id=$1 AND import_id=$2 AND is_sample=TRUE`, [packageId, importId])).rows[0] || null;
  }

  async function createProspectPackage(importId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const prospect = (await client.query(`SELECT * FROM demo_prospect_imports
        WHERE id=$1 AND is_sample=TRUE FOR UPDATE`, [importId])).rows[0];
      if (!prospect) throw new Error('Prospect import not found.');
      const drafts = (await client.query(`SELECT * FROM demo_prospect_drafts
        WHERE import_id=$1 AND is_sample=TRUE ORDER BY id`, [importId])).rows;
      const bundle = buildProspectPackage({ prospect, drafts });
      const version = Number((await client.query(`SELECT COALESCE(MAX(version),0)+1 AS version
        FROM demo_provision_packages WHERE import_id=$1`, [importId])).rows[0].version);
      const inserted = (await client.query(`INSERT INTO demo_provision_packages
        (import_id, version, slug, manifest, clone_plan, manifest_sha256)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING *`, [
        importId, version, bundle.manifest.slug, JSON.stringify(bundle.manifest), JSON.stringify(bundle.clonePlan), bundle.manifestChecksum
      ])).rows[0];
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function updateProspectBrand(id, input) {
    const color = /^#[0-9a-f]{6}$/i.test(input.primaryColor) ? input.primaryColor : '#176b3a';
    const result = await pool.query(`UPDATE demo_prospect_imports SET brand_name=$2, primary_color=$3, logo_url=$4
      WHERE id=$1 AND is_sample=TRUE RETURNING id`, [id, input.brandName.slice(0, 140), color, input.logoUrl.slice(0, 1000)]);
    return result.rowCount === 1;
  }

  async function updateProspectDraft(id, input) {
    const result = await pool.query(`UPDATE demo_prospect_drafts SET title=$2, description=$3, category=$4,
      price_text=$5, source_url=$6, image_url=$7, responsible_rep=$8,
      review_status=CASE WHEN review_status='published' THEN review_status ELSE 'draft' END
      WHERE id=$1 AND is_sample=TRUE RETURNING import_id`, [
      id, input.title.slice(0, 140), input.description.slice(0, 1000), input.category.slice(0, 80), input.priceText.slice(0, 100),
      input.sourceUrl.slice(0, 1000), input.imageUrl.slice(0, 1000), input.responsibleRep.slice(0, 100)
    ]);
    return result.rows[0]?.import_id || null;
  }

  async function setProspectDraftStatus(id, reviewStatus) {
    if (!['approved', 'rejected'].includes(reviewStatus)) return null;
    const result = await pool.query(`UPDATE demo_prospect_drafts SET review_status=$2
      WHERE id=$1 AND is_sample=TRUE AND review_status<>'published' RETURNING import_id`, [id, reviewStatus]);
    if (!result.rowCount) return null;
    await pool.query(`UPDATE demo_prospect_imports SET status='reviewed' WHERE id=$1 AND status<>'published'`, [result.rows[0].import_id]);
    return result.rows[0].import_id;
  }

  async function publishProspectImport(id, locationId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const location = await client.query(`SELECT l.id FROM demo_locations l JOIN demo_prospect_imports p ON p.organization_id=l.organization_id
        WHERE p.id=$1 AND l.id=$2 AND p.is_sample=TRUE LIMIT 1`, [id, locationId]);
      if (!location.rowCount) throw new Error('Choose a valid canonical demo location.');
      const drafts = await client.query(`SELECT d.*, p.brand_name FROM demo_prospect_drafts d
        JOIN demo_prospect_imports p ON p.id=d.import_id
        WHERE d.import_id=$1 AND d.review_status='approved' AND d.is_sample=TRUE ORDER BY d.id FOR UPDATE OF d`, [id]);
      if (!drafts.rowCount) throw new Error('Approve at least one draft before publishing.');
      for (const draft of drafts.rows) {
        const conflict = await client.query('SELECT 1 FROM demo_inventory WHERE location_id=$1 AND name=$2 LIMIT 1', [locationId, draft.title]);
        const publishedName = conflict.rowCount ? `${draft.title} — ${draft.brand_name} #${id}`.slice(0, 180) : draft.title;
        const inserted = await client.query(`INSERT INTO demo_inventory
          (location_id, name, description, format, annual_price_cents, estimated_impressions, status, destination_url, source_url, image_url, responsible_rep, display_price, prospect_import_id)
          VALUES ($1,$2,$3,$4,$5,0,'available',$6,$6,$7,$8,$9,$10)
          RETURNING id`, [locationId, publishedName, draft.description, draft.category, priceCents(draft.price_text), draft.source_url, draft.image_url, draft.responsible_rep, draft.price_text, id]);
        const inventoryId = inserted.rows[0].id;
        await client.query('UPDATE demo_inventory SET tracking_code=$2 WHERE id=$1', [inventoryId, `VVD-IMPORT-${id}-${inventoryId}`]);
        await client.query(`UPDATE demo_prospect_drafts SET review_status='published', inventory_id=$2 WHERE id=$1`, [draft.id, inventoryId]);
      }
      await client.query(`UPDATE demo_prospect_imports SET status='published', published_at=NOW() WHERE id=$1`, [id]);
      await client.query('COMMIT');
      return drafts.rowCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function resetProspectImport(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM demo_inventory WHERE prospect_import_id=$1 AND is_sample=TRUE', [id]);
      await client.query(`UPDATE demo_prospect_drafts SET review_status='approved', inventory_id=NULL
        WHERE import_id=$1 AND review_status='published' AND is_sample=TRUE`, [id]);
      await client.query(`UPDATE demo_prospect_imports SET status='reviewed', published_at=NULL WHERE id=$1 AND is_sample=TRUE`, [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { advertiserDashboard, advertiserDetail, advertisers, campaignDetail, contractDetail, contracts, createProspectImport, createProspectPackage, createRequest, health, initialize, inventory, locationDetail, locations, marketplace, organizationDashboard, placementDetail, pool, prospectImport, prospectImports, prospectPackage, prospectPackages, publishProspectImport, requests, resetProspectImport, revenuePipeline, setProspectDraftStatus, updateProspectBrand, updateProspectDraft, updateRequestStatus };
}

module.exports = { createDatabase, money, priceCents };
