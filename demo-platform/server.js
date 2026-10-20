'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const canonical = require('./templates/canonical.json');
const { createDatabase } = require('./database');
const { assertManifest } = require('./manifest');
const { scrapeProspectWebsite } = require('./prospect-scraper');
const { safeReturnPath } = require('./review-access');
const { assertIsolatedRuntime } = require('./runtime-guard');
const views = require('./mirror-views');
const prospectViews = require('./prospect-views');

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

function publicWebUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function page(title, portal, content) {
  const navigation = Object.entries(canonical.portals).map(([key, value]) => `<a href="${basePath}/${key}"${key === portal ? ' aria-current="page"' : ''}>${escapeHtml(value.label)}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · Vivid</title><style>:root{--navy:#0d2744;--green:#123d25;--blue:#1769aa;--ink:#17251e;--muted:#617069;--line:#dbe4df;--bg:#f4f7f5}*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink)}header{background:linear-gradient(110deg,var(--navy),var(--green));color:white;padding:22px 5vw}header strong{font-size:20px}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:13px}nav a{color:#cfe5f6;text-decoration:none}nav a[aria-current=page]{color:white;font-weight:750;border-bottom:2px solid white}main{max-width:1180px;margin:auto;padding:34px 24px 60px}.eyebrow{color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.sample{display:inline-block;background:#e1f1e7;color:var(--green);padding:6px 10px;border-radius:999px;font-weight:700}.subtle{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.metrics{margin:24px 0}.card,.panel{background:white;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 5px 18px rgba(13,39,68,.04)}.metric strong{display:block;font-size:27px;color:var(--navy);margin-top:6px}.market{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:18px}.status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase}.available{background:#e4f5e9;color:#17642f}.pending{background:#fff3d6;color:#805c00}.sold{background:#e8edf2;color:#52606c}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase}section{margin-top:28px}h1{margin:.35em 0 .2em;font-size:clamp(28px,4vw,42px)}h2{font-size:21px}form{display:grid;gap:8px;margin-top:14px}input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #b9c8c0}button{background:var(--blue);color:white;border:0;font-weight:750;cursor:pointer}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.links a{color:var(--blue);font-weight:700}.notice{margin:24px 0;padding:16px;border-left:4px solid #c5922f;background:#fff8e8}@media(max-width:700px){table{display:block;overflow-x:auto}header{padding-inline:24px}}</style></head><body><header><strong>Vivid canonical demonstration</strong><nav>${navigation}</nav></header><main><span class="sample">${escapeHtml(canonical.sampleData.label)}</span>${content}<div class="notice"><strong>Isolated environment:</strong> all names, contacts and results shown here are synthetic. Email, payments, OAuth, Apollo and production administration are disabled.</div></main></body></html>`;
}

function accessHtml(error = '', returnTo = `${basePath}/organization`) {
  const message = error ? `<div class="notice" role="alert"><strong>${escapeHtml(error)}</strong></div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private demo access · Vivid</title><style>:root{--navy:#0d2744;--green:#123d25;--blue:#1769aa;--ink:#17251e;--muted:#617069;--line:#dbe4df;--bg:#f4f7f5}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:15px/1.45 system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,var(--navy),var(--green));color:var(--ink)}main{width:min(100%,460px);background:white;border-radius:18px;padding:32px;box-shadow:0 24px 70px rgba(0,0,0,.25)}.eyebrow{color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:12px}h1{margin:.35em 0 .25em;font-size:32px}.subtle{color:var(--muted)}form{display:grid;gap:10px;margin-top:24px}label{font-weight:750}input,button{font:inherit;padding:12px 14px;border-radius:9px;border:1px solid #b9c8c0}button{background:var(--blue);color:white;border:0;font-weight:750;cursor:pointer}.notice{margin:20px 0;padding:14px;border-left:4px solid #b54135;background:#fff1ef}</style></head><body><main><p class="eyebrow">Vivid canonical demonstration</p><h1>Private demo access</h1><p class="subtle">Enter the review code supplied by Vivid. Your access lasts for four hours on this device.</p>${message}<form method="post" action="/review"><input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}"><label for="accessCode">Review code</label><input id="accessCode" name="accessCode" type="password" autocomplete="one-time-code" required autofocus><button type="submit">Open requested page</button></form></main></body></html>`;
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
    if (size > 16384) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function publishedAmount(value) {
  const match = String(value || '').match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replaceAll(',', '')) : 0;
}

function fileSlug(value) {
  return String(value || 'vivid-prospect').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'vivid-prospect';
}

function prospectExportContext(data, url) {
  const allItems = prospectViews.reviewed(data);
  const advertiserScope = url.searchParams.get('scope') === 'advertiser';
  const requestedId = Number(url.searchParams.get('opportunity_id'));
  const selected = allItems.find(item => Number(item.id) === requestedId) || allItems[0] || null;
  const items = advertiserScope && selected ? [selected] : allItems;
  const performance = items.map((item, index) => {
    const metrics = prospectViews.sampleMetrics(item, advertiserScope ? 0 : index);
    const investment = publishedAmount(item.price_text);
    const actionRate = metrics.scans ? metrics.clicks / metrics.scans : 0;
    const conversionRate = metrics.clicks ? metrics.conversions / metrics.clicks : 0;
    const roi = investment ? (metrics.revenue - investment) / investment : null;
    return { item, metrics, investment, actionRate, conversionRate, roi };
  });
  return { advertiserScope, selected, items, performance, totals: prospectViews.totalsFor(items), range: reportRange(url) };
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    const identity = await database.health();
    const healthy = identity && identity.project_id === runtime.projectId && identity.environment_id === runtime.environmentId && identity.database_service_id === runtime.databaseServiceId;
    return sendJson(response, healthy ? 200 : 503, { status: healthy ? 'ok' : 'identity-mismatch', isolated: true, tenantSlug: runtime.tenantSlug });
  }
  if (request.method === 'GET' && url.pathname === '/') {
    const returnTo = safeReturnPath(url.searchParams.get('returnTo'), basePath);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(accessHtml('', returnTo));
  }
  if (request.method === 'POST' && url.pathname === '/review') {
    const form = await readForm(request);
    const returnTo = safeReturnPath(form.get('returnTo'), basePath);
    if (!equalSecret(form.get('accessCode'), process.env.DEMO_REVIEW_CODE)) {
      response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
      return response.end(accessHtml('That review code was not recognized.', returnTo));
    }
    response.writeHead(303, {
      location: returnTo,
      'set-cookie': sessionCookie(),
      'cache-control': 'no-store'
    });
    return response.end();
  }
  const auth = authorization(request, url);
  if (!auth.authorized) {
    if (request.method === 'GET') {
      response.writeHead(303, { location: `/?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`, 'cache-control': 'no-store' });
      return response.end();
    }
    return sendJson(response, 401, { error: 'Review access expired. Reopen this page and enter the review code before submitting changes.' });
  }
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
    const imports = await database.prospectImports();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.builderPage(basePath, imports));
  }
  if (request.method === 'POST' && url.pathname === `${basePath}/builder`) {
    const form = await readForm(request);
    try {
      const analysis = await scrapeProspectWebsite(form.get('websiteUrl'));
      const importId = await database.createProspectImport(analysis);
      response.writeHead(303, { location: `${basePath}/builder/import/${importId}?created=1`, 'cache-control': 'no-store' });
      return response.end();
    } catch (error) {
      const imports = await database.prospectImports();
      response.writeHead(422, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
      return response.end(views.builderPage(basePath, imports, error.message));
    }
  }
  const prospectPortalMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/(organization|marketplace|advertiser)$`));
  if (prospectPortalMatch) {
    const data = await database.prospectImport(Number(prospectPortalMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const portal = prospectPortalMatch[2];
    const pages = {
      organization: () => prospectViews.prospectOrganizationPage(basePath, data, String(url.searchParams.get('section') || 'overview')),
      marketplace: () => prospectViews.prospectMarketplacePage(basePath, data, {
        query: url.searchParams.get('q') || '',
        category: url.searchParams.get('category') || ''
      }),
      advertiser: () => prospectViews.prospectAdvertiserPage(basePath, data, Number(url.searchParams.get('opportunity_id')) || null, String(url.searchParams.get('section') || 'overview'))
    };
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(pages[portal]());
  }
  const prospectOpportunityMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/opportunity/(\\d+)$`));
  if (prospectOpportunityMatch) {
    const data = await database.prospectImport(Number(prospectOpportunityMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const pageHtml = prospectViews.prospectOpportunityPage(basePath, data, Number(prospectOpportunityMatch[2]));
    if (!pageHtml) return sendJson(response, 404, { error: 'Reviewed opportunity not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(pageHtml);
  }
  const prospectOnboardingMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/onboarding/(\\d+)$`));
  if (prospectOnboardingMatch) {
    const data = await database.prospectImport(Number(prospectOnboardingMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const pageHtml = prospectViews.prospectOnboardingPage(basePath, data, Number(prospectOnboardingMatch[2]), String(url.searchParams.get('step') || 'request'));
    if (!pageHtml) return sendJson(response, 404, { error: 'Reviewed opportunity not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(pageHtml);
  }
  const prospectCsvMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/exports/(inventory|performance)\\.csv$`));
  if (prospectCsvMatch) {
    const data = await database.prospectImport(Number(prospectCsvMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const context = prospectExportContext(data, url);
    const items = context.items;
    const kind = prospectCsvMatch[2];
    const rows = kind === 'inventory'
      ? [['Opportunity','Category','Published price','Responsible contact','Source URL','Image URL','Review status'], ...items.map(item=>[item.title,item.category,item.price_text,item.responsible_rep,item.source_url,item.image_url||'',item.review_status])]
      : [['Advertiser','Campaign','Opportunity','Category','Campaign status','Report from','Report to','Tracking code','Scans','Website actions','Action rate','Conversions','Conversion rate','Attributed revenue','Published investment reference','Illustrative ROI','Responsible contact','Source URL','Data status'], ...context.performance.map(({item,metrics,investment,actionRate,conversionRate,roi})=>['Sample Local Business','Community response campaign',item.title,item.category,'Active demo campaign',context.range.from,context.range.to,`VVD-${data.prospect.id}-${item.id}`,metrics.scans,metrics.clicks,`${(actionRate*100).toFixed(1)}%`,metrics.conversions,`${(conversionRate*100).toFixed(1)}%`,metrics.revenue,investment||'',roi===null?'':`${Math.round(roi*100)}%`,item.responsible_rep,item.source_url,'Illustrative demo data'])];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const scopeLabel = context.advertiserScope ? 'advertiser-' : '';
    response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${fileSlug(data.prospect.brand_name)}-${scopeLabel}${kind}.csv"`, 'cache-control': 'no-store' });
    return response.end(`${csv}\n`);
  }
  const prospectPdfMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/exports/executive\\.pdf$`));
  if (prospectPdfMatch) {
    const data = await database.prospectImport(Number(prospectPdfMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const context = prospectExportContext(data, url);
    const { items, totals, advertiserScope, selected, performance, range } = context;
    const reportLabel = advertiserScope ? 'Advertiser Executive Report' : 'Publisher Executive Summary';
    response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${fileSlug(data.prospect.brand_name)}-${advertiserScope?'advertiser-':''}executive.pdf"`, 'cache-control': 'no-store' });
    const doc = new PDFDocument({ margin: 46, size: 'LETTER' });
    doc.pipe(response);
    const navy = '#0d2744';
    const green = '#176b3a';
    const ink = '#17251e';
    const muted = '#65776b';
    const card = (x, y, width, label, value, detail) => {
      doc.roundedRect(x, y, width, 66, 8).fillAndStroke('#f4f7f5', '#dbe4df');
      doc.fillColor(muted).fontSize(8).text(label.toUpperCase(), x + 11, y + 10, { width: width - 22 });
      doc.fillColor(navy).fontSize(19).text(value, x + 11, y + 25, { width: width - 22 });
      doc.fillColor(muted).fontSize(7.5).text(detail, x + 11, y + 49, { width: width - 22 });
    };
    doc.fillColor(navy).fontSize(10).text('VIVID SPOTS', { characterSpacing: 1.4 });
    doc.moveDown(.25).fontSize(22).text(data.prospect.brand_name);
    doc.fillColor(green).fontSize(15).text(reportLabel);
    doc.moveDown(.25).fillColor(muted).fontSize(9).text(`${range.from} through ${range.to} · Private prospect demonstration`);
    doc.moveTo(46, 113).lineTo(566, 113).lineWidth(2).strokeColor(green).stroke();
    if (advertiserScope && selected) {
      doc.fillColor(ink).fontSize(11).text('Sample Local Business', 46, 127);
      doc.fillColor(muted).fontSize(9).text(`Community response campaign · ${selected.title} · Tracking code VVD-${data.prospect.id}-${selected.id}`);
    } else {
      doc.fillColor(ink).fontSize(11).text(`${items.length} reviewed advertising opportunities`, 46, 127);
      doc.fillColor(muted).fontSize(9).text('Public-source inventory connected to illustrative Vivid performance reporting.');
    }
    const cardWidth = 124;
    card(46, 165, cardWidth, 'Scans', totals.scans.toLocaleString(), 'Placement engagement');
    card(179, 165, cardWidth, 'Website actions', totals.clicks.toLocaleString(), `${totals.scans ? ((totals.clicks/totals.scans)*100).toFixed(1) : '0.0'}% action rate`);
    card(312, 165, cardWidth, 'Conversions', totals.conversions.toLocaleString(), `${totals.clicks ? ((totals.conversions/totals.clicks)*100).toFixed(1) : '0.0'}% conversion rate`);
    card(445, 165, 121, 'Attributed revenue', formatMoney(totals.revenue), 'Illustrative value');
    doc.fillColor(navy).fontSize(14).text('Measurement funnel', 46, 252);
    doc.fillColor(ink).fontSize(10).text(`${totals.scans.toLocaleString()} scans  →  ${totals.clicks.toLocaleString()} website actions  →  ${totals.conversions.toLocaleString()} conversions  →  ${formatMoney(totals.revenue)} attributed revenue`, 46, 273, { width: 520 });
    if (advertiserScope && performance[0]) {
      const row = performance[0];
      doc.fillColor(navy).fontSize(14).text('Placement and campaign', 46, 316);
      const detailRows = [
        ['Opportunity', row.item.title], ['Category', row.item.category], ['Published investment reference', row.item.price_text],
        ['Responsible contact', row.item.responsible_rep], ['Campaign status', 'Active demo campaign'], ['Campaign destination', row.item.source_url],
        ['Illustrative ROI', row.roi === null ? 'Not calculated — no published price' : `${Math.round(row.roi*100)}% (using published price as investment)`]
      ];
      let y = 338;
      for (const [label,value] of detailRows) {
        doc.fillColor(muted).fontSize(8).text(label.toUpperCase(), 46, y, { width: 155 });
        doc.fillColor(ink).fontSize(9).text(String(value), 205, y, { width: 361 });
        y += Math.max(20, doc.heightOfString(String(value), { width: 361 }) + 6);
      }
      doc.fillColor(navy).fontSize(14).text('Renewal discussion', 46, Math.max(y + 6, 506));
      doc.fillColor(ink).fontSize(9.5).text('Use this report to review placement reach, downstream actions, conversions, attributed value and the next campaign offer. Because the Vivid tracking code remains attached to the placement, the destination can change without replacing the physical asset.', 46, Math.max(y + 28, 528), { width: 520, lineGap: 2 });
    } else {
      doc.fillColor(navy).fontSize(14).text('Reviewed opportunity inventory', 46, 316);
      let y = 340;
      for (const item of items.slice(0, 8)) {
        doc.fillColor(ink).fontSize(9).text(`${item.title} · ${item.category}`, 46, y, { width: 330 });
        doc.fillColor(muted).text(`${item.price_text} · ${item.responsible_rep}`, 380, y, { width: 186, align: 'right' });
        y += 21;
      }
    }
    doc.fillColor(muted).fontSize(7.5).text(`DATA NOTICE: Opportunity details are based on reviewed public sources from ${data.prospect.source_url}. All engagement, conversion, revenue and ROI values are synthetic and do not represent results reported by ${data.prospect.brand_name}.`, 46, 704, { width: 520, align: 'left' });
    doc.end();
    return;
  }
  const prospectXlsxMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/demo/exports/report\\.xlsx$`));
  if (prospectXlsxMatch) {
    const data = await database.prospectImport(Number(prospectXlsxMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const context = prospectExportContext(data, url);
    const { items, totals, advertiserScope, selected, performance, range } = context;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vivid prospect demonstration';
    const addSheet = (name, columns, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map(column => ({ header: column, key: column, width: Math.max(16, column.length + 3) }));
      rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map((column, index) => [column, row[index]]))));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2744' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
    };
    const addReportSheet = (name, title, subtitle, columns, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map((column, index) => ({ key: `c${index}`, width: Math.min(42, Math.max(15, column.length + 4)) }));
      const lastColumn = String.fromCharCode(64 + columns.length);
      sheet.mergeCells(`A1:${lastColumn}1`);
      sheet.getCell('A1').value = title;
      sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2744' } };
      sheet.getCell('A1').alignment = { vertical: 'middle' };
      sheet.getRow(1).height = 30;
      sheet.mergeCells(`A2:${lastColumn}2`);
      sheet.getCell('A2').value = subtitle;
      sheet.getCell('A2').font = { italic: true, color: { argb: 'FF65776B' } };
      sheet.getRow(4).values = columns;
      sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B3A' } };
      rows.forEach(row => sheet.addRow(row));
      sheet.views = [{ state: 'frozen', ySplit: 4 }];
      sheet.autoFilter = { from: 'A4', to: `${lastColumn}4` };
      sheet.pageSetup = { orientation: columns.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .35, right: .35, top: .5, bottom: .5, header: .2, footer: .2 } };
      sheet.headerFooter.oddFooter = '&LPrivate Vivid demonstration&RPage &P of &N';
      for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
        if (rowNumber % 2 === 0) sheet.getRow(rowNumber).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7F5' } };
        sheet.getRow(rowNumber).alignment = { vertical: 'top', wrapText: true };
      }
      return sheet;
    };
    if (advertiserScope && selected && performance[0]) {
      const row = performance[0];
      const reportSubtitle = `${data.prospect.brand_name} · Sample Local Business · ${range.from} through ${range.to} · Illustrative demo performance`;
      const summary = addReportSheet('Executive Summary', 'Vivid Advertiser Executive Report', reportSubtitle, ['Metric','Value','What it shows'], [
        ['Advertiser','Sample Local Business','Illustrative advertiser account'], ['Campaign','Community response campaign','Active demo campaign'], ['Placement',selected.title,'Reviewed public-source opportunity'],
        ['Scans',row.metrics.scans,'Engagements with the placement'], ['Website Actions',row.metrics.clicks,`${(row.actionRate*100).toFixed(1)}% of scans continued to the destination`],
        ['Conversions',row.metrics.conversions,`${(row.conversionRate*100).toFixed(1)}% of website actions converted`], ['Attributed Revenue',row.metrics.revenue,'Illustrative value associated with validated conversions'],
        ['Published Investment Reference',row.investment||'Not published',selected.price_text], ['Illustrative ROI',row.roi===null?'Not calculated':row.roi,'Uses the published price reference as investment'],
        ['Data Status','Illustrative demo data',`Not results reported by ${data.prospect.brand_name}`]
      ]);
      summary.getColumn(2).numFmt = 'General';
      summary.getCell('B11').numFmt = '$#,##0';
      summary.getCell('B12').numFmt = '$#,##0';
      summary.getCell('B13').numFmt = '0%';
      addReportSheet('Campaign Performance', 'Campaign Performance Detail', reportSubtitle, ['Advertiser','Campaign','Placement','Category','Status','Report From','Report To','Tracking Code','Scans','Website Actions','Action Rate','Conversions','Conversion Rate','Attributed Revenue','Investment Reference','Illustrative ROI','Data Status'], [[
        'Sample Local Business','Community response campaign',selected.title,selected.category,'Active demo campaign',range.from,range.to,`VVD-${data.prospect.id}-${selected.id}`,row.metrics.scans,row.metrics.clicks,row.actionRate,row.metrics.conversions,row.conversionRate,row.metrics.revenue,row.investment||'',row.roi===null?'':row.roi,'Illustrative demo data'
      ]]);
      const performanceSheet = workbook.getWorksheet('Campaign Performance');
      performanceSheet.getColumn(11).numFmt = '0.0%';
      performanceSheet.getColumn(13).numFmt = '0.0%';
      performanceSheet.getColumn(14).numFmt = '$#,##0';
      performanceSheet.getColumn(15).numFmt = '$#,##0';
      performanceSheet.getColumn(16).numFmt = '0%';
      addReportSheet('Placement & Campaign', 'Placement and Campaign Setup', reportSubtitle, ['Field','Current demo value'], [
        ['Opportunity',selected.title],['Description',selected.description],['Category',selected.category],['Published Price',selected.price_text],['Responsible Contact',selected.responsible_rep],
        ['Tracking Code',`VVD-${data.prospect.id}-${selected.id}`],['Campaign','Community response campaign'],['Campaign Status','Active demo campaign'],['Destination',selected.source_url],
        ['Campaign Flexibility','Destination and offer can change without replacing the permanent Vivid-powered placement']
      ]);
      addReportSheet('Source Evidence', 'Reviewed Source Evidence', `Source-backed fields used in this private ${data.prospect.brand_name} demonstration`, ['Field','Reviewed value','Public source','Data classification'], [
        ['Organization',data.prospect.brand_name,data.prospect.source_url,'Public-source information'],['Opportunity',selected.title,selected.source_url,'Public-source information'],['Description',selected.description,selected.source_url,'Public-source information'],
        ['Category',selected.category,selected.source_url,'Vivid classification based on source'],['Published Price',selected.price_text,selected.source_url,'Public-source information'],['Responsible Contact',selected.responsible_rep,selected.source_url,'Public-source information'],
        ['Performance metrics','Synthetic demonstration values','Vivid demo engine','Illustrative demo data']
      ]);
      addReportSheet('Metric Definitions', 'Metric Definitions and Data Notes', 'Definitions used across the Vivid advertiser report', ['Metric','Definition','Demo status'], [
        ['Scans','Recorded engagements with the Vivid-powered placement or QR code.','Illustrative'],['Website Actions','Downstream visits or actions after the initial engagement.','Illustrative'],
        ['Action Rate','Website Actions divided by Scans.','Calculated from illustrative data'],['Conversions','Validated business outcomes attributed to the campaign.','Illustrative'],
        ['Conversion Rate','Conversions divided by Website Actions.','Calculated from illustrative data'],['Attributed Revenue','Revenue value assigned to validated conversions.','Illustrative'],
        ['Illustrative ROI','Attributed Revenue minus the published investment reference, divided by that reference.','Calculated demonstration only']
      ]);
    } else {
      addSheet('Executive Summary', ['Organization','Opportunity Count','Scans','Website Actions','Conversions','Attributed Revenue','Data Status'], [[data.prospect.brand_name,items.length,totals.scans,totals.clicks,totals.conversions,totals.revenue,'Illustrative demo data']]);
      addSheet('Inventory', ['Opportunity','Category','Published Price','Responsible Contact','Source URL','Image URL','Review Status'], items.map(item=>[item.title,item.category,item.price_text,item.responsible_rep,item.source_url,item.image_url||'',item.review_status]));
      addSheet('Performance', ['Opportunity','Category','Scans','Website Actions','Conversions','Attributed Revenue','Data Status'], performance.map(({item,metrics})=>[item.title,item.category,metrics.scans,metrics.clicks,metrics.conversions,metrics.revenue,'Illustrative demo data']));
      addSheet('Sales Responsibility', ['Opportunity','Responsible Contact','Category','Published Price','Source URL'], items.map(item=>[item.title,item.responsible_rep,item.category,item.price_text,item.source_url]));
    }
    response.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${fileSlug(data.prospect.brand_name)}-${advertiserScope?'advertiser-':''}report.xlsx"`, 'cache-control': 'no-store' });
    await workbook.xlsx.write(response);
    return response.end();
  }
  const builderImportMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)$`));
  if (builderImportMatch) {
    const importId = Number(builderImportMatch[1]);
    const [data, locations, packages] = await Promise.all([database.prospectImport(importId), database.locations(), database.prospectPackages(importId)]);
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    const messages = { created: 'Website analysis saved as reviewable drafts. Nothing has been published.', published: 'Approved drafts published to the isolated Marketplace.', reset: 'Only the Marketplace records from this import were removed.', saved: 'Changes saved.', reviewed: 'Review decision saved.' };
    const message = Object.entries(messages).find(([key]) => url.searchParams.get(key) === '1')?.[1] || '';
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.builderImportPage(basePath, data, locations, packages, message, url.searchParams.get('error') || ''));
  }
  const builderBrandMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/brand$`));
  if (builderBrandMatch) {
    const form = await readForm(request);
    const logoUrl = String(form.get('logoUrl') || '').trim();
    if (logoUrl && !publicWebUrl(logoUrl)) return sendJson(response, 400, { error: 'Logo must use a public HTTP or HTTPS URL' });
    await database.updateProspectBrand(Number(builderBrandMatch[1]), {
      brandName: String(form.get('brandName') || '').trim(),
      primaryColor: String(form.get('primaryColor') || ''),
      logoUrl: publicWebUrl(logoUrl)
    });
    response.writeHead(303, { location: `${basePath}/builder/import/${builderBrandMatch[1]}?saved=1` });
    return response.end();
  }
  const builderDraftMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/draft/(\\d+)$`));
  if (builderDraftMatch) {
    const form = await readForm(request);
    const sourceUrl = publicWebUrl(form.get('sourceUrl'));
    const rawImageUrl = String(form.get('imageUrl') || '').trim();
    if (!sourceUrl || (rawImageUrl && !publicWebUrl(rawImageUrl))) return sendJson(response, 400, { error: 'Source and image fields must use public HTTP or HTTPS URLs' });
    const importId = await database.updateProspectDraft(Number(builderDraftMatch[1]), {
      title: String(form.get('title') || '').trim(), description: String(form.get('description') || '').trim(),
      category: String(form.get('category') || '').trim(), priceText: String(form.get('priceText') || '').trim(),
      sourceUrl, imageUrl: publicWebUrl(rawImageUrl),
      responsibleRep: String(form.get('responsibleRep') || '').trim()
    });
    if (!importId) return sendJson(response, 404, { error: 'Draft not found' });
    response.writeHead(303, { location: `${basePath}/builder/import/${importId}?saved=1` });
    return response.end();
  }
  const builderDraftStatusMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/draft/(\\d+)/status$`));
  if (builderDraftStatusMatch) {
    const form = await readForm(request);
    const importId = await database.setProspectDraftStatus(Number(builderDraftStatusMatch[1]), String(form.get('status') || ''));
    if (!importId) return sendJson(response, 400, { error: 'Draft could not be reviewed' });
    response.writeHead(303, { location: `${basePath}/builder/import/${importId}?reviewed=1` });
    return response.end();
  }
  const builderPublishMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/publish$`));
  if (builderPublishMatch) {
    const form = await readForm(request);
    try {
      await database.publishProspectImport(Number(builderPublishMatch[1]), Number(form.get('locationId')));
      response.writeHead(303, { location: `${basePath}/builder/import/${builderPublishMatch[1]}?published=1` });
    } catch (error) {
      response.writeHead(303, { location: `${basePath}/builder/import/${builderPublishMatch[1]}?error=${encodeURIComponent(error.message)}` });
    }
    return response.end();
  }
  const builderResetMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/reset$`));
  if (builderResetMatch) {
    const form = await readForm(request);
    if (form.get('confirmation') !== 'RESET') return sendJson(response, 400, { error: 'Reset confirmation required' });
    await database.resetProspectImport(Number(builderResetMatch[1]));
    response.writeHead(303, { location: `${basePath}/builder/import/${builderResetMatch[1]}?reset=1` });
    return response.end();
  }
  const builderPreviewMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/preview$`));
  if (builderPreviewMatch) {
    const data = await database.prospectImport(Number(builderPreviewMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.prospectPreviewPage(basePath, data));
  }
  const builderManifestMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/manifest\\.json$`));
  if (builderManifestMatch) {
    const data = await database.prospectImport(Number(builderManifestMatch[1]));
    if (!data) return sendJson(response, 404, { error: 'Prospect import not found' });
    return sendJson(response, 200, {
      version: 1, sourceUrl: data.prospect.source_url,
      organization: { name: data.prospect.brand_name, primaryColor: data.prospect.primary_color, logoUrl: data.prospect.logo_url, description: data.prospect.website_description, publicWebsite: data.prospect.source_url },
      opportunities: data.drafts.filter(item => ['approved', 'published'].includes(item.review_status)).map(item => ({ title: item.title, description: item.description, category: item.category, displayPrice: item.price_text, sourceUrl: item.source_url, imageUrl: item.image_url, responsibleRep: item.responsible_rep })),
      externalEffectsEnabled: false, sampleDataOnly: true
    });
  }
  const builderPackageCreateMatch = request.method === 'POST' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/package$`));
  if (builderPackageCreateMatch) {
    try {
      const packageRow = await database.createProspectPackage(Number(builderPackageCreateMatch[1]));
      response.writeHead(303, { location: `${basePath}/builder/import/${builderPackageCreateMatch[1]}/package/${packageRow.id}?created=1`, 'cache-control': 'no-store' });
    } catch (error) {
      response.writeHead(303, { location: `${basePath}/builder/import/${builderPackageCreateMatch[1]}?error=${encodeURIComponent(error.message)}`, 'cache-control': 'no-store' });
    }
    return response.end();
  }
  const builderPackageMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/package/(\\d+)$`));
  if (builderPackageMatch) {
    const packageRow = await database.prospectPackage(Number(builderPackageMatch[1]), Number(builderPackageMatch[2]));
    if (!packageRow) return sendJson(response, 404, { error: 'Demo package not found' });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' });
    return response.end(views.provisionPackagePage(basePath, packageRow, url.searchParams.get('created') === '1'));
  }
  const builderPackageJsonMatch = request.method === 'GET' && url.pathname.match(new RegExp(`^${basePath}/builder/import/(\\d+)/package/(\\d+)/(manifest|plan)\\.json$`));
  if (builderPackageJsonMatch) {
    const packageRow = await database.prospectPackage(Number(builderPackageJsonMatch[1]), Number(builderPackageJsonMatch[2]));
    if (!packageRow) return sendJson(response, 404, { error: 'Demo package not found' });
    return sendJson(response, 200, builderPackageJsonMatch[3] === 'manifest' ? packageRow.manifest : packageRow.clone_plan);
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
