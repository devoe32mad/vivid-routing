'use strict';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PORTAL_KEYS = ['organization', 'marketplace', 'advertiser'];
const CUSTOMER_TYPES = new Set(['organization', 'publisher', 'sponsorship']);

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} must be a non-empty string`);
}

function validateManifest(manifest) {
  const errors = [];
  if (!plainObject(manifest)) return ['manifest must be an object'];

  requireText(manifest.version, 'version', errors);
  requireText(manifest.slug, 'slug', errors);
  if (manifest.slug && !SLUG_PATTERN.test(manifest.slug)) errors.push('slug must contain lowercase letters, numbers and single hyphens only');
  requireText(manifest.name, 'name', errors);

  if (!CUSTOMER_TYPES.has(manifest.customerType)) {
    errors.push(`customerType must be one of: ${Array.from(CUSTOMER_TYPES).join(', ')}`);
  }

  if (!plainObject(manifest.branding)) errors.push('branding must be an object');
  else {
    requireText(manifest.branding.primaryColor, 'branding.primaryColor', errors);
    requireText(manifest.branding.logoUrl, 'branding.logoUrl', errors);
  }

  if (!plainObject(manifest.portals)) errors.push('portals must be an object');
  else {
    for (const key of PORTAL_KEYS) {
      const portal = manifest.portals[key];
      if (!plainObject(portal)) {
        errors.push(`portals.${key} must be an object`);
        continue;
      }
      if (portal.enabled !== true) errors.push(`portals.${key}.enabled must be true for a canonical demo`);
      requireText(portal.label, `portals.${key}.label`, errors);
    }
  }

  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) errors.push('modules must be a non-empty array');
  else if (new Set(manifest.modules).size !== manifest.modules.length) errors.push('modules must not contain duplicates');

  if (!plainObject(manifest.sampleData)) errors.push('sampleData must be an object');
  else {
    if (manifest.sampleData.label !== 'Illustrative sample data') {
      errors.push('sampleData.label must be exactly "Illustrative sample data"');
    }
    if (manifest.sampleData.realContacts === true) errors.push('sampleData.realContacts must not be true');
  }

  if (!plainObject(manifest.integrations)) errors.push('integrations must be an object');
  else {
    for (const [name, enabled] of Object.entries(manifest.integrations)) {
      if (enabled !== false) errors.push(`integrations.${name} must be false in a generated demo`);
    }
  }

  return errors;
}

function assertManifest(manifest) {
  const errors = validateManifest(manifest);
  if (errors.length) throw new Error(`Invalid demo manifest:\n- ${errors.join('\n- ')}`);
  return manifest;
}

module.exports = { CUSTOMER_TYPES, PORTAL_KEYS, SLUG_PATTERN, assertManifest, validateManifest };
