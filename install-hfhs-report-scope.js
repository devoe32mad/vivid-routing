"use strict";
function once(source,from,to){if(source.split(from).length!==2)throw Error('HFHS report scope anchor missing/ambiguous: '+from);return source.replace(from,to);}
function install(source){
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
module.exports={install};
