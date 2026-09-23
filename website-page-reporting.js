"use strict";
const {createTracker,cleanUrl}=require("./website-page-tracking");
const {configuredWebsitePages}=require("./website-page-config");
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const note="Page Visits count each attributed QR journey once per page. Totals can include several pages from one journey; they are not unique people, conversions, or revenue. A dash means no records in this period, not verified zero activity or installation. Dates and times are UTC.";
const trackers=new WeakMap();
function filters(query={},allTime=false) {
  const today=new Date().toISOString().slice(0,10);
  const date=value=>{
    if(value==="")return "";
    if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Object.assign(Error("Use valid reporting dates."),{status:400});
    return value;
  };
  const id=value=>{
    if(value==null||value==="")return "";
    if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw Object.assign(Error("Use valid report filters."),{status:400});
    return String(value);
  };
  const f={start_date:date(query.start_date||query.startDate||query.start||query.from||(allTime?"":today)),end_date:date(query.end_date||query.endDate||query.end||query.to||(allTime?"":today)),
    campaign_id:id(query.campaign_id||query.campaignId||query.campaign),qr_id:id(query.qr_id||query.qrId||query.qr),location_id:id(query.location_id),status:String(query.status||"all").toLowerCase()};
  if(f.start_date&&f.end_date&&f.start_date>f.end_date)throw Object.assign(Error("Start date must be on or before end date."),{status:400});
  if(!["all","active","archived"].includes(f.status))throw Object.assign(Error("Use a valid campaign status."),{status:400});
  return f;
}
async function load({q,user,query={},allTime=false}) {
  if(!user||!Number.isSafeInteger(Number(user.id)))throw Object.assign(Error("Sign in required."),{status:401});
  const f=filters(query,allTime),admin=user.role==="super_admin";
  if(!trackers.has(q))trackers.set(q,createTracker(q));
  await trackers.get(q).ensureSchema();
  // Campaign ownership is checked independently of caller-supplied filters.
  // EXISTS avoids multiplying counts when a QR has multiple assignments.
  const campaigns=(await q(`SELECT c.id,c.name,c.advertiser FROM campaigns c
    WHERE ($1::boolean OR c.user_id=$2)
      AND ($3::text='' OR c.id=NULLIF($3,'')::int)
      AND ($4::text='all' OR ($4='archived')=COALESCE(c.is_archived,false))
      AND (($5::text='' AND $6::text='') OR EXISTS (
        SELECT 1 FROM qr_codes qr WHERE ($5::text='' OR qr.id=NULLIF($5,'')::int)
          AND ($6::text='' OR qr.space_id=NULLIF($6,'')::int)
          AND (EXISTS (SELECT 1 FROM qr_campaigns qc WHERE qc.qr_id=qr.id AND qc.campaign_id=c.id)
            OR EXISTS (SELECT 1 FROM campaign_website_visits v WHERE v.qr_id=qr.id AND v.campaign_id=c.id))))
    ORDER BY c.advertiser,c.name,c.id`,[admin,Number(user.id),f.campaign_id,f.status,f.qr_id,f.location_id])).rows;
  const rows=campaigns.length?(await q(`SELECT v.campaign_id,v.qr_id,qr.space_id AS location_id,v.page_url,
      MAX(v.page_name) AS page_name,COUNT(*)::int AS visits,MAX(v.created_at) AS last_visit
    FROM campaign_website_visits v JOIN campaigns c ON c.id=v.campaign_id JOIN qr_codes qr ON qr.id=v.qr_id
    WHERE v.campaign_id=ANY($1::int[]) AND ($2::boolean OR c.user_id=$3)
      AND ($4::text='' OR v.created_at >= (NULLIF($4,'')::date::timestamp AT TIME ZONE 'UTC'))
      AND ($5::text='' OR v.created_at < ((NULLIF($5,'')::date+1)::timestamp AT TIME ZONE 'UTC'))
      AND ($6::text='' OR v.qr_id=NULLIF($6,'')::int)
      AND ($7::text='' OR qr.space_id=NULLIF($7,'')::int)
    GROUP BY v.campaign_id,v.qr_id,qr.space_id,v.page_url ORDER BY v.campaign_id,v.page_url`,
    [campaigns.map(c=>c.id),admin,Number(user.id),f.start_date,f.end_date,f.qr_id,f.location_id])).rows:[];
  const pages=[];
  for(const c of campaigns){
    const observed=new Map();
    for(const row of rows.filter(r=>Number(r.campaign_id)===Number(c.id))){
      const url=cleanUrl(row.page_url)?.url||row.page_url,previous=observed.get(url);
      if(previous){previous.visits+=Number(row.visits);if(new Date(row.last_visit)>new Date(previous.last_visit))previous.last_visit=row.last_visit;}
      else observed.set(url,{...row,page_url:url,visits:Number(row.visits)});
    }
    for(const p of configuredWebsitePages(c)){
      const url=cleanUrl(p.url).url;
      if(!observed.has(url))observed.set(url,{page_url:url,page_name:p.name,visits:null,last_visit:null});
    }
    if(!observed.size)observed.set("",{page_url:"",page_name:"No page records in this period",visits:null,last_visit:null});
    for(const p of observed.values())pages.push({...p,campaign_id:Number(c.id),campaign_name:c.name,advertiser:c.advertiser});
  }
  return {filters:f,campaigns,rows,pages,total:rows.reduce((sum,r)=>sum+Number(r.visits),0)};
}
function count(report,key,id){
  const total=report.rows.filter(r=>Number(r[key])===Number(id)).reduce((n,r)=>n+Number(r.visits),0);
  return total||"—";
}
const stamp=value=>value?new Date(value).toISOString().replace("T"," ").slice(0,19)+" UTC":"—";
function renderSection(report){
  const query=new URLSearchParams({...report.filters,...(!report.filters.start_date||!report.filters.end_date?{all_time:"1"}:{})}).toString();
  return `<section id="website-page-visits"><h2>Website Page Visits</h2>
    <p>Page Visits recorded: <strong>${report.total||"—"}</strong></p><p>${note}</p>
    <p><a class="btn secondary" href="/export/website-pages.csv?${esc(query)}">Export Page Visits CSV</a>
      <a class="btn secondary" href="/export/website-pages.pdf?${esc(query)}">Export Page Visits PDF</a></p>
    <div style="overflow-x:auto"><table><thead><tr><th>Advertiser</th><th>Campaign</th><th>Page</th><th>URL</th><th>Page Visits</th><th>Last Recorded Visit</th></tr></thead><tbody>
    ${report.pages.map(p=>`<tr><td>${esc(p.advertiser)}</td><td>${esc(p.campaign_name)}</td><td>${esc(p.page_name)}</td><td style="overflow-wrap:anywhere">${esc(p.page_url)||"—"}</td><td>${p.visits??"—"}</td><td>${esc(stamp(p.last_visit))}</td></tr>`).join("")||'<tr><td colspan="6">No campaigns match these filters.</td></tr>'}
    </tbody></table></div></section>`;
}
function csv(report){
  // Quote fields and neutralize spreadsheet formula prefixes in untrusted labels.
  const cell=v=>'"'+String(v??"").replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
  const header=["Start Date (UTC)","End Date (UTC)","Campaign ID","Advertiser","Campaign","Page","URL","Page Visits","Last Recorded Visit (UTC)","Data Status"];
  const rows=report.pages.map(p=>[report.filters.start_date,report.filters.end_date,p.campaign_id,p.advertiser,p.campaign_name,p.page_name,p.page_url,p.visits??"",p.last_visit?stamp(p.last_visit):"",p.visits==null?"No records in period":"Recorded"]);
  return [header,...rows].map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
}
function appendPdf(doc,report,{newPage=true}={}){
  if(newPage)doc.addPage();
  const left=doc.page.margins.left,width=doc.page.width-left-doc.page.margins.right;
  const widths=[width*.22,width*.47,width*.11,width*.20];
  const bottom=()=>doc.page.height-doc.page.margins.bottom;
  const heading=continued=>{
    doc.font("Helvetica-Bold").fillColor("#123d25").fontSize(17).text("Website Page Visits"+(continued?" - continued":""),left,doc.y,{width});
    doc.moveDown(.4).font("Helvetica").fillColor("#374151").fontSize(9)
      .text(`Period: ${report.filters.start_date||"All dates"} through ${report.filters.end_date||"present"} (UTC). Page Visits recorded: ${report.total||"No records"}.`,left,doc.y,{width});
    if(!continued)doc.moveDown(.4).text(note.replace(/A dash/g,"A dash (-)"),{width});
    doc.moveDown(.8);let x=left,y=doc.y;
    doc.save().rect(left,y,width,28).fill("#eaf2ff").restore();
    ["Campaign / Advertiser","Page / URL","Page Visits","Last Visit (UTC)"].forEach((label,i)=>{doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(label,x+5,y+8,{width:widths[i]-10});x+=widths[i];});
    doc.y=y+28;
  };
  heading(false);
  if(!report.pages.length)doc.font("Helvetica").fontSize(10).text("No campaigns match these filters.",left,doc.y+12,{width});
  for(const p of report.pages){
    const values=[`${p.campaign_name}\n${p.advertiser}`,`${p.page_name}\n${p.page_url||"-"}`,String(p.visits??"-"),p.last_visit?stamp(p.last_visit).replace(" UTC",""):"-"];
    doc.font("Helvetica").fontSize(8);
    const h=Math.min(180,Math.max(38,...values.map((s,i)=>doc.heightOfString(s,{width:widths[i]-10})+14)));
    if(doc.y+h>bottom()){doc.addPage();heading(true);}
    const y=doc.y;let x=left;
    values.forEach((s,i)=>{doc.font("Helvetica").fontSize(8).fillColor("#111827").text(s,x+5,y+7,{width:widths[i]-10,height:h-12,ellipsis:true});x+=widths[i];});
    doc.moveTo(left,y+h).lineTo(left+width,y+h).strokeColor("#d8e4d8").stroke();doc.y=y+h;
  }
  doc.x=left;
}
function register({app,q,requireLogin}){
  for(const format of ["csv","pdf"])app.get("/export/website-pages."+format,requireLogin,async(req,res)=>{
    try{
      const report=await load({q,user:req.session.user,query:req.query,allTime:req.query.all_time==="1"});
      res.set("Cache-Control","no-store");
      res.set("Content-Disposition",`attachment; filename="vivid-page-visits.${format}"`);
      if(format==="csv")return res.type("text/csv").send(csv(report));
      const PDFDocument=require("pdfkit"),doc=new PDFDocument({margin:48,size:"LETTER"});
      res.type("application/pdf");doc.pipe(res);appendPdf(doc,report,{newPage:false});doc.end();
    }catch(error){console.error("Website page export failed",error.code||"internal");if(!res.headersSent)res.status(error.status||500).send(error.status?error.message:"Unable to export page visits. Please try again.");else res.end();}
  });
}
module.exports={filters,load,count,renderSection,csv,appendPdf,register};
