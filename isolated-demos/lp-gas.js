import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// Standalone LP Gas demonstration. No production imports, database, or credentials.
const INVITE_HASH = '838cf329e5a5e44cf3c767f47261eea53b8c8c21d524e7d6aa1412e50727eb68';
const PREFIX = '/demo/lp-gas';
const SESSION_VALUE = crypto.randomBytes(32).toString('hex');
const EXPIRES = Date.parse('2027-01-14T23:59:59Z');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number=v=>Number(v||0).toLocaleString('en-US');
const date=v=>v?new Date(v).toISOString().slice(0,10):'Not set';
const source='https://www.lpgasmagazine.com/advertising/';
const groups=[
 {id:1,name:'Print advertising',description:'Issue-based placements with dynamic QR engagement.',packages:['Illustrative upcoming print issue'],items:['Print display advertisement','Additional print placement inquiry']},
 {id:2,name:'Email newsletters',description:'Newsletter placements connected to advertiser destinations.',packages:['Illustrative newsletter campaign'],items:['Blue Flame Pilot advertising','Propane Price Insider advertising']},
 {id:3,name:'Website advertising',description:'Website placements and section sponsorships.',packages:['Illustrative website campaign'],items:['Website display advertisement','Website section sponsorship']},
 {id:4,name:'Sponsored content & video',description:'Promotional stories and videos with measurable next steps.',packages:['Illustrative content campaign'],items:['Sponsored content campaign','Sponsored video campaign']},
 {id:5,name:'Webinars',description:'Webinar promotion connected to registration and follow-up.',packages:['Illustrative webinar campaign'],items:['Sponsored webinar']},
 {id:6,name:'Event partnerships',description:'Growth Summit and Hall of Fame partnership exploration.',packages:['Growth Summit — future-cycle example','Hall of Fame — future-cycle example'],items:['Growth Summit partnership','Hall of Fame partnership']},
 {id:7,name:'Buyers Guide',description:'Explore print and online supplier visibility.',packages:['Illustrative annual guide'],items:['Buyer’s Guide advertiser inquiry']}
];
let sequence=0;
const opportunities=groups.flatMap(g=>g.items.map((title,i)=>({id:++sequence,program_id:g.id,space_id:g.id===6?61+i:g.id*10,channel:g.name,edition:g.packages[Math.min(i,g.packages.length-1)],title,status:[1,3,10].includes(sequence)?'Sold':[6,8].includes(sequence)?'Pending':'Available',description:g.description})));
// Conservative illustrative planning prices, not verified LP Gas rate-card prices.
const demoPrices=[1500,750,500,350,400,750,1000,1250,2000,2500,1500,300];
const demoUnits=['per issue','per issue','per send','per send','per month','per month','per campaign','per campaign','per webinar','per event','per event','per year'];
opportunities.forEach((o,i)=>{o.price=demoPrices[i];o.pricing_unit=demoUnits[i];});
const advertiser='Demo Equipment Supplier';
const baseRows=[
 {qr_id:101,campaign_id:201,opportunity_id:1,qr_name:'Print display advertisement',edition:'Illustrative print issue',scans:126,clicks:84,conversions:7,revenue:8400,cost:2200,kind:'print'},
 {qr_id:102,campaign_id:202,opportunity_id:3,qr_name:'Blue Flame Pilot advertising',edition:'Illustrative newsletter campaign',scans:0,clicks:213,conversions:11,revenue:13200,cost:1500,kind:'digital'},
 {qr_id:103,campaign_id:203,opportunity_id:10,qr_name:'Growth Summit partnership',edition:'Future-cycle event example',scans:92,clicks:61,conversions:5,revenue:6000,cost:4000,kind:'event'}
].map(r=>({...r,cost:opportunities.find(o=>o.id===r.opportunity_id).price,advertiser,advertiser_id:1,status:'Active',campaign_name:'Demo — '+r.qr_name,start_date:'2026-09-15',end_date:'2026-12-31',contract_end:'2026-12-31',renewal_date:'2026-12-01',destination_name:'Illustrative product inquiry',destination_url:'https://example.com/?vivid_demo=lp-gas'}));
const sampleContractRevenue=baseRows.reduce((sum,r)=>sum+r.cost,0);
function reporting(q){
 const from=q.start_date||q.from||'2026-09-15',to=q.end_date||q.to||'2026-10-14';
 for(const value of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||date(value)!==value)throw Object.assign(Error('Choose valid reporting dates.'),{status:400});
 if(from>to)throw Object.assign(Error('Start date must be before the end date.'),{status:400});
 if(q.advertiser_id&&q.advertiser_id!=='1')throw Object.assign(Error('Advertiser unavailable in this demo.'),{status:404});
 let rows=baseRows.map(r=>({...r,scans:0,clicks:0,conversions:0,revenue:0}));
 // Daily, deterministic sample activity; date filters work without storing events.
 for(let d=Date.parse('2026-09-15');d<=Date.parse('2026-10-14');d+=86400000){const day=date(d);if(day<from||day>to)continue;const idx=(d-Date.parse('2026-09-15'))/86400000;
  rows.forEach((r,i)=>{for(const k of ['scans','clicks','conversions','revenue'])r[k]+=Math.floor(baseRows[i][k]*(idx+1)/30)-Math.floor(baseRows[i][k]*idx/30);});}
 if(q.location_id){const ids=opportunities.filter(o=>String(o.space_id)===q.location_id).map(o=>o.id);if(!ids.length)throw Object.assign(Error('Location unavailable in this demo.'),{status:404});rows=rows.filter(r=>ids.includes(r.opportunity_id));}
 for(const [key,field]of [['qr_id','qr_id'],['campaign_id','campaign_id']])if(q[key]){rows=rows.filter(r=>String(r[field])===q[key]);if(!rows.length)throw Object.assign(Error('Placement unavailable in this demo.'),{status:404});}
 return {rows,from,to,brand:'LP Gas',marketplace:'lp-gas-demo',detailRoot:'/lp-gas-demo/placement'};
}
const styles=`*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#183047;font:15px system-ui;line-height:1.55}a{color:#175b99;text-decoration:none}a:hover{text-decoration:underline}header{background:#183047;color:white;padding:18px 26px;display:flex;justify-content:space-between;gap:20px;align-items:center}header strong{font-size:24px}header span{font-size:12px;letter-spacing:.08em}nav{display:flex;gap:10px 22px;flex-wrap:wrap;padding:15px 26px;background:white;border-bottom:1px solid #dae2e9}nav a.active{font-weight:800;border-bottom:3px solid #23946b}main{max-width:1190px;padding:30px 24px 60px;margin:auto}h1{font-size:36px;line-height:1.2;margin:12px 0}h2{font-size:23px}h3{font-size:18px}.eyebrow{font-size:12px;letter-spacing:.08em;font-weight:800;color:#53778a;text-transform:uppercase}.muted{color:#607487}.notice{background:#edf3f9;border-left:4px solid #175b99;padding:12px 17px;font-size:13px;margin:20px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:24px 0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:25px 0}.card,.panel,.metric{padding:24px;background:white;border:1px solid #dce3eb;border-radius:12px}.card{color:inherit;display:block;transition:.15s}.card:hover{transform:translateY(-3px);box-shadow:0 8px 22px #18304712}.card footer{color:#175b99;font-weight:700;border-top:1px solid #e0e7ec;padding-top:14px;margin-top:20px}.metric{display:block;border-top:4px solid #23946b;color:inherit}.metric strong{display:block;font-size:29px}.metric span{font-size:13px;color:#607487}.pill{padding:4px 11px;border-radius:20px;background:#e8f4ec;color:#276644;font-size:12px;font-weight:700;display:inline-block}.pill.Pending{background:#fff2d5;color:#92620b}.pill.Sold{background:#e8effb;color:#27599b}.actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:20px 0}.button,button{display:inline-block;background:#175b99;color:white;border:0;border-radius:7px;padding:11px 16px;font:inherit;cursor:pointer}.secondary{background:#e8eef5;color:#175b99}.table{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th{text-align:left;background:#f1f5f8;font-size:12px;color:#607487}td,th{padding:14px;border-bottom:1px solid #e1e7ed}td a{font-weight:650}label{display:block;font-size:13px;font-weight:650;margin:12px 0}input,select,textarea{font:inherit;padding:10px;border:1px solid #b9c8d3;border-radius:6px;max-width:100%;width:100%;margin-top:5px}form.filters{display:flex;gap:16px;align-items:end;flex-wrap:wrap}form.filters label{min-width:160px}.detail-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:24px}.art{background:linear-gradient(145deg,#17354c,#236b91);height:145px;border-radius:8px;padding:22px;color:white;display:flex;align-items:end;font-size:23px;font-weight:800}.chart{height:10px;background:#e7eef4;border-radius:5px;overflow:hidden}.chart span{display:block;height:100%;background:#23946b}summary{cursor:pointer;font-weight:700}footer.site{color:#64778a;font-size:12px;margin-top:35px}.logo{font-size:38px;font-weight:900;letter-spacing:-2px}.logo i{color:#77c2e7;font-style:normal}.step{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0;color:#607487}@media(max-width:760px){.grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:1fr}main{padding:20px 14px}header{padding:14px}h1{font-size:29px}nav{padding:13px 14px;gap:12px}.panel,.card{padding:18px}}@media print{header,nav,.notice,.actions,form{display:none}main{padding:0}.panel{border:0}}`;
const navLinks=[['Executive overview','/enterprise'],['Inventory','/inventory'],['Advertisers','/advertisers'],['Requests','/requests'],['Contracts','/contracts'],['Renewals','/renewals'],['Revenue pipeline','/pipeline'],['Reports','/reports'],['Help','/help']];
function shell(title,subtitle,body,path='/enterprise',market=false){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(title)} | LP Gas · Vivid Demo</title><style>${styles}</style></head><body><header><img src="${imageSources.logo}" alt="LP Gas" style="width:190px;height:54px;object-fit:contain" referrerpolicy="no-referrer"><span>VIVID SPOTS · PRIVATE DEMONSTRATION</span></header><nav><a href="/advertise/lp-gas-demo">Marketplace</a><a href="/enterprise">Publisher portal</a><a href="/my-setup">Advertiser portal</a></nav>${market?'':`<nav>${navLinks.map(([label,url])=>`<a class="${path===url?'active':''}" href="${url}">${label}</a>`).join('')}</nav>`}<main><div class="eyebrow">${market?'Advertising & partnership opportunities':'LP Gas · publisher workspace'}</div><h1>${h(title)}</h1><p class="muted">${h(subtitle)}</p><div class="notice"><strong>Independent Vivid demonstration.</strong> Publicly described product families with illustrative advertising opportunities. All prices are conservative demo estimates, not verified LP Gas rates. No requests, payments, or account changes are submitted. Not an official LP Gas offer or endorsement.</div>${body}<footer class="site">Source: <a href="${source}" target="_blank" rel="noopener noreferrer">LP Gas advertising information ↗</a> · <a href="https://lpgasgrowthsummit.com/" target="_blank" rel="noopener noreferrer">Growth Summit ↗</a> · <a href="https://lpgashalloffame.com/" target="_blank" rel="noopener noreferrer">Hall of Fame ↗</a><br>Vivid connects placement inventory, advertiser relationships, contracts, renewals and measurable engagement. This demo complements existing publishing, ad-serving and event tools.</footer></main></body></html>`;}
const counts=items=>['Available','Pending','Sold'].map(s=>`${s}: ${items.filter(o=>o.status===s).length}`).join(' · ');
const oppUrl=o=>`/advertise/lp-gas-demo/location/${o.space_id}/opportunity/${o.id}`;
function marketplace(path,q){
 const pm=path.match(/\/program\/(\d+)$/),lm=path.match(/\/location\/(\d+)(?:\/opportunity\/(\d+))?$/);
 let items=opportunities.filter(o=>(!pm||o.program_id===+pm[1])&&(!lm||o.space_id===+lm[1]));
 if(!items.length)throw Object.assign(Error('Opportunity not found.'),{status:404});
 if(lm?.[2]){
  const o=items.find(o=>o.id===+lm[2]);if(!o)throw Object.assign(Error('Opportunity not found.'),{status:404});
  return shell(o.title,o.channel+' → '+o.edition,`<div class="actions"><a href="/advertise/lp-gas-demo/program/${o.program_id}">← ${h(o.channel)}</a></div><div class="detail-grid"><section class="panel">${nativeArtwork(o.space_id,true)}<h2>Explore this opportunity</h2><p>${h(o.description)}</p><h3>How Vivid connects the workflow</h3><p>Inquiry → publisher review → confirmed agreement → advertiser setup → tracked campaign → reporting and renewal.</p><h3>Details to confirm with LP Gas</h3><p>Pricing, creative specifications, publication timing, inclusions, availability and any audience commitments.</p>${o.program_id===6?'<p>The 2026 events have already occurred. This is a future-cycle workflow example; dates and partnership packages are unconfirmed.</p>':''}<h3>Measurement</h3><p>Dynamic QR links support print and onsite engagement. Tracked digital links support clicks. Website actions and conversion values require configured destination tracking.</p><a href="/my-setup">Explore an advertiser’s results →</a></section><section class="panel"><h2>${money(o.price)}<small style="display:block;font-size:14px;font-weight:400">${h(o.pricing_unit)} · Conservative demo estimate</small></h2><p>Illustrative planning price; confirm actual pricing with LP Gas.</p><form id="request-form" onsubmit="return false"><label>Business name<input name="business" value="Demo Equipment Supplier" required maxlength="120"></label><label>Contact name<input name="contact" value="Demo Contact" required maxlength="120"></label><label>Email<input name="email" type="email" value="demo@example.com" required></label><label>Campaign destination<input name="destination" type="url" value="https://example.com/" required></label><label>Preferred timing<input name="timing" placeholder="Issue or event cycle" required></label><button type="button" id="review-request">Review request</button></form><section id="summary" hidden aria-live="polite"><h3>Your request preview</h3><p id="request-details"></p><p>${h(o.title)} · ${money(o.price)} · ${h(o.pricing_unit)} · Demo estimate</p><strong>Demo only — nothing has been sent.</strong><div class="actions"><button id="edit-request">Edit request</button><a href="/requests">View publisher request workflow →</a></div></section></section></div><script>document.getElementById('review-request').onclick=()=>{const f=document.getElementById('request-form');if(!f.reportValidity())return;document.getElementById('request-details').textContent=f.elements.business.value+' · '+f.elements.contact.value+' · '+f.elements.timing.value;f.hidden=true;document.getElementById('summary').hidden=false;};document.getElementById('edit-request').onclick=()=>{document.getElementById('request-form').hidden=false;document.getElementById('summary').hidden=true;};</script>`,path,true);
 }
 let cards,title='Advertising across print, digital and events';
 if(pm){title=items[0].channel;cards=[...new Set(items.map(o=>o.space_id))].map(id=>{const list=items.filter(o=>o.space_id===id);return `<a class="card" href="/advertise/lp-gas-demo/location/${id}">${nativeArtwork(list[0].space_id)}<h2>${h(list[0].edition)}</h2><p>${list.length} advertising opportunities<br><strong>From ${money(Math.min(...list.map(o=>o.price)))}</strong> · ${h(list[0].pricing_unit)}<br><small>Conservative demo estimate</small></p><footer>Explore placements →</footer></a>`;}).join('');}
 else if(lm){title=items[0].edition;cards=items.map(o=>`<a class="card" href="${oppUrl(o)}"><h2>${h(o.title)}</h2><p>${h(o.description)}</p><p><strong>${money(o.price)}</strong> · ${h(o.pricing_unit)}<br><small>Conservative demo estimate</small></p><footer>View opportunity →</footer></a>`).join('');}
 else{cards=groups.map(g=>`<a class="card" href="/advertise/lp-gas-demo/program/${g.id}">${nativeArtwork(g.id===6?61:g.id*10)}<h2>${h(g.name)}</h2><p>${h(g.description)}</p><p>${opportunities.filter(o=>o.program_id===g.id).length} advertising opportunities<br><strong>From ${money(Math.min(...opportunities.filter(o=>o.program_id===g.id).map(o=>o.price)))}</strong><br><small>Conservative demo estimate</small></p><footer>Explore packages →</footer></a>`).join('');}
 return shell(title,'Choose a channel, explore an issue or event package, and preview an advertiser inquiry.',`<div class="step">Channel → Issue / event / package → Opportunity → Request details</div><div class="grid">${cards}</div>`,path,true);
}
function cards(values){return `<div class="metrics">${values.map(([label,value,url,description])=>`<a class="metric" href="${url}"><span>${label}</span><strong>${value}</strong><span>${description||'Explore details →'}</span></a>`).join('')}</div>`;}
function inventory(q){const marketplaceHref=q.program_id?`/advertise/lp-gas-demo/program/${q.program_id}`:'/advertise/lp-gas-demo';const rows=opportunities.filter(o=>(!q.program_id||String(o.program_id)===q.program_id)&&(!q.status||o.status===q.status)&&(!q.location_id||String(o.space_id)===q.location_id));return `<div class="actions" style="justify-content:space-between"><p class="muted" style="margin:0">Conservative demo prices · Confirm actual rates and availability with LP Gas.</p><a class="btn" href="${h(marketplaceHref)}">Open Marketplace →</a></div><form class="filters" method="GET" action="/inventory"><label>Channel<select name="program_id"><option value="">All channels</option>${groups.map(g=>`<option value="${g.id}" ${q.program_id==g.id?'selected':''}>${h(g.name)}</option>`).join('')}</select></label><label>Status<select name="status"><option value="">All statuses</option>${['Available','Pending','Sold'].map(s=>`<option ${q.status===s?'selected':''}>${s}</option>`).join('')}</select></label><button>Update inventory</button></form><div class="panel table"><table><thead><tr><th>Opportunity</th><th>Channel / package</th><th>Status</th><th>Demo price</th><th>Marketplace</th></tr></thead><tbody>${rows.map(o=>`<tr><td><a href="${oppUrl(o)}">${h(o.title)}</a></td><td>${h(o.channel)}<br><small>${h(o.edition)}</small></td><td><span class="pill ${o.status}">${o.status}</span></td><td><strong>${money(o.price)}</strong><br><small>${h(o.pricing_unit)} · Demo estimate</small></td><td><a class="btn secondary" href="${oppUrl(o)}">View in Marketplace →</a></td></tr>`).join('')||'<tr><td colspan="5">No matching demo opportunities.</td></tr>'}</tbody></table></div>`;}
function contractRows(){return `<div class="panel table"><table><thead><tr><th>Placement / advertiser</th><th>Sample contract value</th><th>Contract ends</th><th>Renewal due</th><th>Fulfillment</th></tr></thead><tbody>${baseRows.map(r=>`<tr><td><a href="/contract/${r.qr_id}">${h(r.qr_name)}</a><br>${h(advertiser)}</td><td>${money(r.cost)}</td><td>${r.contract_end}</td><td>${r.renewal_date}</td><td>Creative approved · demo</td></tr>`).join('')}</tbody></table><p class="muted">Contract values are fictional workflow examples, not LP Gas rates.</p></div>`;}
function reportPage(q){const data=reporting(q),qs=new URLSearchParams({...q,start_date:data.from,end_date:data.to});return `<form class="filters" method="GET" action="/reports">${q.qr_id?`<input type="hidden" name="qr_id" value="${h(q.qr_id)}">`:''}${q.campaign_id?`<input type="hidden" name="campaign_id" value="${h(q.campaign_id)}">`:''}<label>From<input type="date" name="start_date" value="${data.from}" required></label><label>Through<input type="date" name="end_date" value="${data.to}" required></label><button>Update period</button></form><div class="actions"><a class="button" href="/export/report.csv?${qs}">Export CSV</a><a class="button secondary" href="/export/report.pdf?${qs}">Export PDF</a><a href="/my-setup?${qs}">Advertiser view →</a></div><div class="panel table"><table><thead><tr><th>Placement</th><th>Scans</th><th>Clicks / intent</th><th>Conversions</th><th>Attributed revenue</th></tr></thead><tbody>${data.rows.map(r=>`<tr><td><a href="/lp-gas-demo/placement/${r.qr_id}?${qs}">${h(r.qr_name)}</a></td><td>${number(r.scans)}</td><td>${number(r.clicks)}</td><td>${r.conversions}</td><td>${money(r.revenue)}</td></tr>`).join('')}</tbody></table><p class="muted">Daily simulated data: September 15–October 14, 2026. Outside that period, sample activity is zero. Digital clicks do not count as QR scans. Attributed revenue is advertiser conversion value, separate from publisher contract sales.</p></div>`;}
function publisher(path,q){let title,subtitle='Explore connected advertising operations with illustrative data.',body;
 if(path==='/enterprise'){title='Executive overview';body=cards([['Advertising opportunities',opportunities.length,'/inventory'],['Available',opportunities.filter(o=>o.status==='Available').length,'/inventory?status=Available'],['Pending',opportunities.filter(o=>o.status==='Pending').length,'/inventory?status=Pending'],['Sold',opportunities.filter(o=>o.status==='Sold').length,'/inventory?status=Sold']])+cards([['Active contracts',3,'/contracts'],['Sample contracted revenue',money(sampleContractRevenue),'/pipeline','Publisher sales · illustrative'],['QR scans',218,'/reports','Simulated · last 30 sample days'],['Conversions',23,'/reports','Simulated advertiser outcomes']])+`<h2>Channels → packages → opportunities</h2><div class="grid">${groups.map(g=>`<a class="card" href="/inventory?program_id=${g.id}"><h2>${h(g.name)}</h2><p>${counts(opportunities.filter(o=>o.program_id===g.id))}</p><footer>Open channel inventory →</footer></a>`).join('')}</div>`;}
 else if(path==='/inventory'){title='Advertising inventory';body=inventory(q);}
 else if(path==='/advertisers'){title='Advertisers';body=`<a class="card" href="/my-setup"><h2>${h(advertiser)}</h2><p>Three connected placements: print, newsletter and event.</p><footer>Open this advertiser’s portal →</footer></a>`;}
 else if(path==='/requests'){title='Advertiser requests';body=`<div class="panel"><span class="pill Pending">Pending · sample request</span><h2>Demo Software Provider</h2><p>Interested in website section sponsorship. Timing and pricing require publisher confirmation.</p><details><summary>Explore review and approval</summary><p>Review availability, creative requirements, business details and campaign destination. Approval creates the agreement and advertiser setup in the live workflow.</p><p><strong>View-only demo.</strong> No approval or outbound email is performed.</p></details><div class="actions"><a href="${oppUrl(opportunities[5])}">Review opportunity →</a><a href="/contracts">Explore contracts →</a></div></div>`;}
 else if(path==='/contracts'||path==='/renewals'){title=path==='/contracts'?'Contracts & fulfillment':'Upcoming renewals';body=cards([['Active sample contracts',3,'/contracts'],['Renewal opportunities',3,'/renewals'],['Sample contract value',money(sampleContractRevenue),'/pipeline'],['Advertiser accounts',1,'/advertisers']])+contractRows();}
 else if(/^\/contract\/\d+$/.test(path)){const r=baseRows.find(r=>r.qr_id===+path.split('/').pop());if(!r)throw Object.assign(Error('Contract not found.'),{status:404});title=r.qr_name;body=`<div class="panel"><h2>${h(advertiser)}</h2><p>Sample contract value: <strong>${money(r.cost)}</strong><br>Contract ends: ${r.contract_end}<br>Renewal due: ${r.renewal_date}</p><h3>Benefit fulfillment</h3><ul><li>Agreement approved — demo</li><li>Creative received and reviewed — demo</li><li>Campaign destination confirmed — demo</li><li>Placement delivered — demo</li><li>Performance and renewal review — pending</li></ul><div class="actions"><a class="button" href="/lp-gas-demo/placement/${r.qr_id}">Advertiser placement →</a><a href="/reports?qr_id=${r.qr_id}">Performance report →</a><a href="/renewals">All renewals →</a></div></div>`;}
 else if(path==='/pipeline'){title='Revenue pipeline';body=cards([['Sample contracted sales',money(sampleContractRevenue),'/contracts'],['Pending inquiries',1,'/requests'],['Renewal value',money(sampleContractRevenue),'/renewals'],['Available opportunities',opportunities.filter(o=>o.status==='Available').length,'/inventory?status=Available']])+`<div class="panel"><h2>Publisher revenue by placement</h2>${baseRows.map(r=>`<p><a href="/contract/${r.qr_id}">${h(r.qr_name)} · ${money(r.cost)}</a></p><div class="chart"><span style="width:${r.cost/Math.max(...baseRows.map(x=>x.cost))*100}%"></span></div>`).join('')}<p class="muted">These are fictional contract sales for demonstration. Available and pending inventory uses conservative demo estimates. Actual publisher rates remain unconfirmed.</p></div>`;}
 else if(path==='/reports'||path==='/admin/reports'){title='Reports & Export Center';body=reportPage(q);}
 else if(path==='/help'||path==='/campaign-help'){title='Help';body=`<div class="grid">${[['Explore the marketplace','Browse channels, packages and opportunities. Request previews stay in your browser.','/advertise/lp-gas-demo'],['Manage publisher operations','Review availability, contracts, fulfillment and renewals.','/enterprise'],['See advertiser results','One sample advertiser sees only its three placements.','/my-setup']].map(([t,d,u])=>`<a class="card" href="${u}"><h2>${t}</h2><p>${d}</p><footer>Explore →</footer></a>`).join('')}</div><div class="panel"><h2>What do the results mean?</h2><p>Scans are QR engagements. Clicks / intent are tracked next steps. Conversions are configured actions on a destination website. Attributed revenue is the value attached to those actions; it is not publisher sponsorship revenue.</p><p>All activity is simulated. Website and conversion reporting require installation and validation in a live campaign. Webinar attendee imports and event meeting outcomes are not connected in this demo.</p></div>`;}
 else if(/^\/admin\/(?:view-campaign|edit-campaign|edit-qr)\/\d+$/.test(path)){const id=+path.split('/').pop(),r=baseRows.find(r=>r.campaign_id===id||r.qr_id===id);if(!r)throw Object.assign(Error('Campaign not found.'),{status:404});title='Campaign & QR settings';body=`<div class="panel"><h2>${h(r.qr_name)}</h2><p>${h(advertiser)}</p><label>Campaign name<input value="${h(r.campaign_name)}" readonly></label><label>Destination<input value="${h(r.destination_url)}" readonly></label><p>Dynamic QR destination changes and campaign updates are available in the live workflow. This isolated demo is view-only.</p><a class="button" href="/lp-gas-demo/placement/${r.qr_id}">Back to placement</a></div>`;}
 else if(/^\/admin\/campaign\/\d+\/website-pages$/.test(path)){const r=baseRows.find(r=>r.campaign_id===+path.split('/')[3]);if(!r)throw Object.assign(Error('Campaign not found.'),{status:404});title='Website tracking';body=`<div class="panel"><h2>${h(r.qr_name)}</h2><p>No live website tracker is installed for this fictional advertiser. Page visits, leads, and revenue become available when destination tracking is configured and validated.</p><a href="/reports?campaign_id=${r.campaign_id}">View simulated campaign results →</a></div>`;}
 else throw Object.assign(Error('Demo page not found.'),{status:404});
 return nativeShell(title,subtitle,body,path);
}

// Exact advertiser renderer reused from Rubber World, with LP Gas data supplied.
function portalRender(data,query,placementId){
 const people=data.people||[...new Map(data.rows.map(r=>[Number(r.advertiser_id),r.advertiser])).entries()];
 const brand=data.brand||'Rubber World',marketplace=data.marketplace||'rubber-world-demo',detailRoot=data.detailRoot||'/rubber-world-demo/placement';
 const selected=Number(query.advertiser_id)||people[0]?.[0]||0;
 if(selected&&!people.some(([id])=>id===selected))throw Object.assign(Error('Advertiser unavailable in this demo.'),{status:404});
 let rows=data.rows.filter(r=>!selected||Number(r.advertiser_id)===selected);
 if(placementId){rows=rows.filter(r=>Number(r.qr_id)===Number(placementId));if(!rows.length)throw Object.assign(Error('Placement not found in this demo.'),{status:404});}
 const qs=new URLSearchParams({start_date:data.from,end_date:data.to,...(selected?{advertiser_id:String(selected)}:{})});
 const report=r=>'/admin/reports?'+new URLSearchParams({qr_id:String(r.qr_id),start_date:data.from,end_date:data.to,status:'all'});
 const campaignReport=r=>'/admin/reports?'+new URLSearchParams({campaign_id:String(r.campaign_id),start_date:data.from,end_date:data.to,status:'all'});
 const sums=rows.reduce((a,r)=>{for(const k of ['scans','clicks','conversions','revenue'])a[k]+=Number(r[k]||0);return a;},{scans:0,clicks:0,conversions:0,revenue:0});
 const back='/my-setup?'+qs;
 const selectedCampaigns=[...new Set(rows.map(r=>Number(r.campaign_id)))];
 const reportQuery=new URLSearchParams({start_date:data.from,end_date:data.to,...(selectedCampaigns.length===1?{campaign_id:String(selectedCampaigns[0])}:{})});
 const basic=rows.some(r=>r.basic);if(basic)for(const k of ['clicks','conversions','revenue'])sums[k]=null;
 const metric=(v,currency=false)=>v===null?'—':currency?money(v):number(v);
 const cards=rows.map(r=>`<article><div class="eyebrow">${h(r.edition)}</div><h2>${h(r.qr_name.replace(/^RUBBER WORLD Demo — /,''))}</h2><p>${h(r.advertiser)} · <span class="pill">${h(r.status||'Demo campaign')}</span></p><div class="metrics small">${[['Scans',metric(r.scans)],['Clicks / intent',metric(r.clicks)],['Conversions',metric(r.conversions)],['Attributed revenue',metric(r.revenue,true)]].map(([k,v])=>`<a href="${report(r)}"><span>${k}</span><strong>${typeof v==='number'?number(v):v}</strong></a>`).join('')}</div>${r.basic?'<p class="note">Basic includes scans. Website activity, conversions and revenue require Vivid Performance.</p>':''}<p>Placement value: <strong>${money(r.cost)}</strong><br>Campaign: ${date(r.start_date)} through ${date(r.end_date)}<br>Contract ends: ${date(r.contract_end)} · Renewal due: ${date(r.renewal_date)}</p><div class="actions"><a class="button" href="${detailRoot}/${r.qr_id}?${qs}">Placement details</a><a href="${report(r)}">Performance report</a><a href="/qr/${r.qr_id}.png">Download QR</a><a href="/campaign-help?campaign_id=${r.campaign_id}">Get help</a></div>${placementId?`<hr><h2>Campaign and destination</h2><p>${h(r.campaign_name)}</p><p><strong>${h(r.destination_name||'Destination')}</strong><br>${h(r.destination_url||'Not configured')}</p><p class="muted">This is a sample destination. Demo links do not represent a live advertiser campaign.</p><div class="actions"><a class="button" href="/admin/view-campaign/${r.campaign_id}">View campaign</a><a href="/admin/edit-campaign/${r.campaign_id}">Explore campaign settings</a><a href="/admin/edit-qr/${r.qr_id}">Explore QR settings</a><a href="${campaignReport(r)}">Campaign report</a></div><h2>Website activity</h2><p>Page-by-page activity appears after an advertiser installs the website tracker. Open the report to see any recorded page visits. Missing records do not confirm whether tracking is installed.</p><a href="/admin/campaign/${r.campaign_id}/website-pages">View website tracking report</a>`:''}</article>`).join('');
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(brand)} Advertiser Portal</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#183047;font:16px system-ui;line-height:1.5}main{max-width:1180px;margin:32px auto;padding:0 24px 50px}nav,.actions{display:flex;gap:18px;flex-wrap:wrap;align-items:center}nav{border-bottom:1px solid #d9e1e9;padding-bottom:18px}a{color:#175b99}h1{font-size:34px;margin-bottom:8px}h2{font-size:22px}article,.panel{background:white;border:1px solid #dce3eb;border-radius:12px;padding:24px;margin:20px 0}.muted,.eyebrow{color:#56687a}.eyebrow{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.metrics a{background:#fff;border:1px solid #dce3eb;border-radius:10px;padding:18px;text-decoration:none}.metrics span,.metrics strong{display:block}.metrics strong{font-size:28px;color:#143c2a}.small a{background:#f6faf8;padding:12px}.small strong{font-size:23px}.button,button{display:inline-block;background:#175b99;color:white;padding:10px 16px;border:0;border-radius:7px;text-decoration:none;font:inherit;cursor:pointer}.pill{background:#e7f3eb;color:#215b39;border-radius:16px;padding:3px 10px;font-size:13px}form{display:flex;gap:16px;flex-wrap:wrap;align-items:end}label{display:block;font-weight:600}input,select{display:block;padding:10px;border:1px solid #b6c3cf;border-radius:6px;font:inherit;margin-top:5px;max-width:100%}.note{border-left:4px solid #b2cddd;padding:12px 18px;background:#eaf2f8}hr{border:0;border-top:1px solid #dce3eb;margin:25px 0}@media(max-width:700px){.metrics{grid-template-columns:repeat(2,1fr)}main{padding:0 14px}article{padding:18px}h1{font-size:28px}}</style></head><body><main><nav><strong>${h(brand.toUpperCase())} · ADVERTISER PORTAL</strong><a href="${back}">My placements</a><a href="/admin/reports?${reportQuery}">Reports</a><a href="/admin/reports?${reportQuery}">Export Center</a><a href="/advertise/${marketplace}">Explore advertising</a><a href="/help">Help</a></nav><h1>${placementId?'Placement details':h(people.find(([id])=>id===selected)?.[1]||'Your advertising')}</h1><p class="muted">Review your placements, campaign details, results, and upcoming renewal dates.</p><p class="note">Sample advertiser account · Illustrative placements and results. ${data.editable?"This HFHS demo allows supported campaign changes.":"Settings can be explored; changes are disabled."}</p>${placementId?`<a href="${back}">← Back to my placements</a>`:`<section class="panel"><form method="GET" action="/my-setup"><input type="hidden" name="advertiser_id" value="${selected}"><label>From<input type="date" name="start_date" value="${data.from}"></label><label>Through<input type="date" name="end_date" value="${data.to}"></label><button>Update view</button></form></section><div class="metrics">${[['Scans',metric(sums.scans)],['Clicks / intent',metric(sums.clicks)],['Conversions',metric(sums.conversions)],['Attributed revenue',metric(sums.revenue,true)]].map(([k,v])=>`<a href="#placements"><span>${k}</span><strong>${typeof v==='number'?number(v):v}</strong></a>`).join('')}</div><p class="muted">${data.from} through ${data.to} · Simulated activity. Attributed revenue is advertiser conversion value, not ${h(brand)}’s placement sales.</p>`}<section id="placements"><h2>${placementId?'Your placement':`${rows.length} advertising placements`}</h2>${cards||'<p>No placements match this selection.</p>'}</section></main></body></html>`;
}



// Native Vivid renderer functions copied verbatim from the production source.
const escapeHtml=h;
function vividThemeStyles() {
  return `
    :root {
      --vivid-blue: #2563EB;
      --vivid-blue-dark: #1D4ED8;
      --vivid-navy: #0B1F3A;
      --vivid-text: #172033;
      --vivid-text-muted: #5F6B7A;
      --vivid-background: #F6F8FC;
      --vivid-surface: #FFFFFF;
      --vivid-border: #DBE3EF;
      --vivid-blue-light: #EAF2FF;
    }
        .btn,
    .choice-btn {
      background:var(--vivid-blue);
      color:white;
    }

    .btn:hover,
    .choice-btn:hover {
      background:var(--vivid-blue-dark);
      color:white;
    }

    .btn.secondary,
    .choice-btn.dark {
      background:var(--vivid-navy);
      color:white;
    }

    .btn.secondary:hover,
    .choice-btn.dark:hover {
      background:var(--vivid-navy);
      color:white;
      opacity:.92;
    }

    a:not(.btn):not(.choice-btn):not(.marketplace-btn) {
      color:var(--vivid-blue);
    }

    a:not(.btn):not(.choice-btn):not(.marketplace-btn):hover {
      color:var(--vivid-blue-dark);
    }

    th {
      background:var(--vivid-blue-light);
      color:var(--vivid-navy);
    }

    th,
    td {
      border-color:var(--vivid-border);
    }

    .note {
      border-left-color:var(--vivid-blue);
    }
        .marketplace-btn {
      background:var(--vivid-blue);
      color:white;
    }

    .marketplace-btn:hover {
      background:var(--vivid-blue-dark);
      color:white;
    }

    .marketplace-btn.secondary {
      background:var(--vivid-navy);
      color:white;
    }

    a[style*="background:#2f7d46"],
    button[style*="background:#2f7d46"],
    a[style*="background:#176b3a"],
    button[style*="background:#176b3a"],
    a[style*="background:#17733b"],
    button[style*="background:#17733b"] {
      background:var(--vivid-blue) !important;
      color:white !important;
    }

    a[style*="background:#2f7d46"]:hover,
    button[style*="background:#2f7d46"]:hover,
    a[style*="background:#176b3a"]:hover,
    button[style*="background:#176b3a"]:hover,
    a[style*="background:#17733b"]:hover,
    button[style*="background:#17733b"]:hover {
      background:var(--vivid-blue-dark) !important;
    }

    a[style*="background:#123d25"],
    button[style*="background:#123d25"] {
      background:var(--vivid-navy) !important;
      color:white !important;
    }

    a[style*="color:#176b3a"] {
      color:var(--vivid-blue) !important;
    }

    form[action*="/deactivate"] .btn,
    form[action*="/archive"] .btn,
    form[action*="/delete"] .btn,
    form[action*="/remove"] .btn {
      background:#DC2626 !important;
      color:white !important;
    }

    form[action*="/deactivate"] .btn:hover,
    form[action*="/archive"] .btn:hover,
    form[action*="/delete"] .btn:hover,
    form[action*="/remove"] .btn:hover {
      background:#B91C1C !important;
    }
        body {
      background:var(--vivid-background);
      color:var(--vivid-text);
    }

    .topbar,
    .marketplace-topbar {
      background:linear-gradient(
        135deg,
        var(--vivid-navy),
        var(--vivid-blue)
      );
      color:white;
    }

    .brand,
    .marketplace-brand,
    .subtitle,
    .marketplace-subtitle {
      color:var(--vivid-blue-light);
    }

    .card,
    .marketplace-card,
    table {
      background:var(--vivid-surface);
    }

    .label,
    .small,
    .marketplace-label {
      color:var(--vivid-text-muted);
    }

    input,
    select,
    textarea {
      background:var(--vivid-surface);
      color:var(--vivid-text);
      border-color:var(--vivid-border);
    }

    input:focus,
    select:focus,
    textarea:focus {
      border-color:var(--vivid-blue);
      outline:2px solid var(--vivid-blue-light);
      outline-offset:1px;
    }

    .workflow-step {
      background:var(--vivid-blue-light);
      border-color:var(--vivid-border);
      color:var(--vivid-text);
    }

    div[style*="background:#f7faf7"][style*="border:1px solid #dbe7db"] {
      background:var(--vivid-blue-light) !important;
      border-color:var(--vivid-border) !important;
      color:var(--vivid-text-muted) !important;
    }

    .user-icon,
    .user-avatar,
    .profile-icon,
    .account-icon,
    .avatar {
      background:var(--vivid-blue) !important;
      color:white !important;
    }

    [aria-label*="user" i][style*="background"],
    [title*="user" i][style*="background"] {
      background:var(--vivid-blue) !important;
      color:white !important;
    }
  `;
}


function orgPage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f4f7f1;color:#073b22}
    .topbar{background:linear-gradient(135deg,#123d25,#2f7d46);color:white;padding:30px 40px}
    .brand{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d7eadb;font-weight:bold}
    h1{margin:4px 0 6px;font-size:34px}
    .subtitle{color:#d7eadb;margin:0}
    .wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
    .btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0;cursor:pointer}
    .btn.secondary{background:#123d25}
    .card{background:white;border-radius:18px;padding:18px;box-shadow:0 8px 22px rgba(0,0,0,.08);margin:14px 0}
    input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #cfdacf;margin:6px 0 14px;font-size:15px;box-sizing:border-box}
    a{color:#176b3a;font-weight:bold}
 @media(max-width:1250px){
  .org-location-grid{
    grid-template-columns:repeat(4,minmax(0,1fr)) !important;
  }
}

@media(max-width:980px){
  .org-location-grid{
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
  }
}

@media(max-width:720px){
  .org-location-grid{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
  }
}

@media(max-width:480px){
  .org-location-grid{
    grid-template-columns:1fr !important;
  }
}
    ${vividThemeStyles()}
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
/* =========================================================
   ORGANIZATION PORTAL NAVIGATION
========================================================= */

function organizationNav({
  organizationId,
  organizationName,
  activePage = "",
  userName = "",
  locationId = null,
  queryString = "",
  showAdministration = true
}) {
const scopedHref = href => {
  const params =
    new URLSearchParams(
      queryString || ""
    );

  if (locationId) {
    params.set(
      "location_id",
      String(locationId)
    );
  }

  const extraQuery =
    params.toString();

  if (!extraQuery) {
    return href;
  }

  return `${href}${
    href.includes("?")
      ? "&"
      : "?"
  }${extraQuery}`;
};
  const navItem = (
    label,
    href,
    key
  ) => `
    <a
      href="${scopedHref(href)}"
      style="
        display:inline-block;
        padding:11px 15px;
        border-radius:10px;
        text-decoration:none;
        font-weight:bold;
        color:white;
        background:${
          activePage === key
            ? "#123d25"
            : "#2f7d46"
        };
        white-space:nowrap;
      "
    >
      ${label}
    </a>
  `;

  return `
    <div style="
      background:white;
      border-bottom:1px solid #dfe7df;
      box-shadow:0 4px 14px rgba(0,0,0,.06);
      padding:16px 40px;
      position:sticky;
      top:0;
      z-index:100;
    ">
      <div style="
        max-width:1250px;
        margin:0 auto;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:20px;
          flex-wrap:wrap;
        ">

          <div>
            <div style="
              font-size:20px;
              font-weight:bold;
              color:#073b22;
            ">
              ${organizationName}
            </div>

            <div style="
              font-size:12px;
              color:#65776b;
              margin-top:3px;
            ">
              Organization Portal
            </div>
          </div>

          ${
            userName
              ? `
                  <div style="
                    color:#315b4c;
                    font-size:14px;
                    font-weight:bold;
                  ">
                    ${userName}
                  </div>
                `
              : ""
          }

        </div>

        <div style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:14px;
        ">

      ${navItem(
  "Overview",
  `/org-organization/${organizationId}`,
  "dashboard"
)}

${navItem(
  "Locations",
  `/org-locations?organization_id=${organizationId}`,
  "locations"
)}

${navItem(
  "Advertisers",
  `/org-advertisers?organization_id=${organizationId}`,
  "advertisers"
)}
${navItem(
  "Advertising Inventory",
  `/org-marketplace?organization_id=${organizationId}`,
  "marketplace"
)}
${navItem(
  "Advertising Requests",
  `/org-advertising-requests?organization_id=${organizationId}`,
  "advertising-requests"
)}
${navItem(
  "Contracts",
  `/org-contracts?organization_id=${organizationId}`,
  "contracts"
)}
${navItem(
  "Renewals",
  `/org-renewals?organization_id=${organizationId}`,
  "renewals"
)}
${navItem("Sales Rep Report", `/org-sales-reps?organization_id=${organizationId}`, "sales-reps")}
${navItem(
  "Revenue Pipeline",
  `/org-revenue-pipeline?organization_id=${organizationId}`,
  "pipeline"
)}
${navItem(
  "Performance Insights",
  `/org-performance?organization_id=${organizationId}`,
  "performance"
)}
${navItem("Campaign Builder", `/org-campaign-builder-requests?organization_id=${organizationId}`, "campaign-builder")}
${navItem(
  "Reports",
  `/org-export?organization_id=${organizationId}`,
  "reports"
)}

${
  showAdministration
    ? navItem(
        "Administration",
        `/org-operations?organization_id=${organizationId}`,
        "operations"
      )
    : ""
}
<a
  href="${scopedHref(
    `/org-help?organization_id=${organizationId}`
  )}"
  target="_blank"
  rel="noopener noreferrer"
  style="
    display:inline-block;
    padding:11px 15px;
    border-radius:10px;
    text-decoration:none;
    font-weight:bold;
    color:white;
    background:#2f7d46;
    white-space:nowrap;
  "
>
  Help
</a>
        </div>

      </div>
    </div>
  `;
}


function orgDateFilterForm({
  action,
  fromDate,
  toDate
}) {
  return `
    <form
      method="GET"
      action="${action}"
      style="
        background:white;
        border-radius:14px;
        padding:14px 16px;
        box-shadow:0 5px 14px rgba(0,0,0,.07);
        display:flex;
        align-items:end;
        gap:12px;
        flex-wrap:wrap;
        margin:0 0 22px;
      "
    >
      <div style="min-width:165px;">
        <label style="
          display:block;
          font-size:11px;
          color:#65776b;
          margin-bottom:4px;
        ">
          From
        </label>

        <input
          type="date"
          name="from"
          value="${fromDate}"
          style="margin:0;"
        >
      </div>

      <div style="min-width:165px;">
        <label style="
          display:block;
          font-size:11px;
          color:#65776b;
          margin-bottom:4px;
        ">
          To
        </label>

        <input
          type="date"
          name="to"
          value="${toDate}"
          style="margin:0;"
        >
      </div>

      <button
        class="btn"
        type="submit"
        style="margin:0;"
      >
        Apply
      </button>

      ${
        fromDate || toDate
          ? `
            <a
              class="btn secondary"
              href="${action}"
              style="margin:0;"
            >
              Clear
            </a>
          `
          : ""
      }
    </form>
  `;
}

const imageSources={
 logo:'https://www.lpgasmagazine.com/wp-content/themes/childTheme_3_22/images/footerlogo.png',
 summit:'https://lpgasgrowthsummit.com/wp-content/uploads/2025/07/Header_Top_Center_720x170.webp',
 golf:'https://lpgasgrowthsummit.com/wp-content/uploads/2025/07/HomeBenefits_Golf.webp',
 content:'https://lpgasgrowthsummit.com/wp-content/uploads/2025/07/HomeBenefits_Content.webp',
 hall:'https://lpgashalloffame.com/wp-content/uploads/2023/12/venue.jpg',
 print:'https://www.lpgasmagazine.com/wp-content/themes/childTheme_3_22/images/footerlogo.png'
};
function nativeArtwork(id,large=false){const src=id===61?imageSources.summit:id===62?imageSources.hall:id===40?imageSources.content:imageSources.logo;const photo=[61,62,40].includes(id);return `<figure style="margin:0 0 15px;background:${photo?'#eef3f9':'#0b1f3a'};border-radius:10px;overflow:hidden"><img src="${src}" alt="${photo?(id===62?'LP Gas Hall of Fame venue':id===61?'LP Gas Growth Summit attendees':'LP Gas Growth Summit presentation'):'LP Gas publisher logo'}" style="display:block;width:100%;height:${large?280:130}px;object-fit:${photo?'cover':'contain'};padding:${photo?0:20}px" referrerpolicy="no-referrer" loading="lazy"><figcaption style="background:#edf3f9;color:#5f6b7a;padding:6px 10px;font-size:10px">${photo?'Publisher event photo · illustrative placement context':'LP Gas publisher artwork'}</figcaption></figure>`;}
function demoBanner(){return `<div style="padding:14px 24px;background:#edf3f9;color:#23374d;font:14px Arial"><strong>LP Gas Magazine · Vivid demonstration</strong> · View-only · Illustrative inventory, fictional contract values and simulated activity · Conservative demo pricing · Not verified LP Gas rates<br><a href="/org-organization/lp-gas-demo">Enterprise</a> · <a href="/advertise/lp-gas-demo">Marketplace</a> · <a href="/my-setup">Advertiser portal</a> · <a href="/admin/marketing-command-center">Marketing Command Center</a></div>`;}
function enhanceNative(html){return html.replace('<body>','<body>'+demoBanner()).replace('</style>',`
${nativeExtras}
</style>`);}
const nativeExtras=`.table{overflow:auto}table{width:100%;border-collapse:collapse;background:white}th,td{padding:13px;border-bottom:1px solid var(--vivid-border);text-align:left;font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:15px;margin:24px 0}.metric{display:block;background:white;border-radius:18px;padding:18px;box-shadow:0 8px 22px #00000014;text-decoration:none}.metric strong{display:block;font-size:30px}.metric span{font-size:13px;color:var(--vivid-text-muted)}.pill{display:inline-block;padding:7px 14px;border-radius:999px;font-size:13px;background:#dcfce7;color:#166534}.pill.Pending{background:#fef3c7;color:#92400e}.pill.Sold{background:#dbeafe;color:#1e40af}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:15px 0}.filters{display:flex;gap:12px;align-items:end;flex-wrap:wrap}.filters label{min-width:165px}.muted{color:var(--vivid-text-muted)}.card footer{margin-top:15px;padding-top:10px;border-top:1px solid var(--vivid-border)}label{display:block;font-size:13px}summary{cursor:pointer}button{font:inherit}textarea{width:100%;padding:11px;border:1px solid var(--vivid-border);border-radius:10px}.org-location-grid>a>div{width:100%!important}@media(max-width:800px){.topbar,.wrap{padding:22px}.grid{grid-template-columns:1fr}h1{font-size:28px}}`;
function nativeShell(title,subtitle,body,path){const keyMap={'/org-sales-reps':'sales-reps','/org-campaign-builder-requests':'campaign-builder','/inventory':'marketplace','/advertisers':'advertisers','/requests':'advertising-requests','/contracts':'contracts','/renewals':'renewals','/pipeline':'pipeline','/reports':'reports','/admin/reports':'reports','/locations':'locations','/operations':'operations','/performance':'performance'};body=body.replace(/class="panel/g,'class="card').replace(/class="button secondary/g,'class="btn secondary').replace(/class="button/g,'class="btn').replace(/<button(?![^>]*class=)/g,'<button class="btn"');return enhanceNative(orgPage(title,organizationNav({organizationId:'lp-gas-demo',organizationName:'LP Gas Magazine — Vivid Demo',activePage:keyMap[path]||'',userName:'LP Gas Demo Reviewer'})+`<div class="topbar"><div class="brand">Vivid Organizations</div><h1>${h(title)}</h1><p class="subtitle">${h(subtitle)}</p></div><div class="wrap">${body}</div>`));}
function nativeLocations(q){const d=reporting(q);return [...new Set(opportunities.map(o=>o.space_id))].map(id=>{const list=opportunities.filter(o=>o.space_id===id),rows=d.rows.filter(r=>list.some(o=>o.id===r.opportunity_id));return {id,name:list[0].edition,location:list[0].channel,qr_placements:rows.length,placement_value:rows.reduce((a,r)=>a+r.cost,0),active_campaigns:rows.length,scans:rows.reduce((a,r)=>a+r.scans,0),conversions:rows.reduce((a,r)=>a+r.conversions,0),conversion_value:rows.reduce((a,r)=>a+r.revenue,0)};});}
function nativeOverview(q){
 const org={id:'lp-gas-demo',name:'LP Gas Magazine — Vivid Demo'},req={session:{orgUser:{name:'LP Gas Demo Reviewer'},user:{role:'customer'}}},scope={hasOrganizationWideAccess:true};
 const d=reporting(q),locations=nativeLocations(q),fromDate=d.from,toDate=d.to,dateQueryString=new URLSearchParams({from:fromDate,to:toDate}).toString();
 const totals={qrPlacements:d.rows.length,placementValue:d.rows.reduce((a,r)=>a+r.cost,0),scans:d.rows.reduce((a,r)=>a+r.scans,0),conversions:d.rows.reduce((a,r)=>a+r.conversions,0),conversionValue:d.rows.reduce((a,r)=>a+r.revenue,0)};
 const availableSpots=opportunities.filter(o=>o.status==='Available').length,pendingSpots=opportunities.filter(o=>o.status==='Pending').length,availableRevenue=opportunities.filter(o=>o.status==='Available').reduce((a,o)=>a+o.price,0),pendingRevenue=opportunities.filter(o=>o.status==='Pending').reduce((a,o)=>a+o.price,0),advertiserCount=1,activeContracts=3;
 const nativeMoney=money;
const locationCards = locations.map(location => `
  <a
    href="/org-location/${location.id}?organization_id=${org.id}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
      min-width:0;
    "
  >
    <div style="
    background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
      transition:transform .15s ease, box-shadow .15s ease;
    "
    onmouseover="
      this.style.transform='translateY(-2px)';
      this.style.boxShadow='0 7px 18px rgba(0,0,0,.11)';
    "
    onmouseout="
      this.style.transform='translateY(0)';
      this.style.boxShadow='0 4px 12px rgba(0,0,0,.07)';
    ">

      ${nativeArtwork(location.id)}
      <div style="
        font-size:15px;
        line-height:1.2;
        font-weight:bold;
        min-height:36px;
        margin-bottom:3px;
      ">
        ${location.name || "Unnamed Location"}
      </div>

      <div style="
        color:#65776b;
        font-size:11px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        margin-bottom:10px;
      ">
        ${location.location || "Market not set"}
      </div>

  <div style="
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px 8px;
">

  <div>
    <div style="font-size:10px;color:#65776b;">
      QR Placements
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.qr_placements || 0).toLocaleString()}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Placement Value
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${nativeMoney(location.placement_value)}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Campaigns
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.active_campaigns || 0).toLocaleString()}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Scans
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.scans || 0).toLocaleString()}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Conversions
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.conversions || 0).toLocaleString()}
    </div>
  </div>

  <div style="grid-column:1/-1;">
    <div style="font-size:10px;color:#65776b;">
      Revenue Generated
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${nativeMoney(location.conversion_value)}
    </div>
  </div>

</div>

      <div style="
        margin-top:10px;
        padding-top:8px;
        border-top:1px solid #e7eee7;
        font-size:11px;
        font-weight:bold;
        color:#176b3a;
      ">
        Open Location →
      </div>

    </div>
  </a>
`).join("");

return orgPage("Organization Overview", `
 ${organizationNav({
  organizationId: org.id,
  organizationName: org.name,
  activePage: "dashboard",
  userName:
    req.session.orgUser?.name ||
    req.session.user?.name ||
    "",
  showAdministration:
    scope.hasOrganizationWideAccess
})}

  <div class="topbar">
    <div class="brand">Vivid Organizations</div>

    <h1>Overview</h1>

    <p class="subtitle">
      Organization revenue, advertisers, opportunities, and performance.
    </p>
  </div>

  <div class="wrap">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:18px;
            flex-wrap:wrap;
            margin-bottom:18px;
          ">
            <div>
              <h2 style="margin:0 0 5px;">
                Business Overview
              </h2>

              <div style="color:#65776b;">
                Organization performance aggregated directly from Vivid.
              </div>
            </div>

           
<div style="
  display:flex;
  gap:10px;
  flex-wrap:wrap;
">

  <a
    class="btn"
    href="/org-marketplace?organization_id=${org.id}"
  >
    + Add Sponsorship
  </a>

  ${
    req.session.user?.role === "super_admin"
      ? `
        <a
          class="btn secondary"
          href="/org-organizations"
        >
          Back to Organizations
        </a>
      `
      : ""
  }

</div>
          </div>
${orgDateFilterForm({
  action: `/org-organization/${org.id}`,
  fromDate,
  toDate
})}
        <h2 style="margin:22px 0 5px;">
  Advertising Business
</h2>

<div style="color:#65776b;margin-bottom:16px;">
  Current advertising inventory, pipeline, and advertiser results.
</div>

<div style="
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:15px;
  margin:0 0 30px;
">

  <a
    href="/org-business-breakdown?organization_id=${org.id}&metric=available"
    style="text-decoration:none;color:inherit;display:block;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:15px;font-weight:bold;">
        Available Advertising
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-top:16px;
      ">
        <div>
          <div style="font-size:12px;color:#65776b;">
            Available Spots
          </div>
          <div style="font-size:28px;font-weight:bold;margin-top:5px;">
            ${availableSpots.toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:12px;color:#65776b;">
            Available Revenue
          </div>
          <div style="font-size:25px;font-weight:bold;margin-top:5px;">
            ${nativeMoney(availableRevenue)}
          </div>
        </div>
      </div>

      <div style="
        margin-top:17px;
        padding-top:11px;
        border-top:1px solid #e7eee7;
        font-size:12px;
        color:#176b3a;
        font-weight:bold;
      ">
        View by Location →
      </div>
    </div>
  </a>

  <a
   href="/org-business-breakdown?organization_id=${org.id}&metric=pending${dateQueryString ? `&${dateQueryString}` : ""}"
style="text-decoration:none;color:inherit;display:block;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:15px;font-weight:bold;">
        Pending Advertising
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-top:16px;
      ">
        <div>
          <div style="font-size:12px;color:#65776b;">
            Pending Spots
          </div>
          <div style="font-size:28px;font-weight:bold;margin-top:5px;">
            ${pendingSpots.toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:12px;color:#65776b;">
            Pending Revenue
          </div>
          <div style="font-size:25px;font-weight:bold;margin-top:5px;">
            ${nativeMoney(pendingRevenue)}
          </div>
        </div>
      </div>

      <div style="
        margin-top:17px;
        padding-top:11px;
        border-top:1px solid #e7eee7;
        font-size:12px;
        color:#176b3a;
        font-weight:bold;
      ">
        View by Location →
      </div>
    </div>
  </a>

  <a
    href="/org-business-breakdown?organization_id=${org.id}&metric=active${dateQueryString ? `&${dateQueryString}` : ""}"
    style="text-decoration:none;color:inherit;display:block;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:15px;font-weight:bold;">
        Active Advertising
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-top:16px;
      ">
        <div>
          <div style="font-size:12px;color:#65776b;">
            Active Spots
          </div>
          <div style="font-size:28px;font-weight:bold;margin-top:5px;">
            ${totals.qrPlacements.toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:12px;color:#65776b;">
            Active Revenue
          </div>
          <div style="font-size:25px;font-weight:bold;margin-top:5px;">
            ${nativeMoney(totals.placementValue)}
          </div>
        </div>
      </div>

      <div style="
        margin-top:17px;
        padding-top:11px;
        border-top:1px solid #e7eee7;
        font-size:12px;
        color:#176b3a;
        font-weight:bold;
      ">
        View by Location →
      </div>
    </div>
  </a>

  <a
    href="/org-business-breakdown?organization_id=${org.id}&metric=advertiser-revenue${dateQueryString ? `&${dateQueryString}` : ""}"
    style="text-decoration:none;color:inherit;display:block;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:15px;font-weight:bold;">
        Advertiser Revenue Generated
      </div>

      <div style="font-size:29px;font-weight:bold;margin-top:20px;">
        ${nativeMoney(totals.conversionValue)}
      </div>

      <div style="font-size:12px;color:#65776b;margin-top:8px;">
        Revenue attributed through Vivid
      </div>

      <div style="
        margin-top:17px;
        padding-top:11px;
        border-top:1px solid #e7eee7;
        font-size:12px;
        color:#176b3a;
        font-weight:bold;
      ">
        View by Location →
      </div>
    </div>
  </a>

</div>

<h2 style="margin:0 0 14px;">
  Organization Overview
</h2>

<div style="
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
  gap:15px;
  margin:0 0 30px;
">

  <a
    href="/org-locations?organization_id=${org.id}"
    style="text-decoration:none;color:inherit;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;color:#65776b;">Locations</div>
      <div style="font-size:30px;font-weight:bold;margin-top:7px;">
        ${locations.length.toLocaleString()}
      </div>
    </div>
  </a>

  <a
    href="/org-advertisers?organization_id=${org.id}"
    style="text-decoration:none;color:inherit;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;color:#65776b;">Advertisers</div>
      <div style="font-size:30px;font-weight:bold;margin-top:7px;">
        ${advertiserCount.toLocaleString()}
      </div>
    </div>
  </a>

  <a
    href="/org-contracts?organization_id=${org.id}"
    style="text-decoration:none;color:inherit;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;color:#65776b;">Active Contracts</div>
      <div style="font-size:30px;font-weight:bold;margin-top:7px;">
        ${activeContracts.toLocaleString()}
      </div>
    </div>
  </a>

  <a
    href="/org-performance?organization_id=${org.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="text-decoration:none;color:inherit;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;color:#65776b;">Scans</div>
      <div style="font-size:30px;font-weight:bold;margin-top:7px;">
        ${totals.scans.toLocaleString()}
      </div>
    </div>
  </a>

  <a
    href="/org-performance?organization_id=${org.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="text-decoration:none;color:inherit;"
  >
    <div class="card" style="margin:0;height:100%;box-sizing:border-box;">
      <div style="font-size:13px;color:#65776b;">Conversions</div>
      <div style="font-size:30px;font-weight:bold;margin-top:7px;">
        ${totals.conversions.toLocaleString()}
      </div>
    </div>
  </a>

</div>




          

       <div     
  class="org-location-grid"
  style="
   display:grid;
grid-template-columns:repeat(auto-fill,260px);
gap:18px;
justify-content:flex-start;
  "
>
            ${locationCards || `
              <div class="card" style="grid-column:1/-1;text-align:center;">
                <h3>No active locations</h3>
                <p>
                  No active Vivid locations are currently connected to this organization.
                </p>
              </div>
            `}
          </div>

        </div>
      `);
}


const dateLabel=(value,fallback='Not Set')=>value?new Date(value).toLocaleDateString('en-US',{timeZone:'UTC'}):fallback;
function nativeLocation(id,q){
 const organization={id:'lp-gas-demo',name:'LP Gas Magazine — Vivid Demo'},organizationId=organization.id,location=nativeLocations(q).find(r=>r.id===Number(id));if(!location)throw Object.assign(Error('Location not found.'),{status:404});
 const data=reporting({...q,location_id:String(id)}),fromDate=data.from,toDate=data.to,dateQueryString=new URLSearchParams({from:fromDate,to:toDate}).toString(),showOrganizationBackButton=true,backHref='/org-organization/lp-gas-demo',req={session:{orgUser:{name:'LP Gas Demo Reviewer'},user:{role:'customer'}}};
 const qrPlacements=data.rows.map(r=>({id:r.qr_id,name:r.qr_name,is_active:true,is_imported:false,placement_value:r.cost,active_campaigns:1,scans:r.scans,conversions:r.conversions,conversion_value:r.revenue}));
 const totals={placementValue:location.placement_value,activeCampaigns:location.active_campaigns,scans:location.scans,conversions:location.conversions,conversionValue:location.conversion_value};
const qrCards = qrPlacements.map(qr => `
  <a
    href="/org-qr/${qr.id}?organization_id=${organization.id}&location_id=${location.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
      min-width:0;
    "
  >
    <div style="
    background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
      transition:transform .15s ease, box-shadow .15s ease;
    "
    onmouseover="
      this.style.transform='translateY(-2px)';
      this.style.boxShadow='0 7px 18px rgba(0,0,0,.11)';
    "
    onmouseout="
      this.style.transform='translateY(0)';
      this.style.boxShadow='0 4px 12px rgba(0,0,0,.07)';
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
        margin-bottom:5px;
      ">

        <div style="
          font-size:15px;
          line-height:1.2;
          font-weight:bold;
        ">
          ${qr.name || "Unnamed QR Placement"}
        </div>

        <span style="
          background:${qr.is_active ? "#eaf3e8" : "#f3e8e8"};
          color:${qr.is_active ? "#176b3a" : "#8a1f1f"};
          padding:5px 8px;
          border-radius:999px;
          font-size:10px;
          white-space:nowrap;
        ">
          ${qr.is_active ? "Active" : "Inactive"}
        </span>

      </div>

      <div style="
        color:#65776b;
        font-size:11px;
        margin-bottom:12px;
      ">
        ${qr.is_imported ? "Imported QR" : "Vivid QR"}
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px 8px;
      ">

        <div>
          <div style="font-size:10px;color:#65776b;">
            Placement Value
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${money(qr.placement_value)}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Active Campaigns
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${Number(qr.active_campaigns || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Scans
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${Number(qr.scans || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Conversions
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${Number(qr.conversions || 0).toLocaleString()}
          </div>
        </div>

        <div style="grid-column:1/-1;">
          <div style="font-size:10px;color:#65776b;">
            Revenue Generated
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${money(qr.conversion_value)}
          </div>
        </div>

      </div>

      <div style="
        margin-top:12px;
        padding-top:9px;
        border-top:1px solid #e7eee7;
        font-size:11px;
        font-weight:bold;
        color:#176b3a;
      ">
        Open QR →
      </div>

    </div>
  </a>
`).join("");
return orgPage(
  "Organization Location",
  `
    ${organizationNav({
      organizationId,
      organizationName:
        organization.name,
      activePage: "dashboard",
      userName:
        req.session.orgUser?.name ||
        req.session.orgUser?.email ||
        req.session.user?.name ||
        req.session.user?.email ||
        "",
      locationId: location.id,
      queryString:
        dateQueryString || ""
    })}

    <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${location.name}</h1>

            <p class="subtitle">
              ${location.location || "Location"} · ${organization.name}
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:18px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  Location Overview
                </h2>

                <div style="color:#65776b;">
                  Performance aggregated directly from Vivid QR placements.
                </div>
              </div>

             ${
  showOrganizationBackButton
    ? `
      <a
        class="btn secondary"
        href="${backHref}"
      >
        Back to ${escapeHtml(organization.name)}
      </a>
    `
    : ""
}

            </div>
${nativeArtwork(location.id,true)}
${orgDateFilterForm({
  action: `/org-location/${location.id}`,
  fromDate,
  toDate
})}
            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(165px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  QR Placements
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${qrPlacements.length.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Placement Value
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(totals.placementValue)}
                </div>
              </div>



              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.activeCampaigns.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.scans.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Conversions
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.conversions.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(totals.conversionValue)}
                </div>
              </div>

            </div>

            <div style="margin-bottom:15px;">
              <h2 style="margin:0 0 5px;">
                QR Placements
              </h2>

              <div style="color:#65776b;">
                Each card represents an active Vivid QR placement at this location.
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(235px,1fr));
              gap:14px;
            ">

              ${qrCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No active QR placements</h3>

                  <p>
                    No active Vivid QR placements are currently connected to this location.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      );
}
function nativeQR(id,q){
 const data=reporting({...q,qr_id:String(id)}),r=data.rows[0],opportunity=opportunities.find(o=>o.id===r.opportunity_id),organizationId='lp-gas-demo';
 const qr={id:r.qr_id,name:r.qr_name,location_id:opportunity.space_id,location_name:opportunity.edition,organization_id:organizationId,organization_name:'LP Gas Magazine — Vivid Demo',market:opportunity.channel,is_active:true,is_imported:false,live_date:r.start_date,end_date:r.end_date,placement_value:r.cost,annual_impressions:0};
 const fromDate=data.from,toDate=data.to,dateQueryString=new URLSearchParams({from:fromDate,to:toDate}).toString(),metrics={scans:r.scans,offer_clicks:r.clicks,intent:r.clicks,maps_clicks:0,waze_clicks:0,conversions:r.conversions,revenue_generated:r.revenue};
 const campaigns=[{id:r.campaign_id,name:r.campaign_name,advertiser:r.advertiser,is_active:true,start_date:r.start_date,end_date:r.end_date,avg_customer_value:1200}],activeCampaigns=campaigns,advertiserNames=[r.advertiser];
 const campaignCards = campaigns.map(campaign => `
  <a
    href="/org-campaign/${campaign.id}?organization_id=${organizationId}&qr_id=${qr.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
    "
  >
    <div style="
   background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
    ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:12px;
            margin-bottom:12px;
          ">

            <div>
              <div style="
                font-size:17px;
                font-weight:bold;
                line-height:1.25;
              ">
                ${campaign.name || "Unnamed Campaign"}
              </div>

              <div style="
                color:#65776b;
                font-size:12px;
                margin-top:3px;
              ">
                ${campaign.advertiser || "Advertiser not set"}
              </div>
            </div>

            <span style="
              background:${campaign.is_active !== false ? "#eaf3e8" : "#f3e8e8"};
              color:${campaign.is_active !== false ? "#176b3a" : "#8a1f1f"};
              padding:6px 9px;
              border-radius:999px;
              font-size:10px;
              font-weight:bold;
              white-space:nowrap;
            ">
              ${campaign.is_active !== false ? "Active" : "Inactive"}
            </span>

          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          ">

            <div>
              <div style="font-size:10px;color:#65776b;">
                Start Date
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${dateLabel(
                  campaign.start_date ||
                  campaign.started_at ||
                  campaign.assigned_at
                )}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                End Date
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${dateLabel(
                  campaign.end_date ||
                  campaign.ended_at,
                  "Active"
                )}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                Customer Value
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${money(campaign.avg_customer_value)}
              </div>
            </div>

        <div>
  <div style="font-size:10px;color:#65776b;">
    Campaign ID
  </div>
  <div style="font-size:13px;font-weight:bold;">
    ${campaign.id}
  </div>
</div>

</div>

<div style="
  margin-top:12px;
  padding-top:8px;
  border-top:1px solid #e7eee7;
  color:#176b3a;
  font-size:12px;
  font-weight:bold;
">
  Open Campaign →
</div>

</div>
</a>
`).join("");

return orgPage(
        "QR Placement Detail",
        `
          <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${qr.name || "QR Placement"}</h1>

            <p class="subtitle">
              ${qr.location_name} · ${qr.organization_name}
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:20px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  QR Placement Overview
                </h2>

                <div style="color:#65776b;">
                  Detailed performance pulled directly from Vivid.
                </div>
              </div>

              <a
                class="btn secondary"
                href="/org-location/${qr.location_id}?organization_id=${qr.organization_id}${dateQueryString ? `&${dateQueryString}` : ""}"
              >
                Back to ${qr.location_name}
              </a>

         </div>

${orgDateFilterForm({
  action: `/org-qr/${qr.id}`,
  fromDate,
  toDate
})}

<!-- Executive KPI cards -->

<div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Placement Value
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(qr.placement_value)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${activeCampaigns.length.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(metrics.revenue_generated)}
                </div>
              </div>

            </div>

            <!-- Placement information -->

            <h2 style="margin-bottom:14px;">
              Placement Information
            </h2>

            <div class="card" style="margin:0 0 30px;">

              <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
                gap:18px;
              ">

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Location
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.location_name}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Market
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.market || "-"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    QR Type
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.is_imported ? "Imported QR" : "Vivid QR"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Status
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Live Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(qr.live_date)}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    End Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(qr.end_date, "Active")}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Advertiser
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${advertiserNames.join(", ") || "Not assigned"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Annual Impressions
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${Number(qr.annual_impressions || 0).toLocaleString()}
                  </div>
                </div>

              </div>

            </div>

            <!-- Performance -->

            <h2 style="margin-bottom:14px;">
              Performance Detail
            </h2>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Offer Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.offer_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Maps Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.maps_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Waze Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.waze_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Intent
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.intent || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Conversions
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.conversions || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${money(metrics.revenue_generated)}
                </div>
              </div>

            </div>

            <!-- Campaigns -->

            <div style="margin-bottom:14px;">
              <h2 style="margin:0 0 5px;">
                Campaigns
              </h2>

              <div style="color:#65776b;">
                Campaign relationships and dates pulled directly from Vivid.
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(270px,1fr));
              gap:14px;
            ">

              ${campaignCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No campaigns assigned</h3>

                  <p>
                    No Vivid campaigns are currently connected to this QR placement.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      );
}

function nativePage(path,q){
 if(/^\/org-location\/\d+$/.test(path))return enhanceNative(nativeLocation(path.split('/').pop(),q));
 if(/^\/org-qr\/\d+$/.test(path))return enhanceNative(nativeQR(path.split('/').pop(),q));
 if(path==='/enterprise')return enhanceNative(nativeOverview(q));
 if(path==='/locations'){const rows=nativeLocations(q);return nativeShell('LP Gas Magazine — Vivid Demo Locations','Locations, QR Codes and active campaigns pulled directly from Vivid.',`<div class="card table"><table><thead><tr><th>Location</th><th>Market</th><th>QR Codes</th><th>Active Campaigns</th><th>Live Date</th><th>End Date</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${h(r.name)}</td><td>${h(r.location)}</td><td>${r.qr_placements}</td><td>${r.active_campaigns}</td><td>2026-09-15</td><td>2026-12-31</td><td><a class="btn" href="/org-location/${r.id}">Open</a></td></tr>`).join('')}</tbody></table></div>`,'/locations');}
 const loc=path.match(/^\/org-location\/(\d+)$/);if(loc){const location=nativeLocations(q).find(r=>r.id===+loc[1]);if(!location)throw Object.assign(Error('Location not found.'),{status:404});const list=opportunities.filter(o=>o.space_id===location.id);return nativeShell(location.name,location.location+' · LP Gas Magazine — Vivid Demo',`<div class="actions"><h2>Location Overview</h2><a class="btn secondary" href="/org-organization/lp-gas-demo">Back to LP Gas Magazine — Vivid Demo</a></div>${orgDateFilterForm({action:path,fromDate:reporting(q).from,toDate:reporting(q).to})}${nativeArtwork(location.id,true)}${cards([['QR Placements',location.qr_placements,'/reports?location_id='+location.id],['Placement Value',money(location.placement_value),'/contracts?location_id='+location.id],['Active Campaigns',location.active_campaigns,'/reports?location_id='+location.id],['Scans',location.scans,'/reports?location_id='+location.id],['Conversions',location.conversions,'/reports?location_id='+location.id],['Revenue Generated',money(location.conversion_value),'/reports?location_id='+location.id]])}<h2>Advertising inventory</h2>${inventory({program_id:String(list[0].program_id),location_id:String(location.id)})}`,'/locations');}
 if(path==='/org-sales-reps')return nativeShell('Sales Rep Report','Responsibility, follow-up and renewal ownership.',`<div class="card table"><table><thead><tr><th>Owner</th><th>Advertiser</th><th>Active contracts</th><th>Contracted revenue</th><th>Next action</th></tr></thead><tbody><tr><td>Demo Account Manager</td><td><a href="/advertisers">${h(advertiser)}</a></td><td><a href="/contracts">3</a></td><td>${money(sampleContractRevenue)}</td><td><a href="/renewals">Renewal review · December 1</a></td></tr></tbody></table><p class="muted">Fictional demo team. Ownership and follow-up can be explored without saving changes.</p></div>`,path);
 if(path==='/org-campaign-builder-requests')return nativeShell('Campaign Builder','Advertising requests, campaign destinations and advertiser setup.',`<div class="card"><span class="pill Pending">Pending · demo request</span><h2>Website section sponsorship</h2><p>Demo Software Provider · Inquiry received</p><div class="actions"><a class="btn" href="/requests">Review advertising request</a><a class="btn secondary" href="/admin/edit-campaign/201">Explore campaign setup</a><a href="/my-setup">Advertiser setup →</a></div><p class="muted">Explore request → agreement → advertiser setup → campaign → reporting. Creating or saving campaigns is disabled in this isolated demo.</p></div>`,path);
 if(path==='/operations')return nativeShell('Organization Administration','Manage organization users, programs, permissions and settings.',`<div class="grid">${[['Users','/org-users'],['Programs','/org-programs'],['Permissions','/org-permissions'],['Settings','/org-settings']].map(([name,url])=>`<a class="card" href="${url}"><h2>${name}</h2><p>Explore organization administration.</p><footer>Open ${name} →</footer></a>`).join('')}</div>`,'/operations');
 if(['/org-users','/org-programs','/org-permissions','/org-settings'].includes(path)){const title={'/org-users':'Organization Users','/org-programs':'Organization Programs','/org-permissions':'Organization Permissions','/org-settings':'Organization Settings'}[path];const body=path==='/org-programs'?groups.map(g=>`<a class="card" style="display:block" href="/inventory?program_id=${g.id}"><h2>${h(g.name)}</h2><p>${h(g.description)}</p></a>`).join(''):path==='/org-users'?'<div class="card"><h2>LP Gas Demo Reviewer</h2><p>Organization administrator · View-only demonstration</p><p>Users, roles and location assignments can be managed in the live platform.</p></div>':'<div class="card"><h2>LP Gas Magazine — Vivid Demo</h2><p>Organization scope, permissions and configuration are shown for exploration. Saving and account changes are disabled in this isolated demonstration.</p><a class="btn" href="/operations">Back to Administration</a></div>';return nativeShell(title,'View organization administration without changing accounts.',body,'/operations');}
 if(path==='/admin/marketing-command-center')return nativeShell('Marketing Command Center','Website and digital campaign measurement alongside physical placement engagement.',`<div class="card"><h2>Connected marketing overview</h2><p>No live advertising accounts are connected in this isolated demo. LP Gas and advertiser credentials are not required to explore the workflow.</p><a class="btn" href="/reports">Explore simulated campaign reporting</a><a class="btn secondary" href="/my-setup">Open advertiser portal</a></div>`,'/performance');
 return publisher(path,q);
}
function mapNative(path,q){
 if(q.organization_id&&q.organization_id!=='lp-gas-demo')throw Object.assign(Error('Organization unavailable in this demo.'),{status:404});
 const aliases={'/org-organization/lp-gas-demo':'/enterprise','/org-locations':'/locations','/org-advertisers':'/advertisers','/org-marketplace':'/inventory','/org-advertising-requests':'/requests','/org-contracts':'/contracts','/org-renewals':'/renewals','/org-revenue-pipeline':'/pipeline','/org-performance':'/reports','/org-export':'/reports','/org-operations':'/operations','/org-help':'/help'};
 if(path==='/org-business-breakdown'){const status={available:'Available',pending:'Pending',active:'Sold'}[q.metric];if(status){q.status=status;return '/inventory';}return '/reports';}
 if(/^\/org-campaign\/\d+$/.test(path))return '/admin/view-campaign/'+path.split('/').pop();return aliases[path]||path;
}

function rewrite(html){return html.replace(/(["'`])(\/(?!\/)[^\s"'`<>]*)\1/g,(all,quote,url)=>quote+PREFIX+url+quote);}
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
function response(body,status=200,type='text/html; charset=utf-8',extra={}){return new Response(body,{status,headers:{...headers,'Content-Type':type,...extra}});}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.createHash('sha256').update(token).digest('hex')===INVITE_HASH;}
async function pdf(data){const doc=new PDFDocument({size:'A4',margin:45});const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});doc.fontSize(22).text('LP Gas | Vivid advertiser report');doc.moveDown().fontSize(10).text('SIMULATED DEMONSTRATION DATA - Not official LP Gas results or offers.');doc.moveDown().text(`${data.from} through ${data.to}`).text(advertiser);for(const r of data.rows){doc.moveDown().fontSize(14).text(r.qr_name).fontSize(11).text(`Scans: ${r.scans} | Clicks / intent: ${r.clicks} | Conversions: ${r.conversions}`).text(`Attributed advertiser revenue: ${money(r.revenue)}`);}doc.moveDown().fontSize(9).text('Attributed advertiser revenue is separate from publisher contract sales. Live conversion tracking requires installation and validation.');doc.end();return await done;}
export async function handle(request){
 try{const url=new URL(request.url),path=url.pathname,q=Object.fromEntries(url.searchParams);
  if(path==='/health')return response('ok',200,'text/plain');
  if(!['GET','HEAD'].includes(request.method))return response('This demonstration is view-only.',405,'text/plain',{'Allow':'GET, HEAD'});
  if(Date.now()>=EXPIRES)return response('This demo invitation has expired.',410,'text/plain');
  const entry=path.match(/^\/lp-gas-review\/([^/]+)\/(enterprise|marketplace|advertiser)$/);
  if(entry){if(!validToken(entry[1]))return response('Demo link not found.',404,'text/plain');const target=entry[2]==='marketplace'?'/advertise/lp-gas-demo':entry[2]==='advertiser'?'/my-setup':'/enterprise';return response('',302,'text/plain',{'Location':PREFIX+target,'Set-Cookie':`vivid.lp-gas.demo=${SESSION_VALUE}; HttpOnly; SameSite=Lax; ${url.protocol==='https:'?'Secure; ':''}Path=${PREFIX}; Max-Age=28800`});}
  if(!path.startsWith(PREFIX+'/'))return response('A private LP Gas demo invitation is required.',404,'text/plain');
  const cookie=request.headers.get('cookie')||'';if(!cookie.split(';').some(c=>c.trim()==='vivid.lp-gas.demo='+SESSION_VALUE))return response('Please reopen your original LP Gas demo invitation.',401,'text/plain');
  const local=mapNative(path.slice(PREFIX.length),q);
  if(local.startsWith('/export/')){const data=reporting(q);if(local==='/export/report.pdf')return response(await pdf(data),200,'application/pdf',{'Content-Disposition':'attachment; filename="LP-Gas-Demo-Report.pdf"'});if(local==='/export/report.csv'){const esc=v=>'"'+String(v).replace(/"/g,'""')+'"';const rows=[['SIMULATED VIVID DEMO - NOT OFFICIAL LP GAS RESULTS'],['From',data.from,'Through',data.to],['Placement','Scans','Clicks / intent','Conversions','Attributed advertiser revenue'],...data.rows.map(r=>[r.qr_name,r.scans,r.clicks,r.conversions,r.revenue])];return response(rows.map(row=>row.map(esc).join(',')).join('\r\n'),200,'text/csv; charset=utf-8',{'Content-Disposition':'attachment; filename="LP-Gas-Demo-Report.csv"'});}return response('Export not found.',404,'text/plain');}
  const qr=local.match(/^\/qr\/(\d+)\.png$/);if(qr){if(!baseRows.some(r=>r.qr_id===+qr[1]))return response('QR not found.',404,'text/plain');return response(await QRCode.toBuffer('https://example.com/?vivid_demo=lp-gas&placement='+qr[1],{width:400,margin:3}),200,'image/png',{'Content-Disposition':`attachment; filename="LP-Gas-SAMPLE-QR-${qr[1]}.png"`});}
  let html;
  if(local.startsWith('/advertise/lp-gas-demo'))html=marketplace(local,q);
  else if(local==='/my-setup'||/^\/lp-gas-demo\/placement\/\d+$/.test(local)){const data=reporting(q);html=portalRender(data,q,local==='/my-setup'?null:local.split('/').pop());html=html.replace('<body>','<body><div style="background:#edf3f9;padding:14px 24px;font:14px system-ui"><strong>LP Gas · Independent Vivid demonstration</strong> · Simulated activity and fictional contract values · <a href="/enterprise">Publisher portal</a> · <a href="/advertise/lp-gas-demo">Marketplace</a></div>');}
  else html=nativePage(local,q);
  return response(rewrite(html));
 }catch(error){return response(h(error.status?error.message:'Demo temporarily unavailable.'),error.status||500);}
}
if(typeof Bun!=='undefined')Bun.serve({port:Number(Bun.env.PORT||3000),fetch:handle});
else {const {createServer}=await import('node:http');createServer(async(req,res)=>{const result=await handle(new Request('http://localhost:3000'+req.url,{method:req.method,headers:req.headers}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}).listen(Number(process.env.PORT||3000));}
