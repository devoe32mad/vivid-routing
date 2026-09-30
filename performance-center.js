"use strict";

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const number = value => Number(value || 0).toLocaleString();
const money = value => Number(value || 0).toLocaleString(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const percent = value => `${Number(value || 0).toFixed(1)}%`;

function dateQuery(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function marketingCenterHref(startDate, endDate, platform = "") {
  const params = new URLSearchParams();
  if (startDate) params.set("from", startDate);
  if (endDate) params.set("to", endDate);
  if (platform) params.set("platform", platform);
  const query = params.toString();
  return `/admin/marketing-command-center${query ? `?${query}` : ""}`;
}

function segmentCard({label,title,question,checks,platform,startDate,endDate,tone,insight}) {
  const href=insight?.href||marketingCenterHref(startDate,endDate,platform);
  return `<a class="pc-segment ${escapeHtml(tone || "")}" href="${escapeHtml(href)}">
    <span class="pc-label">${escapeHtml(label)}</span>
    <strong class="pc-title">${escapeHtml(title)}</strong>
    <span class="pc-question">${escapeHtml(question)}</span>
    <span class="pc-note"><b>Current insight:</b> ${escapeHtml(insight?.title||"Vivid is checking your connected evidence.")}</span>
    <span class="pc-finding">${escapeHtml(insight?.reason||checks)}</span>
    <span class="pc-action"><b>Next step:</b> ${escapeHtml(insight?.action||"Open the supporting evidence before making a change.")}</span>
    <span class="pc-link">Inspect evidence <span aria-hidden="true">→</span></span>
  </a>`;
}

function card({ label, value, note, href, tone = "", cta = "See the data" }) {
  return `<a class="pc-card ${escapeHtml(tone)}" href="${escapeHtml(href)}">
    <span class="pc-label">${escapeHtml(label)}</span>
    <strong class="pc-value">${escapeHtml(value)}</strong>
    <span class="pc-note">${escapeHtml(note)}</span>
    <span class="pc-link">${escapeHtml(cta)} <span aria-hidden="true">→</span></span>
  </a>`;
}

function rankedCard({ eyebrow, title, facts, action = "Open the supporting data before making a change.", href, tone = "" }) {
  return `<a class="pc-card pc-result ${escapeHtml(tone)}" href="${escapeHtml(href)}">
    <span class="pc-label">${escapeHtml(eyebrow)}</span>
    <strong class="pc-title">${escapeHtml(title)}</strong>
    <span class="pc-note">${escapeHtml(facts)}</span>
    <span class="pc-action"><b>Next step:</b> ${escapeHtml(action)}</span>
    <span class="pc-link">Inspect evidence <span aria-hidden="true">→</span></span>
  </a>`;
}

function insightHref(type) {
  const label = String(type || "").toLowerCase();
  if (label.includes("location")) return "/reports-location";
  if (label.includes("placement")) return "/reports-qr";
  return "/reports";
}

function insightAction(type) {
  const label = String(type || "").toLowerCase();
  if (label.includes("risk")) return "Check tracking, the offer, and the conversion path before approving more spend.";
  if (label.includes("conversion")) return "Find where visitors stop, then prepare one small test for approval.";
  if (label.includes("location")) return "Compare this location with similar locations before repeating the placement.";
  if (label.includes("placement")) return "Review the message and audience, then prepare a controlled repeat test.";
  if (label.includes("revenue")) return "Open the revenue evidence and confirm it is tied to the measured campaign.";
  if (label.includes("renewal")) return "Review the measured results before approving a renewal decision.";
  return "Review the supporting data and prepare a controlled test; do not change spend yet.";
}

function renderPerformanceCenter(data = {}) {
  const {
    startDate,
    endDate,
    advertisingInvestment = 0,
    conversionRevenue = 0,
    roi = 0,
    conversions = 0,
    cac = 0,
    intentRate = 0,
    intent = 0,
    scans = 0,
    activeCampaigns = 0,
    topFiveCampaigns = [],
    topFiveAttentionCampaigns = [],
    topFiveLocations = [],
    topFivePlacements = [],
    executiveInsights = [],
    segmentInsights = {}
  } = data;
  const range = dateQuery(startDate, endDate);
  const hasInvestment = Number(advertisingInvestment) > 0;
  const hasConversions = Number(conversions) > 0;
  const outcomeLabel = hasConversions ? "Customer actions" : "Customer actions";
  const topCampaign = topFiveCampaigns[0];
  const attention = topFiveAttentionCampaigns[0];
  const topLocation = topFiveLocations[0];
  const topPlacement = topFivePlacements[0];

  const distinctInsights = executiveInsights.filter(insight => !(
    attention &&
    String(insight.text || "").toLowerCase().includes(String(attention.name || "").toLowerCase()) &&
    /(risk|conversion)/i.test(String(insight.type || ""))
  ));
  const insightCards = distinctInsights.slice(0, 4).map(insight => rankedCard({
    eyebrow: "AI recommendation · For review",
    title: insight.type || "Performance signal",
    facts: insight.text || "Open the supporting report for details.",
    action: insightAction(insight.type),
    href: insightHref(insight.type),
    tone: "pc-insight"
  })).join("");

  return `<style>
    .pc-shell{max-width:1180px;margin:0 auto;padding:24px 18px 48px;color:#102b50}
    .pc-hero{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:20px}
    .pc-kicker{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#1559c7}
    .pc-hero h1{font-size:clamp(28px,4vw,42px);line-height:1.08;margin:6px 0 8px}
    .pc-hero p{max-width:690px;color:#52667e;margin:0;line-height:1.55}
    .pc-primary{display:inline-flex;align-items:center;background:#123a6d;color:#fff!important;text-decoration:none;font-weight:800;padding:11px 15px;border-radius:10px;white-space:nowrap}
    .pc-filter{display:flex;align-items:end;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid #dbe4ef;padding:14px;border-radius:14px;margin:0 0 26px}
    .pc-filter label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#52667e}.pc-filter input{min-height:40px;border:1px solid #cbd7e6;border-radius:8px;padding:0 10px}.pc-filter button{min-height:40px;border:0;border-radius:8px;background:#123a6d;color:#fff;padding:0 15px;font-weight:800;cursor:pointer}
    .pc-section{margin-top:28px}.pc-section-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:12px}.pc-section h2{font-size:22px;margin:0}.pc-section-head p{color:#65778c;margin:0;font-size:14px}
    .pc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
    .pc-card{min-height:146px;box-sizing:border-box;display:flex;flex-direction:column;padding:16px;border:1px solid #dbe4ef;border-radius:14px;background:#fff;color:#102b50!important;text-decoration:none;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .pc-card:hover,.pc-card:focus-visible,.pc-segment:hover,.pc-segment:focus-visible{transform:translateY(-2px);border-color:#78a7e8;box-shadow:0 8px 24px rgba(16,43,80,.09);outline:none}
    .pc-label{font-size:12px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;color:#52667e}.pc-value{font-size:27px;line-height:1.1;margin:9px 0 6px}.pc-title{font-size:17px;line-height:1.3;margin:8px 0 7px}.pc-note{font-size:13px;line-height:1.4;color:#65778c}.pc-action{display:block;margin-top:10px;padding-top:10px;border-top:1px solid #e4ebf4;font-size:13px;line-height:1.4;color:#304d70}.pc-link{margin-top:auto;padding-top:12px;font-size:13px;font-weight:900;color:#1559c7}.pc-attention{border-left:4px solid #c2413b}.pc-good{border-left:4px solid #25875d}.pc-insight{background:#f7faff}.pc-result{min-height:190px}
    .pc-help{margin-top:24px;padding:14px 16px;border-radius:12px;background:#edf4ff;color:#304d70;font-size:13px;line-height:1.5}.pc-help strong{color:#102b50}
    .pc-segments{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pc-segment{min-height:285px;box-sizing:border-box;display:flex;flex-direction:column;padding:17px;border:1px solid #dbe4ef;border-top:4px solid #1559c7;border-radius:14px;background:#fff;color:#102b50!important;text-decoration:none;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}.pc-segment .pc-question{display:block;font-size:15px;font-weight:800;line-height:1.35;margin:0 0 12px}.pc-segment .pc-note{padding-top:11px;border-top:1px solid #e4ebf4}.pc-finding{display:block;font-size:13px;line-height:1.45;color:#52667e;margin-top:8px}.pc-paid{border-top-color:#2563eb}.pc-website{border-top-color:#e37400}.pc-organic{border-top-color:#25875d}.pc-ai{border-top-color:#6d4aff}
    @media(max-width:900px){.pc-segments{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.pc-hero{display:block}.pc-primary{margin-top:14px}.pc-section-head{display:block}.pc-section-head p{margin-top:5px}.pc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pc-card{min-height:138px;padding:14px}.pc-value{font-size:23px}}
    @media(max-width:460px){.pc-grid{grid-template-columns:1fr}}
  </style>
  <main class="pc-shell">
    <header class="pc-hero">
      <div><div class="pc-kicker">Vivid AI Performance Center</div><h1>Know what is working—and what to do next.</h1><p>Plain-English recommendations based on measured results. Every suggestion links to its supporting evidence, and nothing changes without your approval.</p></div>
      <a class="pc-primary" href="${escapeHtml(marketingCenterHref(startDate, endDate))}">View all marketing data →</a>
    </header>
    <form class="pc-filter" method="get">
      <label>From<input type="date" name="startDate" value="${escapeHtml(startDate || "")}"></label>
      <label>To<input type="date" name="endDate" value="${escapeHtml(endDate || "")}"></label>
      <button type="submit">Update dates</button>
    </form>

    <section class="pc-section">
      <div class="pc-section-head"><h2>Choose what you want to improve</h2><p>Each area has its own insights, recommendations, and supporting evidence</p></div>
      <div class="pc-segments">
        ${segmentCard({label:"Paid media",title:"Social & search advertising",question:"Are your ads producing useful traffic and outcomes?",checks:"spend, reach, clicks, conversions, ROAS, landing-page quality, and campaign comparisons",platform:"paid_media",startDate,endDate,tone:"pc-paid",insight:segmentInsights.paid})}
        ${segmentCard({label:"Website",title:"Traffic & search performance",question:"What brought people to your site—and what did they do?",checks:"GA4 sessions, engagement, key actions, revenue, Search Console visibility, and landing pages",platform:"ga4",startDate,endDate,tone:"pc-website",insight:segmentInsights.website})}
        ${segmentCard({label:"Organic",title:"Unpaid content performance",question:"Which posts and videos earned attention without ad spend?",checks:"views, engagement, shares, saves, website visits, and key actions—without inventing ROI",platform:"organic",startDate,endDate,tone:"pc-organic",insight:segmentInsights.organic})}
        ${segmentCard({label:"AI discovery",title:"AI-referred website traffic",question:"Are AI assistants helping people discover your business?",checks:"identifiable visits from ChatGPT, Perplexity, Claude, Copilot, engagement, and key actions",platform:"ai_traffic",startDate,endDate,tone:"pc-ai",insight:segmentInsights.ai})}
      </div>
    </section>

    <section class="pc-section">
      <div class="pc-section-head"><h2>Across all marketing</h2><p>${number(activeCampaigns)} active Vivid campaign${Number(activeCampaigns) === 1 ? "" : "s"} in the selected account</p></div>
      <div class="pc-grid">
        ${card({label:"Vivid placement cost",value:money(advertisingInvestment),note:"Cost assigned to Vivid placements",href:`/reports${range}`})}
        ${card({label:"Recorded revenue",value:money(conversionRevenue),note:"Revenue recorded through Vivid",href:`/reports${range}`,tone:conversionRevenue > 0 ? "pc-good" : ""})}
        ${card({label:"Return on investment",value:hasInvestment ? percent(roi) : "Not ready",note:"Revenue minus cost, divided by cost",href:`/reports${range}`,tone:hasInvestment && roi >= 0 ? "pc-good" : hasInvestment ? "pc-attention" : ""})}
        ${card({label:outcomeLabel,value:number(conversions),note:"Tracked leads, purchases, or other goals",href:`/reports${range}`})}
        ${card({label:"Cost per customer action",value:hasConversions ? money(cac) : "Not ready",note:"Placement cost divided by customer actions",href:`/reports${range}`})}
        ${card({label:"Visitor interest rate",value:Number(scans) > 0 ? percent(intentRate) : "Not ready",note:`${number(intent)} meaningful actions from ${number(scans)} scans`,href:`/reports${range}`})}
        ${card({label:"Digital & website results",value:"All channels",note:"Google, Meta, LinkedIn, GA4, AI traffic, and more",href:marketingCenterHref(startDate, endDate),cta:"Open Marketing Center"})}
      </div>
    </section>

    <section class="pc-section">
      <div class="pc-section-head"><h2>What worked?</h2><p>Your strongest measured results</p></div>
      <div class="pc-grid">
        ${topCampaign ? rankedCard({eyebrow:"Best campaign",title:topCampaign.name || "Unnamed campaign",facts:`${money(topCampaign.revenue)} recorded revenue · ${number(topCampaign.conversions)} customer actions`,href:`/admin/edit-campaign/${Number(topCampaign.id)}`,tone:"pc-good"}) : card({label:"Best campaign",value:"Not enough data",note:"Results will appear after activity is recorded",href:`/reports${range}`})}
        ${topLocation ? rankedCard({eyebrow:"Best location",title:topLocation.name || "Unnamed location",facts:`${money(topLocation.revenue)} recorded revenue · ${number(topLocation.conversions)} customer actions`,href:"/reports-location",tone:"pc-good"}) : card({label:"Best location",value:"Not enough data",note:"Results will appear after activity is recorded",href:"/reports-location"})}
        ${topPlacement ? rankedCard({eyebrow:"Best placement",title:topPlacement.name || "Unnamed placement",facts:`${money(topPlacement.revenue)} recorded revenue · ${number(topPlacement.conversions)} customer actions`,href:"/reports-qr",tone:"pc-good"}) : card({label:"Best placement",value:"Not enough data",note:"Results will appear after activity is recorded",href:"/reports-qr"})}
      </div>
    </section>

    <section class="pc-section">
      <div class="pc-section-head"><h2>What should I do next?</h2><p>AI recommendations for review—not automatic changes</p></div>
      <div class="pc-grid">
        ${attention ? rankedCard({eyebrow:"High priority · Campaign review",title:attention.name || "Unnamed campaign",facts:`${money(attention.allocatedCost)} invested · ${money(attention.revenue)} recorded revenue`,action:"Verify tracking, the offer, and the conversion path before approving more spend.",href:`/admin/edit-campaign/${Number(attention.id)}`,tone:"pc-attention"}) : card({label:"Campaign check",value:"Nothing urgent",note:"No measured campaign currently meets the warning rules",href:`/reports${range}`,tone:"pc-good"})}
        ${insightCards || card({label:"Vivid recommendation",value:"Keep measuring",note:"More activity is needed before Vivid can make a reliable suggestion",href:"/admin/marketing-command-center",cta:"Review all evidence"})}
      </div>
    </section>
    <div class="pc-help"><strong>Plain-English definitions:</strong> ROI means how much came back after cost. “Not ready” means Vivid does not yet have enough cost or outcome data to calculate the number honestly. No campaign, bid, budget, or spending change is made without approval.</div>
  </main>`;
}

module.exports = { renderPerformanceCenter };
