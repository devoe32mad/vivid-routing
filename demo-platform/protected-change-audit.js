'use strict';

const PROTECTED_PATH_PATTERN = /(?:^|[\/_.-])(ccps|hfhs|rubber[-_]?world)(?:[\/_.-]|$)/i;

function auditChangedPaths(paths) {
  const normalized = Array.from(new Set(paths.map(value => String(value).trim()).filter(Boolean))).sort();
  const protectedPaths = normalized.filter(value => PROTECTED_PATH_PATTERN.test(value));
  return Object.freeze({
    safe: protectedPaths.length === 0,
    changedPaths: normalized,
    protectedPaths
  });
}

module.exports = { PROTECTED_PATH_PATTERN, auditChangedPaths };
