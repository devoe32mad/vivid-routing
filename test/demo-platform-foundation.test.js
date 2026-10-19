'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const canonical = require('../demo-platform/templates/canonical.json');
const protectedResources = require('../demo-platform/protected-resources.json');
const { assertManifest, validateManifest } = require('../demo-platform/manifest');
const { createClonePlan } = require('../demo-platform/clone-plan');
const { assertIsolatedRuntime, databaseFingerprint } = require('../demo-platform/runtime-guard');
const { auditStartCommand } = require('../demo-platform/startup-audit');
const { auditChangedPaths } = require('../demo-platform/protected-change-audit');
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
