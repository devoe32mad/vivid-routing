"use strict";
function once(source,from,to){if(source.split(from).length!==2)throw Error('HFHS report scope anchor missing/ambiguous: '+from);return source.replace(from,to);}
function installReportScope(source){
  const marker='// HFHS_LINKED_REPORT_SCOPE_V1';
  if(source.includes(marker))return source;
  // Shared exporter also backs the main campaign report and CSV/PDF summaries.
  source=once(source,'  return reportRows;','  return require("./hfhs-demo-setup-scope").scopedRows(reportRows,await require("./hfhs-demo-setup-scope").reportScope(q,req.session.user),"campaignIds","campaignId");');
  for(const [path,result,type,key,loop] of [
    ['/reports-campaign','rows','campaignIds','campaign_id','    for (const r of rows.rows) {'],
    ['/reports-qr','qrResult','qrIds','qr_id','    for (const qr of qrResult.rows) {'],
    ['/reports-location','locations','locationIds','id','    for (const loc of locations.rows) {']
  ]){
    const start=source.indexOf(`app.get("${path}", requireLogin, async (req, res) => {`),end=source.indexOf('\napp.',start+1);
    if(start<0||end<0)throw Error('Missing route '+path);
    let part=source.slice(start,end);
    part=once(part,'  try {','  try {\n    const hfhsReportScope = await require("./hfhs-demo-setup-scope").reportScope(q,req.session.user);');
    part=once(part,loop,`    ${result}.rows = require("./hfhs-demo-setup-scope").scopedRows(${result}.rows,hfhsReportScope,"${type}","${key}");\n`+loop);
    if(path==='/reports-location'){
      part=once(part,'WHERE qr.space_id = $1','WHERE qr.space_id = $1 AND ($5::int[] IS NULL OR qr.id=ANY($5::int[]))');
      part=once(part,'[loc.id, startDate, endDate, isSuperAdmin ? null : currentUser.id]','[loc.id, startDate, endDate, isSuperAdmin ? null : currentUser.id, hfhsReportScope?.qrIds ?? null]');
      part=once(part,'      for (const qr of qrs.rows) {','      qrs.rows = require("./hfhs-demo-setup-scope").scopedRows(qrs.rows,hfhsReportScope,"qrIds","id");\n      for (const qr of qrs.rows) {');
    }
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}
function installExportCenter(source){
  const marker='// HFHS_EXPORT_CENTER_ACCESS_V1';
  if(source.includes(marker))return source;
  source=once(source,'      basicLockedRoutes.has(requestPath) &&',`      basicLockedRoutes.has(requestPath) &&
      !(requestPath === "/admin/reports" && await require("./hfhs-demo-setup-scope").reportScope(q,req.session.user)) &&`);
  const start=source.indexOf('app.get("/admin/reports", requireLogin, async (req, res) => {');
  const end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Export Center route missing');
  let part=source.slice(start,end);
  part=once(part,'    const reportRows = await buildExportReportRows(',`    const hfhsExportScope = await require("./hfhs-demo-setup-scope").reportScope(q,req.session.user);
    locations.rows = require("./hfhs-demo-setup-scope").scopedRows(locations.rows,hfhsExportScope,"locationIds","id");
    qrs.rows = require("./hfhs-demo-setup-scope").scopedRows(qrs.rows,hfhsExportScope,"qrIds","id");
    campaigns.rows = require("./hfhs-demo-setup-scope").scopedRows(campaigns.rows,hfhsExportScope,"campaignIds","id");
    const reportRows = await buildExportReportRows(`);
  part=once(part,'res.send(page("Reports",','res.send(page("Export Center",');
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}
function install(source){
  source=installRetiredDemoExclusion(source);
  source=installAdvertiserPdfPolish(source);
  source=installAdvertiserPeriod(source);
  source=installExecutiveConsistency(source);
  source=installHfhsExecutiveSummary(source);
  source=installRequestLocationFilters(source);
  source=installSalesOpportunityCards(source);
  source=installLocationDemoScope(source);
  source=installMarketingDemoLink(source);
  source=installExportCenter(source);
  source=installSharedExports(source);
  source=installReportScope(source);
  const marker='// HFHS_PERFORMANCE_DEMO_DEFAULT_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get(\n  "/org-performance",');
  const end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Performance route missing');
  let part=source.slice(start,end);
  part=once(part,'              id,\n              name\n\n            FROM organizations','              id,\n              name,\n              slug\n\n            FROM organizations');
  part=once(part,`      const includeTest =
        String(
          req.query.include_test || ""
        ) === "1";`, `      const isHfhsDemo = organization.slug === "henry-ford-health-demo";
      const includeTest = req.query.include_test !== undefined
        ? String(req.query.include_test) === "1"
        : isHfhsDemo && req.query.performance_filter !== "1";`);
  part=once(part,'      const eventTestSql =','      let eventTestSql =');
  part=once(part,'      const campaignTestSql =',`      if (isHfhsDemo) eventTestSql += \`
        AND EXISTS (SELECT 1 FROM campaigns active_demo_campaign
          WHERE active_demo_campaign.id=e.campaign_id
            AND active_demo_campaign.organization_id=$1
            AND COALESCE(active_demo_campaign.is_archived,false)=false)
        AND EXISTS (SELECT 1 FROM qr_codes active_demo_qr
          WHERE active_demo_qr.id=e.qr_id
            AND COALESCE(active_demo_qr.is_archived,false)=false)
      \`;
      const campaignTestSql =`);
  part=once(part,'                <input\n                  type="hidden"\n                  name="organization_id"','                <input type="hidden" name="performance_filter" value="1" />\n                <input\n                  type="hidden"\n                  name="organization_id"');
  part=once(part,'              <!-- =====================================\n                   LAUNCH SCORECARD',`              \${isHfhsDemo ? \`
                <div class="card" style="border-left:4px solid #2563eb;margin-bottom:20px;">
                  <strong>HFHS demonstration data\${includeTest ? " included" : " excluded"}</strong>
                  <p style="margin:6px 0 0;color:#65776b;">\${includeTest
                    ? "Results below use the existing HFHS sample campaigns for the selected dates. These are illustrative results, not actual Henry Ford Health outcomes. Archived demo campaigns are excluded."
                    : "Include test data above to see the HFHS sample campaign results."}</p>
                </div>\` : ""}
              <!-- =====================================
                   LAUNCH SCORECARD`);
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}
module.exports={install};


function installSharedExports(source){
  const marker='// SHARED_EXPORT_CENTER_ENTITLEMENTS_V1';
  if(source.includes(marker))return source;
  source=once(source,'      basicLockedRoutes.has(requestPath) &&','      basicLockedRoutes.has(requestPath) && requestPath !== "/admin/reports" &&');
  const start=source.indexOf('app.get("/admin/reports", requireLogin, async (req, res) => {');
  const end=source.indexOf('\napp.',start+1);
  let part=source.slice(start,end);
  part=once(part,'    const summary = reportRows.reduce',`    const exportAccess = await require("./report-performance-upgrade").load({q,req});
    const restrictedSummary = reportRows.some(r=>require("./report-performance-upgrade").restricted(exportAccess,"campaign_id",r.campaignId));
    const summary = reportRows.reduce`);
  for(const expression of ['summary.intent','summary.conversions','money(summary.revenue)','money(summary.allocatedCost)','money(summary.cac)','pct(summary.roi)']){
    part=once(part,'${'+expression+'}','${restrictedSummary ? "—" : '+expression+'}');
  }
  part=once(part,'${reportRows.map(r => `','${reportRows.map(r => require("./report-performance-upgrade").maskRow(exportAccess,"campaign_id",r.campaignId,5,`');
  part=once(part,'          </tr>\n        `).join("")}','          </tr>\n        `)).join("")}');
  part=once(part,'      <h2>Detailed Results</h2>','      ${restrictedSummary ? "<p>Basic includes scans. Restricted metrics appear as dashes in this page and its exports.</p>" : ""}\n      <h2>Detailed Results</h2>');
  part=once(part,'      <h1>Export Center</h1>',`      <div class="wrap">
      <h1>Export Center</h1>
      <p>Choose a date range and placements, then download your results.</p>
      <div class="card">`);
  part=once(part,'      </form>','      </form>\n      </div>');
  part=part.replace(/<button(?![^>]*class=)/g,'<button class="btn"');
  part=once(part,'grid-template-columns:repeat(4,1fr)','grid-template-columns:repeat(auto-fit,minmax(180px,1fr))');
  part=once(part,'      <h2>Detailed Results</h2>','      <div class="card">\n      <h2>Detailed Results</h2>\n      <div style="overflow-x:auto">');
  part=once(part,'      </table>','      </table>\n      </div></div>');
  part=once(part,'    `));','      </div>\n    `));');
  source=source.slice(0,start)+part+source.slice(end);
  const anchor='app.get("/export/events.csv", async (req, res) => {';
  source=once(source,anchor,`app.get(["/export/events.csv","/export/report.xlsx","/export/report.pdf"], requireLogin, async(req,res,next)=>{
    try { return await require("./install-hfhs-report-scope").exportDownload({q,req,res,next,buildExportReportRows}); }
    catch(error){ console.error("EXPORT ACCESS ERROR",error); return res.status(500).send("Unable to generate export."); }
  });\n`+anchor);
  return source+'\n'+marker+'\n';
}
function exportCells(row,state){
  const restricted=require('./report-performance-upgrade').restricted(state,'campaign_id',row.campaignId);
  return [row.advertiser,row.campaignName,row.qrNames,row.locationNames,row.status,row.scans,
    ...['offerClicks','mapClicks','wazeClicks','intent','conversions','revenue','allocatedCost','cac','roi'].map(key=>restricted?'—':row[key])];
}
async function exportDownload({q,req,res,next,buildExportReportRows}){
  const state=await require('./report-performance-upgrade').load({q,req});
  const raw=req.path==='/export/events.csv';
  if(!raw&&(!state.rows.length||req.ccpsReviewVerified))return next();
  const f=req.query,today=new Date().toISOString().slice(0,10);
  const start=f.start_date||f.startDate||f.start||f.from||today;
  const end=f.end_date||f.endDate||f.end||f.to||today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)return res.status(400).send('Choose a valid date range.');
  const location=f.location_id||'',qr=f.qr_id||f.qrId||f.qr||'',campaign=f.campaign_id||f.campaignId||f.campaign||'';
  const status=['active','archived'].includes(f.status)?f.status:'all';
  if(raw){
    const deniedQr=state.rows.map(r=>Number(r.qr_id));
    const deniedCampaign=state.rows.map(r=>Number(r.campaign_id)).filter(Boolean);
    const result=await q(`SELECT e.id,e.created_at,e.type,e.qr_id,qr.name AS qr_name,e.campaign_id,c.name AS campaign,c.advertiser
      FROM events e LEFT JOIN qr_codes qr ON qr.id=e.qr_id
      LEFT JOIN spaces s ON s.id=qr.space_id LEFT JOIN campaigns c ON c.id=e.campaign_id
      WHERE ($1::int IS NULL OR c.user_id=$1 OR s.user_id=$1)
        AND e.created_at >= $2::date AND e.created_at < $3::date + INTERVAL '1 day'
        AND ($4::text='' OR s.id::text=$4) AND ($5::text='' OR qr.id::text=$5) AND ($6::text='' OR c.id::text=$6)
        AND ($7='all' OR ($7='active' AND COALESCE(c.is_archived,false)=false) OR ($7='archived' AND c.is_archived=true))
        AND ($8::int[] IS NULL OR c.id=ANY($8)) AND ($9::int[] IS NULL OR qr.id=ANY($9))
        AND (e.type='scan' OR (NOT(e.qr_id=ANY($10::int[])) AND NOT(COALESCE(e.campaign_id,0)=ANY($11::int[]))))
      ORDER BY e.created_at DESC`,[req.session.user.role==='super_admin'?null:req.session.user.id,start,end,String(location),String(qr),String(campaign),status,state.hfhsScope?.campaignIds??null,state.hfhsScope?.qrIds??null,deniedQr,deniedCampaign]);
    const keys=['id','created_at','type','qr_id','qr_name','campaign_id','campaign','advertiser'];
    const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename=vivid-events.csv');
    return res.send([keys,...result.rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n'));
  }
  const rows=await buildExportReportRows(req,start,end,location,qr,campaign,status);
  const headers=['Advertiser','Campaign','QR Codes','Locations','Status','Scans','Offers','Maps','Waze','Intent','Conversions','Revenue','Allocated Cost','CAC','ROI %'];
  const data=rows.map(r=>exportCells(r,state));
  if(req.path.endsWith('.xlsx')){
    const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Campaign Results');
    sheet.addRow(['Vivid Export',start,end]);sheet.addRow(['Basic includes scans; restricted metrics are shown as dashes.']);
    sheet.addRow(headers);data.forEach(r=>sheet.addRow(r));
    sheet.columns.forEach(c=>c.width=22);sheet.getRow(3).font={bold:true};
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=vivid-report.xlsx');
    await book.xlsx.write(res);return res.end();
  }
  const PDFDocument=require('pdfkit'),doc=new PDFDocument({margin:40});
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename=vivid-report.pdf');
  doc.pipe(res);doc.fontSize(18).text('Vivid Performance Report');doc.fontSize(10).text(start+' to '+end);
  doc.text('Basic includes scans; restricted metrics are shown as dashes.').moveDown();
  data.forEach(cells=>{if(doc.y>570)doc.addPage();doc.fontSize(12).text(String(cells[1]||'Campaign'));doc.fontSize(9);headers.forEach((h,i)=>{if(i!==1)doc.text(h+': '+String(cells[i]??''));});doc.moveDown();});doc.end();
}
module.exports.exportDownload=exportDownload;
module.exports.exportCells=exportCells;

function installMarketingDemoLink(source){
  const marker='// HFHS_MARKETING_DEMO_LINK_V1';
  if(source.includes(marker))return source;
  for(const path of ['/my-setup','/reports','/admin/reports']){
    const start=source.indexOf(`app.get("${path}", requireLogin, async (req, res) => {`),end=source.indexOf('\napp.',start+1);
    if(start<0||end<0)throw Error('Marketing demo navigation route missing '+path);
    let part=source.slice(start,end);
    const at=part.lastIndexOf('    `));');
    if(at<0)throw Error('Marketing demo navigation rendering anchor missing '+path);
    part=part.slice(0,at)+`      \${require("./hfhs-demo-setup-scope").isHfhsDemo(req.session.user)?'<div class="wrap"><a class="btn secondary" href="/admin/marketing-command-center">Explore Marketing Command Center</a></div>':""}\n`+part.slice(at);
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}

function installLocationDemoScope(source){
  const marker='// HFHS_NEW_LOCATION_SCOPE_V1';
  if(source.includes(marker))return source;
  const get='app.get("/admin/new-location", requireLogin, async (req, res) => {';
  const post='app.post("/admin/new-location", requireLogin, async (req, res) => {';
  for(const anchor of [get,post]){
    const start=source.indexOf(anchor),end=source.indexOf('\napp.',start+anchor.length);
    if(start<0||end<0)throw Error('New Location route missing');
    let part=source.slice(start,end);
    part=once(part,'    const currentUser = req.session.user;',`    const currentUser = req.session.user;
    const hfhsLocationDemo = require("./hfhs-demo-setup-scope").isHfhsDemo(currentUser);
    const hfhsLocationOrg = hfhsLocationDemo ? (await q("SELECT id FROM organizations WHERE slug='henry-ford-health-demo' AND COALESCE(is_active,true)=true")).rows[0] : null;
    if(hfhsLocationDemo && !hfhsLocationOrg)return res.status(403).send("HFHS demo organization is unavailable.");`);
    if(anchor===get){
      part=once(part,'    let organizationField = "";',`    if(hfhsLocationDemo) orgs.rows=orgs.rows.filter(o=>Number(o.id)===Number(hfhsLocationOrg.id));
    let organizationField = "";`);
      part=once(part,'  if (marketplaceRequest) {',`  if (marketplaceRequest && hfhsLocationDemo && Number(marketplaceRequest.organization_id)!==Number(hfhsLocationOrg.id))return res.status(403).send("This request is outside the HFHS demo.");
  if (marketplaceRequest) {`);
    }else{
      part=once(part,'    const marketplaceRequestId =',`    if(hfhsLocationDemo && organizationId!==Number(hfhsLocationOrg.id))return res.status(403).send("Choose the HFHS demo organization.");
    const marketplaceRequestId =`);
    }
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}

function installSalesOpportunityCards(source){
  const marker='// SALES_OPPORTUNITY_CARD_FILTERS_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get(\n  "/org-advertiser/:advertiserKey/opportunities",');
  const end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Sales opportunity route missing');
  let part=source.slice(start,end);
  part=once(part,'      const opportunityRows =',`      const selectedOutcome = ["Open","Won","Lost"].includes(req.query.outcome) ? req.query.outcome : "All";
      const visibleOpportunities = opportunities.filter(o=>selectedOutcome==="All" || String(o.outcome||"Open")===selectedOutcome);
      const outcomeHref = outcome => "/org-advertiser/"+encodeURIComponent(advertiserKey)+"/opportunities?"+new URLSearchParams({organization_id:String(organizationId),...(outcome==="All"?{}:{outcome})}).toString()+"#sales-pipeline";
      const opportunityRows =`);
  part=once(part,'        opportunities.length\n          ? opportunities','        visibleOpportunities.length\n          ? visibleOpportunities');
  const from=part.indexOf('                <div class="card" style="margin:0;">'),to=part.indexOf('              <div class="card">',from);
  let cards=part.slice(from,to);
  for(const outcome of ['Open','Open','Won','Lost'])cards=cards.replace('<div class="card" style="margin:0;">','<a class="card" href="${escapeHtml(outcomeHref("'+outcome+'"))}" style="display:block;color:inherit;text-decoration:none;margin:0;">').replace('\n                </div>','\n                </a>');
  part=part.slice(0,from)+cards+part.slice(to);
  part=once(part,'              <div class="card">','              <div class="card" id="sales-pipeline">');
  part=once(part,'                      Complete Pipeline','                      ${selectedOutcome === "All" ? "Complete Pipeline" : selectedOutcome + " Opportunities"}');
  part=once(part,'                ${opportunityRows}',`                <nav aria-label="Sales opportunity status" style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">
                  \${["All","Open","Won","Lost"].map(outcome=>'<a class="btn '+(selectedOutcome===outcome?'':'secondary')+'" href="'+escapeHtml(outcomeHref(outcome))+'">'+outcome+'</a>').join("")}
                </nav>
                \${opportunityRows}`);
  part=part.replace('${opportunities.length}','${visibleOpportunities.length}').replace('opportunities.length === 1','visibleOpportunities.length === 1');
  part=once(part,'No sales opportunities yet','${selectedOutcome === "All" ? "No sales opportunities yet" : "No " + selectedOutcome.toLowerCase() + " opportunities"}');
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}

function installRequestLocationFilters(source){
  const marker='// REQUEST_LOCATION_CARD_FILTERS_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get(\n  "/org-advertising-requests",'),end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Advertising request route missing');
  let part=source.slice(start,end);
  part=once(part,'const requestLocationSummaries =','let requestLocationSummaries =');
  part=once(part,'      const requestLocationCards =',`      if(selectedStatus!=="All" || cleanSearch || selectedLocationId){
        const matchingLocations=new Set(filteredRequests.map(r=>Number(r.location_id)));
        requestLocationSummaries=requestLocationSummaries.filter(l=>matchingLocations.has(Number(l.location_id)));
      }
      const requestLocationCards =`);
  part=once(part,'            \`&location_id=\${locationId}\`;','            `&location_id=${locationId}` +\n            (selectedStatus!=="All" ? "&status="+encodeURIComponent(selectedStatus) : "") +\n            (cleanSearch ? "&search="+encodeURIComponent(cleanSearch) : "");');
  part=once(part,'href="${locationUrl}"','href="${escapeHtml(locationUrl)}"');
  part=once(part,'No active locations were found.','${selectedStatus!=="All" || cleanSearch ? "No locations have requests matching the selected filters." : "No active locations were found."}');
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}


function installExecutiveConsistency(source){
  const marker='// EXECUTIVE_REPORT_SCOPE_V1';
  if(source.includes(marker))return source;
  const a=source.indexOf('  WITH filtered_locations AS ('),b=source.indexOf('  qr_campaign_metrics AS (',a);
  if(a<0||b<0)throw Error('Overview scope missing');
  const prefix=source.slice(a,b).replace("WITH filtered_locations AS (","WITH\n filtered_locations AS (");
  const metrics=`event_metrics AS (
    SELECT fq.id,
      COUNT(e.id) FILTER(WHERE e.type='scan')::int AS scans,
      COUNT(e.id) FILTER(WHERE e.type IN ('offer','maps','waze','destination_click'))::int AS intent,
      COUNT(e.id) FILTER(WHERE e.type='conversion')::int AS conversions,
      COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion'),0)::numeric AS advertiser_revenue
    FROM filtered_qrs fq LEFT JOIN events e ON e.qr_id=fq.id
      AND (NULLIF($2,'') IS NULL OR e.created_at::date>=NULLIF($2,'')::date)
      AND (NULLIF($3,'') IS NULL OR e.created_at::date<=NULLIF($3,'')::date)
    GROUP BY fq.id
  )`;
  const start=source.indexOf('async function buildOrganizationExportData('),end=source.indexOf('\napp.',start);
  if(start<0||end<0)throw Error('Executive builder missing');
  let part=source.slice(start,end);
  function replaceQuery(name,sql){
    const re=new RegExp('(const '+name+' = await q\\(\\s*`)[\\s\\S]*?(`,\\s*\\[\\s*orgId,\\s*fromDate \\|\\| "",\\s*toDate \\|\\| "",\\s*allowedLocationIds)(\\s*\\])');
    if(!re.test(part))throw Error('Executive query missing '+name);
    part=part.replace(re,(_,head,tail,close)=>head+'\n'+sql+'\n'+tail+', selectedLocationId'+close);
  }
  replaceQuery('locationsResult',prefix+metrics+`
    SELECT s.id,s.name,s.location,
      COUNT(fq.id)::int AS placements,
      (SELECT COUNT(DISTINCT qc.campaign_id)::int FROM filtered_qrs f JOIN qr_campaigns qc ON qc.qr_id=f.id WHERE f.space_id=s.id) AS campaigns,
      (SELECT COUNT(DISTINCT LOWER(TRIM(c.advertiser)))::int FROM filtered_qrs f JOIN qr_campaigns qc ON qc.qr_id=f.id JOIN campaigns c ON c.id=qc.campaign_id WHERE f.space_id=s.id AND NULLIF(TRIM(c.advertiser),'') IS NOT NULL) AS advertisers,
      COALESCE(SUM(m.scans),0)::int AS scans,COALESCE(SUM(m.intent),0)::int AS intent,
      COALESCE(SUM(m.conversions),0)::int AS conversions,COALESCE(SUM(m.advertiser_revenue),0)::numeric AS advertiser_revenue
    FROM filtered_locations s LEFT JOIN filtered_qrs fq ON fq.space_id=s.id
    LEFT JOIN event_metrics m ON m.id=fq.id GROUP BY s.id,s.name,s.location ORDER BY s.name`);
  replaceQuery('placementsResult',prefix+metrics+`
    SELECT qr.id,qr.name,s.id AS location_id,s.name AS location_name,s.location AS market,
      fq.placement_value,m.scans,m.intent,m.conversions,m.advertiser_revenue,
      (SELECT COUNT(DISTINCT qc.campaign_id)::int FROM qr_campaigns qc WHERE qc.qr_id=qr.id) AS campaigns,
      (SELECT STRING_AGG(DISTINCT c.advertiser,', ') FROM qr_campaigns qc JOIN campaigns c ON c.id=qc.campaign_id WHERE qc.qr_id=qr.id AND NULLIF(TRIM(c.advertiser),'') IS NOT NULL) AS advertisers
    FROM filtered_qrs fq JOIN qr_codes qr ON qr.id=fq.id
    JOIN filtered_locations s ON s.id=fq.space_id JOIN event_metrics m ON m.id=fq.id ORDER BY s.name,qr.name`);
  for(const name of ['campaignsResult','customerActionsResult']){
    const re=new RegExp('const '+name+' = await q\\(\\s*`([\\s\\S]*?)`,\\s*\\[\\s*orgId,\\s*fromDate \\|\\| "",\\s*toDate \\|\\| "",\\s*allowedLocationIds\\s*\\]');
    const match=part.match(re);if(!match)throw Error('Executive campaign query missing');
    let sql=match[1];
    if(name==='campaignsResult')sql=sql.replace('WITH unique_assignments AS (',prefix+'unique_assignments AS (');
    else sql=prefix+'unique_assignments AS (SELECT DISTINCT qr_id,campaign_id FROM qr_campaigns) '+sql.replace('JOIN qr_campaigns qc','JOIN unique_assignments qc');
    sql=sql.replace(/JOIN qr_codes qr\s+ON qr.id = qc.qr_id\s+AND COALESCE\(\s*qr.is_archived,\s*false\s*\) = false/,'JOIN filtered_qrs export_fq ON export_fq.id = qc.qr_id JOIN qr_codes qr ON qr.id=export_fq.id');
    part=part.replace(match[0],'const '+name+' = await q(`'+sql+'`,[orgId,fromDate || "",toDate || "",allowedLocationIds,selectedLocationId]');
  }
  // QR events are authoritative even when an old assignment has been removed.
  for(const name of ['advertiserRevenue','scans','intent','conversions']){
    const re=new RegExp('(const '+name+' =\\s*)campaigns(\\.reduce\\()');
    if(!re.test(part))throw Error('Executive total missing '+name);
    part=part.replace(re,'$1placements$2');
  }
  source=source.slice(0,start)+part+source.slice(end);
  source=once(source,`                            The contract cannot be activated
                            until a Signed Agreement is stored.`,`                            \${contractIsActive
                              ? "This contract is active, but no signed agreement is stored. Upload it to complete the contract record."
                              : "The contract cannot be activated until a Signed Agreement is stored."}`);
  return source+'\n'+marker+'\n';
}


// Apply the same placement overlap rule used by enterprise reporting.
// Keep unassigned digital events; they have no physical placement dates.
function periodQuery(q,startDate,endDate,scope){
  return (sql,values=[])=>{
    if(!/\b(?:FROM|JOIN) (?:qr_codes|events)\b/.test(sql))return q(sql,values);
    const n=values.length,from='$'+(n+1),to='$'+(n+2),ids='$'+(n+3);
    const eligible=`SELECT pq.* FROM qr_codes pq JOIN spaces ps ON ps.id=pq.space_id
      WHERE COALESCE(ps.is_archived,false)=false
      AND (${ids}::int[] IS NULL OR pq.id=ANY(${ids}::int[]))
      AND (NULLIF(${from},'') IS NULL OR ps.end_date IS NULL OR ps.end_date>=NULLIF(${from},'')::date)
      AND (NULLIF(${to},'') IS NULL OR COALESCE(ps.live_date,ps.created_at::date)<=NULLIF(${to},'')::date)
      AND (NULLIF(${from},'') IS NULL OR pq.end_date IS NULL OR pq.end_date>=NULLIF(${from},'')::date)
      AND (NULLIF(${to},'') IS NULL OR COALESCE(pq.live_date,pq.created_at::date)<=NULLIF(${to},'')::date)`;
    const scopedEvents=`(SELECT pe.* FROM events pe WHERE (pe.qr_id IS NULL AND ${ids}::int[] IS NULL) OR pe.qr_id IN (SELECT eligible.id FROM (${eligible}) eligible))`;
    sql=sql.replace(/\b(FROM|JOIN) (qr_codes|events)\b/g,(_,join,table)=>join+' '+(table==='qr_codes'?'('+eligible+')':scopedEvents));
    return q(sql,[...values,startDate||'',endDate||'',scope?.qrIds??null]);
  };
}
module.exports.periodQuery=periodQuery;
function installAdvertiserPeriod(source){
  const marker='// ADVERTISER_PLACEMENT_PERIOD_V1';if(source.includes(marker))return source;
  source=once(source,'<h3>Getting Started</h3>\n<h3>Getting Started</h3>','<h3>Getting Started</h3>');
  let a=source.indexOf('async function getPerformanceMetrics({'),b=source.indexOf('async function activeCampaignForQr',a);
  let part=source.slice(a,b);
  part=once(part,'  campaignId = null,','  query = q,\n  campaignId = null,');
  part=once(part,'const result = await q(','const result = await query(');
  source=source.slice(0,a)+part+source.slice(b);
  a=source.indexOf('async function allocatedSpotCostForCampaign(');b=source.indexOf('async function allocatedSpotCostForQr(',a);part=source.slice(a,b);
  part=once(part,'campaignId, startDate, endDate)','campaignId, startDate, endDate, query = q)');
  part=once(part,'const result = await q(','const result = await query(');source=source.slice(0,a)+part+source.slice(b);
  a=source.indexOf('async function buildExportReportRows(');b=source.indexOf('\napp.',a);part=source.slice(a,b);
  part=once(part,'  const currentUser = req.session.user;',`  const currentUser = req.session.user;
  const reportPeriodScope = await require("./hfhs-demo-setup-scope").reportScope(q,currentUser);
  const periodQ = require("./install-hfhs-report-scope").periodQuery(q,startDate,endDate,reportPeriodScope);`);
  part=part.replace(/await q\(/g,'await periodQ(');
  part=once(part,'await getPerformanceMetrics({','await getPerformanceMetrics({\n        query: periodQ,');
  part=once(part,'        campaignRow.campaign_id,\n        startDate,\n        endDate\n      );','        campaignRow.campaign_id,\n        startDate,\n        endDate,\n        periodQ\n      );');
  source=source.slice(0,a)+part+source.slice(b);
  return source+'\n'+marker+'\n';
}

function installAdvertiserPdfPolish(source){
  const marker='// ADVERTISER_PDF_POLISH_V1';
  if(source.includes(marker))return source;
  const a=source.indexOf('app.get(\n  "/export/report.pdf",'),b=source.indexOf('\napp.',a+1);
  if(a<0||b<0)throw Error('Advertiser PDF route missing');
  let part=source.slice(a,b);
  part=once(part,'      doc.pipe(res);',`      doc.pipe(res);
      // Keep demo fonts unchanged; regular advertiser reports use PDF standard fonts.
      if (!req.hfhsReviewVerified && !req.rubberWorldReviewVerified && !req.ccpsReviewVerified) doc.font("Helvetica");
      else
      doc.font(require("./install-hfhs-report-scope").reportFont());`);
  part=once(part,'            totals.visitors +=','            totals.scans = (totals.scans || 0) + Number(row.scans || 0);\n            totals.visitors +=');
  part=once(part,'        "Executive Summary",\n        [','        "Executive Summary",\n        [\n          ["Scans", Number(summary.scans || 0).toLocaleString()],');
  part=once(part,'              "Campaign Performance",\n              [','              "Campaign Performance",\n              [\n                ["Scans", Number(campaign.scans || 0).toLocaleString()],');
  part=part.replaceAll('"Not assigned"','"No placements match the selected dates and filters."');
  part=once(part,'        ensureSpace(44);','        ensureSpace(75);\n        doc.x = doc.page.margins.left;');
  part=once(part,'          .text(title);','          .text(title, doc.page.margins.left, doc.y, {width: doc.page.width-doc.page.margins.left-doc.page.margins.right, align:"left", characterSpacing:0});');
  part=once(part,'        sectionTitle(title);',`        doc.fontSize(fontSize);
        const estimatedHeight = 58 + rows.reduce((height,[label,value])=>height+Math.max(rowHeight,
          doc.heightOfString(String(label),{width:labelWidth-18})+14,
          doc.heightOfString(String(value ?? "—"),{width:valueWidth-18})+14),0);
        if(estimatedHeight <= pageBottom()-doc.page.margins.top)ensureSpace(estimatedHeight);
        sectionTitle(title);`);
  part=once(part,'        doc.y =\n          tableY + 12;','        doc.x = doc.page.margins.left;\n        doc.y =\n          tableY + 12;');
  part=once(part,'      doc.moveDown(1.5);',`      doc.moveDown(0.8);
      if(require("./hfhs-demo-setup-scope").isHfhsDemo(req.session.user)){
        doc.fillColor("#123d25").fontSize(10).text("HFHS DEMONSTRATION DATA",{align:"center"});
        doc.fillColor("#6b7280").fontSize(9).text("Illustrative sample results - not actual Henry Ford Health outcomes.",{align:"center"});
        doc.moveDown(0.7);
      }`);
  return source.slice(0,a)+part+source.slice(b)+'\n'+marker+'\n';
}

/* Embedded DejaVu Sans Latin subset for portable PDF typography.
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: DejaVu fonts
Upstream-Author: Stepan Roh <src@users.sourceforge.net> (original author),
                  see /usr/share/doc/fonts-dejavu-core/AUTHORS for full list
Source: https://dejavu-fonts.github.io/

Files: *
Copyright: Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. 
 Bitstream Vera is a trademark of Bitstream, Inc.
 DejaVu changes are in public domain.
License: bitstream-vera
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of the fonts accompanying this license ("Fonts") and associated
 documentation files (the "Font Software"), to reproduce and distribute the
 Font Software, including without limitation the rights to use, copy, merge,
 publish, distribute, and/or sell copies of the Font Software, and to permit
 persons to whom the Font Software is furnished to do so, subject to the
 following conditions:
 .
 The above copyright and trademark notices and this permission notice shall
 be included in all copies of one or more of the Font Software typefaces.
 .
 The Font Software may be modified, altered, or added to, and in particular
 the designs of glyphs or characters in the Fonts may be modified and
 additional glyphs or characters may be added to the Fonts, only if the fonts
 are renamed to names not containing either the words "Bitstream" or the word
 "Vera".
 .
 This License becomes null and void to the extent applicable to Fonts or Font
 Software that has been modified and is distributed under the "Bitstream
 Vera" names.
 .
 The Font Software may be sold as part of a larger software package but no
 copy of one or more of the Font Software typefaces may be sold by itself.
 .
 THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
 TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL BITSTREAM OR THE GNOME
 FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING
 ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
 THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE
 FONT SOFTWARE.
 .
 Except as contained in this notice, the names of Gnome, the Gnome
 Foundation, and Bitstream Inc., shall not be used in advertising or
 otherwise to promote the sale, use or other dealings in this Font Software
 without prior written authorization from the Gnome Foundation or Bitstream
 Inc., respectively. For further information, contact: fonts at gnome dot
 org.

*/
module.exports.reportFont=()=>require('path').join(__dirname,'assets/fonts/DejaVuSans-full.ttf');

function installRetiredDemoExclusion(source){
  const marker='// HFHS_RETIRED_DEMO_REPORT_EXCLUSION_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('  WITH filtered_locations AS ('),end=source.indexOf('  qr_campaign_metrics AS (',start);
  if(start<0||end<0)throw Error('HFHS retired demo scope anchor missing');
  let part=source.slice(start,end);
  const anchor='    WHERE\n      (';
  part=once(part,anchor,`    WHERE NOT EXISTS (
      SELECT 1 FROM organization_advertising_requests retired
      JOIN organizations demo_org ON demo_org.id=retired.organization_id
      WHERE demo_org.slug='henry-ford-health-demo'
        AND retired.created_qr_id=qr.id AND retired.setup_status='Demo Archived'
    ) AND
      (`);
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}


function installHfhsExecutiveSummary(source){
 const marker='// HFHS_EXECUTIVE_SUMMARY_V2';if(source.includes(marker))return source;
 let a=source.indexOf('async function buildOrganizationExportData('),b=source.indexOf('\napp.',a);
 let part=source.slice(a,b);
 part=once(part,'  return {\n    organization,','  const exportData = {\n    organization,');
 const tail=part.lastIndexOf('  };');if(tail<0)throw Error('Executive return missing');
 part=part.slice(0,tail)+part.slice(tail).replace('  };','  };\n  return await require("./install-hfhs-report-scope").alignHfhsExecutive({q,req,scope,data:exportData});');
 source=source.slice(0,a)+part+source.slice(b);
 for(const format of ['pdf','xlsx']){
  a=source.indexOf('  "/org-export/report.'+format+'",');b=source.indexOf('\napp.',a);
  part=source.slice(a,b);
  if(format==='pdf'){
   const heading=part.indexOf('"Executive Summary"');
   const from=part.indexOf('drawMetricTable([',heading),to=part.indexOf('\n      ]);',from);
   if(from<0||to<0)throw Error('PDF summary rows missing');
   const rows=part.slice(from+'drawMetricTable('.length,to+'\n      ]'.length);
   part=part.slice(0,from)+'drawMetricTable(req.hfhsReviewVerified ? require("./install-hfhs-report-scope").hfhsExecutiveRows(data).map(([label,value,format])=>({label,value:format==="money"?moneyValue(value):format==="percent"?percentValue(value):numberValue(value)})) : '+rows+part.slice(to+'\n      ]'.length);
   part=part.replace('"This report combines organization advertising revenue, available inventory, advertiser performance, conversions, and attributed advertiser revenue from Vivid."',`(req.hfhsReviewVerified ? "Illustrative HFHS demo data. Active placement value is current inventory value, not payments collected. Approved sponsor value is approved request pricing. Sponsor attributed revenue is separate from HFHS revenue. Combined Value adds approved sponsor value and sponsor attributed revenue; it is not HFHS income. Performance follows the selected dates; active inventory and contracts are current snapshots." : "This report combines organization advertising revenue, available inventory, advertiser performance, conversions, and attributed advertiser revenue from Vivid.")`);
  }else{
   const from=part.indexOf('executive.addRows(['),to=part.indexOf('\n]);',from);
   if(from<0||to<0)throw Error('Excel summary missing');
   const rows=part.slice(from+'executive.addRows('.length,to+2);
   part=part.slice(0,from)+'executive.addRows(req.hfhsReviewVerified ? require("./install-hfhs-report-scope").hfhsExecutiveRows(data).map(([label,value,format])=>[label,format==="percent"?value/100:value]) : '+rows+part.slice(to+2);
   const anchor='const locationsSheet =';
   part=once(part,anchor,`if(req.hfhsReviewVerified){
    executive.getColumn("A").width=42;
    const rows=require("./install-hfhs-report-scope").hfhsExecutiveRows(data);
    rows.forEach(([label,value,format],i)=>{const row=executive.getRow(i+2);row.height=23;row.getCell(2).numFmt=format==="money"?'$#,##0.00':format==="percent"?'0.0%':'#,##0';});
    const notes=workbook.addWorksheet("Metric Definitions");notes.columns=[{header:"Metric",width:34},{header:"Definition",width:110}];
    notes.addRows([["Reporting period",String(data.reportingPeriod.fromDate||"All")+" through "+String(data.reportingPeriod.toDate||"All")],["Demo data","Illustrative sample results, not actual HFHS outcomes."],["Active Placement Value","Current active placement values; not payments collected or contract revenue."],["Active Contracts","Current active contract count, independent of performance dates."],["Approved Sponsor Value","Approved sponsorship request prices in the selected period; not collected payments."],["Sponsor Attributed Revenue","Sponsor conversion values attributed through Vivid in the selected period."],["Combined Value","Approved sponsor value plus sponsor attributed revenue. Not HFHS income."],["Period Placement Value","Value of placements whose dates overlap the reporting period; can differ from current active placement value."]]);notes.getColumn(2).alignment={wrapText:true};
   }
`+anchor);
  }
  part=part.replaceAll('"Internal Revenue"','(req.hfhsReviewVerified ? "Approved Sponsor Value" : "Internal Revenue")').replaceAll('"Economic Impact"','(req.hfhsReviewVerified ? "Combined Value" : "Economic Impact")');
  source=source.slice(0,a)+part+source.slice(b);
 }
 // Correct the Overview label without changing other customers' pages.
 source=once(source,'            Active Revenue\n          </div>','            ${req.hfhsReviewVerified ? "Active Placement Value" : "Active Revenue"}\n          </div>');
 return source+'\n'+marker+'\n';
}
async function alignHfhsExecutive({q,req,scope,data}){
 if(!req.hfhsReviewVerified)return data;
 const active=require('./org-active-advertising').summarize((await require('./org-active-advertising').load(q,scope)).rows);
 const contracts=(await q(`SELECT COUNT(*) FILTER(WHERE LOWER(COALESCE(status,'active'))='active')::int AS count FROM contracts WHERE organization_id=$1 AND location_id=ANY($2::int[]) AND ($3::int IS NULL OR location_id=$3)`,[scope.organizationId,scope.allowedLocationIds,scope.selectedLocationId])).rows[0];
 const eligible=(await q(HFHS_OVERVIEW_ADVERTISER_SQL,[scope.organizationId,scope.fromDate||'',scope.toDate||'',scope.allowedLocationIds,scope.selectedLocationId])).rows;
 const ids=new Set(eligible.map(r=>Number(r.campaign_id))),keys=new Set(eligible.map(r=>r.advertiser_key));
 data.campaigns=data.campaigns.filter(r=>ids.has(Number(r.campaignId)));
 data.advertisers=data.advertisers.filter(r=>keys.has(String(r.advertiser||'').trim().toLowerCase()));
 data.customerActions=data.customerActions.filter(r=>ids.has(Number(r.campaignId)));
 Object.assign(data.summary,{activePlacementValue:active.value,activePlacements:active.placements,activeContracts:Number(contracts.count||0),advertisers:keys.size,campaigns:data.campaigns.length,customerActions:data.customerActions.length});
 return data;
}
function hfhsExecutiveRows(data){const s=data.summary;return [
 ['Active Placement Value',s.activePlacementValue,'money'],['Active Placements',s.activePlacements,'number'],['Active Contracts',s.activeContracts,'number'],
 ['Available Inventory Value',s.availableRevenue,'money'],['Pending Sponsor Value',s.pendingRevenue,'money'],['Sponsor Attributed Revenue',s.advertiserRevenue,'money'],
 ['Locations',s.locations,'number'],['Advertisers',s.advertisers,'number'],['Scans',s.scans,'number'],['Intent / Click Actions',s.intent,'number'],['Conversions',s.conversions,'number'],
 ['Campaigns',s.campaigns,'number'],['QR Placements in Period',s.placements,'number'],['Approved Sponsor Value',s.approvedRevenue,'money'],['Period Placement Value',s.placementValue,'money'],
 ['Visitors',s.visitors,'number'],['Clicks',s.clicks,'number'],['Conversion Rate',s.conversionRate,'percent']
 ];}
module.exports.alignHfhsExecutive=alignHfhsExecutive;
module.exports.hfhsExecutiveRows=hfhsExecutiveRows;

const HFHS_OVERVIEW_ADVERTISER_SQL="\n  SELECT\n    DISTINCT c.id AS campaign_id, LOWER(TRIM(c.advertiser)) AS advertiser_key\n\n  FROM spaces s\n\n  JOIN qr_codes qr\n    ON qr.space_id = s.id\n   AND COALESCE(qr.is_archived, false) = false\n\n  JOIN qr_campaigns qc\n    ON qc.qr_id = qr.id\n\n  JOIN campaigns c\n    ON c.id = qc.campaign_id\n\n WHERE s.organization_id = $1\n  AND COALESCE(s.is_archived, false) = false\n  AND s.id = ANY($4::int[])\n  AND (\n    $5::int IS NULL\n    OR s.id = $5\n  )\n  AND NULLIF(TRIM(c.advertiser), '') IS NOT NULL\n\n    /*\n      Location overlaps the selected range.\n    */\n    AND (\n      NULLIF($2, '') IS NULL\n      OR s.end_date IS NULL\n      OR s.end_date >= NULLIF($2, '')::date\n    )\n\n    AND (\n      NULLIF($3, '') IS NULL\n      OR COALESCE(\n           s.live_date,\n           s.created_at::date\n         ) <= NULLIF($3, '')::date\n    )\n\n    /*\n      QR placement overlaps the selected range.\n    */\n    AND (\n      NULLIF($2, '') IS NULL\n      OR qr.end_date IS NULL\n      OR qr.end_date >= NULLIF($2, '')::date\n    )\n\n    AND (\n      NULLIF($3, '') IS NULL\n      OR COALESCE(\n           qr.live_date,\n           qr.created_at::date\n         ) <= NULLIF($3, '')::date\n    )\n\n    /*\n      Campaign assignment overlaps the selected range.\n    */\n    AND (\n      NULLIF($2, '') IS NULL\n      OR COALESCE(\n           qc.ended_at::date,\n           c.end_date,\n           NULLIF($3, '')::date\n         ) >= NULLIF($2, '')::date\n    )\n\n    AND (\n      NULLIF($3, '') IS NULL\n      OR COALESCE(\n           qc.started_at::date,\n           qc.assigned_at::date,\n           c.start_date,\n           c.live_date,\n           c.created_at::date\n         ) <= NULLIF($3, '')::date\n    )\n\n    /*\n      With no dates selected, preserve the current active-only view.\n    */\n    AND (\n      (\n        NULLIF($2, '') IS NULL\n        AND NULLIF($3, '') IS NULL\n        AND COALESCE(qr.is_active, true) = true\n        AND COALESCE(qc.is_active, true) = true\n        AND COALESCE(c.is_archived, false) = false\n      )\n\n      OR\n\n      (\n        NULLIF($2, '') IS NOT NULL\n        OR NULLIF($3, '') IS NOT NULL\n      )\n    )\n"
;
