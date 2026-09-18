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
  renderCampaignIntelligence,
  buildAdvertiserIntelligence,
  renderAdvertiserIntelligence
} = require("./vivid-intelligence");`;

const askImportAnchor = '} = require("./vivid-intelligence");';
const askImportBlock = `${askImportAnchor}
const {
  answerAskVivid,
  renderAskVivid
} = require("./ask-vivid");
const {
  calculatePreviousPeriod,
  buildComparativeIntelligence,
  buildRenewalPricingRecommendation,
  renderComparativeIntelligence,
  renderRenewalPricingRecommendations
} = require("./comparative-intelligence");`;

const benchmarkImportAnchor = '} = require("./comparative-intelligence");';
const benchmarkImportBlock = `${benchmarkImportAnchor}
const {
  loadVividBenchmark,
  renderVividBenchmark
} = require("./vivid-benchmarks");
const {
  buildPriorityCenter,
  renderPriorityCenter
} = require("./ai-priority-center");
const {
  registerWeeklyAiReportRoutes
} = require("./weekly-ai-report-routes");
const {
  registerAiCampaignOperatorRoutes
} = require("./ai-campaign-operator-routes");`;

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

      const organizationComparisonPeriod =
        calculatePreviousPeriod(
          fromDate,
          toDate
        );

      let previousOrganizationCampaigns = [];

      if (organizationComparisonPeriod) {
        const previousCampaignResult =
          await q(
            \`
              SELECT
                c.id,
                c.name,
                c.advertiser,
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
               AND e.created_at::date >= $4::date
               AND e.created_at::date <= $5::date
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
              GROUP BY c.id, c.name, c.advertiser
            \`,
            [
              organizationId,
              allowedLocationIds,
              selectedLocationId,
              organizationComparisonPeriod.previousStartDate,
              organizationComparisonPeriod.previousEndDate
            ]
          );

        previousOrganizationCampaigns =
          previousCampaignResult.rows;
      }

      const organizationComparison =
        buildComparativeIntelligence({
          role: "enterprise",
          period: organizationComparisonPeriod,
          currentCampaigns: campaignIntelligence,
          previousCampaigns:
            previousOrganizationCampaigns
        });

      const organizationBenchmark =
        await loadVividBenchmark(q, {
          startDate: fromDate,
          endDate: toDate,
          subject: campaignIntelligence.reduce(
            (summary, campaign) => ({
              campaigns: summary.campaigns + 1,
              scans: summary.scans + Number(campaign.scans || 0),
              engagement: summary.engagement + Number(campaign.intent || 0),
              conversions: summary.conversions + Number(campaign.conversions || 0),
              revenue: summary.revenue + Number(campaign.revenue || 0)
            }),
            { campaigns: 0, scans: 0, engagement: 0, conversions: 0, revenue: 0 }
          )
        });


      const liveCampaignStartDates =`;

const organizationAskBuilderAnchor = `const executiveInsights =
        vividInsights;`;
const organizationAskBuilderBlock = `const executiveInsights =
        vividInsights;

      const organizationAskVivid =
        answerAskVivid({
          role: "enterprise",
          organizationName: organization.name,
          question: req.query.ask,
          campaigns: campaignIntelligence,
          comparison: organizationComparison,
          metrics: {
            revenue: advertiserRevenueGenerated
          },
          inventory: {
            availableSpots,
            pendingSpots,
            pendingRevenue
          },
          inventoryHref:
            \`/org-marketplace?organization_id=\${organizationId}\`,
          periodLabel:
            fromDate || toDate
              ? \`Reporting period: \${fromDate || "Beginning"} through \${toDate || "Today"}\`
              : "All measured activity"
        });

      const renewalPricingResult =
        await q(
          \`
            SELECT
              c.id,
              c.contract_name,
              c.total_contract_value,
              COALESCE(c.end_date, c.expiration_date)::date AS end_date,
              c.qr_id,
              qr.name AS placement_name,
              COUNT(e.id) FILTER (
                WHERE e.type = 'scan'
              )::int AS scans,
              COUNT(e.id) FILTER (
                WHERE e.type IN ('offer', 'maps', 'waze', 'destination_click')
              )::int AS clicks,
              COUNT(e.id) FILTER (
                WHERE e.type = 'conversion'
              )::int AS conversions,
              COALESCE(
                SUM(e.value) FILTER (
                  WHERE e.type = 'conversion'
                ),
                0
              )::numeric AS revenue
            FROM contracts c
            LEFT JOIN qr_codes qr
              ON qr.id = c.qr_id
            LEFT JOIN events e
              ON e.qr_id = c.qr_id
              \${eventDateSql}
              \${eventTestSql}
            WHERE c.organization_id = $1
              AND c.location_id = ANY($2::int[])
              AND (
                $3::int IS NULL
                OR c.location_id = $3::int
              )
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND COALESCE(c.end_date, c.expiration_date)
                BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
              AND c.renewed_from_contract_id IS NULL
            GROUP BY
              c.id,
              c.contract_name,
              c.total_contract_value,
              c.qr_id,
              qr.name
            ORDER BY COALESCE(c.end_date, c.expiration_date)
            LIMIT 6
          \`,
          eventParams
        );

      const renewalPricingRecommendations =
        renewalPricingResult.rows.map(contract => ({
          name:
            contract.contract_name ||
            contract.placement_name ||
            "Advertising renewal",
          currentPrice:
            Number(contract.total_contract_value || 0),
          endDate:
            contract.end_date,
          scans:
            Number(contract.scans || 0),
          clicks:
            Number(contract.clicks || 0),
          conversions:
            Number(contract.conversions || 0),
          revenue:
            Number(contract.revenue || 0),
          href:
            \`/org-renewals?organization_id=\${organizationId}\`,
          recommendation:
            buildRenewalPricingRecommendation({
              currentPrice:
                contract.total_contract_value,
              revenue: contract.revenue,
              conversions: contract.conversions,
              scans: contract.scans,
              expiringSoon: true
            })
        }));

      const enterprisePriorityCenter =
        buildPriorityCenter({
          role: "enterprise",
          campaigns: campaignIntelligence,
          renewals: renewalPricingRecommendations,
          availableSpots,
          pendingSpots,
          pendingRevenue,
          inventoryHref:
            \`/org-marketplace?organization_id=\${organizationId}\`
        });`;

const campaignRenderAnchor = `              <!-- =====================================
                   LAUNCH SCORECARD
              ====================================== -->`;
const campaignRenderBlock = `              \${renderPriorityCenter(
                enterprisePriorityCenter,
                {
                  returnTo: req.originalUrl,
                  organizationId
                }
              )}

              \${renderComparativeIntelligence(
                organizationComparison,
                {
                  fallbackHref:
                    \`/org-performance?organization_id=\${organizationId}\`
                }
              )}

              \${renderVividBenchmark(
                organizationBenchmark,
                { role: "enterprise" }
              )}

              \${renderRenewalPricingRecommendations(
                renewalPricingRecommendations
              )}

              \${renderAskVivid(
                organizationAskVivid,
                {
                  action: "/org-performance",
                  hiddenFields: {
                    organization_id: organizationId,
                    from: fromDate,
                    to: toDate,
                    location_id: selectedLocationId
                  }
                }
              )}

              \${renderCampaignIntelligence(
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

const advertiserBuilderAnchor = `const executiveInsights =
  vividInsights.slice(0, 4);`;
const advertiserBuilderBlock = `const executiveInsights =
  vividInsights.slice(0, 4);

const advertiserComparisonPeriod =
  calculatePreviousPeriod(
    startDate,
    endDate
  );

const previousCampaignPerformance = [];

if (advertiserComparisonPeriod) {
  for (const campaign of campaignsResult.rows) {
    if (campaign.is_archived) {
      continue;
    }

    const previousMetricsResult =
      await q(
        \`
          SELECT
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
          FROM events e
          WHERE e.campaign_id = $1
            AND e.created_at::date >= $2::date
            AND e.created_at::date <= $3::date
        \`,
        [
          Number(campaign.id),
          advertiserComparisonPeriod.previousStartDate,
          advertiserComparisonPeriod.previousEndDate
        ]
      );

    const previousMetrics =
      previousMetricsResult.rows[0] || {};
    const previousCost =
      await allocatedSpotCostForCampaign(
        Number(campaign.id),
        advertiserComparisonPeriod.previousStartDate,
        advertiserComparisonPeriod.previousEndDate
      );

    previousCampaignPerformance.push({
      id: Number(campaign.id),
      name: campaign.name || "",
      scans: Number(previousMetrics.scans || 0),
      intent: Number(previousMetrics.intent || 0),
      conversions:
        Number(previousMetrics.conversions || 0),
      revenue: Number(previousMetrics.revenue || 0),
      allocatedCost: Number(previousCost || 0),
      href:
        \`/admin/edit-campaign/\${Number(campaign.id)}\`
    });
  }
}

const advertiserComparison =
  buildComparativeIntelligence({
    role: "advertiser",
    period: advertiserComparisonPeriod,
    currentCampaigns:
      campaignPerformance.map(campaign => ({
        ...campaign,
        href:
          \`/admin/edit-campaign/\${campaign.id}\`
      })),
    previousCampaigns:
      previousCampaignPerformance
  });

const advertiserBenchmark =
  await loadVividBenchmark(q, {
    startDate,
    endDate,
    subject: campaignPerformance.reduce(
      (summary, campaign) => ({
        campaigns: summary.campaigns + 1,
        scans: summary.scans + Number(campaign.scans || 0),
        engagement: summary.engagement + Number(campaign.intent || 0),
        conversions: summary.conversions + Number(campaign.conversions || 0),
        revenue: summary.revenue + Number(campaign.revenue || 0)
      }),
      { campaigns: 0, scans: 0, engagement: 0, conversions: 0, revenue: 0 }
    )
  });

const advertiserIntelligence =
  buildAdvertiserIntelligence(
    campaignPerformance,
    {
      periodLabel:
        startDate || endDate
          ? \`Reporting period: \${startDate || "Beginning"} through \${endDate || "Today"}\`
          : "All measured activity"
    }
  );

const advertiserAskVivid =
  answerAskVivid({
    role: "advertiser",
    question: req.query.ask,
    campaigns: campaignPerformance,
    comparison: advertiserComparison,
    metrics: {
      investment: advertisingInvestment,
      revenue: conversionRevenue
    },
    periodLabel:
      startDate || endDate
        ? \`Reporting period: \${startDate || "Beginning"} through \${endDate || "Today"}\`
        : "All measured activity"
  });

const advertiserPriorityCenter =
  buildPriorityCenter({
    role: "advertiser",
    campaigns: advertiserIntelligence.campaigns
  });`;

const advertiserRenderAnchor = `  <!-- =========================================
       TOP CAMPAIGN
  ========================================== -->`;
const advertiserRenderBlock = `  \${renderPriorityCenter(
    advertiserPriorityCenter,
    { returnTo: req.originalUrl }
  )}

  \${renderComparativeIntelligence(
    advertiserComparison,
    {
      fallbackHref: "/admin/ai-insights"
    }
  )}

  \${renderVividBenchmark(
    advertiserBenchmark,
    { role: "platform" }
  )}

  \${renderAskVivid(
    advertiserAskVivid,
    {
      action: "/admin/ai-insights",
      viewLabel: "Platform",
      hiddenFields: {
        startDate,
        endDate
      }
    }
  )}

  \${renderAdvertiserIntelligence(
    advertiserIntelligence,
    {
      viewLabel: "Platform",
      scopeLabel: "Active campaigns only"
    }
  )}

  <!-- =========================================
       TOP CAMPAIGN
  ========================================== -->`;

const patches = [
  {
    marker: 'require("./vivid-intelligence")',
    anchor: importAnchor,
    replacement: importBlock,
    label: "module import"
  },
  {
    marker: 'require("./ask-vivid")',
    anchor: askImportAnchor,
    replacement: askImportBlock,
    label: "Ask Vivid module import"
  },
  {
    marker: 'require("./vivid-benchmarks")',
    anchor: benchmarkImportAnchor,
    replacement: benchmarkImportBlock,
    label: "Vivid benchmark module import"
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
    marker: "const organizationAskVivid =",
    anchor: organizationAskBuilderAnchor,
    replacement: organizationAskBuilderBlock,
    label: "enterprise Ask Vivid builder"
  },
  {
    marker: "const accessError =",
    anchor: performanceCatchAnchor,
    replacement: performanceCatchBlock,
    label: "performance access response"
  },
  {
    marker: "const advertiserIntelligence =",
    anchor: advertiserBuilderAnchor,
    replacement: advertiserBuilderBlock,
    label: "advertiser intelligence builder"
  },
  {
    marker: "${renderAdvertiserIntelligence(",
    anchor: advertiserRenderAnchor,
    replacement: advertiserRenderBlock,
    label: "advertiser intelligence panel"
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

const feedbackRouteMarker = 'app.post("/ai-priority-feedback"';
const feedbackRouteAnchor = `app.listen(port, () => {`;
const feedbackRouteBlock = `app.post("/ai-priority-feedback", async (req, res) => {
  try {
    const actor = req.session.orgUser || req.session.user;
    if (!actor) return res.redirect("/login");

    const actorId = Number(actor.user_id || actor.login_user_id || actor.id || 0);
    if (!actorId) return res.status(403).send("Access denied");

    const allowedFeedback = new Set([
      "helpful",
      "not_helpful",
      "action_taken",
      "dismissed"
    ]);
    const feedback = String(req.body.feedback || "");
    if (!allowedFeedback.has(feedback)) {
      return res.status(400).send("Invalid feedback");
    }

    const requestedRole = String(req.body.role || "");
    const role = requestedRole === "enterprise" ? "enterprise" : "advertiser";
    const isSuperAdmin = req.session.user?.role === "super_admin";
    if (role === "enterprise" && !req.session.orgUser && !isSuperAdmin) {
      return res.status(403).send("Access denied");
    }

    const priorityKey = String(req.body.priority_key || "").trim().slice(0, 180);
    if (!priorityKey) return res.status(400).send("Priority is required");

    const sessionOrganizationId = Number(
      req.session.orgUser?.organization_id ||
      req.session.orgUser?.organizationId ||
      0
    );
    const requestedOrganizationId = Number(req.body.organization_id || 0);
    const scopeId = role === "enterprise"
      ? (sessionOrganizationId || (isSuperAdmin ? requestedOrganizationId : 0))
      : 0;
    if (role === "enterprise" && !scopeId) {
      return res.status(403).send("Valid organization is required");
    }

    await q(\`
      CREATE TABLE IF NOT EXISTS ai_priority_feedback (
        id BIGSERIAL PRIMARY KEY,
        actor_id BIGINT NOT NULL,
        scope_id INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL,
        priority_key TEXT NOT NULL,
        feedback TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (actor_id, scope_id, role, priority_key)
      )
    \`);

    await q(
      \`
        INSERT INTO ai_priority_feedback
          (actor_id, scope_id, role, priority_key, feedback)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (actor_id, scope_id, role, priority_key)
        DO UPDATE SET
          feedback = EXCLUDED.feedback,
          updated_at = CURRENT_TIMESTAMP
      \`,
      [actorId, scopeId, role, priorityKey, feedback]
    );

    const requestedReturnTo = String(req.body.return_to || "");
    const returnTo = /^\\/(?:admin\\/ai-insights|org-performance)(?:\\?|$)/.test(requestedReturnTo)
      ? requestedReturnTo
      : role === "enterprise"
        ? \`/org-performance?organization_id=\${scopeId}\`
        : "/admin/ai-insights";
    return res.redirect(
      returnTo + (returnTo.includes("?") ? "&" : "?") + "ai_feedback=saved"
    );
  } catch (error) {
    console.error("AI PRIORITY FEEDBACK ERROR", error);
    return res.status(500).send("Unable to save feedback");
  }
});

${feedbackRouteAnchor}`;

if (!source.includes(feedbackRouteMarker)) {
  const matches = source.split(feedbackRouteAnchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install AI priority feedback route: expected one anchor, found ${matches}.`
    );
  }
  source = source.replace(feedbackRouteAnchor, feedbackRouteBlock);
}

const weeklyReportRouteMarker = `registerWeeklyAiReportRoutes({`;
const weeklyReportRouteAnchor = `app.listen(port, () => {`;
const weeklyReportRouteBlock = `registerWeeklyAiReportRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  getOrganizationScope,
  buildPriorityCenter,
  sendOrganizationNotification,
  baseUrl: process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "https://vivid-routing-production.up.railway.app"
});

registerAiCampaignOperatorRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  requireOrganizationPermission,
  getOrganizationScope
});

${weeklyReportRouteAnchor}`;

if (!source.includes(weeklyReportRouteMarker)) {
  const matches = source.split(weeklyReportRouteAnchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install weekly AI report routes: expected one anchor, found ${matches}.`
    );
  }
  source = source.replace(weeklyReportRouteAnchor, weeklyReportRouteBlock);
}

const advertiserWeeklyNavMarker = `href="/admin/weekly-ai-report"`;
const advertiserWeeklyNavAnchor = `<a href="/admin/ai-insights" style="color:white;text-decoration:none;">
 Performance Insights </a>`;
const advertiserWeeklyNavBlock = `${advertiserWeeklyNavAnchor}

  <a href="/admin/weekly-ai-report" style="color:white;text-decoration:none;">
    Weekly AI Report
  </a>`;

if (!source.includes(advertiserWeeklyNavMarker)) {
  const matches = source.split(advertiserWeeklyNavAnchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install advertiser weekly report navigation: expected one anchor, found ${matches}.`
    );
  }
  source = source.replace(advertiserWeeklyNavAnchor, advertiserWeeklyNavBlock);
}

const advertiserApprovalNavMarker = `href="/admin/ai-approval-center"`;
const advertiserApprovalNavAnchor = `  <a href="/admin/weekly-ai-report" style="color:white;text-decoration:none;">
    Weekly AI Report
  </a>`;
const advertiserApprovalNavBlock = `${advertiserApprovalNavAnchor}
  <a href="/admin/ai-approval-center" style="color:white;text-decoration:none;">
    AI Approval Center
  </a>`;
if (!source.includes(advertiserApprovalNavMarker)) {
  const matches = source.split(advertiserApprovalNavAnchor).length - 1;
  if (matches !== 1) throw new Error(`Unable to install AI Approval Center navigation: expected one anchor, found ${matches}.`);
  source = source.replace(advertiserApprovalNavAnchor, advertiserApprovalNavBlock);
}

const enterpriseWeeklyNavMarker = `"Weekly AI Report",\n  \`/org-weekly-ai-report?organization_id=\${organizationId}\``;
const enterpriseWeeklyNavAnchor = `\${navItem(
  "Performance Insights",
  \`/org-performance?organization_id=\${organizationId}\`,
  "performance"
)}`;
const enterpriseWeeklyNavBlock = `${enterpriseWeeklyNavAnchor}
\${navItem(
  "Weekly AI Report",
  \`/org-weekly-ai-report?organization_id=\${organizationId}\`,
  "weekly-ai-report"
)}`;

if (!source.includes(enterpriseWeeklyNavMarker)) {
  const matches = source.split(enterpriseWeeklyNavAnchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install enterprise weekly report navigation: expected one anchor, found ${matches}.`
    );
  }
  source = source.replace(enterpriseWeeklyNavAnchor, enterpriseWeeklyNavBlock);
}

const enterpriseApprovalNavMarker = `"AI Approval Center",\n  \`/org-ai-approval-center?organization_id=\${organizationId}\``;
const enterpriseApprovalNavAnchor = `\${navItem(
  "Weekly AI Report",
  \`/org-weekly-ai-report?organization_id=\${organizationId}\`,
  "weekly-ai-report"
)}`;
const enterpriseApprovalNavBlock = `${enterpriseApprovalNavAnchor}
\${navItem(
  "AI Approval Center",
  \`/org-ai-approval-center?organization_id=\${organizationId}\`,
  "ai-approval-center"
)}`;
if (!source.includes(enterpriseApprovalNavMarker)) {
  const matches = source.split(enterpriseApprovalNavAnchor).length - 1;
  if (matches !== 1) throw new Error(`Unable to install enterprise AI Approval Center navigation: expected one anchor, found ${matches}.`);
  source = source.replace(enterpriseApprovalNavAnchor, enterpriseApprovalNavBlock);
}

const clicksPerScanAnchor = `    const intentRate =
      scans > 0
        ? (intent / scans) * 100
        : 0;`;
const clicksPerScanCalculation = `    const clicksPerScan =
      scans > 0
        ? intent / scans
        : 0;`;

if (!source.includes(clicksPerScanCalculation)) {
  if (source.includes(clicksPerScanAnchor)) {
    source = source.replace(
      clicksPerScanAnchor,
      clicksPerScanCalculation
    );
  } else {
    console.warn(
      "Clicks-per-scan calculation was not changed because its exact source block was not found."
    );
  }
}

const clicksPerScanCardAnchor = `              <div class="label">
                Intent Rate
              </div>

              <div class="num">
                \${pct(intentRate)}
              </div>`;
const clicksPerScanCard = `              <div class="label">
                Clicks per Scan
              </div>

              <div class="num">
                \${clicksPerScan.toFixed(2)}
              </div>`;

if (!source.includes(clicksPerScanCard)) {
  if (source.includes(clicksPerScanCardAnchor)) {
    source = source.replace(
      clicksPerScanCardAnchor,
      clicksPerScanCard
    );
  } else {
    console.warn(
      "Clicks-per-scan card was not changed because its exact source block was not found."
    );
  }
}

source = source.replace(
  "intent actions from",
  "clicks from"
);

fs.writeFileSync(serverPath, source, "utf8");
console.log("Vivid intelligence preview installed.");
