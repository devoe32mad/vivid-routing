"use strict";
function once(source,anchor,replacement){
  if(source.split(anchor).length!==2)throw Error("Page reporting installer: missing or ambiguous anchor "+anchor.slice(0,75));
  return source.replace(anchor,replacement);
}
function route(source,anchor,edit){
  const from=source.indexOf(anchor),to=source.indexOf("\napp.",from+anchor.length);
  if(from<0||to<0)throw Error("Page reporting installer: route missing "+anchor);
  return source.slice(0,from)+edit(source.slice(from,to))+source.slice(to);
}
function install(source){
  const marker="// WEBSITE_PAGE_REPORTS_AND_EXPORTS";
  if(source.includes(marker))return source;
  const registration='require("./website-page-tracking").registerWebsitePageTracking({app,q,page,requireLogin,express});';
  source=once(source,registration,registration+'\n'+marker+'\nrequire("./website-page-reporting").register({app,q,requireLogin});');
  const load=(query,allTime=false)=>`    const websitePages = await require("./website-page-reporting").load({q,user:req.session.user,query:${query},allTime:${allTime}});\n`;
  const section='${require("./website-page-reporting").renderSection(websitePages)}';
  for(const name of ["/reports","/reports-qr","/reports-campaign","/reports-location","/admin/reports"]){
    source=route(source,`app.get("${name}", requireLogin, async (req, res) => {`,part=>{
      const table=name==="/reports-campaign"||name==="/reports-location"?'    let table = "";':name==="/admin/reports"?'    const summary = reportRows.reduce':'    let reportTable = "";';
      const query=name==="/admin/reports"?'{start_date:startDate,end_date:endDate,campaign_id:campaignId,qr_id:qrId,location_id:locationId,status}':'{start_date:startDate,end_date:endDate}';
      part=once(part,table,load(query,name==="/reports-campaign")+table);
      const key=name==="/reports-qr"?"qr_id":name==="/reports-location"?"location_id":"campaign_id";
      const id=name==="/reports-qr"?"qr.qr_id":name==="/reports-location"?"loc.id":name==="/reports-campaign"?"r.campaign_id":"r.campaignId";
      const scanCell=name==="/reports"?'<td style="text-align:center;">${r.scans}</td>':name==="/reports-qr"?'<td style="text-align:center;">${scans}</td>':name==="/admin/reports"?'<td>${r.scans}</td>':'<td>${scans}</td>';
      part=once(part,scanCell,scanCell+`\n          <td>\${require("./website-page-reporting").count(websitePages,"${key}",${id})}</td>`);
      part=once(part,'<th>Scans</th>','<th>Scans</th>\n              <th>Page Visits</th>');
      if(name==="/reports")part=once(part,'colspan="13"','colspan="14"');
      if(name==="/reports-qr"||name==="/reports-location")part=part.replace('colspan="12"','colspan="13"');
      if(name==="/admin/reports"){
        const button='<button\n  type="submit"\n  formaction="/export/events.csv"';
        part=once(part,button,'<button type="submit" formaction="/export/website-pages.csv" formmethod="get">Export Page Visits CSV</button>\n\n'+button);
        part=once(part,'    `));',section+'\n    `));');
      }else{
        const end=part.lastIndexOf('</div>');
        if(end<0)throw Error("Page reporting: report wrapper missing");
        part=part.slice(0,end)+section+'\n'+part.slice(end);
      }
      return part;
    });
  }
  source=route(source,'app.get(\n  "/export/report.pdf",',part=>{
    part=once(part,'      const reportRows =',load('{start_date:startDate,end_date:endDate,campaign_id:campaignId,qr_id:qrId,location_id:locationId,status}')+'      const reportRows =');
    part=once(part,'"Executive Summary",\n        [','"Executive Summary",\n        [\n          ["Page Visits", String(websitePages.total || "No records")],');
    part=once(part,'      doc.end();','      require("./website-page-reporting").appendPdf(doc,websitePages);\n      doc.end();');
    return part;
  });
  return source;
}
module.exports={install};
