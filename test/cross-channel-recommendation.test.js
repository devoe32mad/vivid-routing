"use strict";

const assert = require("assert");
const { allocatePercentages, prepareCrossChannelRecommendation } = require("../cross-channel-recommendation");

const mix = prepareCrossChannelRecommendation({ objective:"sales", campaignScope:"vivid_selects", audience:"Naples families", geography:"Naples, FL", offer:"Family offer", monthlyBudget:2500, channels:["digital","physical","vivid","owned"] });
assert.equal(mix.channels.reduce((sum, channel) => sum + channel.percentage, 0), 100);
assert.equal(mix.channels.reduce((sum, channel) => sum + channel.monthlyBudget, 0), 2500);
assert.equal(mix.forecast.status, "baseline_required");
assert(mix.guardrails.some(item => item.includes("No campaign launch")));
assert(mix.channels.find(item => item.key === "physical").examples.includes("Valpak or direct mail"));

const marketplace = allocatePercentages("visits", ["digital","vivid"], "specific_marketplace");
assert.equal(marketplace.reduce((sum, channel) => sum + channel.percentage, 0), 100);
assert(marketplace.find(item => item.key === "vivid").percentage > marketplace.find(item => item.key === "digital").percentage);

assert.throws(() => prepareCrossChannelRecommendation({ channels:[] }), /channel/i);
console.log("cross-channel-recommendation tests passed");
