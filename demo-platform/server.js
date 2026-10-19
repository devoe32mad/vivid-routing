'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const canonical = require('./templates/canonical.json');
const { createDatabase } = require('./database');
const { assertManifest } = require('./manifest');
const { assertIsolatedRuntime } = require('./runtime-guard');

assertManifest(canonical);
const runtime = assertIsolatedRuntime(process.env, canonical);
const database = createDatabase(process.env.DATABASE_URL);
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

function authorization(request, url) {
  const supplied = url.searchParams.get('review');
  if (request.method === 'GET' && equalSecret(supplied, process.env.DEMO_REVIEW_TOKEN)) return { authorized: true, establishSession: true };
  const cookie = cookieMap(request.headers.cookie).vivid_demo_session;
  return { authorized: equalSecret(cookie, tokenDigest(process.env.DEMO_REVIEW_TOKEN)), establishSession: false };
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value ?? '') : date.toISOString().slice(0, 10);
}

function page(title, portal, content) {
  const navigation = Object.entries(canonical.portals).map(([key, value]) => `<a href="${basePath}/${key}"${key === portal ? ' aria-current="page"' : ''}>${escapeHtml(value.label)}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · Vivid</title><style>:root{--navy:#0d2744;--green:#123d25;--blue:#1769aa;--ink:#17251e;--muted:#617069;--line:#dbe4df;--bg:#f4f7f5}*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink)}header{background:linear-gradient(110deg,var(--navy),var(--green));color:white;padding:22px 5vw}header strong{font-size:20px}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:13px}nav a{color:#cfe5f6;text-decoration:none}nav a[aria-current=page]{color:white;font-weight:750;border-bottom:2px solid white}main{max-width:1180px;margin:auto;padding:34px 24px 60px}.eyebrow{color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.sample{display:inline-block;background:#e1f1e7;color:var(--green);padding:6px 10px;border-radius:999px;font-weight:700}.subtle{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.metrics{margin:24px 0}.card,.panel{background:white;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 5px 18px rgba(13,39,68,.04)}.metric strong{display:block;font-size:27px;color:var(--navy);margin-top:6px}.market{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:18px}.status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase}.available{background:#e4f5e9;color:#17642f}.pending{background:#fff3d6;color:#805c00}.sold{background:#e8edf2;color:#52606c}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase}section{margin-top:28px}h1{margin:.35em 0 .2em;font-size:clamp(28px,4vw,42px)}h2{font-size:21px}form{display:grid;gap:8px;margin-top:14px}input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #b9c8c0}button{background:var(--blue);color:white;border:0;font-weight:750;cursor:pointer}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.links a{color:var(--blue);font-weight:700}.notice{margin:24px 0;padding:16px;border-left:4px solid #c5922f;background:#fff8e8}@media(max-width:700px){table{display:block;overflow-x:auto}header{padding-inline:24px}}</style></head><body><header><strong>Vivid canonical demonstration</strong><nav>${navigation}</nav></header><main><span class="sample">${escapeHtml(canonical.sampleData.label)}</span>${content}<div class="notice"><strong>Isolated environment:</strong> all names, contacts and results shown here are synthetic. Email, payments, OAuth, Apollo and production administration are disabled.</div></main></body></html>`;
}

function metric(label, value) {
  return `<article class="card metric"><span class="subtle">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function organizationHtml(data) {
  const totals = data.totals;
  const metrics = [
    ['Placements', totals.placements], ['Active advertisers', totals.advertisers], ['Contract value', formatMoney(totals.contractValue)],
    ['Scans', totals.scans], ['Conversions', totals.conversions], ['Attributed revenue', formatMoney(totals.revenue)]
  ].map(([label, value]) => metric(label, value)).join('');
  const locations = data.locations.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.location_type)}</td><td>${Number(row.audience).toLocaleString()}</td><td>${row.placements}</td><td>${row.available}</td></tr>`).join('');
  const contracts = data.contracts.map(row => `<tr><td>${escapeHtml(row.advertiser)}</td><td>${escapeHtml(row.placement)}</td><td>${formatMoney(row.value)}</td><td>${row.fulfillment_percent}%</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(formatDate(row.ends_on))}</td></tr>`).join('');
  const requests = data.requests.map(row => `<tr><td>#${row.id}</td><td>${escapeHtml(row.advertiser_name)}</td><td>${escapeHtml(row.placement)}</td><td>${escapeHtml(row.contact_name)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(formatDate(row.created_at))}</td></tr>`).join('');
  const requestSection = requests ? `<section class="panel"><h2>Marketplace requests</h2><table><thead><tr><th>Request</th><th>Advertiser</th><th>Opportunity</th><th>Contact</th><th>Status</th><th>Received</th></tr></thead><tbody>${requests}</tbody></table></section>` : '';
  return page('Organization overview', 'organization', `<p class="eyebrow">Organization platform</p><h1>Harbor Community Network</h1><p class="subtle">One executive view of inventory, advertiser commitments, fulfillment and measurable outcomes.</p><section class="grid metrics">${metrics}</section>${requestSection}<section class="panel"><h2>Locations and inventory</h2><table><thead><tr><th>Location</th><th>Type</th><th>Audience</th><th>Placements</th><th>Available</th></tr></thead><tbody>${locations}</tbody></table></section><section class="panel"><h2>Contracts and renewals</h2><table><thead><tr><th>Advertiser</th><th>Placement</th><th>Value</th><th>Fulfillment</th><th>Status</th><th>Ends</th></tr></thead><tbody>${contracts}</tbody></table></section><div class="links"><a href="${basePath}/marketplace">Open Marketplace →</a><a href="${basePath}/advertiser">View advertiser performance →</a><a href="${basePath}/exports/performance.csv">Export performance CSV</a></div>`);
}

function marketplaceHtml(items, requested) {
  const cards = items.map(item => `<article class="card"><span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><p class="eyebrow">${escapeHtml(item.location)} · ${escapeHtml(item.format)}</p><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p><p><strong>${formatMoney(item.annualPrice)}/year</strong><br><span class="subtle">${Number(item.estimated_impressions).toLocaleString()} estimated annual impressions</span></p>${item.status === 'available' ? `<form method="post" action="${basePath}/marketplace/request"><input type="hidden" name="inventoryId" value="${item.id}"><input name="advertiserName" value="Demo Advertiser" aria-label="Advertiser name" required><input name="contactName" value="Demo User" aria-label="Contact name" required><input type="email" name="contactEmail" value="demo@example.invalid" aria-label="Contact email" required><button type="submit">Request this opportunity</button></form>` : ''}</article>`).join('');
  return page('Opportunity Marketplace', 'marketplace', `<p class="eyebrow">Public opportunity Marketplace</p><h1>Available advertising and sponsorship opportunities</h1><p class="subtle">Prospects can understand availability, audience, pricing and value before submitting a request.</p>${requested ? '<div class="notice"><strong>Demo request recorded.</strong> It is now available to the organization workflow without sending an email.</div>' : ''}<section class="market">${cards}</section><div class="links"><a href="${basePath}/organization">View organization operations →</a><a href="${basePath}/advertiser">See advertiser results →</a></div>`);
}

function advertiserHtml(rows) {
  const totals = rows.reduce((result, row) => ({ scans: result.scans + row.scans, clicks: result.clicks + row.clicks, conversions: result.conversions + row.conversions, revenue: result.revenue + row.revenue, investment: result.investment + row.investment }), { scans: 0, clicks: 0, conversions: 0, revenue: 0, investment: 0 });
  const totalRoi = totals.investment ? Math.round(((totals.revenue - totals.investment) / totals.investment) * 100) : 0;
  const metrics = [['Scans', totals.scans], ['Website actions', totals.clicks], ['Conversions', totals.conversions], ['Attributed revenue', formatMoney(totals.revenue)], ['Investment', formatMoney(totals.investment)], ['ROI', `${totalRoi}%`]].map(([label, value]) => metric(label, value)).join('');
  const campaigns = rows.map(row => `<tr><td>${escapeHtml(row.advertiser)}</td><td>${escapeHtml(row.campaign)}</td><td>${escapeHtml(row.placement)}</td><td>${row.scans}</td><td>${row.clicks}</td><td>${row.conversions}</td><td>${formatMoney(row.revenue)}</td><td>${row.roi}%</td></tr>`).join('');
  return page('Advertiser performance', 'advertiser', `<p class="eyebrow">Advertiser platform</p><h1>Performance by advertiser, placement and campaign</h1><p class="subtle">The same inventory sold through the Marketplace connects to engagement, conversion, revenue and renewal evidence.</p><section class="grid metrics">${metrics}</section><section class="panel"><h2>Campaign performance</h2><table><thead><tr><th>Advertiser</th><th>Campaign</th><th>Placement</th><th>Scans</th><th>Actions</th><th>Conversions</th><th>Revenue</th><th>ROI</th></tr></thead><tbody>${campaigns}</tbody></table></section><div class="links"><a href="${basePath}/organization">Organization overview →</a><a href="${basePath}/marketplace">Marketplace inventory →</a><a href="${basePath}/exports/performance.csv">Export performance CSV</a></div>`);
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    const identity = await database.health();
    const healthy = identity && identity.project_id === runtime.projectId && identity.environment_id === runtime.environmentId && identity.database_service_id === runtime.databaseServiceId;
    return sendJson(response, healthy ? 200 : 503, { status: healthy ? 'ok' : 'identity-mismatch', isolated: true, tenantSlug: runtime.tenantSlug });
  }
  if (url.pathname === '/') {
    response.writeHead(302, { location: `${basePath}/organization` });
    return response.end();
  }
  const auth = authorization(request, url);
  if (!auth.authorized) return sendJson(response, 401, { error: 'Review token required' });
  if (auth.establishSession) {
    response.writeHead(302, {
      location: url.pathname,
      'set-cookie': `vivid_demo_session=${tokenDigest(process.env.DEMO_REVIEW_TOKEN)}; Path=${basePath}; HttpOnly; SameSite=Strict; Secure; Max-Age=14400`,
      'cache-control': 'no-store'
    });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization`) {
    const data = await database.organizationDashboard();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(organizationHtml(data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/marketplace`) {
    const data = await database.marketplace();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(marketplaceHtml(data, url.searchParams.get('requested') === '1'));
  }
  if (request.method === 'POST' && url.pathname === `${basePath}/marketplace/request`) {
    const form = await readForm(request);
    const input = {
      inventoryId: Number(form.get('inventoryId')),
      advertiserName: String(form.get('advertiserName') || '').slice(0, 100),
      contactName: String(form.get('contactName') || '').slice(0, 100),
      contactEmail: String(form.get('contactEmail') || '').slice(0, 180)
    };
    if (!Number.isInteger(input.inventoryId) || !input.advertiserName || !input.contactName || !input.contactEmail.endsWith('.invalid')) {
      return sendJson(response, 400, { error: 'Use the supplied illustrative .invalid contact information in this demo' });
    }
    await database.createRequest(input);
    response.writeHead(303, { location: `${basePath}/marketplace?requested=1` });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/advertiser`) {
    const data = await database.advertiserDashboard();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(advertiserHtml(data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/exports/performance.csv`) {
    const rows = await database.advertiserDashboard();
    const csv = [['Advertiser', 'Campaign', 'Placement', 'Scans', 'Actions', 'Conversions', 'Revenue', 'ROI'], ...rows.map(row => [row.advertiser, row.campaign, row.placement, row.scans, row.clicks, row.conversions, row.revenue, `${row.roi}%`])].map(row => row.map(csvCell).join(',')).join('\n');
    response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="vivid-canonical-performance.csv"', 'cache-control': 'no-store' });
    return response.end(`${csv}\n`);
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/api/config`) {
    return sendJson(response, 200, { slug: canonical.slug, sampleData: canonical.sampleData.label, portals: canonical.portals, modules: canonical.modules, integrations: canonical.integrations });
  }
  return sendJson(response, 404, { error: 'Not found' });
}

const server = http.createServer((request, response) => {
  handle(request, response).catch(error => {
    process.stderr.write(`Canonical demo request failed: ${error.message}\n`);
    if (!response.headersSent) sendJson(response, 500, { error: 'Canonical demo request failed' });
    else response.end();
  });
});

async function start() {
  await database.initialize(runtime, canonical);
  server.listen(port, () => process.stdout.write(`Canonical demo listening on ${port}\n`));
}

start().catch(error => {
  process.stderr.write(`Canonical demo startup blocked: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { server };
