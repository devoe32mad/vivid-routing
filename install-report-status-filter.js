"use strict";
function replace(source,anchor,value){
  if(source.split(anchor).length!==2)throw Error('Report status filter anchor missing or ambiguous: '+anchor);
  return source.replace(anchor,value);
}
function install(source){
  const marker='// CUSTOMER_REPORT_STATUS_FILTER_V1';
  if(source.includes(marker))return source;
  for(const path of ['/reports','/reports-campaign','/reports-qr','/reports-location']){
    const start=source.indexOf(`app.get("${path}", requireLogin, async (req, res) => {`),end=source.indexOf('\napp.',start+1);
    if(start<0||end<0)throw Error('Report status route missing: '+path);
    let part=source.slice(start,end);
    const scope=path==='/reports-qr'?'qr':path==='/reports-location'?'location':'campaign';
    part=replace(part,'  try {','  try {\n    const reportStatus = ["active","archived","all"].includes(req.query.status) ? req.query.status : "active";');
    if(path==='/reports')part=replace(part,'      "all"\n    );','      reportStatus\n    );');
    if(path==='/reports-campaign')part=replace(part,'      WHERE 1=1','      WHERE (\'${reportStatus}\'=\'all\' OR COALESCE(c.is_archived,false)=(\'${reportStatus}\'=\'archived\'))');
    if(path==='/reports-qr')part=replace(part,'      ORDER BY qr.name',"        AND ('${reportStatus}'='all' OR COALESCE(qr.is_archived,false)=('${reportStatus}'='archived'))\n      ORDER BY qr.name");
    if(path==='/reports-location'){
      const anchor='WHERE COALESCE(is_archived,false) = false';
      if(part.split(anchor).length!==3)throw Error('Location archive predicates changed');
      part=part.replaceAll(anchor,"WHERE ('${reportStatus}'='all' OR COALESCE(is_archived,false)=('${reportStatus}'='archived'))");
      // Location totals include all historical activity belonging to the selected locations.
      part=part.replace('          AND COALESCE(qr.is_archived,false) = false','').replace('          AND COALESCE(is_archived,false) = false','');
    }
    part=replace(part,'query:{start_date:startDate,end_date:endDate}',`query:{start_date:startDate,end_date:endDate,status:reportStatus,status_scope:"${scope}"}`);
    part=replace(part,'<button class="btn" type="submit">Apply Filter</button>',`<div><label for="report-status">Status</label><br>
            <select id="report-status" name="status">
              <option value="active" \${reportStatus === "active" ? "selected" : ""}>Active</option>
              <option value="archived" \${reportStatus === "archived" ? "selected" : ""}>Archived</option>
              <option value="all" \${reportStatus === "all" ? "selected" : ""}>All</option>
            </select></div>
          <button class="btn" type="submit">Apply Filter</button>`);
    for(const target of ['/reports','/reports-qr','/reports-location','/reports-campaign']){
      part=part.replaceAll(`href="${target}"`,`href="${target}?status=\${reportStatus}&amp;start_date=\${encodeURIComponent(startDate)}&amp;end_date=\${encodeURIComponent(endDate)}"`);
    }
    part=part.replace('No report data yet.','No campaigns match these filters.').replace('No QR report data yet.','No QR codes match these filters.').replace('No location data yet.','No locations match these filters.');
    if(path==='/reports-campaign')part=replace(part,'${table}','${table || `<tr><td colspan="16">No campaigns match these filters.</td></tr>`}');
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}
module.exports={install};
