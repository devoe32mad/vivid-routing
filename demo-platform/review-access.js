'use strict';

function safeReturnPath(value, basePath) {
  const fallback = `${basePath}/organization`;
  const candidate = String(value || '').trim();
  if (!candidate || candidate.includes('\\')) return fallback;
  try {
    const parsed = new URL(candidate, 'https://demo.invalid');
    if (parsed.origin !== 'https://demo.invalid') return fallback;
    if (parsed.pathname !== basePath && !parsed.pathname.startsWith(`${basePath}/`)) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

module.exports = { safeReturnPath };
