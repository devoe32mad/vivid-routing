"use strict";
const fs = require("fs");
const path = require("path");

const target = process.env.VIVID_SERVER_FILE || path.join(__dirname, "server.js");
let source = fs.readFileSync(target, "utf8");

if (!source.includes('require("./performance-center")')) {
  const marker = 'const crypto = require("crypto");';
  if (!source.includes(marker)) throw new Error("Performance Center require marker not found.");
  source = source.replace(marker, `${marker}\nconst { renderPerformanceCenter } = require("./performance-center");`);
}

if (!source.includes("renderPerformanceCenter({")) {
  const marker = `    res.send(
      page(
        "Performance Insights",
        \``;
  const replacement = `    return res.send(
      page(
        "Performance Insights",
        renderPerformanceCenter({
          startDate,
          endDate,
          advertisingInvestment,
          conversionRevenue,
          roi,
          conversions,
          cac,
          intentRate,
          intent,
          scans,
          activeCampaigns,
          topFiveCampaigns,
          topFiveAttentionCampaigns,
          topFiveLocations,
          topFivePlacements,
          executiveInsights
        })
      )
    );

    /* Legacy layout retained temporarily for rollback safety. */
    res.send(
      page(
        "Performance Insights",
        \``;
  const matches = source.split(marker).length - 1;
  if (matches !== 1) throw new Error(`Performance Center route marker expected once; found ${matches}.`);
  source = source.replace(marker, replacement);
}

fs.writeFileSync(target, source);
console.log("Performance Center installed.");
