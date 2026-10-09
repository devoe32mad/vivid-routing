"use strict";
const fs=require("fs"),path=require("path");
const MARKER="// HFHS_CARD_ROUTE_REGISTERED_V1";
function install(source){
 if(source.includes(MARKER))return source;
 const anchor='  "/advertise/:slug",';
 const pos=source.indexOf(anchor);
 if(pos<0)throw new Error("Generic marketplace route anchor not found");
 const appGet=source.lastIndexOf("app.get(",pos);
 if(appGet<0)throw new Error("Generic marketplace app.get not found");
 const line=`${MARKER}\nrequire("./hfhs-marketplace-route")(app,{q,escapeHtml});\n`;
 return source.slice(0,appGet)+line+source.slice(appGet);
}
if(require.main===module){try{const f=path.join(__dirname,"server.js"),s=fs.readFileSync(f,"utf8"),n=require("./sponsorship-operations").install(require("./placement-performance").install(require("./renewal-exports").install(installPipeline(require("./install-contract-advertiser-links").install(require("./install-org-active-advertising").install(require("./install-hfhs-report-scope").install(require("./hfhs-demo-setup-scope").install(install(s)))))))));if(n!==s)fs.writeFileSync(f,n);console.log("HFHS card route installed.");}catch(e){console.error("HFHS card route install skipped:",e.message);}}

function installPipeline(source){
 const marker='// PIPELINE_CONTRACT_METRICS_V1';
 if(source.includes(marker))return source;
 function route(path,edit){
  const start=source.indexOf('app.get(\n  "'+path+'",'),end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Pipeline route missing: '+path);
  source=source.slice(0,start)+edit(source.slice(start,end))+source.slice(end);
 }
 function once(s,a,b){if(s.split(a).length!==2)throw Error('Pipeline anchor missing: '+a);return s.replace(a,b);}
 route('/org-revenue-pipeline',s=>{
  s=once(s,'      s.location AS market,',`      s.location AS market,
      contract_metrics.active_revenue,
      contract_metrics.renewal_count,
      contract_metrics.renewal_value,`);
  s=once(s,' FROM spaces s',` FROM spaces s
 LEFT JOIN LATERAL (
   SELECT COALESCE(SUM(c.total_contract_value),0)::numeric AS active_revenue,
     COUNT(*) FILTER (WHERE COALESCE(c.end_date,c.expiration_date)
       BETWEEN CURRENT_DATE AND CURRENT_DATE+90)::int AS renewal_count,
     COALESCE(SUM(c.total_contract_value) FILTER (WHERE COALESCE(c.end_date,c.expiration_date)
       BETWEEN CURRENT_DATE AND CURRENT_DATE+90),0)::numeric AS renewal_value
   FROM contracts c WHERE c.organization_id=s.organization_id AND c.location_id=s.id
     AND LOWER(TRIM(COALESCE(c.status,'')))='active'
     AND c.renewed_from_contract_id IS NULL
 ) contract_metrics ON true`);
  s=once(s,"            AND LOWER(TRIM(ar.status)) = 'approved'", "            AND LOWER(TRIM(ar.status)) = 'approved'\n            AND COALESCE(ar.setup_status,'') <> 'Demo Archived'");
  s=once(s,'  totals.advertisers += Number(location.advertiser_count || 0);',`  totals.advertisers += Number(location.advertiser_count || 0);
  totals.active += Number(location.active_revenue || 0);
  totals.renewals += Number(location.renewal_count || 0);
  totals.renewalValue += Number(location.renewal_value || 0);`);
  s=once(s,'pending: 0, advertisers: 0','pending: 0, advertisers: 0, active: 0, renewals: 0, renewalValue: 0');
  s=once(s,'["Active", "—"]','["Active Contract Value", pipelineWholeDollars(pipelineTotals.active)]');
  s=once(s,'["Renewals (90d)", "—"]','["Renewals (90d)", pipelineTotals.renewals.toLocaleString()]');
  s=once(s,'["Renewal Value", "—"]','["Renewal Value", pipelineWholeDollars(pipelineTotals.renewalValue)]');
  s=once(s,'<a href="#revenue-by-location"', '<a href="${label === "Active Contract Value" ? `/org-contracts?organization_id=${organizationId}&status=active${selectedLocationId ? `&location_id=${selectedLocationId}` : ""}` : label.startsWith("Renewal") ? `/org-renewals?organization_id=${organizationId}&window=90${selectedLocationId ? `&location_id=${selectedLocationId}` : ""}` : "#revenue-by-location"}"');
  for(const [label,value] of [['Active','money(Number(location.active_revenue || 0))'],['Renewals (90d)','Number(location.renewal_count || 0).toLocaleString()'],['Renewal Value','money(Number(location.renewal_value || 0))']]){
   s=once(s,'                  '+label+'\n                </div>\n\n                <strong>—</strong>', '                  '+(label==='Active'?'Active Contract Value':label)+'\n                </div>\n\n                <strong>${'+value+'}</strong>');
  }
  s=once(s,'Dashes indicate figures not yet available.','Active Contract Value is the value of active contracts. Renewals show active contracts ending within 90 days; Renewal Value is part of Active Contract Value, not additional revenue. Archived demo requests are excluded from advertiser counts.');
  return s;
 });
 for(const path of ['/org-revenue-pipeline/location/:locationId','/org-revenue-pipeline/location/:locationId/revenue'])route(path,s=>{
  const a=s.indexOf('      let organizationId = null;'),b=s.indexOf('      const locationId =',a);
  if(a<0||b<0)throw Error('Pipeline location scope anchor missing');
  s=s.slice(0,a)+'      const scope = await getOrganizationScope(req);\n      const {organizationId, allowedLocationIds} = scope;\n\n'+s.slice(b);
  s=once(s,'        locationId <= 0','        locationId <= 0 ||\n        !allowedLocationIds.includes(locationId)');
  if(path.endsWith('/revenue')){
   s=once(s,'      const revenue =',`      const activeRevenueResult = await q(\`
        SELECT COALESCE(SUM(total_contract_value),0)::numeric AS active_revenue
        FROM contracts WHERE organization_id=$1 AND location_id=$2
          AND LOWER(TRIM(COALESCE(status,'')))='active'
          AND renewed_from_contract_id IS NULL
      \`, [organizationId,locationId]);
      const revenue =`);
   s=once(s,'label: "Active Revenue",\n                  value: 0,','label: "Active Contract Value",\n                  value: activeRevenueResult.rows[0]?.active_revenue || 0,');
  }else s=once(s,'`/org-contracts?organization_id=${organizationId}&location_id=${locationId}&renewal_window=90`','`/org-renewals?organization_id=${organizationId}&location_id=${locationId}&window=90`');
  return s;
 });
 source=source.replace('Active, Renewals (90d) and Renewal Value remain dashes until those figures are available.','Active Contract Value comes from active contracts. Renewals (90d) counts active contracts ending within 90 days; Renewal Value is their contract value and is already included in Active Contract Value. Archived demo requests are excluded from advertiser counts.');
 return source+'\n'+marker+'\n';
}
module.exports={install,installPipeline};