"use strict";
function install(source){
  const marker="// INLINE_REPORT_PERFORMANCE_UPGRADE_V1";
  if(source.includes(marker))return source;
  // Keep the established report URLs accessible to Basic advertisers.
  for(const name of ["/reports","/reports-qr","/reports-location"]){
    source=source.replace('      "'+name+'",\n','');
  }
  source=source.replaceAll('return res.redirect(303,"/admin/sponsorship-performance");','return res.redirect(303,"/reports");');
  source=source.replaceAll('href: "/admin/sponsorship-performance?request_id=" + marketplaceRequestId','href: "/reports"');
  for(const [name,key,cell,id] of [
    ["/reports","campaign_id",'${r.campaignName || ""}',"r.campaignId"],
    ["/reports-campaign","campaign_id",'${r.campaign_name || ""}',"r.campaign_id"],
    ["/reports-qr","qr_id",'${qr.qr_name || ""}',"qr.qr_id"],
    ["/reports-location","location_id",'${loc.name || ""}',"loc.id"]
  ]){
    const start=source.indexOf(`app.get("${name}", requireLogin, async (req, res) => {`);
    const end=source.indexOf("\napp.",start+1);
    if(start<0||end<0)throw Error("Missing report route: "+name);
    let part=source.slice(start,end);
    part=part.replace('  try {','  try {\n    const performanceUpgrade = await require("./report-performance-upgrade").load({q,req});');
    const anchor='<td>'+cell+'</td>';
    if(!part.includes(anchor))throw Error("Missing report name cell: "+name);
    part=part.replace(anchor,'<td>'+cell+'${require("./report-performance-upgrade").render(performanceUpgrade,"'+key+'",'+id+')}</td>');
    part=part.replace('<div class="card">','${require("./report-performance-upgrade").intro(performanceUpgrade)}\n        <div class="card">');
    if(name==="/reports-location"){
      part=part.replace("            AND user_id = $1", `            AND (user_id = $1 OR EXISTS (
              SELECT 1 FROM qr_codes owned_qr JOIN qr_campaigns owned_qc ON owned_qc.qr_id=owned_qr.id
              JOIN campaigns owned_c ON owned_c.id=owned_qc.campaign_id
              WHERE owned_qr.space_id=spaces.id AND owned_c.user_id=$1
            ))`);
      const scope=` AND ($4::int IS NULL OR EXISTS (SELECT 1 FROM spaces owner_space WHERE owner_space.id=qr.space_id AND owner_space.user_id=$4)
        OR EXISTS (SELECT 1 FROM campaigns owner_campaign WHERE owner_campaign.id=e.campaign_id AND owner_campaign.user_id=$4))`;
      part=part.replace("AND e.created_at::date BETWEEN $2::date AND $3::date", "AND e.created_at::date BETWEEN $2::date AND $3::date"+scope);
      part=part.replace("[loc.id, startDate, endDate]", "[loc.id, startDate, endDate, isSuperAdmin ? null : currentUser.id]");
      part=part.replace("SELECT id\n        FROM qr_codes", "SELECT id\n        FROM qr_codes qr");
      part=part.replace("WHERE space_id = $1", `WHERE space_id = $1
          AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM spaces owner_space WHERE owner_space.id=qr.space_id AND owner_space.user_id=$2)
          OR EXISTS (SELECT 1 FROM qr_campaigns owned_qc JOIN campaigns owned_c ON owned_c.id=owned_qc.campaign_id WHERE owned_qc.qr_id=qr.id AND owned_c.user_id=$2))`);
      part=part.replace("[loc.id]);", "[loc.id, isSuperAdmin ? null : currentUser.id]);");
    }
    source=source.slice(0,start)+part+source.slice(end);
  }
  return source+'\n'+marker+'\n';
}
module.exports={install};
