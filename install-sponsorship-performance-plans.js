"use strict";

const fs=require("fs");
const path=require("path");

function install(source){
  const importLine='const { attachBasicPlanToMarketplaceQr, basicRestrictionApplies } = require("./sponsorship-performance-plan");';
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
'app.use([\\n' +
'  "/admin/edit-campaign",\\n' +
'  "/admin/new-campaign",\\n' +
'  "/admin/schedule",\\n' +
'  "/admin/event-calendar"\\n' +
'], requireLogin, async (req,res,next)=>{\\n' +
'  try {\\n' +
'    if(req.session.user?.role==="super_admin") return next();\\n' +
'    if(!await basicRestrictionApplies(q,req.session.user?.id)) return next();\\n' +
'    if(req.method==="GET" || req.method==="HEAD") {\\n' +
'      return res.status(403).send(page(\\n' +
'        "Vivid Performance",\\n' +
'        \`<div class="wrap"><div class="card"><h1>Available with Vivid Performance</h1><p>Your sponsorship includes scan reporting. Dynamic campaign changes, scheduling, conversion attribution, revenue and ROI are available with Vivid Performance for $35/month per placement.</p><p><a class="btn" href="/admin/marketing-command-center">Back to Sponsorship Performance</a></p></div></div>\`\\n' +
'      ));\\n' +
'    }\\n' +
'    return res.status(403).send("Vivid Performance is required to change or schedule this sponsorship campaign.");\\n' +
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
