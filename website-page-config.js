"use strict";
// Customer-approved installation configuration. These are planned pages, never
// evidence that the advertiser installed the script or that a visit occurred.
const configurations = [{
  campaignId:55,
  advertiser:"hexpol",
  pages:[
    {name:"Quality Journey",url:"https://www.hexpol.com/rubber/what-we-offer/qualityjourney/",icon:"quality"},
    {name:"Contact Us",url:"https://www.hexpol.com/rubber/contact/",icon:"contact"},
    {name:"What We Offer",url:"https://www.hexpol.com/rubber/what-we-offer/",icon:"offer"},
    {name:"About Us",url:"https://www.hexpol.com/rubber/about-us/",icon:"about"},
    {name:"Find Contact",url:"https://www.hexpol.com/rubber/contact/find-contact/",icon:"find"}
  ]
}];
function configuredWebsitePages(campaign) {
  return configurations.find(c=>c.campaignId===Number(campaign.id) && c.advertiser===String(campaign.advertiser||"").trim().toLowerCase())?.pages || [];
}
module.exports={configuredWebsitePages};
