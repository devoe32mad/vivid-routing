"use strict";
// Customer-approved installation configuration. These are planned pages, never
// evidence that the advertiser installed the script or that a visit occurred.
const configurations = [{
  campaignId:55,
  advertiser:"hexpol",
  // QRs 61 and 96 are Vivid's dedicated HEXPOL tracking QRs. They may route through a
  // currently active event campaign while website visits remain reported in
  // the long-lived Customer-Tracking campaign.
  qrIds:[61,96],
  pages:[
    {campaignId:93,name:"Quality Journey",url:"https://www.hexpol.com/rubber/what-we-offer/qualityjourney/"},
    {campaignId:92,name:"Contact Us",url:"https://www.hexpol.com/rubber/contact/"},
    {campaignId:91,name:"What We Offer",url:"https://www.hexpol.com/rubber/what-we-offer/"},
    {campaignId:90,name:"About Us",url:"https://www.hexpol.com/rubber/about-us/"},
    {campaignId:89,name:"Find Contact",url:"https://www.hexpol.com/rubber/contact/find-contact/"}
  ]
}];
const polymerBooth = {qrId:61, installCampaignId:55, pages:configurations[0].pages};
function configuredWebsitePages(campaign) {
  if (String(campaign.advertiser || "").trim().toLowerCase() === "hexpol") {
    const page = polymerBooth.pages.find(p => p.campaignId === Number(campaign.id));
    if (page && campaign.name === "Polymer Summit - " + page.name) return [page];
  }
  return configurations.find(c=>c.campaignId===Number(campaign.id) && c.advertiser===String(campaign.advertiser||"").trim().toLowerCase())?.pages || [];
}
function configuredWebsiteTracking(campaignId) {
  return configurations.find(c=>c.campaignId===Number(campaignId)) || null;
}
module.exports={configuredWebsitePages,configuredWebsiteTracking,polymerBooth};
