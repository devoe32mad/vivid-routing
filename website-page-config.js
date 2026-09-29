"use strict";
// Customer-approved installation configuration. These are planned pages, never
// evidence that the advertiser installed the script or that a visit occurred.
const configurations = [{
  campaignId:55,
  advertiser:"hexpol",
  // QR 96 is Vivid's dedicated HEXPOL tracking QR. It may route through a
  // currently active event campaign while website visits remain reported in
  // the long-lived Customer-Tracking campaign.
  qrIds:[96],
  pages:[
    {name:"Quality Journey",url:"https://www.hexpol.com/rubber/what-we-offer/qualityjourney/"},
    {name:"Contact Us",url:"https://www.hexpol.com/rubber/contact/"},
    {name:"What We Offer",url:"https://www.hexpol.com/rubber/what-we-offer/"},
    {name:"About Us",url:"https://www.hexpol.com/rubber/about-us/"},
    {name:"Find Contact",url:"https://www.hexpol.com/rubber/contact/find-contact/"}
  ]
}];
function configuredWebsitePages(campaign) {
  return configurations.find(c=>c.campaignId===Number(campaign.id) && c.advertiser===String(campaign.advertiser||"").trim().toLowerCase())?.pages || [];
}
function configuredWebsiteTracking(campaignId) {
  return configurations.find(c=>c.campaignId===Number(campaignId)) || null;
}
module.exports={configuredWebsitePages,configuredWebsiteTracking};
