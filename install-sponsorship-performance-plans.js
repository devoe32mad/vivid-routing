"use strict";

const fs=require("fs");
const path=require("path");

function install(source){
  const importLine='const { attachBasicPlanToMarketplaceQr } = require("./sponsorship-performance-plan");';
  const importAnchor='const crypto = require("crypto");';
  if(!source.includes(importLine)){
    if(!source.includes(importAnchor))throw new Error("Sponsorship performance import anchor not found.");
    source=source.replace(importAnchor,importAnchor+"\n"+importLine);
  }

  const marker="// SPONSORSHIP_PERFORMANCE_MARKETPLACE_DEFAULT";
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
