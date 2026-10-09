"use strict";
const PATH='/org-placement-report';
const number=v=>Number(v||0);
const money=v=>number(v).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const date=v=>v?new Date(v).toISOString().slice(0,10):'';
const rate=r=>r.scans?100*r.conversions/r.scans:0;
function totals(rows){return rows.reduce((a,r)=>{for(const k of ['scans','clicks','conversions','revenue'])a[k]+=number(r[k]);return a;},{scans:0,clicks:0,conversions:0,revenue:0});}
function buildSQL(source){
 const start=source.indexOf('  WITH filtered_locations AS ('),end=source.indexOf('  qr_campaign_metrics AS (',start);
 if(start<0||end<0)throw Error('Overview placement scope missing');
 const prefix=source.slice(start,end);
 if(prefix.includes('${'))throw Error('Unexpected dynamic Overview scope');
 return prefix+`metrics AS (
 SELECT fq.id,COUNT(e.id) FILTER(WHERE e.type='scan')::int AS scans,
 COUNT(e.id) FILTER(WHERE e.type IN ('offer','maps','waze','destination_click'))::int AS clicks,
 COUNT(e.id) FILTER(WHERE e.type='conversion')::int AS conversions,
 COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion'),0)::numeric AS revenue
 FROM filtered_qrs fq LEFT JOIN events e ON e.qr_id=fq.id
 AND (NULLIF($2,'') IS NULL OR e.created_at::date>=NULLIF($2,'')::date)
 AND (NULLIF($3,'') IS NULL OR e.created_at::date<=NULLIF($3,'')::date)
 GROUP BY fq.id)
 SELECT fq.id,qr.name,qr.description,qr.live_date,qr.end_date,qr.is_active,qr.is_archived,
 fl.id AS location_id,fl.name AS location_name,m.scans,m.clicks,m.conversions,m.revenue
 FROM filtered_qrs fq JOIN filtered_locations fl ON fl.id=fq.space_id
 JOIN qr_codes qr ON qr.id=fq.id JOIN metrics m ON m.id=fq.id ORDER BY fl.name,qr.name,fq.id`;
}
const META_SQL=`SELECT c.id,c.qr_id,c.contract_name,c.status,c.start_date,c.end_date,c.total_contract_value,
 COALESCE(p.name,'Unassigned event type') AS event_type,COALESCE(oo.title,c.contract_name) AS sponsorship,
 COALESCE(NULLIF(a.name,''),ar.business_name,u.name,u.email,'Unknown Advertiser') AS advertiser
 FROM contracts c LEFT JOIN organization_opportunities oo ON oo.id=c.opportunity_id AND oo.organization_id=c.organization_id
 LEFT JOIN organization_programs p ON p.id=oo.program_id AND p.organization_id=c.organization_id
 LEFT JOIN advertisers a ON a.id=c.advertiser_id AND a.organization_id=c.organization_id
 LEFT JOIN organization_advertising_requests ar ON ar.id=c.advertising_request_id AND ar.organization_id=c.organization_id
 LEFT JOIN users u ON u.id=c.customer_id
 WHERE c.organization_id=$1 AND c.qr_id=ANY($2::int[])
 AND (NULLIF($3,'') IS NULL OR c.end_date IS NULL OR c.end_date>=NULLIF($3,'')::date)
 AND (NULLIF($4,'') IS NULL OR c.start_date IS NULL OR c.start_date<=NULLIF($4,'')::date)
 ORDER BY c.id`;
const CAMPAIGN_SQL=`SELECT DISTINCT qc.qr_id,c.id,c.name,c.advertiser,c.start_date,c.end_date,c.campaign_url,c.is_archived
 FROM qr_campaigns qc JOIN campaigns c ON c.id=qc.campaign_id
 WHERE qc.qr_id=ANY($1::int[])
 AND (NULLIF($2,'') IS NULL OR COALESCE(qc.ended_at::date,c.end_date,NULLIF($3,'')::date)>=NULLIF($2,'')::date)
 AND (NULLIF($3,'') IS NULL OR COALESCE(qc.started_at::date,qc.assigned_at::date,c.start_date,c.live_date,c.created_at::date)<=NULLIF($3,'')::date)
 AND (NULLIF($2,'') IS NOT NULL OR NULLIF($3,'') IS NOT NULL OR (COALESCE(qc.is_active,true) AND NOT COALESCE(c.is_archived,false)))
 ORDER BY qc.qr_id,c.id`;
const DETAIL_SQL=`SELECT e.campaign_id,c.name,c.advertiser,e.type,COUNT(*)::int AS count,COALESCE(SUM(e.value),0)::numeric AS value
 FROM events e LEFT JOIN campaigns c ON c.id=e.campaign_id WHERE e.qr_id=$1
 AND (NULLIF($2,'') IS NULL OR e.created_at::date>=NULLIF($2,'')::date)
 AND (NULLIF($3,'') IS NULL OR e.created_at::date<=NULLIF($3,'')::date)
 GROUP BY e.campaign_id,c.name,c.advertiser,e.type ORDER BY c.name,e.type`;
function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].join(' / ');}
async function load(req,deps){
 const scope=await deps.getOrganizationScope(req);const {organizationId,allowedLocationIds,selectedLocationId,fromDate='',toDate=''}=scope;
 if(req.query.organization_id&&Number(req.query.organization_id)!==Number(organizationId))throw Object.assign(Error('Access denied'),{status:403});
 if(req.query.location_id&&!allowedLocationIds.includes(Number(req.query.location_id)))throw Object.assign(Error('Location access denied'),{status:403});
 for(const d of [fromDate,toDate])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||date(d)!==d))throw Object.assign(Error('Invalid date range'),{status:400});
 const org=(await deps.q('SELECT id,name,slug FROM organizations WHERE id=$1',[organizationId])).rows[0];
 if(!org)throw Object.assign(Error('Organization not found'),{status:404});
 let rows=(await deps.q(deps.sql,[organizationId,fromDate,toDate,allowedLocationIds,selectedLocationId])).rows;
 const ids=rows.map(r=>r.id);
 const contracts=(await deps.q(META_SQL,[organizationId,ids,fromDate,toDate])).rows;
 const campaigns=(await deps.q(CAMPAIGN_SQL,[ids,fromDate,toDate])).rows;
 rows=rows.map(r=>{const cs=contracts.filter(c=>c.qr_id===r.id),cm=campaigns.filter(c=>c.qr_id===r.id);return {...r,scans:number(r.scans),clicks:number(r.clicks),conversions:number(r.conversions),revenue:number(r.revenue),contracts:cs,campaigns:cm,event_type:unique(cs,'event_type')||'Unassigned event type',advertiser:unique(cm,'advertiser')||unique(cs,'advertiser')||'Unassigned',sponsorship:unique(cs,'sponsorship')||r.name};}).sort((a,b)=>a.event_type.localeCompare(b.event_type)||a.location_name.localeCompare(b.location_name)||a.name.localeCompare(b.name));
 const options=[...new Set(rows.map(r=>r.event_type))];
 if(req.query.event_type)rows=rows.filter(r=>r.event_type===req.query.event_type);
 let detail=null;
 if(req.query.placement_id){detail=rows.find(r=>r.id===Number(req.query.placement_id));if(!detail)throw Object.assign(Error('Placement not found in this report scope'),{status:404});detail.events=(await deps.q(DETAIL_SQL,[detail.id,fromDate,toDate])).rows;}
 const locations=(await deps.q('SELECT id,name FROM spaces WHERE organization_id=$1 AND id=ANY($2::int[]) AND COALESCE(is_archived,false)=false ORDER BY name',[organizationId,allowedLocationIds])).rows;
 return {org,scope,rows,options,locations,detail,total:totals(rows),selectedEvent:String(req.query.event_type||'')};
}
function params(d,extra={}){const p=new URLSearchParams({organization_id:d.org.id});if(d.scope.fromDate)p.set('from',d.scope.fromDate);if(d.scope.toDate)p.set('to',d.scope.toDate);if(d.scope.selectedLocationId)p.set('location_id',d.scope.selectedLocationId);if(d.selectedEvent)p.set('event_type',d.selectedEvent);for(const [k,v]of Object.entries(extra))if(v!==null)p.set(k,String(v));return p.toString();}
function csv(d){const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';const rows=d.detail?[d.detail]:d.rows;return '\uFEFF'+[['Event type','Event / Location','Placement','Advertiser','Sponsorship','Scans','Clicks','Conversions','Tracked conversion revenue','Conversion rate (%)','QR ID','From','To'],...rows.map(r=>[r.event_type,r.location_name,r.name,r.advertiser,r.sponsorship,r.scans,r.clicks,r.conversions,r.revenue,rate(r).toFixed(2),r.id,d.scope.fromDate,d.scope.toDate])].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
function pdf(d,PDFDocument){
 const doc=new PDFDocument({size:'LETTER',layout:'landscape',margin:36,bufferPages:true});let y;
 const rows=d.detail?[d.detail]:d.rows,t=totals(rows);
 function header(){doc.font('Helvetica-Bold').fontSize(19).fillColor('#173f2a').text(d.detail?'Placement Details':'Placement Performance',36,30);doc.font('Helvetica').fontSize(10).text(d.org.name,36,57,{width:720});doc.text((d.scope.fromDate||'All dates')+' to '+(d.scope.toDate||'present')+' | '+(d.locations.find(l=>l.id===d.scope.selectedLocationId)?.name||'All locations'),36,74);doc.fontSize(9).text(`${t.scans} scans | ${t.clicks} clicks | ${t.conversions} conversions | ${money(t.revenue)} tracked revenue`,36,92);y=116;}
 header();
 function line(text,bold=false){doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?10:9);let h=doc.heightOfString(text,{width:720})+8;if(y+h>554){doc.addPage();header();}doc.text(text,36,y,{width:720});y+=h;}
 if(d.org.slug==='henry-ford-health-demo')line('Illustrative HFHS demo data; not actual Henry Ford Health results.');
 line('Clicks = offer, maps, Waze and destination clicks. Conversion rate = conversions / scans.');
 let group='';for(const r of rows){if(y>460){doc.addPage();header();group='';}const g=r.event_type+' / '+r.location_name;if(g!==group){line(g,true);group=g;}line(r.name+' | '+r.advertiser,true);line(r.sponsorship);line(`${r.scans} scans | ${r.clicks} clicks | ${r.conversions} conversions | ${money(r.revenue)} | ${rate(r).toFixed(1)}% conversion rate`);}
 if(!rows.length)line('No placements match these filters.');
 if(d.detail){for(const c of d.detail.contracts)line(`Contract #${c.id}: ${c.contract_name} | ${c.status} | ${date(c.start_date)} to ${date(c.end_date)} | ${money(c.total_contract_value)}`);for(const c of d.detail.campaigns)line(`Campaign #${c.id}: ${c.name} | ${c.advertiser||'Unassigned'} | ${date(c.start_date)} to ${date(c.end_date)}`);for(const e of d.detail.events)line(`${e.name||'Unassigned campaign'} | ${e.type}: ${e.count}${e.type==='conversion'?' | '+money(e.value):''}`);}
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fontSize(8).text(`Page ${i+1} of ${range.count}`,36,564,{width:720,align:'right',lineBreak:false});}return doc;
}
function render(d,deps,req){const h=deps.escapeHtml;const url=(extra={})=>PATH+'?'+params(d,extra);const link=(path,text)=>`<a href="${h(path)}">${h(String(text))}</a>`;const r=d.detail,t=r||d.total;
 const stats=`<div class="pp-stats">${[['Scans',t.scans],['Clicks',t.clicks],['Conversions',t.conversions],['Tracked conversion revenue',money(t.revenue)],['Conversion rate',rate(t).toFixed(1)+'%']].map(([k,v])=>`<div class="card"><div>${k}</div><strong>${v}</strong></div>`).join('')}</div>`;
 const controls=`<form class="card pp-filters" method="GET"><input type="hidden" name="organization_id" value="${d.org.id}">${r?`<input type="hidden" name="placement_id" value="${r.id}">`:''}<label>From<input type="date" name="from" value="${h(d.scope.fromDate||'')}"></label><label>To<input type="date" name="to" value="${h(d.scope.toDate||'')}"></label><label>Event / Location<select name="location_id"><option value="">All locations</option>${d.locations.map(l=>`<option value="${l.id}" ${l.id===d.scope.selectedLocationId?'selected':''}>${h(l.name)}</option>`).join('')}</select></label><label>Event type<select name="event_type"><option value="">All event types</option>${d.options.map(o=>`<option ${o===d.selectedEvent?'selected':''}>${h(o)}</option>`).join('')}</select></label><button class="btn">Apply</button></form>`;
 let body='';
 if(r){body=`<div class="card"><h2>${h(r.name)}</h2><p>${h(r.event_type)} → ${h(r.location_name)}</p><p><b>Advertiser:</b> ${h(r.advertiser)}</p><p><b>Sponsorship:</b> ${h(r.sponsorship)}</p><p><b>Placement dates:</b> ${date(r.live_date)||'Not set'} to ${date(r.end_date)||'Open-ended'} · QR #${r.id} · ${r.is_archived?'Archived':r.is_active===false?'Inactive':'Active'}</p><p>${h(r.description||'')}</p></div><div class="card"><h2>Contracts</h2>${r.contracts.length?r.contracts.map(c=>`<p>${link('/org-contract/'+c.id+'?'+params(d),c.contract_name||'Contract #'+c.id)} · ${h(c.status||'')} · ${date(c.start_date)}–${date(c.end_date)} · ${money(c.total_contract_value)}</p>`).join(''):'<p>No linked contracts overlap these dates.</p>'}</div><div class="card"><h2>Campaigns and advertiser details</h2>${r.campaigns.map(c=>`<p>${link('/org-campaign/'+c.id+'?'+params(d,{qr_id:r.id}),c.name)} · ${link('/org-advertiser/'+encodeURIComponent(String(c.advertiser||'').trim().toLowerCase())+'?'+params(d),c.advertiser||'Unassigned')} · ${date(c.start_date)||'Not set'}–${date(c.end_date)||'Open-ended'}</p>`).join('')||'<p>No campaign assignments overlap these dates.</p>'}</div><div class="card"><h2>Recorded activity by campaign</h2><table><tr><th>Campaign</th><th>Activity</th><th>Count</th><th>Conversion revenue</th></tr>${r.events.map(e=>`<tr><td>${h(e.name||'Unassigned campaign')}</td><td>${h(e.type)}</td><td>${e.count}</td><td>${e.type==='conversion'?money(e.value):'—'}</td></tr>`).join('')||'<tr><td colspan="4">No recorded activity in this period.</td></tr>'}</table></div>`;
 }else{let group='';let table='';for(const x of d.rows){const g=x.event_type+' / '+x.location_name;if(g!==group){table+=`<tr class="pp-group"><th colspan="8">${link(url({event_type:x.event_type}),x.event_type)} / ${link(url({event_type:x.event_type,location_id:x.location_id}),x.location_name)}</th></tr>`;group=g;}table+=`<tr><td>${link(url({placement_id:x.id}),x.name)}</td><td>${h(x.advertiser)}<small>${h(x.sponsorship)}</small></td><td>${x.scans}</td><td>${x.clicks}</td><td>${x.conversions}</td><td>${money(x.revenue)}</td><td>${rate(x).toFixed(1)}%</td><td>${link(url({placement_id:x.id}),'View details →')}</td></tr>`;}body=`<div class="card" style="overflow:auto"><h2>Placements (${d.rows.length})</h2><table><thead><tr><th>Placement</th><th>Advertiser / Sponsorship</th><th>Scans</th><th>Clicks</th><th>Conversions</th><th>Tracked revenue</th><th>Conversion rate</th><th>Details</th></tr></thead><tbody>${table||'<tr><td colspan="8">No placements match these filters.</td></tr>'}</tbody></table></div>`;}
 return deps.orgPage('Placement Performance — '+d.org.name,`${deps.organizationNav({organizationId:d.org.id,organizationName:h(d.org.name),activePage:'reports',userName:h(req.session.orgUser?.name||req.session.orgUser?.email||req.session.user?.name||'')})}<style>.pp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.pp-stats strong{display:block;font-size:25px;margin-top:8px}.pp-filters{display:flex;gap:14px;flex-wrap:wrap;align-items:end}.pp-filters label{display:grid;gap:6px}.pp-group{background:#edf3f9}small{display:block;color:#65776b;margin-top:5px}td,th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #e2e8f0}table{width:100%;border-collapse:collapse}</style><div class="topbar"><h1>${r?'Placement Details':'Placement Performance'}</h1><p>${h(d.org.name)}</p></div><div class="wrap"><p>${link('/org-organization/'+d.org.id+'?'+params(d),'← Overview')} ${r?' · '+link(url(),'← Placement report'):''}</p>${controls}${stats}<p>Clicks include offer, maps, Waze and destination clicks. Conversion rate = conversions ÷ scans. Revenue is recorded conversion value, not contract value.</p>${d.org.slug==='henry-ford-health-demo'?'<p><b>HFHS demonstration data:</b> illustrative results, not actual Henry Ford Health outcomes.</p>':''}<p>${link(url({format:'pdf',...(r?{placement_id:r.id}:{})}),'Export PDF')} · ${link(url({format:'csv',...(r?{placement_id:r.id}:{})}),'Export CSV')}</p>${body}</div>`);
}
function register(app,deps){app.get(PATH,async(req,res)=>{try{const d=await load(req,deps);if(req.query.format==='csv'){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="Placement-performance.csv"');return res.send(csv(d));}if(req.query.format==='pdf'){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Placement-performance.pdf"');const doc=pdf(d,deps.PDFDocument);doc.pipe(res);doc.end();return;}res.send(render(d,deps,req));}catch(e){console.error('PLACEMENT PERFORMANCE ERROR:',e.message);if(!res.headersSent)res.status(e.status||500).send(e.status?e.message:'Unable to load placement performance.');}});}
function install(source){const marker='// PLACEMENT_PERFORMANCE_V1';if(source.includes(marker))return source;const sql=buildSQL(source);const start=source.indexOf('app.get(\n  "/org-organization/:id",'),end=source.indexOf('\napp.',start+1);if(start<0||end<0)throw Error('Overview route missing');let part=source.slice(start,end);const old='/org-performance?organization_id=${org.id}${dateQueryString ? `&${dateQueryString}` : ""}';if(part.split(old).length!==3)throw Error('Overview metric links missing');part=part.split(old).join('/org-placement-report?organization_id=${org.id}${dateQueryString ? `&${dateQueryString}` : ""}');source=source.slice(0,start)+marker+'\nrequire("./placement-performance").register(app,{q,getOrganizationScope,orgPage,organizationNav,escapeHtml,PDFDocument,sql:'+JSON.stringify(sql)+'});\n'+part+source.slice(end);const anchor='              ${require("./renewal-exports").form(';const a=source.indexOf(anchor);if(a<0)throw Error('Export Center placement link anchor missing');source=source.slice(0,a)+'              <div class="card"><h2>Placement Performance</h2><p>Review scans, clicks, conversions and tracked revenue for each placement, with details and PDF/CSV exports.</p><a class="btn" href="/org-placement-report?organization_id=${organizationId}">Open Placement Report</a></div>\n'+source.slice(a);return source;}
module.exports={buildSQL,META_SQL,CAMPAIGN_SQL,DETAIL_SQL,load,totals,params,csv,pdf,render,register,install};
