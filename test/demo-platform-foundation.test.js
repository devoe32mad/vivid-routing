'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const canonical = require('../demo-platform/templates/canonical.json');
const protectedResources = require('../demo-platform/protected-resources.json');
const { assertManifest, validateManifest } = require('../demo-platform/manifest');
const { createClonePlan } = require('../demo-platform/clone-plan');
const { buildProspectPackage, checksum, slugify } = require('../demo-platform/prospect-package');
const { safeReturnPath } = require('../demo-platform/review-access');
const { assertIsolatedRuntime, databaseFingerprint } = require('../demo-platform/runtime-guard');
const { auditStartCommand } = require('../demo-platform/startup-audit');
const { auditChangedPaths } = require('../demo-platform/protected-change-audit');
const { discoverContacts, discoverImages, discoverOpportunities, isBlockedAddress } = require('../demo-platform/prospect-scraper');
const { priceCents } = require('../demo-platform/database');
const mirrorViews = require('../demo-platform/mirror-views');
const prospectViews = require('../demo-platform/prospect-views');
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

test('private review login returns only to safe canonical demo pages', () => {
  const base = '/demo/canonical-vivid';
  const packagePath = `${base}/builder/import/1/package/1?created=1`;
  assert.equal(safeReturnPath(packagePath, base), packagePath);
  assert.equal(safeReturnPath('https://attacker.example/steal', base), `${base}/organization`);
  assert.equal(safeReturnPath('//attacker.example/steal', base), `${base}/organization`);
  assert.equal(safeReturnPath('/admin', base), `${base}/organization`);
  assert.equal(safeReturnPath(`${base}\\..\\admin`, base), `${base}/organization`);
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
  assert.equal((sql.match(/CHECK \(is_sample = TRUE\)/g) || []).length, 12);
  assert.match(sql, /demo_prospect_imports/);
  assert.match(sql, /demo_prospect_drafts/);
  assert.match(sql, /demo_provision_packages/);
  assert.match(sql, /external_effects_enabled = FALSE/);
  assert.match(sql, /prospect_import_id BIGINT REFERENCES demo_prospect_imports/);
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

test('prospect importer rejects tracking pixels and prioritizes reviewable artwork', () => {
  const html = '<meta property="og:image" content="/hero.jpg"><img src="https://px.ads.linkedin.com/collect?id=1" width="1" height="1"><img src="/sponsor.jpg" width="800" height="600"><img src="https://cdn.example.net/partner.png"><img src=""><img src="{{ data.sizes.full.url }}"><img data-lazy-src="/conference.webp">';
  const images = discoverImages(html, new URL('https://example.org/advertise'));
  assert.deepEqual(images, ['https://example.org/hero.jpg', 'https://example.org/sponsor.jpg', 'https://example.org/conference.webp', 'https://cdn.example.net/partner.png']);
  assert.ok(images.every(url => !url.includes('linkedin')));
  assert.ok(images.every(url => url !== 'https://example.org/advertise' && !/%7b|%7d/i.test(url)));
});

test('prospect importer carries public contacts into reviewable opportunity ownership', () => {
  const contacts = discoverContacts('<a href="mailto:partnerships@example.org">Taylor Morgan</a><a href="tel:+12395550100">Partnership Office</a>');
  assert.deepEqual(contacts[0], { name: 'Taylor Morgan', email: 'partnerships@example.org' });
  assert.deepEqual(contacts[1], { name: 'Partnership Office', phone: '+12395550100' });
});

test('prospect review mirrors edit, approval, publishing and reversible reset controls', () => {
  const html = mirrorViews.builderImportPage('/demo/canonical-vivid', {
    prospect: { id: 8, brand_name: 'Example Association', website_title: 'Example Association', website_description: 'Example description', source_url: 'https://example.org/', primary_color: '#176b3a', logo_url: '', status: 'reviewed' },
    drafts: [{ id: 9, title: 'Annual Sponsorship', description: 'Reviewed description', category: 'Sponsorship', price_text: '$2,500 per event', source_url: 'https://example.org/advertise', image_url: '', responsible_rep: 'Demo Sales Rep', review_status: 'approved', inventory_id: null }]
  }, [{ id: 1, name: 'Main Campus' }]);
  for (const label of ['Prospect branding', 'Approve', 'Reject', 'Publish 1 approved', 'Responsible rep', 'Reviewed manifest', 'Create isolated package']) assert.match(html, new RegExp(label));
  assert.match(html, /builder\/import\/8\/publish/);
  assert.match(html, /builder\/draft\/9/);
});

test('approved prospect data becomes an immutable three-portal isolated package', () => {
  const data = {
    prospect: { id: 8, brand_name: 'Example & Partners', website_title: 'Example', source_url: 'https://example.org/', primary_color: '#176b3a', logo_url: '' },
    drafts: [
      { title: 'Annual Sponsorship', description: 'Reviewed description', category: 'Sponsorship', price_text: '$2,500 per event', source_url: 'https://example.org/advertise', image_url: '', responsible_rep: 'Demo Sales Rep', review_status: 'approved' },
      { title: 'Rejected Idea', review_status: 'rejected' }
    ]
  };
  const bundle = buildProspectPackage(data);
  assert.equal(slugify(data.prospect.brand_name), 'example-partners');
  assert.equal(bundle.manifest.slug, 'example-partners-8');
  assert.equal(bundle.manifest.opportunities.length, 1);
  assert.deepEqual(Object.keys(bundle.manifest.portals), ['organization', 'marketplace', 'advertiser']);
  assert.equal(bundle.clonePlan.resourcePolicy.reuseExistingDatabase, false);
  assert.equal(bundle.clonePlan.resourcePolicy.protectedTenantAccess, false);
  assert.equal(bundle.clonePlan.externalEffectsEnabled, false);
  assert.equal(bundle.manifestChecksum, checksum(bundle.manifest));
  assert.equal(bundle.manifestChecksum.length, 64);
  assert.equal(bundle.manifest.branding.organizationName, 'Example & Partners');
  assert.equal(bundle.manifest.branding.publicWebsite, 'https://example.org/');
});

test('reviewed website data replaces generic content across prospect demo portals', () => {
  const data = {
    prospect: { id: 22, brand_name: 'Florida Association of Counties', website_title: 'Work With Counties', website_description: 'Connect with county leaders.', source_url: 'https://wwc.fl-counties.com/', primary_color: '#176b3a', logo_url: 'https://wwc.fl-counties.com/fac-logo.png' },
    drafts: [{ id: 31, title: 'Annual Conference Sponsorship', description: 'Reach county commissioners and administrators.', category: 'Event', price_text: '$2,500 per event', source_url: 'https://wwc.fl-counties.com/sponsors/', image_url: 'https://wwc.fl-counties.com/conference.jpg', responsible_rep: 'Corporate Relations', review_status: 'approved' }]
  };
  const organization = prospectViews.prospectOrganizationPage('/demo/canonical-vivid', data, 'inventory');
  const organizationReports = prospectViews.prospectOrganizationPage('/demo/canonical-vivid', data, 'reports');
  const marketplace = prospectViews.prospectMarketplacePage('/demo/canonical-vivid', data);
  const advertiser = prospectViews.prospectAdvertiserPage('/demo/canonical-vivid', data, 31);
  const advertiserExports = prospectViews.prospectAdvertiserPage('/demo/canonical-vivid', data, 31, 'exports');
  const onboarding = prospectViews.prospectOnboardingPage('/demo/canonical-vivid', data, 31);
  for (const html of [organization, marketplace, advertiser]) {
    assert.match(html, /Florida Association of Counties/);
    assert.match(html, /Annual Conference Sponsorship/);
    assert.match(html, /conference\.jpg/);
    assert.doesNotMatch(html, /Harbor Community Network/);
  }
  assert.match(organization, /Corporate Relations/);
  assert.match(organizationReports, /exports\/inventory\.csv/);
  assert.match(organizationReports, /exports\/executive\.pdf/);
  assert.match(organizationReports, /exports\/report\.xlsx/);
  assert.match(marketplace, /View Opportunity/);
  assert.match(marketplace, /Search opportunities/);
  assert.match(marketplace, /Program \/ format/);
  assert.match(advertiser, /Illustrative performance only/);
  for (const label of ['Overview', 'My Setup', 'Reports', 'Performance Insights', 'Archive Center', 'Export Center', 'Help']) assert.match(advertiser, new RegExp(label));
  assert.match(advertiserExports, /Campaign Performance/);
  assert.match(advertiserExports, /Executive Summary/);
  assert.match(advertiserExports, /Complete Workbook/);
  for (const label of ['Request', 'Approval', 'Advertiser setup', 'Campaign live']) assert.match(onboarding, new RegExp(label));
  assert.match(onboarding, /demo@example\.invalid/);
  assert.match(prospectViews.prospectOnboardingPage('/demo/canonical-vivid', data, 31, 'approval'), /No production action occurs/);
});

test('prospect Marketplace filters reviewed opportunities without changing source data', () => {
  const data = {
    prospect: { id: 22, brand_name: 'Example', website_title: 'Example', source_url: 'https://example.org/', primary_color: '#176b3a', logo_url: '' },
    drafts: [
      { id: 31, title: 'Conference Sponsorship', description: 'Event reach.', category: 'Event', price_text: '$2,500', source_url: 'https://example.org/event', image_url: '', responsible_rep: 'Events', review_status: 'approved' },
      { id: 32, title: 'Magazine Advertising', description: 'Print reach.', category: 'Publication', price_text: '$500', source_url: 'https://example.org/magazine', image_url: '', responsible_rep: 'Publishing', review_status: 'approved' }
    ]
  };
  const filtered = prospectViews.prospectMarketplacePage('/demo/canonical-vivid', data, { category: 'Publication', query: 'magazine' });
  assert.match(filtered, /Magazine Advertising/);
  assert.doesNotMatch(filtered, /Conference Sponsorship/);
  assert.match(filtered, /1<\/strong> matching opportunity/);
});

test('prospect package refuses unreviewed opportunities', () => {
  assert.throws(() => buildProspectPackage({
    prospect: { id: 2, brand_name: 'No Review', website_title: 'No Review', source_url: 'https://example.org/', primary_color: '#176b3a', logo_url: '' },
    drafts: [{ title: 'Draft', review_status: 'draft' }]
  }), /Approve at least one opportunity/);
});

test('package review shows isolation contract and all Vivid surfaces', () => {
  const bundle = buildProspectPackage({
    prospect: { id: 8, brand_name: 'Example', website_title: 'Example', source_url: 'https://example.org/', primary_color: '#176b3a', logo_url: '' },
    drafts: [{ title: 'Annual Sponsorship', description: 'Reviewed', category: 'Sponsorship', price_text: '$2,500', source_url: 'https://example.org/advertise', image_url: '', responsible_rep: 'Demo Rep', review_status: 'approved' }]
  });
  const html = mirrorViews.provisionPackagePage('/demo/canonical-vivid', { id: 3, import_id: 8, version: 1, status: 'ready', manifest_sha256: bundle.manifestChecksum, manifest: bundle.manifest, clone_plan: bundle.clonePlan }, true);
  for (const label of ['Isolation contract', 'New project', 'New database', 'Organization Platform', 'Opportunity Marketplace', 'Advertiser Platform', 'Operator verification']) assert.match(html, new RegExp(label));
  assert.match(html, /No infrastructure or external system was changed/);
});

test('public price references become annual-price cents without inventing prices', () => {
  assert.equal(priceCents('$2,500 per event'), 250000);
  assert.equal(priceCents('$185/month'), 18500);
  assert.equal(priceCents('Pricing requires review'), 0);
});
