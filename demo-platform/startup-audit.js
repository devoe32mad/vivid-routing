'use strict';

const CUSTOMER_PATTERN = /(?:ccps|hfhs|rubber-world|sjn|mca|via-via)/i;
const MUTATION_PATTERN = /^(?:seed|install|polish|restore|trim|diagnose)-/i;

function commandFiles(command) {
  return String(command || '')
    .split(/&&|;/)
    .map(part => part.trim().match(/^node\s+([^\s]+)/)?.[1])
    .filter(Boolean);
}

function auditStartCommand(command) {
  const files = commandFiles(command);
  const customerSpecific = files.filter(file => CUSTOMER_PATTERN.test(file));
  const mutating = files.filter(file => MUTATION_PATTERN.test(file));
  return {
    safeForCanonicalDemo: customerSpecific.length === 0 && mutating.length === 0,
    files,
    customerSpecific,
    mutating,
    findings: [
      ...(customerSpecific.length ? [`Customer-specific startup steps: ${customerSpecific.join(', ')}`] : []),
      ...(mutating.length ? [`Potentially mutating startup steps: ${mutating.join(', ')}`] : [])
    ]
  };
}

module.exports = { auditStartCommand, commandFiles };
