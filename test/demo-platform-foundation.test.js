'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const canonical = require('../demo-platform/templates/canonical.json');
const protectedResources = require('../demo-platform/protected-resources.json');
const { assertManifest, validateManifest } = require('../demo-platform/manifest');
const { createClonePlan } = require('../demo-platform/clone-plan');
const { assertIsolatedRuntime, databaseFingerprint } = require('../demo-platform/runtime-guard');
const { auditStartCommand } = require('../demo-platform/startup-audit');
const { auditChangedPaths } = require('../demo-platform/protected-change-audit');
const { discoverOpportunities, isBlockedAddress } = require('../demo-platform/prospect-scraper');
const mirrorViews = require('../demo-platform/mirror-views');
const packageJson = require('../package.json');

const isolatedProject = 'e02ba0e0-4faf-41eb-a81d-d53b94ee1019';
const isolatedEnvironment = '247466bb-3b21-4f93-bb85-2e04babbe88b';
const isolatedDatabaseService = '93db3daf-731d-43bf-8990-18d385ae0b09';
const databaseUrl = 'postgresql://demo:secret@demo.internal:5432/canonical_demo';
function safeEnvironment(overrides = {}) {
  return {
    DEMO_PLATFORM_ISOLATED: '1',
    DEMO_ENVIRONMENT_KIND: 'demo',
    DEMO_PROJECT_ID: isolatedProject,
    RAILWAY_PROJECT_ID: isolatedProject,
    RAILWAY_ENVIRONMENT_ID: isolatedEnvironment,
    DEMO_DATABASE_SERVICE_ID: isolatedDatabaseService,
    DEMO_TENANT_SLUG: canonical.slug,
    DEMO_REVIEW_TOKEN: 'review-token-with-more-than-24-characters',
    DEMO_REVIEW_CODE: 'VIVID-TEST-ACCESS',
    SESSION_SECRET: 'session-secret-with-more-than-32-characters-total',
    DATABASE_URL: databaseUrl,
    DEMO_DATABASE_FINGERPRINT: databaseFingerprint(databaseUrl),
    ...overrides
  };
}

test('canonical manifest requires organization, marketplace and advertiser portals', () => {
  assert.equal(assertManifest(canonical), canonical);
  for (const portal of ['organization', 'marketplace', 'advertiser']) {
    const changed = structuredClone(canonical);
    delete changed.portals[portal];
    assert.match(validateManifest(changed).join('\n'), new RegExp(`portals\\.${portal}`));
  }
});

test('clone plan contains all three connected demo surfaces and no external effects', () => {
  const plan = createClonePlan(canonical);
  assert.deepEqual(Object.keys(plan.portals), ['organization', 'marketplace', 'advertiser']);
  assert.equal(plan.externalEffectsEnabled, false);
  assert.ok(plan.disabledCapabilities.includes('email'));
  assert.ok(plan.disabledCapabilities.includes('payments'));
});

test('runtime guard accepts only the approved isolated project and database', () => {
  const state = assertIsolatedRuntime(safeEnvironment(), canonical);
  assert.equal(state.projectId, isolatedProject);
  assert.equal(state.externalEffectsEnabled, false);
  assert.throws(
    () => assertIsolatedRuntime(safeEnvironment({ RAILWAY_PROJECT_ID: Object.keys(protectedResources.railwayProjects)[0], DEMO_PROJECT_ID: Object.keys(protectedResources.railwayProjects)[0] }), canonical),
    /project is protected/
  );
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ DEMO_DATABASE_FINGERPRINT: 'wrong' }), canonical), /approved demo database fingerprint/);
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ RAILWAY_ENVIRONMENT_ID: 'wrong' }), canonical), /approved demo environment/);
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ DEMO_DATABASE_SERVICE_ID: 'wrong' }), canonical), /approved isolated database/);
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ RAILWAY_PROJECT_ID: '11111111-2222-4333-8444-555555555555', DEMO_PROJECT_ID: '11111111-2222-4333-8444-555555555555' }), canonical), /not registered/);
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ RESEND_API_KEY: 'must-not-be-here' }), canonical), /RESEND_API_KEY/);
  assert.throws(() => assertIsolatedRuntime(safeEnvironment({ DEMO_REVIEW_CODE: 'short' }), canonical), /DEMO_REVIEW_CODE/);
});

test('runtime guard accepts only a private Railway database reference in the approved project', () => {
  const environment = safeEnvironment({
    DATABASE_URL: 'postgresql://postgres:secret@Postgres.railway.internal:5432/canonical_demo',
    DEMO_DATABASE_FINGERPRINT: '',
    DEMO_DATABASE_REFERENCE_MODE: 'railway-service',
    DEMO_DATABASE_NAME: 'canonical_demo'
  });
  assert.equal(assertIsolatedRuntime(environment, canonical).databaseServiceId, isolatedDatabaseService);
  assert.throws(
    () => assertIsolatedRuntime({ ...environment, DATABASE_URL: 'postgresql://postgres:secret@production.example.com:5432/canonical_demo' }, canonical),
    /private internal networking/
  );
  assert.throws(
    () => assertIsolatedRuntime({ ...environment, DATABASE_URL: 'postgresql://postgres:secret@Postgres.railway.internal:5432/production' }, canonical),
    /DEMO_DATABASE_NAME/
  );
});

test('protected active demos are registered explicitly', () => {
  assert.deepEqual(Object.keys(protectedResources.protectedTenants).sort(), ['ccps', 'hfhs', 'rubber-world']);
  assert.deepEqual(Object.values(protectedResources.protectedTenants).map(value => value.organizationId).sort((a, b) => a - b), [13, 39, 40]);
});

test('protected-demo audit rejects changes to active opportunity files', () => {
  assert.equal(auditChangedPaths(['demo-platform/server.js', 'package.json']).safe, true);
  const result = auditChangedPaths(['seed-hfhs-enterprise.js', 'polish-rubber-world-demo.js', 'install-ccps-marketplace-opportunities.js']);
  assert.equal(result.safe, false);
  assert.equal(result.protectedPaths.length, 3);
});

test('audit detects current customer-specific and mutating production startup steps', () => {
  const result = auditStartCommand(packageJson.scripts.start);
  assert.equal(result.safeForCanonicalDemo, false);
  assert.ok(result.customerSpecific.some(file => file.includes('hfhs')));
  assert.ok(result.customerSpecific.some(file => file.includes('rubber-world')));
  assert.ok(result.customerSpecific.some(file => file.includes('ccps')));
  assert.ok(result.mutating.some(file => file.startsWith('seed-')));
});

test('canonical schema is sample-only and binds itself to one demo environment', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'demo-platform', 'schema.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS demo_environment/);
  assert.match(sql, /CHECK \(id = 1\)/);
  assert.equal((sql.match(/CHECK \(is_sample = TRUE\)/g) || []).length, 9);
  assert.doesNotMatch(sql, /ccps|hfhs|rubber.world/i);
});

test('canonical mirror exposes the connected Vivid operating surfaces', () => {
  const html = mirrorViews.organizationOverview('/demo/canonical-vivid', {
    totals: { placements: 2, advertisers: 1, contractValue: 1000, scans: 10, conversions: 2, revenue: 500 },
    locations: [{ id: 1, name: 'Sample Location', location_type: 'Campus', audience: 100, placements: 2, available: 1, scans: 10, revenue: 500 }],
    contracts: [{ id: 1 }],
    requests: [{ status: 'pending' }]
  });
  for (const label of ['Locations', 'Advertisers', 'Advertising Inventory', 'Advertising Requests', 'Contracts', 'Renewals', 'Revenue Pipeline', 'Performance Insights', 'Reports', 'Sales Rep Report', 'Administration', 'Help']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /Advertiser Revenue Generated/);
  assert.match(html, /Open Location/);
});

test('canonical mirror includes source-of-truth placement, campaign and contract detail views', () => {
  const placement = mirrorViews.placementPage('/demo/canonical-vivid', {
    placement: { id: 4, name: 'Sample Placement', location: 'Main Campus', format: 'Signage', status: 'sold', annualPrice: 1000, estimated_impressions: 10000, tracking_code: 'VVD-HCN-004', destination_url: 'https://example.invalid/sample' },
    contracts: [{ id: 2, advertiser_id: 1, advertiser: 'Sample Advertiser', starts_on: '2026-01-01', ends_on: '2026-12-31', value: 1000, fulfillment_percent: 50, status: 'active' }],
    campaigns: [{ id: 3, name: 'Sample Campaign', advertiser: 'Sample Advertiser', starts_on: '2026-01-01', ends_on: '2026-12-31', scans: 10, clicks: 5, conversions: 2, revenue: 200 }]
  });
  assert.match(placement, /Dynamic Placement/);
  assert.match(placement, /organization\/contract\/2/);
  assert.match(placement, /organization\/campaign\/3/);

  const contract = mirrorViews.contractPage('/demo/canonical-vivid', {
    contract: { id: 2, advertiser_id: 1, advertiser: 'Sample Advertiser', location_id: 1, location: 'Main Campus', inventory_id: 4, placement: 'Sample Placement', starts_on: '2026-01-01', ends_on: '2026-12-31', value: 1000, fulfillment_percent: 50, status: 'active', renewal_owner: 'Jordan Lee', next_action: 'Review results', sales_rep: 'Jordan Lee' },
    benefits: [{ benefit: 'Placement', notes: 'Installed', due_on: '2026-01-01', status: 'fulfilled' }]
  });
  assert.match(contract, /Contract Hierarchy/);
  assert.match(contract, /Benefit Fulfillment/);
});

test('advertiser mirror uses the current Vivid Core navigation hierarchy', () => {
  const html = mirrorViews.advertiserSetupPage('/demo/canonical-vivid', [{ id: 1, name: 'Sample Advertiser' }], { id: 1, name: 'Sample Advertiser' }, [{
    campaign_id: 1, campaign: 'Sample Campaign', inventory_id: 1, placement: 'Sample Placement', location: 'Main Campus', destination_url: 'https://example.invalid', starts_on: '2026-01-01', ends_on: '2026-12-31', status: 'active'
  }]);
  for (const label of ['My Setup', 'Reports', 'Performance Insights', 'Archive Center', 'Export Center', 'Help']) assert.match(html, new RegExp(label));
  for (const buildingBlock of ['Locations', 'Placements &amp; QR Codes', 'Campaigns', 'Assignments', 'Schedule']) assert.match(html, new RegExp(buildingBlock));
});

test('prospect importer extracts reviewable sources without writing Marketplace data', () => {
  const html = '<title>Example Association</title><h2>Annual Conference Sponsorship</h2><a href="/advertise">Advertise with us</a><a href="/media-kit.pdf">2027 Media Kit</a><p>Packages start at $2,500 per event.</p>';
  const result = discoverOpportunities(html, new URL('https://example.org/'));
  assert.equal(result.discoveredLinks.length, 2);
  assert.ok(result.opportunities.some(item => /Advertise with us|Media Kit|Conference Sponsorship/.test(item.title)));
  assert.deepEqual(result.priceMatches, ['$2,500 per event']);
});

test('prospect importer blocks private network targets', () => {
  for (const address of ['127.0.0.1', '10.0.0.2', '172.16.0.4', '192.168.1.4', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.equal(isBlockedAddress(address), true);
  assert.equal(isBlockedAddress('8.8.8.8'), false);
});
