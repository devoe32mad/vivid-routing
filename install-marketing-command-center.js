"use strict";
const fs=require("fs"),path=require("path");
function install(source) {
  const marker='const { registerMarketingCommandCenterRoutes } = require("./marketing-command-center-routes");';
  const anchor='const { registerGoogleAdsObservationRoutes } = require("./google-ads-observation-routes");';
  if(!source.includes(marker)){
    if(!source.includes(anchor))throw Error("Command Center import anchor missing");
    source=source.replace(anchor,anchor+"\n"+marker);
  }
  const route="registerMarketingCommandCenterRoutes({app,q,page,orgPage,organizationNav,requireLogin,requireOrganizationPermission,getOrganizationScope});";
  const routeAnchor="registerGoogleAdsObservationRoutes({";
  if(!source.includes(route)){
    if(!source.includes(routeAnchor))throw Error("Command Center route anchor missing");
    source=source.replace(routeAnchor,route+"\n\n"+routeAnchor);
  }
  const nav='<a href="/admin/marketing-command-center" style="color:white;text-decoration:none;">Marketing Command Center</a>';
  const navAnchor='<a href="/admin/ai-insights"';
  if(!source.includes(nav)){
    if(!source.includes(navAnchor))throw Error("Command Center navigation anchor missing");
    source=source.replace(navAnchor,nav+"\n  "+navAnchor);
  }
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));}
module.exports={install};
