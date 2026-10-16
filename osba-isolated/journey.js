import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages=['Request','Approval','Setup','Agreement','Fulfillment','Reporting','Renewal'];
export function createJourney({opportunities,banner,footer}){
 const sessions=new Map();
 const page=body=>`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OSBA · Sample journey</title><style>body{margin:0;background:#f6f8f7;color:#203b2b;font:16px/1.55 Arial}main{max-width:920px;margin:32px auto;padding:0 20px}section{background:white;border:1px solid #dce5df;border-radius:12px;padding:24px;margin:20px 0}h1{font-size:30px}h2{font-size:21px}a{color:#176339}label{display:block;margin:14px 0}input:not([type=checkbox]),textarea{display:block;width:100%;box-sizing:border-box;padding:12px;border:1px solid #aabbb0;border-radius:6px;font:inherit}button,.button{display:inline-block;background:#17482f;color:white;border:0;border-radius:7px;padding:12px 18px;font:inherit;cursor:pointer;text-decoration:none}p,dd{overflow-wrap:anywhere}dt{font-weight:bold}dd{margin:0 0 12px}small{color:#52645a}.steps{display:flex;gap:12px;flex-wrap:wrap}.steps b{color:#176339}img{max-width:100%;height:auto}table{width:100%;text-align:left}th,td{padding:8px;border-bottom:1px solid #ddd}</style></head><body>${banner()}<main><a href="/advertise/osba-demo">← Marketplace</a><h1>Your sample campaign</h1><p>Private to this browser session. No order, payment, email or binding agreement is created. Sample state expires after eight hours or when this demo restarts.</p>${body}</main>${footer()}</body></html>`;
 const fields=(s)=>`<dl><dt>Opportunity</dt><dd>${h(s.offer.title)} · $${s.offer.price.toLocaleString()} ${h(s.offer.pricing_unit)}</dd><dt>Business and contact</dt><dd>${h(s.data.business_name)} · ${h(s.data.contact_name)} · ${h(s.data.email)}</dd><dt>Campaign</dt><dd>${h(s.data.campaign_name||s.offer.title)}</dd><dt>Destination</dt><dd>${h(s.data.destination_url)}</dd><dt>Requirements / notes</dt><dd>${h(s.data.campaign_notes||'None supplied')}</dd></dl>`;
 const input=(name,label,value='',required=true)=>`<label>${label}<input name="${name}" value="${h(value)}" maxlength="1500" ${required?'required':''}></label>`;
 function render(s){
  const progress=`<div class="steps">${stages.map((x,i)=>i===s.stage?`<b>${i+1}. ${x}</b>`:`<span>${i<s.stage?'✓ ':''}${i+1}. ${x}</span>`).join('')}</div>`;
  let body='';
  if(s.stage===0)body='<p>Review the carried-over information below and submit a sample request.</p>'+fields(s);
  if(s.stage===1)body='<p>Publisher review: approve this sample request to carry its details into advertiser setup.</p>'+fields(s);
  if(s.stage===2)body=fields(s)+input('asset','Creative file name or asset reference','sample-artwork.pdf')+input('schedule','Requested issue / dates','Future cycle — confirm with OSBA')+'<label><input type="checkbox" name="qr" value="yes"> Enable optional sample QR tracking</label><p>The destination remains the one supplied in onboarding.</p>';
  if(s.stage===3)body=fields(s)+`<p>Creative: ${h(s.data.asset)}<br>Requested schedule: ${h(s.data.schedule)}<br>QR tracking: ${s.data.qr==='yes'?'Enabled':'Off'}</p><p>${h(s.offer.description)}</p><label><input type="checkbox" name="ack" value="yes" required> Acknowledge this sample agreement for demonstration purposes.</label>`;
  if(s.stage===4)body='<p>Mark the sample delivery checks complete. These controls do not publish any advertising.</p>'+['Creative approved','Placement or session scheduled','Package benefits delivered'].map((x,i)=>`<label><input type="checkbox" name="check${i}" value="yes" required> ${x}</label>`).join('')+`<p>Package scope: ${h(s.offer.description)}</p>`;
  if(s.stage===5)body='<p>Illustrative campaign results, generated only after sample fulfillment.</p><table><tr><th>Metric</th><th>Sample result</th></tr><tr><td>Clicks</td><td>84</td></tr><tr><td>Inquiries</td><td>7</td></tr>'+ (s.data.qr==='yes'?'<tr><td>QR scans</td><td>126</td></tr>':'')+'</table><p>These are simulated results, not OSBA audience estimates or measured activity.</p>';
  if(s.stage===6)body=fields(s)+'<p>Renewal draft retains the opportunity, buyer, destination, creative and tracking preference. Pricing and availability must be reconfirmed for the next cycle.</p>'+input('renewal_schedule','Next requested cycle','Next available cycle — confirm with OSBA');
  const buttons=['Submit sample request','Approve sample request','Save sample setup','Accept sample agreement','Complete sample fulfillment','Prepare renewal draft','Start sample renewal review'];
  return page(progress+`<section><h2>${stages[s.stage]}${s.cycle>1?' · Renewal '+(s.cycle-1):''}</h2><form method="post" action="/sample-journey"><input type="hidden" name="csrf" value="${s.csrf}"><input type="hidden" name="stage" value="${s.stage}">${body}<button>${buttons[s.stage]}</button></form></section><section><h2>Sample activity</h2><ol>${s.log.map(x=>`<li>${h(x)}</li>`).join('')}</ol>${s.stage>=4?'<a href="/sample-journey/agreement.pdf">Download sample agreement PDF</a>':''}${s.stage>=5?' · <a href="/sample-journey/report.pdf">Download sample report PDF</a>':''}</section>`);
 }
 return {
 decorate(html,path,data){
  const match=path.match(/\/opportunity\/(\d+)(?:\/review)?$/);
  if(match){const offer=opportunities.find(o=>o.id===Number(match[1]));if(offer){const review=path.endsWith('/review');const hidden=Object.entries(data).filter(([k])=>['business_name','contact_name','email','phone','campaign_name','destination_url','campaign_notes'].includes(k)).map(([k,v])=>`<input type="hidden" name="${h(k)}" value="${h(v)}">`).join('');
   const panel=`<section style="max-width:1000px;margin:24px auto;padding:24px;border:1px solid #dce5df;border-radius:12px;overflow-wrap:anywhere"><h2>Package details</h2>${offer.program_id===3?'<img src="/assets/conference.webp" alt="OSBA 2026 Capital Conference sponsorship" style="max-width:100%;height:auto">':''}<p>${h(offer.description)}</p><p><a href="${h(offer.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official package source</a></p>${review?`<form method="post" action="/sample-journey/start"><input type="hidden" name="opportunity_id" value="${offer.id}">${hidden}<button type="submit">Continue with this sample request</button></form><p>Continue through approval, setup, agreement, fulfillment, reporting and renewal in this browser session.</p>`:''}</section>`;
   html=html.replace('</main>',panel+'</main>');if(!html.includes('Official package source'))html=html.replace('</body>',panel+'</body>');
  }}
  if(['/my-setup','/org-advertising-requests','/org-contracts'].includes(path))html=html.replace('</body>','<p style="padding:24px;text-align:center"><a href="/sample-journey">Open your session’s sample campaign journey</a></p></body>');
  return html;
 },
 async handle(req,path){
  if(!path.startsWith('/sample-journey'))return null;
  const now=Date.now();for(const [k,v]of sessions)if(v.expires<now)sessions.delete(k);
  const id=(req.headers.get('cookie')||'').match(/(?:^|;\s*)osba\.journey=([a-f0-9]{48})(?:;|$)/)?.[1];let s=sessions.get(id);
  if(req.method==='POST'){
   const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin&&!((!origin||origin==='null')&&req.headers.get('sec-fetch-site')==='same-origin'))return {status:403,html:page('<p>Please submit from the demo page.</p>')};
   const data=Object.fromEntries(await req.formData());
   if(path==='/sample-journey/start'){
    const offer=opportunities.find(o=>o.id===Number(data.opportunity_id)&&o.status==='Available');
    let destination;try{destination=new URL(data.destination_url);}catch{}
    if(!offer||!data.business_name||!data.contact_name||!data.email||!destination||!['https:','http:'].includes(destination.protocol))return {status:400,html:page('<p>Complete the marketplace contact and destination fields first.</p>')};
    if(sessions.size>=500)return {status:503,html:page('<p>Demo session limit reached. Please try again later.</p>')};
    const newId=crypto.randomBytes(24).toString('hex');s={offer,data:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v).slice(0,3000)])),stage:0,cycle:1,csrf:crypto.randomBytes(24).toString('hex'),expires:now+28800000,log:['Onboarding information carried from marketplace review.']};sessions.set(newId,s);
    return {status:303,headers:{Location:'/demo/osba/sample-journey','Set-Cookie':`osba.journey=${newId}; HttpOnly; SameSite=Strict; ${new URL(req.url).protocol==='https:'?'Secure; ':''}Path=/demo/osba; Max-Age=28800`}};
   }
   if(!s||data.csrf!==s.csrf||Number(data.stage)!==s.stage)return {status:409,html:page('<p>Session or step changed. <a href="/sample-journey">Reload your current step.</a></p>')};
   if((s.stage===2&&(!data.asset||!data.schedule))||(s.stage===3&&data.ack!=='yes')||(s.stage===4&&[0,1,2].some(i=>data['check'+i]!=='yes'))||(s.stage===6&&!data.renewal_schedule))return {status:400,html:page('<p>Complete the required fields before continuing. <a href="/sample-journey">Return to your current step.</a></p>')};
   if(s.stage===2)for(const k of ['asset','schedule','qr'])s.data[k]=String(data[k]||'').slice(0,1500);
   s.log.push(stages[s.stage]+' completed (sample).');
   if(s.stage===6){s.data.schedule=String(data.renewal_schedule).slice(0,1500);s.stage=1;s.cycle++;s.log.push('Renewal request created with previous campaign information.');}else s.stage++;
   s.csrf=crypto.randomBytes(24).toString('hex');
   return {status:303,headers:{Location:'/demo/osba/sample-journey'}};
  }
  if(!s)return {html:page('<section><p>No sample request in this browser yet. Select an available marketplace opportunity, complete onboarding and use “Continue with this sample request” on its review page.</p><a class="button" href="/advertise/osba-demo">Browse opportunities</a></section>')};
  if(path.endsWith('.pdf')){
   const report=path==='/sample-journey/report.pdf';if(!['/sample-journey/report.pdf','/sample-journey/agreement.pdf'].includes(path)||s.stage<(report?5:4))return {status:404,html:page('<p>Complete the required journey step first.</p>')};
   const doc=new PDFDocument({margin:50});const chunks=[];const complete=new Promise(resolve=>doc.on('end',()=>resolve(Buffer.concat(chunks))));doc.on('data',x=>chunks.push(x));doc.fontSize(22).text('OSBA — SAMPLE '+(report?'REPORT':'AGREEMENT'));doc.moveDown().fontSize(11).text('Demonstration only. Not binding. No real inventory reservation or measured results.');for(const [label,value]of Object.entries({Opportunity:s.offer.title,Price:`$${s.offer.price} ${s.offer.pricing_unit}`,Business:s.data.business_name,Contact:s.data.contact_name,Email:s.data.email,Campaign:s.data.campaign_name,Destination:s.data.destination_url,Creative:s.data.asset,Schedule:s.data.schedule,'QR tracking':s.data.qr==='yes'?'Enabled':'Off',Benefits:s.offer.description}))doc.moveDown(.6).text(label+': '+String(value||''));if(report)doc.moveDown().text('SIMULATED RESULTS: 84 clicks; 7 inquiries'+(s.data.qr==='yes'?'; 126 QR scans.':'.'));doc.end();return {pdf:await complete,headers:{'Content-Disposition':`attachment; filename="OSBA-SAMPLE-${report?'REPORT':'AGREEMENT'}.pdf"`}};
  }
  return {html:render(s)};
 }
 };
}
