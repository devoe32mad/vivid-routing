'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertManifest } = require('./manifest');

function createClonePlan(manifest) {
  assertManifest(manifest);
  const slug = manifest.slug;
  return Object.freeze({
    version: 1,
    tenantSlug: slug,
    projectName: `vivid-demo-${slug}`,
    serviceName: `${slug}-demo`,
    databaseName: `${slug.replaceAll('-', '_')}_demo`,
    externalEffectsEnabled: false,
    sampleDataLabel: manifest.sampleData.label,
    portals: {
      organization: `/demo/${slug}/organization`,
      marketplace: `/demo/${slug}/marketplace`,
      advertiser: `/demo/${slug}/advertiser`
    },
    requiredEnvironment: [
      'DATABASE_URL',
      'DEMO_DATABASE_FINGERPRINT',
      'DEMO_DATABASE_SERVICE_ID',
      'DEMO_ENVIRONMENT_KIND',
      'DEMO_PLATFORM_ISOLATED',
      'DEMO_PROJECT_ID',
      'DEMO_REVIEW_TOKEN',
      'DEMO_TENANT_SLUG',
      'RAILWAY_PROJECT_ID',
      'RAILWAY_ENVIRONMENT_ID',
      'SESSION_SECRET'
    ],
    disabledCapabilities: ['email', 'billing', 'payments', 'oauth', 'live-connectors', 'production-admin'],
    modules: [...manifest.modules]
  });
}

if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node demo-platform/clone-plan.js <manifest.json>');
    process.exitCode = 2;
  } else {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
    process.stdout.write(`${JSON.stringify(createClonePlan(manifest), null, 2)}\n`);
  }
}

module.exports = { createClonePlan };
