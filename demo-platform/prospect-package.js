'use strict';

const crypto = require('node:crypto');
const canonical = require('./templates/canonical.json');
const { assertManifest } = require('./manifest');
const { createClonePlan } = require('./clone-plan');

function slugify(value) {
  return String(value || 'prospect')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'prospect';
}

function reviewedOpportunities(drafts) {
  return drafts
    .filter(item => ['approved', 'published'].includes(item.review_status))
    .map(item => ({
      title: item.title,
      description: item.description,
      category: item.category,
      displayPrice: item.price_text,
      sourceUrl: item.source_url,
      imageUrl: item.image_url,
      responsibleRep: item.responsible_rep
    }));
}

function buildProspectManifest(data) {
  const { prospect, drafts } = data;
  const opportunities = reviewedOpportunities(drafts);
  if (!opportunities.length) throw new Error('Approve at least one opportunity before creating an isolated demo package.');
  const manifest = {
    version: '1.0',
    slug: `${slugify(prospect.brand_name)}-${prospect.id}`,
    name: `${prospect.brand_name} Vivid Demonstration`,
    customerType: 'organization',
    branding: {
      primaryColor: prospect.primary_color,
      logoUrl: prospect.logo_url || canonical.branding.logoUrl
    },
    portals: structuredClone(canonical.portals),
    modules: [...canonical.modules],
    sampleData: structuredClone(canonical.sampleData),
    integrations: structuredClone(canonical.integrations),
    source: {
      importId: Number(prospect.id),
      publicWebsite: prospect.source_url,
      websiteTitle: prospect.website_title,
      reviewedOpportunityCount: opportunities.length
    },
    opportunities,
    isolation: {
      project: 'new',
      environment: 'new',
      applicationService: 'new',
      databaseService: 'new',
      sharedDatabase: false,
      protectedTenantAccess: false,
      externalEffectsEnabled: false
    }
  };
  assertManifest(manifest);
  return manifest;
}

function checksum(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function buildProspectPackage(data) {
  const manifest = buildProspectManifest(data);
  const clonePlan = {
    ...createClonePlan(manifest),
    manifestChecksum: checksum(manifest),
    resourcePolicy: {
      project: 'create-new',
      environment: 'create-new',
      applicationService: 'create-new',
      databaseService: 'create-new',
      reuseExistingDatabase: false,
      protectedTenantAccess: false
    },
    verification: [
      'Runtime guard accepts only the newly registered project, environment and database service',
      'Organization, Marketplace and Advertiser portals return HTTP 200',
      'Review-code access works and no public indexing is permitted',
      'Email, billing, payments, OAuth, Apollo and live connectors remain disabled',
      'Protected-demo audit confirms no CCPS, HFHS or Rubber World files changed'
    ]
  };
  return { manifest, clonePlan, manifestChecksum: clonePlan.manifestChecksum };
}

module.exports = { buildProspectManifest, buildProspectPackage, checksum, reviewedOpportunities, slugify };
