'use strict';
const {jobs,MAIN}=require('./hexpol-careers');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isDemo=req=>Boolean(req.hfhsReviewVerified||req.rubberWorldReviewVerified||req.ccpsReviewVerified);
function shortcut(req,campaigns){
 if(isDemo(req)||!campaigns.some(c=>Number(c.id)===88))return '';
 return `<section class="card" style="margin:18px 0;padding:22px;border-left:5px solid #176b3a"><h2 style="margin:0 0 8px">HEXPOL job performance</h2><p>See clicks for each of your 27 job listings.</p><a class="btn" href="/hexpol-careers/report">Job Click Report</a> <a class="btn secondary" href="/hexpol-careers/report.pdf">Download Job Report PDF</a></section>`;
}
function dates(query,now=new Date()){
 const end=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const start=new Date(end+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-29);
 const from=String(query.from||start.toISOString().slice(0,10)),to=String(query.to||end);
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to)||from>to)throw Object.assign(Error('Choose a valid start and end date.'),{status:400});
 return {from,to};
}
async function load(q,req){
 if(isDemo(req))throw Object.assign(Error('Report unavailable in this demo.'),{status:403});
 const user=req.session.user;
 const allowed=await q('SELECT id FROM campaigns WHERE id=88 AND ($1::boolean OR user_id=$2)',[user.role==='super_admin',user.id]);
 if(!allowed.rows.length)throw Object.assign(Error('Report unavailable for this account.'),{status:403});
 const period=dates(req.query);
 const result=await q(`SELECT cd.id,cd.destination_url,cd.is_active,
 COUNT(e.id)::int AS clicks,COUNT(DISTINCT e.vivid_click_id)::int AS visitors,MAX(e.created_at) AS last_click
 FROM campaign_destinations cd LEFT JOIN events e ON e.campaign_destination_id=cd.id
 AND e.campaign_id=88 AND e.type='destination_click'
 AND e.created_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')
 AND e.created_at < ((($2::date+1)::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')
 WHERE cd.campaign_id=88 GROUP BY cd.id ORDER BY cd.id`,[period.from,period.to]);
 const rows=jobs.map(j=>{
  const matches=result.rows.filter(r=>r.destination_url===j.url);
  return {...j,clicks:matches.reduce((n,r)=>n+Number(r.clicks),0),visitors:matches.reduce((n,r)=>n+Number(r.visitors),0),active:matches.some(r=>r.is_active!==false),lastClick:matches.map(r=>r.last_click).filter(Boolean).sort().at(-1)||null};
 });
 const visitorTotal=await q(`SELECT COUNT(DISTINCT e.vivid_click_id)::int AS visitors
 FROM events e JOIN campaign_destinations cd ON cd.id=e.campaign_destination_id AND cd.campaign_id=e.campaign_id
 WHERE e.campaign_id=88 AND e.type='destination_click' AND cd.destination_url=ANY($3::text[])
 AND e.created_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')
 AND e.created_at < ((($2::date+1)::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')`,[period.from,period.to,jobs.map(j=>j.url)]);
 return {...period,rows,visitors:Number(visitorTotal.rows[0]?.visitors||0),clicks:rows.reduce((n,r)=>n+r.clicks,0),mainClicks:result.rows.filter(r=>r.destination_url===MAIN).reduce((n,r)=>n+Number(r.clicks),0)};
}
const when=value=>value?new Date(String(value).includes('T')?value:String(value)+'Z').toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'No clicks yet';
function infoIcon(id,label,text){
 return `<span class="job-metric-info"><button type="button" aria-label="About ${label}" aria-describedby="${id}" aria-expanded="false" onclick="const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));" onkeydown="if(event.key==='Escape'){this.setAttribute('aria-expanded','false');this.blur();}" >ⓘ</button><span id="${id}" role="tooltip">${esc(text)}</span></span>`;
}
const clickExplanation='How many times this job was selected through Vivid. If someone clicks the same job three times during one tracked visit, that is 3 clicks.';
const visitorExplanation='Distinct tracked QR visits that clicked this job. Three clicks on the same job during one tracked visit count as 1 visitor. Scanning the QR again can count as another visitor; this is not a count of verified individual people.';
function html(data){
 const query=new URLSearchParams({from:data.from,to:data.to});
 return `<style>
.job-metric-info{position:relative;display:inline-block;vertical-align:middle;text-align:left}
.job-metric-info button{border:0;background:transparent;color:#176b3a;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1}
.job-metric-info button:focus-visible{outline:2px solid #176b3a;outline-offset:2px;border-radius:4px}
.job-metric-info [role=tooltip]{display:none;position:absolute;z-index:20;top:100%;right:0;width:260px;max-width:70vw;padding:12px;background:#123d25;color:white;border-radius:8px;box-shadow:0 4px 14px #0003;font-size:13px;font-weight:normal;line-height:1.5;white-space:normal}
.job-metric-info:hover [role=tooltip],.job-metric-info button:focus-visible+[role=tooltip],.job-metric-info button[aria-expanded=true]+[role=tooltip]{display:block}
.job-metric-info.card-info [role=tooltip]{left:0;right:auto}
</style><div class="wrap"><p><a href="/my-setup">← Back to advertiser portal</a></p><h1>HEXPOL Job Click Report</h1><p>Online Job Listings · All 27 jobs · Dates and times in Eastern Time</p>
 <form method="get" style="display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:20px 0"><label>From<br><input type="date" name="from" value="${data.from}" required></label><label>To<br><input type="date" name="to" value="${data.to}" required></label><button class="btn">Update report</button><a class="btn secondary" href="/hexpol-careers/report.pdf?${query}">Download PDF</a></form>
 <div class="cards"><div class="card"><div>Job listings</div><h2>27</h2></div><div class="card"><div>Job clicks ${infoIcon("job-total-clicks-info","job clicks",clickExplanation).replace("job-metric-info", "job-metric-info card-info")}</div><h2>${data.clicks}</h2></div><div class="card"><div>Visitors ${infoIcon("job-total-visitors-info","total visitors","Distinct tracked QR visits that clicked at least one job in the selected dates. A visit that clicks several jobs is counted once here, even though it appears under each job. Scanning the QR again can count as another visitor; this is not a count of verified individual people.").replace("job-metric-info", "job-metric-info card-info")}</div><h2>${data.visitors||0}</h2></div><div class="card"><div>Main careers page clicks</div><h2>${data.mainClicks}</h2></div></div>
 <p class="note">Job clicks are selections routed through Vivid. ADP must connect its job-selection tracking before these clicks can appear. Application submissions are not measured in this report. Visitors are distinct tracked journeys for each job.</p>
 <div style="overflow:auto"><table style="width:100%;min-width:720px"><thead><tr><th style="text-align:left">Job / destination URL</th><th style="text-align:left">Location</th><th>Clicks ${infoIcon("job-clicks-info","clicks",clickExplanation)}</th><th>Visitors ${infoIcon("job-visitors-info","visitors",visitorExplanation)}</th><th>Last click</th></tr></thead><tbody>${data.rows.map(j=>`<tr><td style="max-width:480px;padding:14px 10px"><strong>${esc(j.title)}</strong><br><small>${j.requisition}${j.active?'':' · Inactive'}</small><br><a href="${esc(j.url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;overflow-wrap:anywhere">${esc(j.url)}</a></td><td>${esc(j.location)}</td><td style="text-align:center;font-weight:bold">${j.clicks}</td><td style="text-align:center">${j.visitors}</td><td>${esc(when(j.lastClick))}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function pdf(data){
 const PDFDocument=require('pdfkit');
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'LETTER',margin:40,bufferPages:true,info:{Title:'HEXPOL Job Click Report'}}),chunks=[];
  doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
  function heading(){doc.font('Helvetica-Bold').fontSize(18).fillColor('#123d25').text('HEXPOL Job Click Report',40,40);doc.font('Helvetica').fontSize(10).fillColor('#374151').text(data.from+' to '+data.to+' | Eastern Time',40,66);doc.text('27 jobs   |   Job clicks: '+data.clicks+'   |   Main page clicks: '+data.mainClicks,40,84);doc.fontSize(8).text('Clicks measure job selections through Vivid. ADP tracking installation is required.',40,104);doc.text('Application submissions are not measured. Visitors = tracked journeys per job.',40,116);doc.y=140;}
  heading();
  for(const job of data.rows){
   if(doc.y+66>735){doc.addPage();heading();}
   const y=doc.y;doc.rect(40,y,532,62).fill('#f4f7f5');
   doc.font('Helvetica-Bold').fontSize(10).fillColor('#123d25').text(job.title,48,y+6,{width:390,height:24});
   doc.font('Helvetica').fontSize(8).fillColor('#374151').text(job.requisition+' | '+job.location+(job.active?'':' | Inactive'),48,y+30,{width:410});
   doc.fontSize(7).fillColor('#176b3a').text(job.url,48,y+44,{width:510,link:job.url,lineBreak:false});
   doc.font('Helvetica-Bold').fontSize(10).fillColor('#123d25').text(String(job.clicks)+' clicks',455,y+6,{width:105,align:'right'});
   doc.font('Helvetica').fontSize(8).text(String(job.visitors)+' visitors',455,y+21,{width:105,align:'right'});doc.y=y+66;
  }
  const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Vivid Spots | Online Job Listings',40,752,{lineBreak:false});doc.text('Page '+(i+1)+' of '+range.count,470,752,{lineBreak:false});}
  doc.end();
 });
}
function register(app,q,{requireLogin,page}){
 for(const format of ['html','pdf'])app.get('/hexpol-careers/report'+(format==='pdf'?'.pdf':''),requireLogin,async(req,res)=>{
  try{const data=await load(q,req);res.set('Cache-Control','private, no-store');if(format==='html')return res.send(page('Job Click Report',html(data)));
   const buffer=await pdf(data);res.type('application/pdf').set('Content-Disposition','attachment; filename="hexpol-job-clicks-'+data.from+'-to-'+data.to+'.pdf"').send(buffer);
  }catch(e){console.error('HEXPOL job report:',e.message);res.status(e.status||500).send(e.status?e.message:'Unable to generate the job report. Please try again.');}
 });
}
module.exports={shortcut,dates,load,html,pdf,register};
