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
  if(!raw&&!state.rows.length)return next();
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
