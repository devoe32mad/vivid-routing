'use strict';
const metric=/^(?:visitors?(?: converted)?|clicks?|conversions?|conversion value|conversion rate|visitor conversion rate|revenue(?: generated| per .+)?|allocated cost|cac|roi(?: %)?|offer clicks|map clicks|waze clicks|offers|maps|waze|intent|total intent|page visits|last activity)$/i;
const metricKey=/^(?:visitors|clicks|conversions|visitorsConverted|visitorConversionRate|conversionRate|conversionValue|revenue.*|allocatedCost|cac|roi|offerClicks|mapClicks|wazeClicks|intent|pageVisits|lastActivity)$/;
function restricted(state,id){return require('./report-performance-upgrade').restricted(state,'campaign_id',id);}
function maskWorkbook(book,state,rows){
 if(state.readOnlyDemo){const s=book.getWorksheet('Executive Summary');if(s){s.getCell('A2').value=String(s.getCell('A2').value||'')+' · CCPS illustrative demo · Basic metrics shown as dashes';s.getRow(2).height=32;s.getCell('A2').alignment={wrapText:true};}}
 const restrictedRows=rows.filter(r=>restricted(state,r.campaignId));if(!restrictedRows.length)return;
 for(const sheet of book.worksheets){
  const keys=new Map(sheet.columns.map((c,i)=>[c.key,i+1]));
  const detail=sheet.__vividCampaignId!=null;
  const defaultRestricted=detail?restricted(state,sheet.__vividCampaignId):true;
  let actionHeader=0;
  sheet.eachRow((row,n)=>{
   if(detail&&row.getCell(1).value==='Customer Action'&&row.getCell(4).value==='Visitors'){actionHeader=n;return;}
   const value=k=>keys.has(k)?String(row.getCell(keys.get(k)).value??''):'';
   let blocked=defaultRestricted;
   if(keys.has('campaign'))blocked=restrictedRows.some(r=>r.campaignName===value('campaign'));
   else if(keys.has('location'))blocked=restrictedRows.some(r=>String(r.locationNames||'').split(', ').includes(value('location')));
   else if(keys.has('qrName')||keys.has('qr'))blocked=restrictedRows.some(r=>String(r.qrNames||'').split(', ').includes(value('qrName')||value('qr')));
   if(!blocked||n<=4)return;
   if(keys.has('metric')||keys.has('field')){
    if(metric.test(String(row.getCell(1).value??'')))row.getCell(2).value='—';
    if(detail&&actionHeader&&n>actionHeader)for(const i of [4,5,6])if(row.getCell(i).value!=null)row.getCell(i).value='—';
   }else for(const [key,i] of keys)if(metricKey.test(key))row.getCell(i).value='—';
  });
 }
}
function install(source){
 const marker='// CCPS_NATIVE_EXPERIENCE_V1';if(source.includes(marker))return source;
 const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Native experience anchor missing: '+a.slice(0,80));return s.replace(a,b);};
 for(const path of ['/admin/reports','/admin/new-qr']){
  const start=source.indexOf(`app.get("${path}", requireLogin, async (req, res) => {`),end=source.indexOf('\napp.',start+1);if(start<0||end<0)throw Error('Native route missing '+path);
  let part=source.slice(start,end);
  if(path==='/admin/reports')part=replace(part,'    const reportRows = await buildExportReportRows(',`    if(req.ccpsReviewVerified){
      locations.rows=(await q('SELECT id,name FROM spaces WHERE id=ANY($1::int[]) ORDER BY name',[hfhsExportScope.locationIds])).rows;
      qrs.rows=(await q('SELECT id,name FROM qr_codes WHERE id=ANY($1::int[]) ORDER BY name',[hfhsExportScope.qrIds])).rows;
    }
    const reportRows = await buildExportReportRows(`);
  else part=replace(part,'    const locationOptions =',`    if(req.ccpsReviewVerified)spaces.rows=(await q('SELECT id,name,location FROM spaces WHERE organization_id=13 AND COALESCE(is_archived,false)=false ORDER BY name')).rows;
    const locationOptions =`);
  source=source.slice(0,start)+part+source.slice(end);
 }
 for(const ext of ['pdf','xlsx']){
  const start=source.indexOf(`app.get(\n  "/export/report.${ext}",`),end=source.indexOf('\napp.',start+1);if(start<0||end<0)throw Error('Native export missing '+ext);
  let part=source.slice(start,end);
  part=replace(part,'      const reportRows =',`      const nativeExportAccess=req.ccpsReviewVerified?await require('./report-performance-upgrade').load({q,req}):{rows:[]};
      const nativeRestricted=id=>require('./ccps-native-experience').restricted(nativeExportAccess,id);
      const reportRows =`);
  if(ext==='pdf'){
   part=replace(part,'doc.font(require("./install-hfhs-report-scope").reportFont());','doc.font(req.ccpsReviewVerified?"Helvetica":require("./install-hfhs-report-scope").reportFont());');
   part=replace(part,'      drawKeyValueTable(\n        "Executive Summary",',`      if(req.ccpsReviewVerified){doc.fontSize(9).fillColor("#6b7280").text("CCPS illustrative demo. Basic includes scans; restricted metrics are shown as dashes.");doc.moveDown(0.8);}
      drawKeyValueTable(
        "Executive Summary",`);
   part=replace(part,'      const drawKeyValueTable = (',`      let maskPdfMetrics=reportRows.some(r=>nativeRestricted(r.campaignId));
      const drawKeyValueTable = (`);
   part=replace(part,'        sectionTitle(title);',`        if(maskPdfMetrics)rows=rows.map(([label,value])=>[label,require('./ccps-native-experience').metric.test(label)?'—':value]);
        sectionTitle(title);`);
   for(const key of ['visitors','clicks','conversions']){
    const pattern=new RegExp('Number\\(\\s*row\\.'+key+'\\s*\\|\\|\\s*0\\s*\\)\\.toLocaleString\\(\\)','g');
    part=part.replace(pattern,m=>`(nativeRestricted(row.campaignId)?'—':${m})`);
   }
   part=part.replace(/money\(\s*row\.revenueGenerated\s*\|\|\s*0\s*\)/g,m=>`(nativeRestricted(row.campaignId)?'—':${m})`);
   part=replace(part,'            doc.addPage();\n\n            doc',`            maskPdfMetrics=nativeRestricted(campaign.campaignId);
            doc.addPage();

            doc`);
  }else{
   part=replace(part,'          sheet.columns = [','          sheet.__vividCampaignId=campaign.campaignId;\n          sheet.columns = [');
   part=replace(part,'      await workbook.xlsx.write(',"      require('./ccps-native-experience').maskWorkbook(workbook,nativeExportAccess,reportRows);\n      await workbook.xlsx.write(");
  }
  source=source.slice(0,start)+part+source.slice(end);
 }
 return source+'\n'+marker+'\n';
}
module.exports={install,maskWorkbook,restricted,metric};
