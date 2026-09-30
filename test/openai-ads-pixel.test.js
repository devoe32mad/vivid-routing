"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderOpenAiAdsPixel } = require("../openai-ads-pixel");
const { renderVividCampaignBuilder, renderVividConfirmation } = require("../marketplace-campaign-builder");

test("renders the documented OpenAI Ads browser SDK without secrets", () => {
  const html = renderOpenAiAdsPixel({ env:{ OPENAI_ADS_PIXEL_ID:"pixel-public-id" } });
  assert.match(html, /https:\/\/bzrcdn\.openai\.com\/sdk\/oaiq\.min\.js/);
  assert.match(html, /pixelId:"pixel-public-id"/);
  assert.match(html, /"measure","page_viewed"/);
  assert.doesNotMatch(html, /api[_-]?key|client[_-]?secret|authorization/i);
});

test("measures a page view on the public Vivid campaign form", () => {
  const html = renderVividCampaignBuilder({});
  assert.match(html, /"measure","page_viewed"/);
  assert.equal((html.match(/oaiq\.min\.js/g) || []).length, 1);
});

test("measures a lead only on the successful confirmation page", () => {
  const html = renderVividConfirmation({ reference:"VIVID-TEST", aiVisible:false });
  assert.match(html, /"measure","lead_created"/);
  assert.match(html, /"type":"customer_action"/);
});
