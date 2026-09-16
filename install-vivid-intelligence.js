"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "server.js");
let source = fs.readFileSync(serverPath, "utf8");

const importAnchor = 'const crypto = require("crypto");';
const importBlock = `${importAnchor}
const {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence,
  buildCampaignIntelligence,
  renderCampaignIntelligence
} = require("./vivid-intelligence");`;

const builderAnchor = `const pendingRevenue =
  Number(pendingMetricsResult.rows[0]?.pending_revenue || 0);
const locationCards = locations.map(location => \``;
const builderBlock = `const pendingRevenue =
  Number(pendingMetricsResult.rows[0]?.pending_revenue || 0);
const organizationIntelligence =
  buildOrganizationIntelligence({
    organizationId: org.id,
    organizationName: org.name,
    totals,
    locations,
    availableSpots,
    pendingSpots,
    pendingRevenue,
    advertiserCount,
    activeContracts,
    queryString: dateQueryString
  });
const locationCards = locations.map(location => \``;

const renderAnchor = `\${orgDateFilterForm({
  action: \`/org-organization/\${org.id}\`,
  fromDate,
  toDate
})}
        <div`;
const renderBlock = `\${orgDateFilterForm({
  action: \`/org-organization/\${org.id}\`,
  fromDate,
  toDate
})}
\${renderOrganizationIntelligence(
  organizationIntelligence
)}
        <div`;

const campaignBuilderAnchor = `const testCampaignCount =
        testCampaigns.length;


      const liveCampaignStartDates =`;
const campaignBuilderBlock = `const testCampaignCount =
        testCampaigns.length;


      const campaignIntelligenceResult =
        await q(
          \`
            SELECT
              c.id,
              c.name,
              c.advertiser,
              c.end_date,
              COUNT(e.id) FILTER (
                WHERE e.type = 'scan'
              )::int AS scans,
              COUNT(e.id) FILTER (
                WHERE e.type IN (
                  'offer',
                  'maps',
                  'waze',
                  'destination_click'
                )
              )::int AS intent,
              COUNT(e.id) FILTER (
                WHERE e.type = 'conversion'
              )::int AS conversions,
              COALESCE(
                SUM(e.value) FILTER (
                  WHERE e.type = 'conversion'
                ),
                0
              )::numeric AS revenue
            FROM campaigns c
            JOIN qr_campaigns qc
              ON qc.campaign_id = c.id
            JOIN qr_codes qr
              ON qr.id = qc.qr_id
            JOIN spaces s
              ON s.id = qr.space_id
            LEFT JOIN events e
              ON e.campaign_id = c.id
             AND e.qr_id = qr.id
             \${eventDateSql}
             \${eventTestSql}
            WHERE s.organization_id = $1
              AND s.id = ANY($2::int[])
              AND (
                $3::int IS NULL
                OR s.id = $3::int
              )
              AND COALESCE(c.is_archived, false) = false
              \${campaignTestSql}
              AND COALESCE(qr.is_archived, false) = false
            GROUP BY
              c.id,
              c.name,
              c.advertiser,
              c.end_date
            ORDER BY c.name
          \`,
          eventParams
        );

      const campaignIntelligence =
        buildCampaignIntelligence(
          campaignIntelligenceResult.rows.map(
            campaign => ({
              id: campaign.id,
              name: campaign.name,
              advertiser: campaign.advertiser,
              endDate: campaign.end_date,
              scans: campaign.scans,
              intent: campaign.intent,
              conversions: campaign.conversions,
              revenue: campaign.revenue
            })
          ),
          { organizationId }
        );


      const liveCampaignStartDates =`;

const campaignRenderAnchor = `              <!-- =====================================
                   LAUNCH SCORECARD
              ====================================== -->`;
const campaignRenderBlock = `              \${renderCampaignIntelligence(
                campaignIntelligence
              )}


              <!-- =====================================
                   LAUNCH SCORECARD
              ====================================== -->`;

const performanceCatchAnchor = `      return res
        .status(500)
        .send(
          "Unable to load Performance Insights: " +
          err.message
        );`;
const performanceCatchBlock = `      const accessError =
        /valid organization|required|access denied/i
          .test(String(err.message || ""));

      return res
        .status(accessError ? 403 : 500)
        .send(
          accessError
            ? "Access denied"
            : "Unable to load Performance Insights: " +
              err.message
        );`;

const patches = [
  {
    marker: 'require("./vivid-intelligence")',
    anchor: importAnchor,
    replacement: importBlock,
    label: "module import"
  },
  {
    marker: "const organizationIntelligence =",
    anchor: builderAnchor,
    replacement: builderBlock,
    label: "organization intelligence builder"
  },
  {
    marker: "${renderOrganizationIntelligence(",
    anchor: renderAnchor,
    replacement: renderBlock,
    label: "organization intelligence panel"
  },
  {
    marker: "const campaignIntelligenceResult =",
    anchor: campaignBuilderAnchor,
    replacement: campaignBuilderBlock,
    label: "campaign intelligence builder"
  },
  {
    marker: "${renderCampaignIntelligence(",
    anchor: campaignRenderAnchor,
    replacement: campaignRenderBlock,
    label: "campaign intelligence panel"
  },
  {
    marker: "const accessError =",
    anchor: performanceCatchAnchor,
    replacement: performanceCatchBlock,
    label: "performance access response"
  }
];

for (const patch of patches) {
  if (source.includes(patch.marker)) {
    continue;
  }

  const matches = source.split(patch.anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install ${patch.label}: expected one anchor, found ${matches}.`
    );
  }

  source = source.replace(patch.anchor, patch.replacement);
}

fs.writeFileSync(serverPath, source, "utf8");
console.log("Vivid intelligence preview installed.");
