"use strict";
function install(source){
  const marker='// BASIC_REPORT_METRIC_DASHES_V1';
  if(source.includes(marker))return source;
  for(const [path,key,id,table,scan] of [
    ['/reports','campaign_id','r.campaignId','reportTable',3],
    ['/reports-campaign','campaign_id','r.campaign_id','table',5],
    ['/reports-qr','qr_id','qr.qr_id','reportTable',2],
    ['/reports-location','location_id','loc.id','table',2]
  ]){
    const start=source.indexOf(`app.get("${path}", requireLogin, async (req, res) => {`);
    const end=source.indexOf('\napp.',start+1);
    if(start<0||end<0)throw Error('Basic metric report route missing: '+path);
    let part=source.slice(start,end);
    if(!part.includes('const performanceUpgrade ='))throw Error('Report upgrade state missing: '+path);
    const anchor=table+' += `';
    const from=part.indexOf(anchor),to=part.indexOf('`;',from+anchor.length);
    if(from<0||to<0)throw Error('Report row template missing: '+path);
    part=part.slice(0,from)+table+' += require("./report-performance-upgrade").maskRow(performanceUpgrade,"'+key+'",'+id+','+scan+',`'+part.slice(from+anchor.length,to)+'`);'+part.slice(to+2);
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}
module.exports={install};
