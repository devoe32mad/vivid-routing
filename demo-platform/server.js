'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const canonical = require('./templates/canonical.json');
const { assertManifest } = require('./manifest');
const { assertIsolatedRuntime } = require('./runtime-guard');

assertManifest(canonical);
const runtime = assertIsolatedRuntime(process.env, canonical);
const port = Number(process.env.PORT || 3000);
const basePath = `/demo/${canonical.slug}`;

function tokenDigest(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`${canonical.slug}:${value}`).digest('hex');
}

function equalSecret(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cookieMap(header) {
  return Object.fromEntries(String(header || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2));
}

function isAuthorized(request, url) {
  const supplied = url.searchParams.get('review');
  if (equalSecret(supplied, process.env.DEMO_REVIEW_TOKEN)) return { authorized: true, establishSession: true };
  const cookie = cookieMap(request.headers.cookie).vivid_demo_session;
  return { authorized: equalSecret(cookie, tokenDigest(process.env.DEMO_REVIEW_TOKEN)), establishSession: false };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function portalHtml(portal) {
  const cards = {
    organization: ['Executive overview', 'Inventory and placements', 'Contracts and renewals'],
    marketplace: ['Available opportunities', 'Placement details', 'Advertiser request flow'],
    advertiser: ['Active campaigns', 'Engagement and conversions', 'Revenue and ROI']
  }[portal];
  const navigation = Object.entries(canonical.portals).map(([key, value]) => `<a href="${basePath}/${key}"${key === portal ? ' aria-current="page"' : ''}>${escapeHtml(value.label)}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(canonical.portals[portal].label)} · Vivid</title><style>body{margin:0;font:16px system-ui;background:#f5f7f6;color:#11251a}header{background:#123d25;color:white;padding:24px}nav{display:flex;gap:18px;flex-wrap:wrap}nav a{color:#cfe9d9}nav a[aria-current=page]{color:white;font-weight:700}main{max-width:1050px;margin:auto;padding:38px 24px}.badge{display:inline-block;background:#e6f3eb;color:#123d25;padding:7px 11px;border-radius:999px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:24px}.card{background:white;border:1px solid #dce5df;border-radius:14px;padding:22px;min-height:120px}.notice{margin-top:28px;padding:18px;border-left:4px solid #c5922f;background:#fff8e8}</style></head><body><header><strong>Vivid canonical demo</strong><nav>${navigation}</nav></header><main><span class="badge">${escapeHtml(canonical.sampleData.label)}</span><h1>${escapeHtml(canonical.portals[portal].label)}</h1><p>One isolated demonstration, with connected organization, Marketplace and advertiser views.</p><section class="grid">${cards.map(card => `<article class="card"><h2>${escapeHtml(card)}</h2><p>Canonical module shell ready for isolated sample data.</p></article>`).join('')}</section><div class="notice"><strong>Foundation build:</strong> the isolated database is provisioned; customer data and external integrations are disabled.</div></main></body></html>`;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok', isolated: true, tenantSlug: runtime.tenantSlug });
  if (url.pathname === '/') {
    response.writeHead(302, { location: `${basePath}/organization` });
    return response.end();
  }
  const portal = url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length + 1) : '';
  if (!Object.hasOwn(canonical.portals, portal)) return sendJson(response, 404, { error: 'Not found' });
  const auth = isAuthorized(request, url);
  if (!auth.authorized) return sendJson(response, 401, { error: 'Review token required' });
  if (auth.establishSession) {
    response.writeHead(302, {
      location: `${basePath}/${portal}`,
      'set-cookie': `vivid_demo_session=${tokenDigest(process.env.DEMO_REVIEW_TOKEN)}; Path=${basePath}; HttpOnly; SameSite=Strict; Secure; Max-Age=14400`,
      'cache-control': 'no-store'
    });
    return response.end();
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
  response.end(portalHtml(portal));
});

server.listen(port, () => process.stdout.write(`Canonical demo listening on ${port}\n`));

module.exports = { server };
