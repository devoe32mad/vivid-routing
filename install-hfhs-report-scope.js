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
function install(source){
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
