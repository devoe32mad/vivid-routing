"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {aiSource,organicMedium}=require("../performance-center-evidence");
const {renderPerformanceCenter}=require("../performance-center");

test("classifies AI and organic traffic without treating paid traffic as organic",()=>{
  assert.equal(aiSource("chatgpt.com"),true);
  assert.equal(aiSource("perplexity.ai"),true);
  assert.equal(aiSource("google.com"),false);
  assert.equal(organicMedium("organic_social"),true);
  assert.equal(organicMedium("paid-social"),false);
  assert.equal(organicMedium("cpc"),false);
});

test("renders inline segment findings and actions",()=>{
  const insight={title:"A measured finding",reason:"12 sessions and 4 engaged sessions.",action:"Review the landing page.",href:"/evidence"};
  const html=renderPerformanceCenter({segmentInsights:{paid:insight,website:insight,organic:insight,ai:insight}});
  assert.equal((html.match(/A measured finding/g)||[]).length,4);
  assert.match(html,/Current insight:/);
  assert.match(html,/12 sessions and 4 engaged sessions/);
  assert.match(html,/Next step:/);
  assert.match(html,/href="\/evidence"/);
});
