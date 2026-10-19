'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const canonical = require('./templates/canonical.json');
const { createDatabase } = require('./database');
const { assertManifest } = require('./manifest');
const { scrapeProspectWebsite } = require('./prospect-scraper');
const { assertIsolatedRuntime } = require('./runtime-guard');
const views = require('./mirror-views');

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

function reportRange(url) {
  const toDefault = new Date();
  const fromDefault = new Date(toDefault.getTime() - 29 * 86400000);
  const iso = value => value.toISOString().slice(0, 10);
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const from = valid(url.searchParams.get('from')) ? url.searchParams.get('from') : iso(fromDefault);
  const to = valid(url.searchParams.get('to')) ? url.searchParams.get('to') : iso(toDefault);
  return from <= to ? { from, to } : { from: to, to: from };
}

function page(title, portal, content) {
  const navigation = Object.entries(canonical.portals).map(([key, value]) => `<a href="${basePath}/${key}"${key === portal ? ' aria-current="page"' : ''}>${escapeHtml(value.label)}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · Vivid</title><style>:root{--navy:#0d2744;--green:#123d25;--blue:#1769aa;--ink:#17251e;--muted:#617069;--line:#dbe4df;--bg:#f4f7f5}*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink)}header{background:linear-gradient(110deg,var(--navy),var(--green));color:white;padding:22px 5vw}header strong{font-size:20px}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:13px}nav a{color:#cfe5f6;text-decoration:none}nav a[aria-current=page]{color:white;font-weight:750;border-bottom:2px solid white}main{max-width:1180px;margin:auto;padding:34px 24px 60px}.eyebrow{color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.sample{display:inline-block;background:#e1f1e7;color:var(--green);padding:6px 10px;border-radius:999px;font-weight:700}.subtle{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.metrics{margin:24px 0}.card,.panel{background:white;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 5px 18px rgba(13,39,68,.04)}.metric strong{display:block;font-size:27px;color:var(--navy);margin-top:6px}.market{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:18px}.status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase}.available{background:#e4f5e9;color:#17642f}.pending{background:#fff3d6;color:#805c00}.sold{background:#e8edf2;color:#52606c}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase}section{margin-top:28px}h1{margin:.35em 0 .2em;font-size:clamp(28px,4vw,42px)}h2{font-size:21px}form{display:grid;gap:8px;margin-top:14px}input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #b9c8c0}button{background:var(--blue);color:white;border:0;font-weight:750;cursor:pointer}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.links a{color:var(--blue);font-weight:700}.notice{margin:24px 0;padding:16px;border-left:4px solid #c5922f;background:#fff8e8}@media(max-width:700px){table{display:block;overflow-x:auto}header{padding-inline:24px}}</style></head><body><header><strong>Vivid canonical demonstration</strong><nav>${navigation}</nav></header><main><span class="sample">${escapeHtml(canonical.sampleData.label)}</span>${content}<div class="notice"><strong>Isolated environment:</strong> all names, contacts and results shown here are synthetic. Email, payments, OAuth, Apollo and production administration are disabled.</div></main></body></html>`;
}

function accessHtml(error = '') {
  const message = error ? `<div class="notice" role="alert"><strong>${escapeHtml(error)}</strong></div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private demo access · Vivid</title><style>:root{--navy:#0d2744;--green:#123d25;--blue:#1769aa;--ink:#17251e;--muted:#617069;--line:#dbe4df;--bg:#f4f7f5}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:15px/1.45 system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,var(--navy),var(--green));color:var(--ink)}main{width:min(100%,460px);background:white;border-radius:18px;padding:32px;box-shadow:0 24px 70px rgba(0,0,0,.25)}.eyebrow{color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px}h1{margin:.35em 0 .25em;font-size:32px}.subtle{color:var(--muted)}form{display:grid;gap:10px;margin-top:24px}label{font-weight:750}input,button{font:inherit;padding:12px 14px;border-radius:9px;border:1px solid #b9c8c0}button{background:var(--blue);color:white;border:0;font-weight:750;cursor:pointer}.notice{margin:20px 0;padding:14px;border-left:4px solid #b54135;background:#fff1ef}</style></head><body><main><p class="eyebrow">Vivid canonical demonstration</p><h1>Private demo access</h1><p class="subtle">Enter the review code supplied by Vivid. Your access lasts for four hours on this device.</p>${message}<form method="post" action="/review"><label for="accessCode">Review code</label><input id="accessCode" name="accessCode" type="password" autocomplete="one-time-code" required autofocus><button type="submit">Open demo</button></form></main></body></html>`;
}

function sessionCookie() {
  return `vivid_demo_session=${tokenDigest(process.env.DEMO_REVIEW_TOKEN)}; Path=${basePath}; HttpOnly; SameSite=Strict; Secure; Max-Age=14400`;
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
  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(accessHtml());
  }
  if (request.method === 'POST' && url.pathname === '/review') {
    const form = await readForm(request);
    if (!equalSecret(form.get('accessCode'), process.env.DEMO_REVIEW_CODE)) {
      response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
      return response.end(accessHtml('That review code was not recognized.'));
    }
    response.writeHead(303, {
      location: `${basePath}/organization`,
      'set-cookie': sessionCookie(),
      'cache-control': 'no-store'
    });
    return response.end();
  }
  const auth = authorization(request, url);
  if (!auth.authorized) return sendJson(response, 401, { error: 'Review token required' });
  if (auth.establishSession) {
    response.writeHead(302, {
      location: url.pathname,
      'set-cookie': sessionCookie(),
      'cache-control': 'no-store'
    });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization`) {
    const data = await database.organizationDashboard();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.organizationOverview(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/locations`) {
    const data = await database.locations();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.locationsPage(basePath, data));
  }
  const locationMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/organization/location/(\\d+)$`));
  if (locationMatch) {
    const data = await database.locationDetail(Number(locationMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Location not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.locationPage(basePath, data));
  }
  const placementMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/organization/placement/(\\d+)$`));
  if (placementMatch) {
    const data = await database.placementDetail(Number(placementMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Placement not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.placementPage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/inventory`) {
    const data = await database.inventory();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.inventoryPage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/advertisers`) {
    const data = await database.advertisers();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.advertisersPage(basePath, data));
  }
  const advertiserMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/organization/advertiser/(\\d+)$`));
  if (advertiserMatch) {
    const data = await database.advertiserDetail(Number(advertiserMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Advertiser not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.advertiserOrgPage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/requests`) {
    const data = await database.requests();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.requestsPage(basePath, data));
  }
  const requestStatusMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/organization/requests/(\\d+)/status$`));
  if (requestStatusMatch) {
    const form = await readForm(request);
    const status = String(form.get('status') || '');
    if (!['approved', 'declined'].includes(status)) return sendJson(response, 400, { error: 'Invalid review status' });
    await database.updateRequestStatus(Number(requestStatusMatch[1]), status);
    response.writeHead(303, { location: `${basePath}/organization/requests` });
    return response.end();
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/contracts`) {
    const data = await database.contracts();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.contractsPage(basePath, data, false));
  }
  const contractMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/organization/contract/(\\d+)$`));
  if (contractMatch) {
    const data = await database.contractDetail(Number(contractMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Contract not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.contractPage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/renewals`) {
    const data = await database.contracts();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.contractsPage(basePath, data, true));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/pipeline`) {
    const data = await database.revenuePipeline();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.pipelinePage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/performance`) {
    const range = reportRange(url);
    const data = await database.advertiserDashboard(null, range.from, range.to);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.performancePage(basePath, data, range.from, range.to));
  }
  const campaignMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/organization/campaign/(\\d+)$`));
  if (campaignMatch) {
    const data = await database.campaignDetail(Number(campaignMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Campaign not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.campaignPage(basePath, data));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/reports`) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.reportsPage(basePath));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/responsibility`) {
    const [advertisers, contracts] = await Promise.all([database.advertisers(), database.contracts()]);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.responsibilityPage(basePath, advertisers, contracts));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/administration`) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.administrationPage(basePath));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/organization/help`) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.helpPage(basePath));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/builder`) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.builderPage(basePath));
  }
  if (request.method === 'POST' && url.pathname === `${basePath}/builder`) {
    const form = await readForm(request);
    try {
      const analysis = await scrapeProspectWebsite(form.get('websiteUrl'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
      return response.end(views.builderPage(basePath, analysis));
    } catch (error) {
      response.writeHead(422, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
      return response.end(views.builderPage(basePath, null, error.message));
    }
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/comparison`) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.comparisonPage(basePath));
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/marketplace`) {
    const data = await database.marketplace();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.marketplacePage(basePath, data, url.searchParams.get('requested') === '1'));
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
  const advertiserPortalMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/advertiser(?:/(setup|reports|performance|archive|exports|help))?$`));
  if (advertiserPortalMatch) {
    const section = advertiserPortalMatch[1] || 'setup';
    const range = reportRange(url);
    const advertisers = await database.advertisers();
    const requestedId = Number(url.searchParams.get('advertiser_id'));
    const selected = advertisers.find(row => Number(row.id) === requestedId) || advertisers[0];
    const data = await database.advertiserDashboard(selected?.id || null, range.from, range.to);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    const pages = {
      setup: () => views.advertiserSetupPage(basePath, advertisers, selected, data),
      reports: () => views.advertiserReportsPage(basePath, advertisers, selected, data, range.from, range.to),
      performance: () => views.advertiserPerformancePage(basePath, advertisers, selected, data, range.from, range.to),
      archive: () => views.advertiserArchivePage(basePath, advertisers, selected),
      exports: () => views.advertiserExportsPage(basePath, advertisers, selected, range.from, range.to),
      help: () => views.advertiserHelpPage(basePath, advertisers, selected)
    };
    return response.end(pages[section]());
  }
  const exportMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/exports/(executive|inventory|performance|contracts)\\.csv$`));
  if (exportMatch) {
    const kind = exportMatch[1];
    let rows;
    if (kind === 'inventory') {
      const data = await database.inventory();
      rows = [['Location','Opportunity','Format','Status','Annual price','Estimated impressions','Advertiser'], ...data.map(x=>[x.location,x.name,x.format,x.status,x.annualPrice,x.estimated_impressions,x.advertiser||''])];
    } else if (kind === 'contracts') {
      const data = await database.contracts();
      rows = [['Contract','Advertiser','Location','Placement','Start','End','Value','Fulfillment','Status','Owner','Next action'], ...data.map(x=>[x.id,x.advertiser,x.location,x.placement,formatDate(x.starts_on),formatDate(x.ends_on),x.value,`${x.fulfillment_percent}%`,x.status,x.renewal_owner,x.next_action])];
    } else if (kind === 'executive') {
      const data = await database.organizationDashboard();
      rows = [['Organization','Locations','Placements','Advertisers','Contract value','Scans','Conversions','Attributed revenue'],['Harbor Community Network',data.locations.length,data.totals.placements,data.totals.advertisers,data.totals.contractValue,data.totals.scans,data.totals.conversions,data.totals.revenue]];
    } else {
      const advertiserId = Number(url.searchParams.get('advertiser_id')) || null;
      const range = reportRange(url);
      const data = await database.advertiserDashboard(advertiserId, range.from, range.to);
      rows = [['Advertiser','Campaign','Location','Placement','Scans','Actions','Conversions','Revenue','ROI'], ...data.map(x=>[x.advertiser,x.campaign,x.location,x.placement,x.scans,x.clicks,x.conversions,x.revenue,`${x.roi}%`])];
    }
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="vivid-canonical-${kind}.csv"`, 'cache-control': 'no-store' });
    return response.end(`${csv}\n`);
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/exports/executive.pdf`) {
    const [overview, performance] = await Promise.all([database.organizationDashboard(), database.advertiserDashboard()]);
    response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="vivid-canonical-executive.pdf"', 'cache-control': 'no-store' });
    const doc = new PDFDocument({ margin: 46, size: 'LETTER' });
    doc.pipe(response);
    doc.fillColor('#073b22').fontSize(21).text('Vivid Executive Summary');
    doc.fillColor('#65776b').fontSize(10).text('Harbor Community Network · Illustrative sample data · Isolated canonical demo');
    doc.moveDown().fillColor('#17251e').fontSize(13).text(`Locations: ${overview.locations.length}   Placements: ${overview.totals.placements}   Advertisers: ${overview.totals.advertisers}`);
    doc.text(`Contract value: ${formatMoney(overview.totals.contractValue)}   Scans: ${overview.totals.scans}   Conversions: ${overview.totals.conversions}`);
    doc.text(`Attributed advertiser revenue: ${formatMoney(overview.totals.revenue)}`);
    doc.moveDown().fillColor('#073b22').fontSize(15).text('Campaign performance');
    for (const row of performance) doc.fillColor('#17251e').fontSize(10).text(`${row.advertiser} · ${row.campaign} · ${row.placement}: ${row.scans} scans, ${row.conversions} conversions, ${formatMoney(row.revenue)} revenue, ${row.roi}% ROI`);
    doc.moveDown().fillColor('#65776b').fontSize(9).text('All information in this report is synthetic and intended only to demonstrate the Vivid workflow.');
    doc.end();
    return;
  }
  if (request.method === 'GET' && url.pathname === `${basePath}/exports/report.xlsx`) {
    const [overview, inventory, performance, contracts, advertisers] = await Promise.all([database.organizationDashboard(), database.inventory(), database.advertiserDashboard(), database.contracts(), database.advertisers()]);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vivid canonical demonstration';
    const addSheet = (name, columns, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map(column => ({ header: column, key: column, width: Math.max(14, column.length + 3) }));
      rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map((column, index) => [column, row[index]]))));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B3A' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
    };
    addSheet('Executive Summary', ['Organization','Locations','Placements','Advertisers','Contract Value','Scans','Conversions','Attributed Revenue'], [['Harbor Community Network',overview.locations.length,overview.totals.placements,overview.totals.advertisers,overview.totals.contractValue,overview.totals.scans,overview.totals.conversions,overview.totals.revenue]]);
    addSheet('Inventory', ['Location','Opportunity','Format','Status','Annual Price','Impressions','Tracking Code','Advertiser'], inventory.map(x=>[x.location,x.name,x.format,x.status,x.annualPrice,x.estimated_impressions,x.tracking_code,x.advertiser||'']));
    addSheet('Performance', ['Advertiser','Campaign','Location','Placement','Scans','Actions','Conversions','Revenue','ROI'], performance.map(x=>[x.advertiser,x.campaign,x.location,x.placement,x.scans,x.clicks,x.conversions,x.revenue,x.roi/100]));
    addSheet('Contracts & Renewals', ['Contract','Advertiser','Location','Placement','Start','End','Value','Fulfillment','Status','Owner','Next Action'], contracts.map(x=>[x.id,x.advertiser,x.location,x.placement,formatDate(x.starts_on),formatDate(x.ends_on),x.value,x.fulfillment_percent/100,x.status,x.renewal_owner,x.next_action]));
    addSheet('Sales Responsibility', ['Sales Rep','Advertiser','Category','Status','Investment','Revenue'], advertisers.map(x=>[x.sales_rep,x.name,x.category,x.status,x.investment,x.revenue]));
    response.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="vivid-canonical-report.xlsx"', 'cache-control': 'no-store' });
    await workbook.xlsx.write(response);
    return response.end();
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
