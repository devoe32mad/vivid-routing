"use strict";
const fs=require("fs"),path=require("path");
function install(source){
  const importLine='const { registerGoogleAdsObservationRoutes } = require("./google-ads-observation-routes");';
  const importAnchor='const { registerMarketplaceCampaignBuilderRoutes } = require("./marketplace-campaign-builder-routes");';
  if(!source.includes(importLine)){if(!source.includes(importAnchor))throw new Error("Google Ads connector import anchor not found.");source=source.replace(importAnchor,`${importAnchor}\n${importLine}`);}
  const marker="registerGoogleAdsObservationRoutes({";
  const anchor=`registerMarketplaceCampaignBuilderRoutes({
  app,
  q,
  orgPage,
  organizationNav,
  requireOrganizationPermission,
  getOrganizationScope,
  sendOrganizationNotification
});`;
  if(!source.includes(marker)){if(!source.includes(anchor))throw new Error("Google Ads connector registration anchor not found.");source=source.replace(anchor,`${anchor}\n\nregisterGoogleAdsObservationRoutes({\n  app,\n  q,\n  orgPage,\n  organizationNav,\n  requireOrganizationPermission,\n  getOrganizationScope\n});`);}
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js"),before=fs.readFileSync(file,"utf8"),after=install(before);if(after!==before)fs.writeFileSync(file,after);console.log("Google Ads Observation connector installed.");}
module.exports={install};
