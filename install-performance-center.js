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

if (!source.includes("const performanceUserId =")) {
  const routeStart = source.indexOf('app.get("/admin/ai-insights"');
  if (routeStart < 0) throw new Error("Performance Center route not found.");
  const roleMarker = `    const isSuperAdmin =
      currentUser.role === "super_admin";`;
  const rolePosition = source.indexOf(roleMarker, routeStart);
  if (rolePosition < 0) throw new Error("Performance Center account-scope marker not found.");
  source = source.slice(0, rolePosition) + source.slice(rolePosition).replace(roleMarker, `${roleMarker}
    // Keep this page aligned with the account selected in Marketing Command Center.
    // Non-super-admin users can only see their own account.
    const rememberedMarketingAccountId = Number(req.session.marketingAccountId);
    const performanceUserId = isSuperAdmin && Number.isInteger(rememberedMarketingAccountId) && rememberedMarketingAccountId > 0
      ? rememberedMarketingAccountId
      : Number(currentUser.id);`);

  const eventScope = `    if (!isSuperAdmin) {
      eventParams.push(currentUser.id);

      eventWhere.push(
        \`c.user_id = $\${eventParams.length}\`
      );
    }`;
  if (!source.includes(eventScope)) throw new Error("Performance Center event-scope marker not found.");
  source = source.replace(eventScope, `    eventParams.push(performanceUserId);
    eventWhere.push(
      \`c.user_id = $$\${eventParams.length}\`
    );`);

  for (const parameterName of ["campaignParams", "locationParams", "placementParams"]) {
    const oldScope = `const ${parameterName} =
  isSuperAdmin
    ? [null]
    : [currentUser.id];`;
    if (!source.includes(oldScope)) throw new Error(`Performance Center ${parameterName} marker not found.`);
    source = source.replace(oldScope, `const ${parameterName} = [performanceUserId];`);
  }
}

if (!source.includes("renderPerformanceCenter({")) {
  const marker = `    res.send(
      page(
        "Performance Insights",
        \``;
  const replacement = `    return res.send(
      page(
        "AI Performance Center",
        renderPerformanceCenter({
          startDate,
          endDate,
          advertisingInvestment,
          conversionRevenue,
          roi,
          conversions,
          cac,
          intentRate: scans > 0 ? (intent / scans) * 100 : 0,
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
