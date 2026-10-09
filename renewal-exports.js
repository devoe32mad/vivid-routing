"use strict";
const DAY=86400000;
const STATUSES=['all','not-started','draft','scheduled','active','in-progress'];
const iso=value=>value ? (value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10)) : '';
const money=value=>Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
function dateInput(value){const s=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Choose valid renewal dates.');return s;}
function filters(query,now=new Date()){
 const window=String(query.renewal_window||'90');if(!['30','60','90','custom'].includes(window))throw Error('Choose a valid renewal window.');
 const today=now.toISOString().slice(0,10);
 const from=window==='custom'?dateInput(query.renewal_from):today;
 const to=window==='custom'?dateInput(query.renewal_to):new Date(Date.parse(today)+Number(window)*DAY).toISOString().slice(0,10);
 if(from>to)throw Error('Renewal end date must follow start date.');
 const status=String(query.renewal_status||'all');if(!STATUSES.includes(status))throw Error('Choose a valid renewal status.');
 const programId=query.renewal_program_id?Number(query.renewal_program_id):null;
 if(programId!==null&&(!Number.isInteger(programId)||programId<=0))throw Error('Choose a valid event type.');
 return {window,from,to,status,programId,today};
}
const statusFor=r=>!r.renewal_contract_id?'Not Started':({draft:'Draft',scheduled:'Scheduled',active:'Active'})[String(r.renewal_status||'').trim().toLowerCase()]||r.renewal_status||'In Progress';
function selectRows(rows,f){return rows.map(r=>({...r,due_date:iso(r.renewal_date||r.expiration_date||r.end_date),expiration:iso(r.expiration_date||r.end_date),renewal_label:statusFor(r)})).filter(r=>r.due_date>=f.from&&r.due_date<=f.to&&(f.status==='all'||(f.status==='not-started'?!r.renewal_contract_id:f.status==='in-progress'?r.renewal_contract_id&&!['draft','scheduled','active'].includes(String(r.renewal_status||'').toLowerCase()):String(r.renewal_status||'').trim().toLowerCase()===f.status))).map(r=>({...r,days_remaining:Math.ceil((Date.parse(r.due_date)-Date.parse(f.today))/DAY)})).sort((a,b)=>String(a.event_type).localeCompare(String(b.event_type))||String(a.location_name).localeCompare(String(b.location_name))||a.due_date.localeCompare(b.due_date)||Number(a.id)-Number(b.id));}
function summary(rows){return rows.reduce((s,r)=>{s.count++;s.current+=Number(r.total_contract_value||0);if(['scheduled','active'].includes(String(r.renewal_status||'').trim().toLowerCase()))s.secured+=Number(r.renewal_contract_value||0);else s.outstanding+=Number(r.total_contract_value||0);return s;},{count:0,current:0,secured:0,outstanding:0});}
// Same active-contract cohort, renewal-date precedence and latest renewal version as /org-renewals.
const SQL=`SELECT c.id,c.contract_name,c.total_contract_value,c.start_date,c.end_date,c.expiration_date,c.renewal_date,
 s.name AS location_name,COALESCE(p.name,'Unassigned event type') AS event_type,
 COALESCE(NULLIF(a.name,''),ar.business_name,u.name,u.email,'Unknown Advertiser') AS advertiser_name,
 COALESCE(oo.title,ar.opportunity_name,c.contract_name) AS opportunity_name,
 renewal.id AS renewal_contract_id,renewal.status AS renewal_status,renewal.total_contract_value AS renewal_contract_value,
 renewal.start_date AS renewal_start_date,renewal.end_date AS renewal_end_date
 FROM contracts c LEFT JOIN spaces s ON s.id=c.location_id AND s.organization_id=c.organization_id
 LEFT JOIN advertisers a ON a.id=c.advertiser_id AND a.organization_id=c.organization_id
 LEFT JOIN organization_advertising_requests ar ON ar.id=c.advertising_request_id AND ar.organization_id=c.organization_id
 LEFT JOIN organization_opportunities oo ON oo.id=c.opportunity_id AND oo.organization_id=c.organization_id
 LEFT JOIN organization_programs p ON p.id=oo.program_id AND p.organization_id=c.organization_id
 LEFT JOIN users u ON u.id=c.customer_id
 LEFT JOIN LATERAL (SELECT r.id,r.status,r.total_contract_value,r.start_date,r.end_date FROM contracts r
  WHERE r.renewed_from_contract_id=c.id AND r.organization_id=c.organization_id
  ORDER BY r.contract_version DESC,r.id DESC LIMIT 1) renewal ON true
 WHERE c.organization_id=$1 AND c.location_id=ANY($2::int[]) AND LOWER(TRIM(c.status))='active'
 AND ($3::int IS NULL OR c.location_id=$3) AND ($4::int IS NULL OR oo.program_id=$4)`;
async function data(req,{q,getOrganizationScope},f){
 const scope=await getOrganizationScope(req);const org=Number(req.query.organization_id);
 if(!org||org!==Number(scope.organizationId))throw Object.assign(Error('Access denied'),{status:403});
 const location=req.query.location_id?Number(req.query.location_id):scope.selectedLocationId||null;
 if(location!==null&&(!Number.isInteger(location)||!scope.allowedLocationIds.includes(location)))throw Object.assign(Error('Location access denied'),{status:403});
 const organization=(await q('SELECT id,name,slug FROM organizations WHERE id=$1',[org])).rows[0];
 if(!organization)throw Object.assign(Error('Organization not found'),{status:404});
 const rows=selectRows((await q(SQL,[org,scope.allowedLocationIds,location,f.programId])).rows,f);
 return {organization,rows,filters:f,summary:summary(rows)};
}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(d){const header=['Contract ID','Event Type','Event / Location','Sponsorship','Advertiser','Current Contract Value','Expiration Date','Renewal Due Date','Days Until Renewal','Renewal Status','Renewal Contract ID','Renewal Contract Value','Renewal Start','Renewal End','Demo Data'];return '\uFEFF'+[header,...d.rows.map(r=>[r.id,r.event_type,r.location_name,r.opportunity_name,r.advertiser_name,Number(r.total_contract_value||0),r.expiration,r.due_date,r.days_remaining,r.renewal_label,r.renewal_contract_id||'',r.renewal_contract_id?Number(r.renewal_contract_value||0):'',iso(r.renewal_start_date),iso(r.renewal_end_date),d.organization.slug==='henry-ford-health-demo'?'Yes':'No'])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
function pdf(d,PDFDocument){
 const doc=new PDFDocument({size:'LETTER',layout:'landscape',margin:36,bufferPages:true,info:{Title:d.organization.name+' Renewals Report',Author:'Vivid'}});
 const widths=[133,164,71,70,70,80,132];const heads=['Advertiser','Sponsorship','Current value','Expiration','Renewal due','Status','Renewal value'];const left=36,right=756,bottom=558;
 function title(){doc.fillColor('#173f2a').font('Helvetica-Bold').fontSize(20).text('Renewals Report',left,32);doc.fontSize(11).text(d.organization.name,left,58);doc.font('Helvetica').fontSize(9).fillColor('#52645a').text('Renewal dates: '+d.filters.from+' to '+d.filters.to+' | Status: '+d.filters.status,left,77);if(d.organization.slug==='henry-ford-health-demo')doc.text('Demonstration data - illustrative, not actual Henry Ford Health results.',left,92);}
 title();let y=116;const s=d.summary;doc.fillColor('#173f2a').font('Helvetica-Bold').fontSize(11).text('Contracts due: '+s.count+'    Current value: '+money(s.current)+'    Secured renewal value: '+money(s.secured),left,y);y+=20;doc.text('Outstanding current value: '+money(s.outstanding),left,y);y+=20;doc.font('Helvetica').fontSize(8).fillColor('#52645a').text('Secured = Scheduled or Active renewal. Outstanding = current value without a secured renewal. These are contract values, not collected revenue.',left,y,{width:720});y+=30;
 function tableHeader(){let x=left;doc.rect(left,y,720,23).fill('#e9eff5');doc.fillColor('#173f2a').font('Helvetica-Bold').fontSize(8);heads.forEach((h,i)=>{doc.text(h,x+5,y+7,{width:widths[i]-10,lineBreak:false});x+=widths[i];});y+=23;}
 function newPage(group){doc.addPage();title();y=116;doc.font('Helvetica-Bold').fontSize(10).fillColor('#173f2a').text(group+' (continued)',left,y,{width:720});y=doc.y+8;tableHeader();}
 let group='';if(!d.rows.length)doc.font('Helvetica').fontSize(12).text('No renewals match these filters.',left,y);
 for(const r of d.rows){const g=r.event_type+' / '+r.location_name;if(g!==group){if(group)y+=10;if(y>bottom-100){doc.addPage();title();y=116;}group=g;doc.font('Helvetica-Bold').fontSize(10).fillColor('#173f2a').text(g,left,y,{width:720});y=doc.y+8;tableHeader();}
 const cells=[r.advertiser_name,r.opportunity_name,money(r.total_contract_value),r.expiration||'-',r.due_date,r.renewal_label,r.renewal_contract_id?money(r.renewal_contract_value):'-'];doc.font('Helvetica').fontSize(8);let h=Math.max(29,...cells.map((v,i)=>doc.heightOfString(String(v||''),{width:widths[i]-10})+14));if(y+h>bottom)newPage(group);let x=left;doc.font('Helvetica').fontSize(8).fillColor('#1f2937');cells.forEach((v,i)=>{doc.text(String(v||''),x+5,y+7,{width:widths[i]-10});x+=widths[i];});doc.moveTo(left,y+h).lineTo(right,y+h).strokeColor('#dce5dd').stroke();y+=h;
 }
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(8).fillColor('#64748b').text('Vivid | '+new Date().toISOString().slice(0,10)+' | Page '+(i+1)+' of '+range.count,36,564,{width:720,align:'right',lineBreak:false});}
 return doc;
}
function register(app,deps){for(const format of ['csv','pdf'])app.get('/org-export/renewals.'+format,async(req,res)=>{try{let f;try{f=filters(req.query);}catch(e){return res.status(400).send(e.message);}const d=await data(req,deps,f);res.setHeader('Content-Disposition','attachment; filename="Renewals-'+d.filters.from+'-to-'+d.filters.to+'.'+format+'"');if(format==='csv'){res.setHeader('Content-Type','text/csv; charset=utf-8');return res.send(csv(d));}res.setHeader('Content-Type','application/pdf');const doc=pdf(d,deps.PDFDocument);doc.pipe(res);doc.end();}catch(e){console.error('RENEWALS EXPORT ERROR:',e.message);if(!res.headersSent)res.status(e.status||500).send(e.status?e.message:'Unable to export renewals.');}});}
function form(org,locationOptions,programs,escapeHtml){return `<section class="card" id="renewal-exports"><h2 style="margin-top:0">Renewals Export</h2><p style="color:#64748b">Export current active contracts by renewal due date, using the same due-date priority as Renewals. Executive reporting filters above remain separate.</p><form method="GET" action="/org-export/renewals.pdf"><input type="hidden" name="organization_id" value="${org}"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px"><label>Renewal window<select name="renewal_window"><option value="30">Next 30 days</option><option value="60">Next 60 days</option><option value="90" selected>Next 90 days</option><option value="custom">Custom dates below</option></select></label><label>Custom start<input type="date" name="renewal_from"></label><label>Custom end<input type="date" name="renewal_to"></label><label>Event / Location<select name="location_id">${locationOptions}</select></label><label>Event type<select name="renewal_program_id"><option value="">All event types</option>${programs.map(p=>'<option value="'+Number(p.id)+'">'+escapeHtml(p.name)+'</option>').join('')}</select></label><label>Renewal status<select name="renewal_status"><option value="all">All statuses</option><option value="not-started">Not Started</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="in-progress">Other / In Progress</option></select></label></div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px"><button class="btn" type="submit">Export Renewals PDF</button><button class="btn secondary" type="submit" formaction="/org-export/renewals.csv">Export Renewals CSV</button></div></form></section>`;}
function install(source){const marker='// RENEWALS_EXPORTS_V1';if(source.includes(marker))return source;const anchor='app.get(\n  "/org-export",';const start=source.indexOf(anchor),end=source.indexOf('\napp.',start+1);if(start<0||end<0)throw Error('Export Center route missing');let part=source.slice(start,end);const before='      const formatMoney = value =>';if(part.split(before).length!==2)throw Error('Export Center format anchor missing');part=part.replace(before,`      const renewalPrograms = await q(\`SELECT DISTINCT p.id,p.name FROM organization_programs p
        JOIN organization_opportunities oo ON oo.program_id=p.id AND oo.organization_id=p.organization_id
        WHERE p.organization_id=$1 AND oo.space_id=ANY($2::int[]) ORDER BY p.name\`,[organizationId,scope.allowedLocationIds]);
`+before);const card='              <div class="card">\n                <h2\n                  style="\n                    margin-top:0;\n                    margin-bottom:4px;';if(part.split(card).length!==2)throw Error('Executive snapshot anchor missing');part=part.replace(card,'              ${require("./renewal-exports").form(organizationId,reportLocationOptions,renewalPrograms.rows,escapeHtml)}\n'+card);return source.slice(0,start)+marker+'\nrequire("./renewal-exports").register(app,{q,getOrganizationScope,PDFDocument});\n'+part+source.slice(end);}
module.exports={filters,selectRows,summary,data,SQL,csv,pdf,form,register,install};
