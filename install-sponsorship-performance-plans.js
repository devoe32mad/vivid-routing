"use strict";

const fs=require("fs");
const path=require("path");

function install(source){
  const importLine='const { attachBasicPlanToMarketplaceQr, basicQrRestricted, basicCampaignRestricted } = require("./sponsorship-performance-plan");';
  const routeAnchor='app.get(\n  "/admin/edit-campaign/:campaignId",';

  if(!source.includes(importLine)){
    const routePos=source.indexOf(routeAnchor);
    if(routePos<0)throw new Error("Campaign edit route anchor not found for sponsorship import.");
    source=source.slice(0,routePos)+importLine+"\n"+source.slice(routePos);
  }

  const guardMarker="// SPONSORSHIP_PERFORMANCE_ROUTE_GUARD";
  if(!source.includes(guardMarker)){
    const guardPos=source.indexOf(routeAnchor);
    if(guardPos<0)throw new Error("Campaign edit route anchor not found for sponsorship guard.");

    const guard=`${guardMarker}
app.use(async (req,res,next)=>{
  try {
    if(!req.session?.user || req.session.user.role==="super_admin") return next();

    const requestPath=String(req.path||"");
    const campaignMatch=requestPath.match(/^\\/admin\\/(?:edit-campaign|view-campaign)\\/(\\d+)$/);
    const websiteMatch=requestPath.match(/^\\/admin\\/campaign\\/(\\d+)\\/website-pages$/);
    const campaignId=campaignMatch
      ? Number(campaignMatch[1])
      : websiteMatch
        ? Number(websiteMatch[1])
        : 0;

    if(campaignId && await basicCampaignRestricted(q,req.session.user.id,campaignId)){
      return res.status(403).send(page(
        "Vivid Performance",
        '<div class="wrap"><div class="card"><h1>Available with Vivid Performance</h1><p>Your Basic sponsorship includes scan reporting. Website activity, conversions, revenue, ROI and dynamic campaign changes are available with Vivid Performance for $35/month per placement.</p><p><a class="btn" href="/admin/marketing-command-center">Back to Sponsorship Performance</a></p></div></div>'
      ));
    }

    const isCampaignWrite=requestPath==="/admin/new-campaign" && req.method==="POST";
    const isScheduleWrite=(
      requestPath==="/admin/schedule" ||
      requestPath==="/admin/event-calendar" ||
      requestPath==="/admin/event-calendar/import"
    ) && req.method==="POST";

    if(
      (isCampaignWrite || isScheduleWrite) &&
      req.body?.qr_id &&
      await basicQrRestricted(q,req.session.user.id,req.body.qr_id)
    ){
      return res.status(403).send(
        "Vivid Performance is required to change or schedule this sponsorship placement."
      );
    }

    return next();
  } catch(error) {
    console.error("SPONSORSHIP PERFORMANCE ROUTE GUARD ERROR",error);
    return res.status(500).send(
      "Unable to verify sponsorship access. Please try again."
    );
  }
});
`;

    source=source.slice(0,guardPos)+guard+"\n"+source.slice(guardPos);
  }

  const marker="// SPONSORSHIP_PERFORMANCE_MARKETPLACE_DEFAULT";
  if(source.includes(marker))return source;

  const campaignAnchor=`const campaignId =
  Number(campaignInsertResult.rows[0].id);
if (
  Number.isInteger(marketplaceRequestId) &&
  marketplaceRequestId > 0
) {`;

  if(!source.includes(campaignAnchor)){
    throw new Error("Marketplace campaign creation anchor not found.");
  }

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
