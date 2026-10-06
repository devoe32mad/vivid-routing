"use strict";

const fs=require("fs");
const path=require("path");

function install(source){
  const importLine='const { attachBasicPlanToMarketplaceQr, basicRestrictionApplies, basicQrRestricted, basicCampaignRestricted } = require("./sponsorship-performance-plan");';
  const importAnchor='const crypto = require("crypto");';
  if(!source.includes(importLine)){
    if(!source.includes(importAnchor))throw new Error("Sponsorship performance import anchor not found.");
    source=source.replace(importAnchor,importAnchor+"\n"+importLine);
  }

  const marker="// SPONSORSHIP_PERFORMANCE_MARKETPLACE_DEFAULT";

  const guardMarker="// SPONSORSHIP_PERFORMANCE_ROUTE_GUARD";
  if(!source.includes(guardMarker)){
    const guardAnchor='app.get(\\n  "/admin/edit-campaign/:campaignId",';
    const guardPos=source.indexOf(guardAnchor);
    if(guardPos<0)throw new Error("Campaign edit route anchor not found for sponsorship guard.");
    const guard=guardMarker + "\\n" +
'app.use(async (req,res,next)=>{\\n' +
'  try {\\n' +
'    if(!req.session?.user || req.session.user.role==="super_admin") return next();\\n' +
'    const path=String(req.path||"");\\n' +
'    const campaignMatch=path.match(/^\\\\/admin\\\\/(?:edit-campaign|view-campaign)\\\\/(\\\\d+)$/);\\n' +
'    const websiteMatch=path.match(/^\\\\/admin\\\\/campaign\\\\/(\\\\d+)\\\\/website-pages$/);\\n' +
'    const campaignId=campaignMatch?Number(campaignMatch[1]):websiteMatch?Number(websiteMatch[1]):0;\\n' +
'    if(campaignId && await basicCampaignRestricted(q,req.session.user.id,campaignId)) {\\n' +
'      return res.status(403).send(page("Vivid Performance", \`<div class="wrap"><div class="card"><h1>Available with Vivid Performance</h1><p>Your Basic sponsorship includes scan reporting. Website activity, conversions, revenue, ROI and dynamic campaign changes are available with Vivid Performance for $35/month per placement.</p><p><a class="btn" href="/admin/marketing-command-center">Back to Sponsorship Performance</a></p></div></div>\`));\\n' +
'    }\\n' +
'    const isCampaignWrite=path==="/admin/new-campaign" && req.method==="POST";\\n' +
'    const isScheduleWrite=(path==="/admin/schedule" || path==="/admin/event-calendar" || path==="/admin/event-calendar/import") && req.method==="POST";\\n' +
'    if((isCampaignWrite || isScheduleWrite) && req.body?.qr_id && await basicQrRestricted(q,req.session.user.id,req.body.qr_id)) {\\n' +
'      return res.status(403).send("Vivid Performance is required to change or schedule this sponsorship placement.");\\n' +
'    }\\n' +
'    return next();\\n' +
'  } catch(error) {\\n' +
'    console.error("SPONSORSHIP PERFORMANCE ROUTE GUARD ERROR",error);\\n' +
'    return res.status(500).send("Unable to verify sponsorship access. Please try again.");\\n' +
'  }\\n' +
'});\\n';
    source=source.slice(0,guardPos)+guard+"\\n"+source.slice(guardPos);
  }

  if(source.includes(marker))return source;

  const campaignAnchor=`const campaignId =
  Number(campaignInsertResult.rows[0].id);
if (
  Number.isInteger(marketplaceRequestId) &&
  marketplaceRequestId > 0
) {`;

  if(!source.includes(campaignAnchor))throw new Error("Marketplace campaign creation anchor not found.");

  const replacement=`const campaignId =
  Number(campaignInsertResult.rows[0].id);
${marker}
if (
  Number.isInteger(marketplaceRequestId) &&
  marketplaceRequestId > 0 &&
  Number.isInteger(requestedQrId) &&
  requestedQrId > 0
) {
  await attachBasicPlanToMarketplaceQr(q,{
    qrId: requestedQrId,
    marketplaceRequestId,
    userId
  });
}
if (
  Number.isInteger(marketplaceRequestId) &&
  marketplaceRequestId > 0
) {`;

  return source.replace(campaignAnchor,replacement);
}

if(require.main===module){
  const file=path.join(__dirname,"server.js");
  const before=fs.readFileSync(file,"utf8");
  const after=install(before);
  if(after!==before)fs.writeFileSync(file,after);
  console.log("Sponsorship performance plans installed.");
}

module.exports={install};
