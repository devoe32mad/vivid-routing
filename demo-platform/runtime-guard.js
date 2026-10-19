'use strict';

const crypto = require('node:crypto');
const protectedResources = require('./protected-resources.json');

const FORBIDDEN_EXTERNAL_VARIABLES = [
  'RESEND_API_KEY',
  'SQUARE_PRODUCTION_APPLICATION_SECRET',
  'SQUARE_SANDBOX_APPLICATION_SECRET',
  'GOOGLE_ADS_CLIENT_SECRET',
  'LINKEDIN_ADS_CLIENT_SECRET',
  'META_ADS_APP_SECRET',
  'PINTEREST_ADS_CLIENT_SECRET',
  'REDDIT_ADS_CLIENT_SECRET'
];

function databaseFingerprint(connectionString) {
  const url = new URL(connectionString);
  const identity = `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function assertIsolatedRuntime(env, manifest) {
  const errors = [];
  const projectId = env.RAILWAY_PROJECT_ID;
  const expectedProjectId = env.DEMO_PROJECT_ID;

  if (env.DEMO_PLATFORM_ISOLATED !== '1') errors.push('DEMO_PLATFORM_ISOLATED must equal 1');
  if (env.DEMO_ENVIRONMENT_KIND !== 'demo') errors.push('DEMO_ENVIRONMENT_KIND must equal demo');
  if (!projectId) errors.push('RAILWAY_PROJECT_ID is required');
  if (!expectedProjectId) errors.push('DEMO_PROJECT_ID is required');
  if (projectId && expectedProjectId && projectId !== expectedProjectId) errors.push('DEMO_PROJECT_ID does not match RAILWAY_PROJECT_ID');
  if (projectId && protectedResources.railwayProjects[projectId]) {
    errors.push(`Railway project is protected: ${protectedResources.railwayProjects[projectId]}`);
  }
  if (projectId && !protectedResources.approvedDemoProjects[projectId]) {
    errors.push('Railway project is not registered as an approved isolated demo');
  }
  const approvedProject = projectId && protectedResources.approvedDemoProjects[projectId];
  if (approvedProject && env.RAILWAY_ENVIRONMENT_ID !== approvedProject.environmentId) {
    errors.push('RAILWAY_ENVIRONMENT_ID does not match the approved demo environment');
  }
  if (approvedProject && env.DEMO_DATABASE_SERVICE_ID !== approvedProject.databaseServiceId) {
    errors.push('DEMO_DATABASE_SERVICE_ID does not match the approved isolated database');
  }
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if (!env.DEMO_DATABASE_FINGERPRINT) errors.push('DEMO_DATABASE_FINGERPRINT is required');
  if (!env.DEMO_REVIEW_TOKEN || env.DEMO_REVIEW_TOKEN.length < 24) errors.push('DEMO_REVIEW_TOKEN must contain at least 24 characters');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET must contain at least 32 characters');
  if (!manifest || env.DEMO_TENANT_SLUG !== manifest.slug) errors.push('DEMO_TENANT_SLUG must match the manifest slug');

  if (env.DATABASE_URL && env.DEMO_DATABASE_FINGERPRINT) {
    try {
      const actual = databaseFingerprint(env.DATABASE_URL);
      if (actual !== env.DEMO_DATABASE_FINGERPRINT) errors.push('DATABASE_URL does not match the approved demo database fingerprint');
      if (env.PRODUCTION_DATABASE_FINGERPRINT && actual === env.PRODUCTION_DATABASE_FINGERPRINT) {
        errors.push('Demo database resolves to the protected production database');
      }
    } catch {
      errors.push('DATABASE_URL is not a valid PostgreSQL connection string');
    }
  }

  for (const name of FORBIDDEN_EXTERNAL_VARIABLES) {
    if (env[name]) errors.push(`${name} must not be present in an isolated demo`);
  }

  if (errors.length) throw new Error(`Unsafe demo runtime:\n- ${errors.join('\n- ')}`);
  return Object.freeze({
    projectId,
    environmentId: env.RAILWAY_ENVIRONMENT_ID,
    databaseServiceId: env.DEMO_DATABASE_SERVICE_ID,
    tenantSlug: manifest.slug,
    databaseFingerprint: env.DEMO_DATABASE_FINGERPRINT,
    externalEffectsEnabled: false
  });
}

module.exports = { FORBIDDEN_EXTERNAL_VARIABLES, assertIsolatedRuntime, databaseFingerprint };
