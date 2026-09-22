"use strict";
const assert=require("assert"),{install}=require("../install-google-ads-observation");
const source=`const { registerMarketplaceCampaignBuilderRoutes } = require("./marketplace-campaign-builder-routes");
registerMarketplaceCampaignBuilderRoutes({
  app,
  q,
  orgPage,
  organizationNav,
  requireOrganizationPermission,
  getOrganizationScope,
  sendOrganizationNotification
});`;
const installed=install(source);assert(installed.includes('require("./google-ads-observation-routes")'));assert(installed.includes("registerGoogleAdsObservationRoutes({"));assert.equal(install(installed),installed);
console.log("install-google-ads-observation tests passed");
