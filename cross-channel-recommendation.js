"use strict";

const CHANNELS = {
  digital: {
    name: "Digital Advertising",
    role: "Capture and create measurable demand with search, social, display, retargeting and email.",
    examples: ["Google Ads", "Meta or LinkedIn", "Display and retargeting", "Email activation"],
    measurement: ["UTM-tagged destinations", "Platform clicks and spend", "Vivid conversions", "POS or verified revenue match"]
  },
  physical: {
    name: "Physical Media",
    role: "Build repeated local visibility through high-context offline media.",
    examples: ["Billboards", "Magazines and print", "Valpak or direct mail", "Events and sponsorships"],
    measurement: ["Placement-specific QR", "Unique URL or offer code", "Call tracking when appropriate", "POS or verified revenue match"]
  },
  vivid: {
    name: "Vivid Marketplace",
    role: "Reach trusted communities through measurable schools, gyms, campuses, venues and publications.",
    examples: ["School and campus placements", "Gyms and business locations", "Venue sponsorships", "Publication inventory"],
    measurement: ["Vivid dynamic QR", "Placement and location attribution", "Intent actions", "Conversion and revenue attribution"]
  },
  owned: {
    name: "Owned Channels",
    role: "Convert existing attention through channels the advertiser controls.",
    examples: ["Website", "Organic social", "Email list", "Business locations"],
    measurement: ["Campaign-specific landing path", "Vivid click ID", "Form or checkout completion", "POS or verified revenue match"]
  }
};

const OBJECTIVE_WEIGHTS = {
  sales: { digital: 40, physical: 15, vivid: 30, owned: 15 },
  leads: { digital: 50, physical: 10, vivid: 20, owned: 20 },
  visits: { digital: 25, physical: 25, vivid: 35, owned: 15 },
  awareness: { digital: 25, physical: 35, vivid: 30, owned: 10 }
};

function allocatePercentages(objective, selected, scope) {
  const base = { ...(OBJECTIVE_WEIGHTS[objective] || OBJECTIVE_WEIGHTS.sales) };
  if (scope === "specific_marketplace" && selected.includes("vivid")) {
    base.vivid = 50;
    for (const key of Object.keys(base)) if (key !== "vivid") base[key] = Math.max(5, base[key] - 7);
  }
  const total = selected.reduce((sum, key) => sum + Number(base[key] || 0), 0);
  let used = 0;
  return selected.map((key, index) => {
    const percentage = index === selected.length - 1 ? 100 - used : Math.round((Number(base[key] || 0) / total) * 100);
    used += percentage;
    return { key, percentage };
  });
}

function prepareCrossChannelRecommendation(brief) {
  const selected = Array.from(new Set((brief.channels || []).filter(key => CHANNELS[key])));
  if (!selected.length) throw new Error("At least one supported channel is required.");
  const budget = Math.max(0, Number(brief.monthlyBudget || 0));
  const allocation = allocatePercentages(brief.objective, selected, brief.campaignScope);
  let allocatedCents = 0;
  const totalCents = Math.round(budget * 100);
  const channels = allocation.map((item, index) => {
    const cents = index === allocation.length - 1 ? totalCents - allocatedCents : Math.round(totalCents * item.percentage / 100);
    allocatedCents += cents;
    const details = CHANNELS[item.key];
    return {
      key: item.key,
      name: details.name,
      percentage: item.percentage,
      monthlyBudget: cents / 100,
      role: details.role,
      examples: details.examples,
      measurement: details.measurement,
      executionStatus: item.key === "vivid" ? "Vivid can coordinate eligible marketplace inventory after approval." : "Connection or vendor coordination is required before execution.",
      evidenceStatus: "Baseline required — no connected performance evidence was supplied with this brief."
    };
  });
  return {
    version: 1,
    status: "recommendation_ready",
    objective: brief.objective,
    campaignScope: brief.campaignScope,
    audience: brief.audience,
    geography: brief.geography,
    offer: brief.offer,
    monthlyBudget: budget,
    channels,
    measurementPlan: ["Use a unique campaign and destination identity for every channel.", "Reconcile platform delivery, Vivid intent, conversions and verified revenue.", "Review performance against the advertiser Evidence Passport before reallocating budget."],
    guardrails: ["No campaign launch or media purchase without approval.", "No budget increase without approval.", "Recommendations are not performance guarantees."],
    forecast: { status: "baseline_required", message: "Vivid will calculate outcome ranges after account, placement or comparable-campaign evidence is connected." },
    rationale: `This mix prioritizes the ${brief.objective} objective across the channel families the advertiser authorized. Allocation is a starting recommendation and must be recalibrated with connected evidence.`
  };
}

module.exports = { CHANNELS, allocatePercentages, prepareCrossChannelRecommendation };
