"use strict";

const fs=require("fs");
const path=require("path");

function install(source){
  const importLine='const { attachBasicPlanToMarketplaceQr, basicQrRestricted, basicCampaignRestricted, initialMarketplaceCampaignAllowed, completeBasicMarketplaceSetup, completeBasicMarketplaceSetupFromQr } = require("./sponsorship-performance-plan");';
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

    if(
      requestPath==="/admin/assign" &&
      (req.method==="GET" || req.method==="POST")
    ){
      const source=req.method==="POST" ? req.body : req.query;
      if(
        source?.qr_id &&
        await basicQrRestricted(q,req.session.user.id,source.qr_id)
      ){
        const completed=await completeBasicMarketplaceSetupFromQr(q,{
          userId:req.session.user.id,
          qrId:source.qr_id
        });
        if(completed){
          return res.redirect(303,"/admin/marketing-command-center");
        }
      }
    }

    if(
      requestPath==="/admin/schedule" &&
      req.method==="GET" &&
      req.query?.qr_id &&
      await basicQrRestricted(q,req.session.user.id,req.query.qr_id)
    ){
      const completed=await completeBasicMarketplaceSetupFromQr(q,{
        userId:req.session.user.id,
        qrId:req.query.qr_id
      });
      if(completed){
        return res.redirect(303,"/admin/marketing-command-center");
      }
    }

    const isCampaignWrite=requestPath==="/admin/new-campaign" && req.method==="POST";
    const isQrControlWrite=(
      requestPath==="/admin/assign" ||
      requestPath==="/admin/schedule" ||
      requestPath==="/admin/bulk-schedule" ||
      requestPath==="/admin/event-calendar" ||
      requestPath==="/admin/event-calendar/import"
    ) && req.method==="POST";

    if(
      isCampaignWrite &&
      req.body?.qr_id &&
      await basicQrRestricted(q,req.session.user.id,req.body.qr_id)
    ){
      const allowedInitialSetup=await initialMarketplaceCampaignAllowed(
        q,
        req.session.user.id,
        req.body.qr_id,
        req.body?.marketplace_request_id
      );
      if(!allowedInitialSetup){
        return res.status(403).send(
          "Vivid Performance is required to change this sponsorship campaign."
        );
      }
    }

    if(
      isQrControlWrite &&
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

  const planMarker="// SPONSORSHIP_PERFORMANCE_MARKETPLACE_DEFAULT";
  if(!source.includes(planMarker)){
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
${planMarker}
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

    source=source.replace(campaignAnchor,replacement);
  }

  const autoMarker="// SPONSORSHIP_BASIC_AUTO_EVERYDAY";
  if(!source.includes(autoMarker)){
    const successStart=`    res.send(successPage(
      "Campaign Created Successfully",
      "Your campaign has been saved.",
      "Assign this campaign to a QR code.",
      [
        {
  label: "Assign Campaign",
  href:
    \`/admin/assign\` +
    \`?marketplace_request_id=\${marketplaceRequestId}\` +
    \`&qr_id=\${requestedQrId}\` +
    \`&campaign_id=\${campaignId}\`
},
        { label: "Back to My Setup", href: "/my-setup" },
        { label: "Dashboard", href: "/dashboard" }
      ]
    ));`;

    if(!source.includes(successStart)){
      throw new Error("Campaign success response anchor not found.");
    }

    source=source.replace(successStart,`${autoMarker}
    if (
      Number.isInteger(marketplaceRequestId) &&
      marketplaceRequestId > 0 &&
      Number.isInteger(requestedQrId) &&
      requestedQrId > 0
    ) {
      await completeBasicMarketplaceSetup(q,{
        userId,
        qrId: requestedQrId,
        campaignId,
        marketplaceRequestId
      });

      return res.send(successPage(
        "Sponsorship Setup Complete",
        "Your sponsorship is active and runs every day using the destination you selected.",
        "Basic includes QR scan reporting. Upgrade to Vivid Performance to change campaigns, rotate offers, schedule by day or time, or track deeper business outcomes.",
        [
          { label: "View Sponsorship Performance", href: "/admin/marketing-command-center" },
          { label: "Test QR", href: "/r/" + requestedQrId, target: "_blank" },
          { label: "Back to My Setup", href: "/my-setup" }
        ]
      ));
    }

    res.send(successPage(
      "Campaign Created Successfully",
      "Your campaign has been saved.",
      "Assign this campaign to a QR code.",
      [
        { label: "Assign Campaign", href: "/admin/assign" },
        { label: "Back to My Setup", href: "/my-setup" },
        { label: "Dashboard", href: "/dashboard" }
      ]
    ));`);
  }

  return source;
}

if(require.main===module){
  const file=path.join(__dirname,"server.js");
  const before=fs.readFileSync(file,"utf8");
  const after=install(before);
  if(after!==before)fs.writeFileSync(file,after);
  console.log("Sponsorship performance plans installed.");
}

module.exports={install};
