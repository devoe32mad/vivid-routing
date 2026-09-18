"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareCampaignPlan, renderOperatorPage, renderPlanCard, validateCampaignBrief } = require("../ai-campaign-operator");

test("validates a complete campaign brief", () => {
  const result = validateCampaignBrief({name:"Game Night",objective:"conversion",audience:"Families",offer:"Family offer",placementId:4,startDate:"2026-10-01",endDate:"2026-10-31",budget:500});
  assert.equal(result.valid,true);
  assert.equal(result.value.budget,500);
});

test("rejects incomplete and reversed campaign briefs", () => {
  const result = validateCampaignBrief({name:"",placementId:0,startDate:"2026-11-02",endDate:"2026-11-01"});
  assert.equal(result.valid,false);
  assert.match(result.errors.join(" "),/Campaign name/);
  assert.match(result.errors.join(" "),/End date/);
});

test("prepares an explainable conversion plan with measured evidence", () => {
  const brief = validateCampaignBrief({name:"Game Night",objective:"conversion",audience:"Families",offer:"Family offer",placementId:4,startDate:"2026-10-01",endDate:"2026-10-31",budget:500}).value;
  const plan = prepareCampaignPlan(brief,{placementName:"Football Stadium",evidence:"12 scans and 2 conversions."});
  assert.deepEqual(plan.measurement,["Scans","Clicks","Conversions","Attributed value","Cost per conversion"]);
  assert.match(plan.rationale,/conversion objective/);
  assert.match(plan.evidence,/12 scans/);
});

test("renders approval controls without claiming automatic execution", () => {
  const plan={id:7,name:"<script>bad</script>",status:"pending",plan_json:{audience:"Families",placement:"Stadium",schedule:"October",budget:500,headline:"Offer",callToAction:"Act",rationale:"Measured",evidence:"Evidence"}};
  const html=renderPlanCard(plan);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/Approve Plan/);
  assert.match(html,/Dismiss/);
  const page=renderOperatorPage({role:"advertiser",placements:[{id:1,name:"Stadium"}],plans:[plan]});
  assert.match(page,/Nothing runs until an authorized user approves it/);
  assert.match(page,/Prepare Campaign Plan/);
});
