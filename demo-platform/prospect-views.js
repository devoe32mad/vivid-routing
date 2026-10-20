'use strict';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function reviewed(data) {
  return data.drafts.filter(item => ['approved', 'published'].includes(item.review_status));
}

function amount(value) {
  const match = String(value || '').match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replaceAll(',', '')) : 0;
}

function portalBase(base, prospect) {
  return `${base}/builder/import/${prospect.id}/demo`;
}

function nav(base, prospect, active) {
  const root = portalBase(base, prospect);
  const links = [
    ['Publisher Portal', `${root}/organization`, 'organization'],
    ['Marketplace', `${root}/marketplace`, 'marketplace'],
    ['Advertiser Portal', `${root}/advertiser`, 'advertiser'],
    ['Before / After', `${base}/builder/import/${prospect.id}/preview`, 'preview'],
    ['Review Sources', `${base}/builder/import/${prospect.id}`, 'review']
  ];
  return links.map(([label, href, key]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${h(label)}</a>`).join('');
}

function shell({ base, prospect, title, eyebrow, heading, subtitle, active, content }) {
  const accent = /^#[0-9a-f]{6}$/i.test(prospect.primary_color) ? prospect.primary_color : '#176b3a';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${h(title)} · Vivid</title><style>
  :root{--accent:${h(accent)};--forest:#073b22;--ink:#183126;--muted:#65776b;--line:#dfe7df;--bg:#f4f7f4;--gold:#c5922f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}a{color:var(--forest)}header{background:white;border-bottom:1px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.06);padding:15px 3vw;position:sticky;top:0;z-index:20}.brand{max-width:1250px;margin:auto;display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}.brand strong{display:block;color:var(--forest);font-size:21px}.brand small{display:block;color:var(--muted)}.logo{max-width:190px;max-height:60px;object-fit:contain}.portal-nav{max-width:1250px;margin:13px auto 0;display:flex;gap:8px;flex-wrap:wrap}.portal-nav a{background:#2f7d46;color:white;text-decoration:none;padding:10px 13px;border-radius:9px;font-weight:800}.portal-nav a[aria-current=page]{background:var(--forest)}.hero{background:linear-gradient(115deg,var(--forest),var(--accent));color:white;padding:30px 4vw}.hero>div,.wrap{max-width:1250px;margin:auto}.hero h1{font-size:clamp(28px,4vw,43px);margin:5px 0}.hero p{max-width:800px;margin:0;opacity:.92}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:850}.wrap{padding:26px 20px 60px}.notice{border-left:4px solid var(--gold);background:#fff9e9;padding:13px 15px;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.metrics{margin:18px 0 26px}.metric,.card,.panel{background:white;border:1px solid var(--line);border-radius:14px;box-shadow:0 5px 14px rgba(0,0,0,.055)}.metric{padding:17px;min-height:120px}.metric span{color:var(--muted);display:block}.metric strong{display:block;color:var(--forest);font-size:28px;margin:6px 0}.metric.link{display:block;text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s}.metric.link:hover{transform:translateY(-2px);box-shadow:0 9px 22px rgba(0,0,0,.09)}.metric small{color:var(--muted)}.card{padding:17px;display:flex;flex-direction:column}.card h2,.card h3,.panel h2{color:var(--forest);margin:5px 0 8px}.card p{color:var(--muted)}.panel{padding:20px;margin:18px 0;overflow:hidden}.market{display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:18px}.opportunity-image{width:100%;height:185px;object-fit:cover;border-radius:10px;margin-bottom:13px;background:#e8eee9}.thumb{width:88px;height:58px;object-fit:cover;border-radius:8px;background:#e8eee9}.tag,.status{display:inline-block;padding:5px 9px;border-radius:999px;background:#e1f1e6;color:var(--forest);font-size:11px;font-weight:850;text-transform:uppercase}.status{background:#e5f1fb;color:#135b91}.price{font-size:23px;color:var(--forest);font-weight:850}.btn{display:inline-block;background:var(--accent);color:white!important;text-decoration:none;border-radius:9px;padding:10px 13px;font-weight:850;margin-top:auto}.btn.secondary{background:white;color:var(--forest)!important;border:1px solid #99b6a3}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:11px;color:var(--muted);text-transform:uppercase}.module-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 19px}.module-nav a{padding:8px 10px;border-radius:8px;background:white;border:1px solid #a7bcae;text-decoration:none;font-weight:750}.module-nav a[aria-current=page]{background:var(--forest);color:white}.source{overflow-wrap:anywhere}.empty{text-align:center;color:var(--muted);padding:28px}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end}.filters label{display:grid;gap:4px;min-width:190px}.filters input,.filters select{font:inherit;padding:10px 12px;border:1px solid #b6c6bb;border-radius:8px;background:white}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}.step{padding:13px;border-radius:10px;border:1px solid var(--line);background:white;text-decoration:none}.step[aria-current=step]{background:var(--forest);color:white}.step strong{display:block}.step small{display:block;color:inherit;opacity:.75}@media(max-width:760px){header{position:static}.portal-nav{overflow-x:auto;flex-wrap:nowrap}.two{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}.wrap{padding-inline:14px}}
  </style></head><body><header><div class="brand"><div><strong>${h(prospect.brand_name)}</strong><small>Prospect-specific Vivid demonstration · Public sources + illustrative workflow data</small></div>${prospect.logo_url ? `<img class="logo" src="${h(prospect.logo_url)}" alt="${h(prospect.brand_name)} logo" loading="lazy" referrerpolicy="no-referrer">` : ''}</div><nav class="portal-nav">${nav(base, prospect, active)}</nav></header><section class="hero"><div><div class="eyebrow">${h(eyebrow)}</div><h1>${h(heading)}</h1><p>${h(subtitle)}</p></div></section><main class="wrap"><div class="notice"><strong>Private demo:</strong> organization and opportunity details come from reviewed public sources. Advertisers, workflow statuses and results are illustrative. No email, payment, connector or production action is enabled.</div>${content}</main></body></html>`;
}

function publisherModules(root, section) {
  const links = [['Overview','overview'],['Locations','locations'],['Advertisers','advertisers'],['Advertising Inventory','inventory'],['Advertising Requests','requests'],['Contracts','contracts'],['Renewals','renewals'],['Revenue Pipeline','pipeline'],['Performance Insights','performance'],['Reports','reports'],['Sales Rep Report','responsibility'],['Administration','administration'],['Help','help']];
  return `<nav class="module-nav">${links.map(([label,key])=>`<a href="${root}/organization?section=${key}"${section===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}

function sampleMetrics(item, index) {
  const seed = Number(item.id || index + 1);
  const scans = 72 + (seed % 7) * 19;
  const clicks = Math.round(scans * .61);
  const conversions = Math.max(2, Math.round(clicks * .13));
  const revenue = conversions * (225 + (seed % 4) * 75);
  return { scans, clicks, conversions, revenue };
}

function metricLink(label, value, note, href) {
  return `<a class="metric link" href="${h(href)}"><span>${h(label)}</span><strong>${h(value)}</strong>${note ? `<small>${h(note)}</small>` : ''}</a>`;
}

function advertiserModules(root, section, selectedId) {
  const suffix = selectedId ? `&opportunity_id=${selectedId}` : '';
  const links = [['Overview','overview'],['My Setup','setup'],['Reports','reports'],['Performance Insights','performance'],['Archive Center','archive'],['Export Center','exports'],['Help','help']];
  return `<nav class="module-nav">${links.map(([label,key])=>`<a href="${root}/advertiser?section=${key}${suffix}"${section===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}

function totalsFor(items) {
  return items.reduce((out,item,index)=>{const m=sampleMetrics(item,index);out.scans+=m.scans;out.clicks+=m.clicks;out.conversions+=m.conversions;out.revenue+=m.revenue;return out;},{scans:0,clicks:0,conversions:0,revenue:0});
}

function opportunityRows(base, prospect, items) {
  const root = portalBase(base, prospect);
  return items.map(item => `<tr><td>${item.image_url ? `<img class="thumb" src="${h(item.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '—'}</td><td><a href="${root}/opportunity/${item.id}"><strong>${h(item.title)}</strong></a><br><small>${h(item.description)}</small></td><td>${h(item.category)}</td><td><strong>${h(item.price_text)}</strong></td><td>${h(item.responsible_rep)}</td><td><a class="source" href="${h(item.source_url)}" target="_blank" rel="noopener noreferrer">Public source ↗</a></td></tr>`).join('');
}

function prospectOrganizationPage(base, data, section = 'overview') {
  const p = data.prospect;
  const items = reviewed(data);
  const root = portalBase(base, p);
  const categories = [...new Set(items.map(item => item.category))];
  const totalValue = items.reduce((sum, item) => sum + amount(item.price_text), 0);
  const reps = [...new Set(items.map(item => item.responsible_rep).filter(Boolean))];
  let content;
  if (section === 'inventory' || section === 'locations') {
    content = `<div class="grid metrics">${metricLink('Public opportunities',items.length,'Reviewed inventory',`${root}/organization?section=inventory`)}${metricLink('Programs / formats',categories.length,'Source-backed categories',`${root}/organization?section=locations`)}${metricLink('Published price references',items.filter(item=>amount(item.price_text)>0).length,'No invented pricing',`${root}/organization?section=inventory`)}${metricLink('Visible inventory value',`$${totalValue.toLocaleString()}`,'Published values only',`${root}/organization?section=pipeline`)}</div><section class="panel"><h2>${section==='locations'?'Programs and locations':'Advertising Inventory'}</h2><div class="table-wrap"><table><thead><tr><th>Image</th><th>Opportunity</th><th>Format</th><th>Public price</th><th>Responsible contact</th><th>Evidence</th></tr></thead><tbody>${opportunityRows(base,p,items)}</tbody></table></div></section>`;
  } else if (section === 'responsibility' || section === 'administration') {
    content = `<section class="panel"><h2>${section==='responsibility'?'Sales Responsibility':'Administration'}</h2><p>Publicly identified contacts are carried into the demo for review; ownership can be reassigned before release.</p><div class="grid">${(reps.length?reps:['Unassigned']).map(rep=>`<article class="card"><span class="tag">Demo owner</span><h3>${h(rep)}</h3><p>${items.filter(item=>item.responsible_rep===rep).length} source-backed opportunities assigned.</p></article>`).join('')}</div></section>`;
  } else if (['advertisers','requests','contracts','renewals','pipeline'].includes(section)) {
    const labels = {advertisers:'Advertisers',requests:'Advertising Requests',contracts:'Contracts',renewals:'Renewals',pipeline:'Revenue Pipeline'};
    content = `<section class="panel"><h2>${labels[section]}</h2><p>This prospect demo connects reviewed inventory to the complete Vivid workflow. The records below are illustrative and do not represent actual ${h(p.brand_name)} customers.</p><div class="table-wrap"><table><thead><tr><th>Sample advertiser</th><th>Opportunity</th><th>Stage</th><th>Value</th><th>Owner</th></tr></thead><tbody>${items.slice(0,5).map((item,index)=>`<tr><td>Sample Advertiser ${index+1}</td><td><a href="${root}/opportunity/${item.id}">${h(item.title)}</a></td><td>${section==='renewals'?'Renewal planning':section==='contracts'?'Active demo contract':section==='requests'?'Pending review':'Demo pipeline'}</td><td>${h(item.price_text)}</td><td>${h(item.responsible_rep)}</td></tr>`).join('')}</tbody></table></div></section>`;
  } else if (['performance','reports'].includes(section)) {
    const totals = totalsFor(items);
    const exports = section==='reports' ? `<div class="module-nav"><a href="${root}/exports/inventory.csv">Inventory CSV</a><a href="${root}/exports/performance.csv">Performance CSV</a><a href="${root}/exports/executive.pdf">Executive PDF</a><a href="${root}/exports/report.xlsx">Excel workbook</a></div>` : '';
    content = `<div class="notice"><strong>Illustrative performance only:</strong> these results demonstrate Vivid’s reporting structure; they are not results reported by ${h(p.brand_name)}.</div><div class="grid metrics">${metricLink('Scans',totals.scans.toLocaleString(),'Placement engagement',`${root}/organization?section=performance`)}${metricLink('Website actions',totals.clicks.toLocaleString(),'Downstream actions',`${root}/organization?section=performance`)}${metricLink('Conversions',totals.conversions,'Illustrative outcomes',`${root}/organization?section=performance`)}${metricLink('Attributed revenue',`$${totals.revenue.toLocaleString()}`,'Illustrative value',`${root}/organization?section=reports`)}</div>${exports}<section class="panel"><h2>${section==='reports'?'Source-level Reports':'Performance Insights'}</h2><div class="table-wrap"><table><thead><tr><th>Opportunity</th><th>Scans</th><th>Actions</th><th>Conversions</th><th>Revenue</th></tr></thead><tbody>${items.map((item,index)=>{const m=sampleMetrics(item,index);return `<tr><td><a href="${root}/opportunity/${item.id}">${h(item.title)}</a></td><td>${m.scans}</td><td>${m.clicks}</td><td>${m.conversions}</td><td>$${m.revenue.toLocaleString()}</td></tr>`}).join('')}</tbody></table></div></section>`;
  } else if (section === 'help') {
    content = `<div class="grid"><article class="card"><h2>Inventory</h2><p>Review public opportunities, pricing, imagery and responsible contacts before release.</p></article><article class="card"><h2>Marketplace</h2><p>Give advertisers one organized destination to discover and request opportunities.</p></article><article class="card"><h2>Advertiser reporting</h2><p>Connect each placement to changeable campaigns, scans, actions, conversions and revenue.</p></article></div>`;
  } else {
    content = `<div class="grid metrics">${metricLink('Advertising opportunities',items.length,'Reviewed public sources',`${root}/organization?section=inventory`)}${metricLink('Programs / formats',categories.length,'View programs',`${root}/organization?section=locations`)}${metricLink('Published price references',items.filter(item=>amount(item.price_text)>0).length,'No invented pricing',`${root}/organization?section=inventory`)}${metricLink('Visible inventory value',`$${totalValue.toLocaleString()}`,'Published values only',`${root}/organization?section=pipeline`)}${metricLink('Responsible contacts',reps.length,'View ownership',`${root}/organization?section=responsibility`)}</div><div class="two"><section class="panel"><h2>Organization summary</h2><p>${h(p.website_description || `${p.brand_name} advertising and sponsorship opportunities organized in Vivid.`)}</p><p><a href="${h(p.source_url)}" target="_blank" rel="noopener noreferrer">Open current public website ↗</a></p></section><section class="panel"><h2>Connected Vivid workflow</h2><p>Inventory → Marketplace request → advertiser setup → campaign → performance → contract → renewal.</p><a class="btn" href="${root}/marketplace">Open Public Marketplace</a></section></div><section class="panel"><h2>Opportunity overview</h2><div class="table-wrap"><table><thead><tr><th>Image</th><th>Opportunity</th><th>Format</th><th>Public price</th><th>Responsible contact</th><th>Evidence</th></tr></thead><tbody>${opportunityRows(base,p,items)}</tbody></table></div></section>`;
  }
  return shell({ base, prospect:p, title:`${p.brand_name} Publisher Portal`, eyebrow:'Vivid Publisher Portal', heading: section==='overview'?'Executive Overview':section.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()), subtitle:'Manage advertising inventory, ownership, requests, contracts, fulfillment, reporting and renewals in one connected platform.', active:'organization', content:`${publisherModules(root,section)}${content}` });
}

function prospectMarketplacePage(base, data, filters = {}) {
  const p = data.prospect;
  const allItems = reviewed(data);
  const root = portalBase(base, p);
  const query = String(filters.query || '').trim().toLowerCase();
  const category = String(filters.category || '').trim();
  const categories = [...new Set(allItems.map(item=>item.category))];
  const items = allItems.filter(item => (!category || item.category===category) && (!query || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)));
  const options = categories.map(value=>`<option value="${h(value)}"${category===value?' selected':''}>${h(value)}</option>`).join('');
  const cards = items.map(item=>`<article class="card">${item.image_url?`<img class="opportunity-image" src="${h(item.image_url)}" alt="${h(item.title)}" loading="lazy" referrerpolicy="no-referrer">`:''}<div><span class="tag">${h(item.category)}</span> <span class="status">Available</span></div><h2>${h(item.title)}</h2><p>${h(item.description)}</p><p class="price">${h(item.price_text)}</p><p><strong>Contact:</strong> ${h(item.responsible_rep)}</p><a class="btn" href="${root}/opportunity/${item.id}">View Opportunity</a></article>`).join('');
  const filtersHtml = `<section class="panel"><form class="filters" method="get" action="${root}/marketplace"><label><strong>Search opportunities</strong><input name="q" value="${h(filters.query || '')}" placeholder="Advertising, sponsorship, event…"></label><label><strong>Program / format</strong><select name="category"><option value="">All opportunities</option>${options}</select></label><button class="btn" type="submit">Apply filters</button><a class="btn secondary" href="${root}/marketplace">Clear</a></form></section>`;
  return shell({ base, prospect:p, title:`Advertise with ${p.brand_name}`, eyebrow:'Advertising Marketplace', heading:`Reach the ${p.brand_name} community`, subtitle:'Explore reviewed advertising, sponsorship, publication and event opportunities in one organized Marketplace.', active:'marketplace', content:`<div class="grid metrics">${metricLink('Available opportunities',allItems.length,'Reviewed public inventory',`${root}/marketplace`)}${metricLink('Programs / formats',categories.length,'Filter by category',`${root}/marketplace`)}${metricLink('Measurable with Vivid','Yes','Dynamic QR and attribution',`${root}/advertiser`)}</div>${filtersHtml}<p><strong>${items.length}</strong> matching ${items.length===1?'opportunity':'opportunities'}</p><div class="market">${cards || '<section class="panel empty">No opportunities match these filters.</section>'}</div>` });
}

function prospectAdvertiserPage(base, data, selectedId, section = 'overview') {
  const p = data.prospect;
  const items = reviewed(data);
  const selected = items.find(item=>Number(item.id)===Number(selectedId)) || items[0];
  const root = portalBase(base,p);
  const metrics = selected ? sampleMetrics(selected,0) : {scans:0,clicks:0,conversions:0,revenue:0};
  const selector = items.map(item=>`<option value="${item.id}"${selected?.id===item.id?' selected':''}>${h(item.title)}</option>`).join('');
  const selectForm = `<form class="panel filters" method="get" action="${root}/advertiser"><input type="hidden" name="section" value="${h(section)}"><label><strong>Demo placement</strong><select name="opportunity_id">${selector}</select></label><button class="btn" type="submit">View placement</button></form>`;
  let content = '<section class="panel empty">Approve an opportunity to populate the advertiser demo.</section>';
  if (selected) {
    const detail = `<a href="${root}/opportunity/${selected.id}">${h(selected.title)}</a>`;
    if (section === 'setup') {
      content = `<div class="grid"><article class="card"><span class="tag">Placement & QR code</span><h2>${detail}</h2><p><strong>Tracking code:</strong> VVD-${p.id}-${selected.id}</p><p><strong>Status:</strong> Active demo assignment</p></article><article class="card"><span class="tag">Campaign</span><h2>Community response campaign</h2><p><strong>Destination:</strong> ${h(selected.source_url)}</p><p>Change the destination or offer without replacing the permanent code.</p></article><article class="card"><span class="tag">Assignment</span><h2>${h(selected.category)}</h2><p>Responsible contact: ${h(selected.responsible_rep)}</p></article><article class="card"><span class="tag">Schedule</span><h2>Always active</h2><p>Illustrative campaign runs daily; production scheduling can be date-, day- and time-specific.</p></article></div>`;
    } else if (section === 'reports' || section === 'performance') {
      content = `<div class="notice"><strong>Illustrative performance only:</strong> results demonstrate Vivid reporting and are not reported by ${h(p.brand_name)}.</div><div class="grid metrics">${metricLink('Scans',metrics.scans,'Placement engagement',`${root}/advertiser?section=performance&opportunity_id=${selected.id}`)}${metricLink('Website actions',metrics.clicks,'Downstream actions',`${root}/advertiser?section=performance&opportunity_id=${selected.id}`)}${metricLink('Conversions',metrics.conversions,'Illustrative outcomes',`${root}/advertiser?section=performance&opportunity_id=${selected.id}`)}${metricLink('Attributed revenue',`$${metrics.revenue.toLocaleString()}`,'Illustrative value',`${root}/advertiser?section=reports&opportunity_id=${selected.id}`)}</div><section class="panel"><h2>${section==='reports'?'Campaign Reports':'Performance Insights'}</h2><div class="table-wrap"><table><thead><tr><th>Campaign</th><th>Placement</th><th>Scans</th><th>Actions</th><th>Conversions</th><th>Revenue</th></tr></thead><tbody><tr><td>Community response campaign</td><td>${detail}</td><td>${metrics.scans}</td><td>${metrics.clicks}</td><td>${metrics.conversions}</td><td>$${metrics.revenue.toLocaleString()}</td></tr></tbody></table></div></section>`;
    } else if (section === 'exports') {
      content = `<div class="grid"><article class="card"><h2>Campaign Performance</h2><p>Placement, scan, action, conversion and revenue detail.</p><a class="btn" href="${root}/exports/performance.csv">CSV</a></article><article class="card"><h2>Executive Summary</h2><p>Presentation-ready publisher and advertiser overview.</p><a class="btn" href="${root}/exports/executive.pdf">PDF</a></article><article class="card"><h2>Complete Workbook</h2><p>Executive, inventory, performance and responsibility tabs.</p><a class="btn" href="${root}/exports/report.xlsx">Excel</a></article></div>`;
    } else if (section === 'archive') {
      content = `<section class="panel empty"><h2>No archived demo campaigns</h2><p>Completed campaigns move here with their historical results intact.</p></section>`;
    } else if (section === 'help') {
      content = `<div class="grid"><article class="card"><h2>Change a campaign</h2><p>Update the destination or offer without replacing the QR code or physical placement.</p></article><article class="card"><h2>Understand results</h2><p>Drill from scans to website actions, conversions, attributed revenue and source evidence.</p></article><article class="card"><h2>Export evidence</h2><p>Download campaign and executive reporting for internal review and renewal discussions.</p></article></div>`;
    } else {
      content = `<div class="notice"><strong>Illustrative performance only:</strong> the opportunity, price, image and contact come from reviewed public sources; results are synthetic.</div><div class="grid metrics">${metricLink('Scans',metrics.scans,'Placement engagement',`${root}/advertiser?section=performance&opportunity_id=${selected.id}`)}${metricLink('Website actions',metrics.clicks,'Downstream actions',`${root}/advertiser?section=performance&opportunity_id=${selected.id}`)}${metricLink('Conversions',metrics.conversions,'Illustrative outcomes',`${root}/advertiser?section=reports&opportunity_id=${selected.id}`)}${metricLink('Attributed revenue',`$${metrics.revenue.toLocaleString()}`,'Illustrative value',`${root}/advertiser?section=reports&opportunity_id=${selected.id}`)}</div><div class="two"><article class="card">${selected.image_url?`<img class="opportunity-image" src="${h(selected.image_url)}" alt="${h(selected.title)}" loading="lazy" referrerpolicy="no-referrer">`:''}<span class="tag">Active demo placement</span><h2>${h(selected.title)}</h2><p>${h(selected.description)}</p><p class="price">${h(selected.price_text)}</p><a class="btn secondary" href="${root}/opportunity/${selected.id}">Open placement details</a></article><section class="panel"><h2>Dynamic campaign setup</h2><p><strong>Tracking code:</strong> VVD-${p.id}-${selected.id}</p><p><strong>Destination:</strong> ${h(selected.source_url)}</p><p>The advertiser can change the campaign destination and creative without replacing the permanent Vivid-powered placement.</p><a class="btn" href="${root}/advertiser?section=setup&opportunity_id=${selected.id}">Open My Setup</a></section></div>`;
    }
  }
  return shell({ base, prospect:p, title:`${p.brand_name} Advertiser Portal`, eyebrow:'Vivid Advertiser Portal', heading:section==='overview'?'Advertiser Overview':section.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()), subtitle:'Manage placements, reusable campaigns, source-level results and renewal evidence in one connected portal.', active:'advertiser', content:`${advertiserModules(root,section,selected?.id)}${selectForm}${content}` });
}

function prospectOpportunityPage(base, data, draftId) {
  const p = data.prospect;
  const item = reviewed(data).find(row=>Number(row.id)===Number(draftId));
  if (!item) return null;
  const root = portalBase(base,p);
  const metrics = sampleMetrics(item,0);
  return shell({ base, prospect:p, title:item.title, eyebrow:item.category, heading:item.title, subtitle:'Source-backed opportunity with a complete Vivid operating and measurement workflow.', active:'marketplace', content:`<a class="btn secondary" href="${root}/marketplace">← Back to Marketplace</a><div class="two" style="margin-top:18px"><article class="card">${item.image_url?`<img class="opportunity-image" src="${h(item.image_url)}" alt="${h(item.title)}" loading="lazy" referrerpolicy="no-referrer">`:''}<span class="tag">Public-source inventory</span><h2>${h(item.title)}</h2><p>${h(item.description)}</p><p class="price">${h(item.price_text)}</p><p><strong>Responsible contact:</strong> ${h(item.responsible_rep)}</p><p><a href="${h(item.source_url)}" target="_blank" rel="noopener noreferrer">Verify on public website ↗</a></p><a class="btn" href="${root}/onboarding/${item.id}">Preview Request & Onboarding</a></article><section class="panel"><h2>Vivid demonstration setup</h2><p><strong>Reusable tracking code:</strong> VVD-${p.id}-${item.id}</p><p><strong>Campaign destination:</strong> can change without replacing the placement.</p><p><strong>Workflow:</strong> Request → approval → contract → fulfillment → campaign → reporting → renewal.</p><h2>Illustrative reporting</h2><div class="grid"><article class="metric"><span>Scans</span><strong>${metrics.scans}</strong></article><article class="metric"><span>Actions</span><strong>${metrics.clicks}</strong></article><article class="metric"><span>Conversions</span><strong>${metrics.conversions}</strong></article><article class="metric"><span>Revenue</span><strong>$${metrics.revenue.toLocaleString()}</strong></article></div></section></div>` });
}

function prospectOnboardingPage(base, data, draftId, step = 'request') {
  const p = data.prospect;
  const item = reviewed(data).find(row=>Number(row.id)===Number(draftId));
  if (!item) return null;
  const root = portalBase(base,p);
  const steps = [['request','1','Request'],['approval','2','Approval'],['account','3','Advertiser setup'],['campaign','4','Campaign live']];
  const stepNav = `<nav class="steps">${steps.map(([key,number,label])=>`<a class="step" href="${root}/onboarding/${item.id}?step=${key}"${step===key?' aria-current="step"':''}><small>Step ${number}</small><strong>${label}</strong></a>`).join('')}</nav>`;
  const panels = {
    request:`<section class="panel"><span class="tag">Marketplace request</span><h2>Opportunity and contact captured</h2><p><strong>Opportunity:</strong> ${h(item.title)}</p><p><strong>Published price:</strong> ${h(item.price_text)}</p><p><strong>Prospective advertiser:</strong> Sample Local Business</p><p><strong>Contact:</strong> Demo User · demo@example.invalid</p><a class="btn" href="${root}/onboarding/${item.id}?step=approval">Continue to approval</a></section>`,
    approval:`<section class="panel"><span class="tag">Publisher review</span><h2>Approve the request and assign ownership</h2><p>The opportunity, advertiser request and source evidence stay connected. The assigned owner is <strong>${h(item.responsible_rep)}</strong>.</p><p><strong>No production action occurs in this demonstration.</strong></p><a class="btn" href="${root}/onboarding/${item.id}?step=account">Preview advertiser setup</a></section>`,
    account:`<section class="panel"><span class="tag">Advertiser onboarding</span><h2>Known information transfers into setup</h2><div class="table-wrap"><table><tbody><tr><th>Advertiser</th><td>Sample Local Business</td></tr><tr><th>Placement</th><td>${h(item.title)}</td></tr><tr><th>Investment</th><td>${h(item.price_text)}</td></tr><tr><th>Tracking code</th><td>VVD-${p.id}-${item.id}</td></tr><tr><th>Destination</th><td>${h(item.source_url)}</td></tr></tbody></table></div><a class="btn" href="${root}/onboarding/${item.id}?step=campaign">Preview active campaign</a></section>`,
    campaign:`<section class="panel"><span class="tag">Campaign active</span><h2>The advertiser is ready to measure and optimize</h2><p>The permanent placement connects to a destination that can change without replacing the QR code. Vivid reports scans, website actions, conversions and attributed revenue by opportunity and campaign.</p><div class="module-nav"><a href="${root}/advertiser?section=setup&opportunity_id=${item.id}">My Setup</a><a href="${root}/advertiser?section=performance&opportunity_id=${item.id}">Performance Insights</a><a href="${root}/advertiser?section=reports&opportunity_id=${item.id}">Reports</a></div></section>`
  };
  return shell({ base, prospect:p, title:`${item.title} onboarding`, eyebrow:'Vivid self-service workflow', heading:'Marketplace Request to Active Advertiser', subtitle:'See how reviewed opportunity data flows through approval, setup and measurement without rekeying the same information.', active:'marketplace', content:`${stepNav}${panels[step]||panels.request}<p><a href="${root}/opportunity/${item.id}">← Return to opportunity</a></p>` });
}

module.exports = { prospectAdvertiserPage, prospectMarketplacePage, prospectOnboardingPage, prospectOpportunityPage, prospectOrganizationPage, reviewed, sampleMetrics, totalsFor };
