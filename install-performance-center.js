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
if (!source.includes('require("./performance-center-evidence")')) {
  const marker = 'const { renderPerformanceCenter } = require("./performance-center");';
  source = source.replace(marker, `${marker}\nconst { loadPerformanceCenterInsights } = require("./performance-center-evidence");`);
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
      \`(
        c.user_id = $$\${eventParams.length}
        OR EXISTS (
          SELECT 1
          FROM qr_campaigns performance_qc
          JOIN qr_codes performance_qr ON performance_qr.id = performance_qc.qr_id
          JOIN spaces performance_space ON performance_space.id = performance_qr.space_id
          WHERE performance_qc.campaign_id = c.id
            AND performance_space.user_id = $$\${eventParams.length}
        )
      )\`
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
  const replacement = `    const performanceRange = {
      from: startDate || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
      to: endDate || new Date().toISOString().slice(0, 10)
    };
    const segmentInsights = await loadPerformanceCenterInsights({q,userId:performanceUserId,range:performanceRange});
    return res.send(
      page(
        "AI Performance Center",
        renderPerformanceCenter({
          startDate: performanceRange.from,
          endDate: performanceRange.to,
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
          ,segmentInsights
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
