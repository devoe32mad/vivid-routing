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

test("uses successful comparable campaigns to set targets", () => {
  const brief = validateCampaignBrief({name:"Game Night",objective:"conversion",audience:"Families at games",offer:"Family offer",placementId:4,startDate:"2026-10-01",endDate:"2026-10-31",budget:500}).value;
  const plan = prepareCampaignPlan(brief,{placementName:"Stadium",metrics:{scans:100,clicks:20,conversions:2},comparables:[{id:12,qr_id:4,name:"Winning Friday Offer",offer:"Free appetizer with entree",placement:"Stadium Concourse",start_date:"2026-08-01",end_date:"2026-08-31",scans:200,clicks:80,conversions:16,source:"same_placement"}]});
  assert.equal(plan.comparables[0].name,"Winning Friday Offer");
  assert.equal(plan.targets.clickRate,40);
  assert.equal(plan.targets.conversionRate,20);
  assert.match(plan.rationale,/Winning Friday Offer/);
  assert.equal(plan.comparables[0].offer,"Free appetizer with entree");
  assert.equal(plan.comparables[0].startDate,"2026-08-01");
});

test("flags an audience and placement mismatch", () => {
  const brief = validateCampaignBrief({name:"Car Line",objective:"engagement",audience:"Students and family in car line",offer:"Offer",placementId:4,startDate:"2026-10-01",endDate:"2026-10-31",budget:500}).value;
  const plan = prepareCampaignPlan(brief,{placementName:"Athletics Concession Display",metrics:{}});
  assert.match(plan.warning,/may not align/);
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

test("renders offer, where and when for previous campaigns", () => {
  const plan={id:8,name:"New offer",status:"pending",plan_json:{audience:"Families",placement:"Stadium",schedule:"October",budget:500,headline:"Offer",callToAction:"Act",rationale:"Measured",evidence:"Evidence",comparables:[{id:12,qrId:4,name:"August Family Night",offer:"Free appetizer",placement:"Home Stadium",startDate:"2026-08-01",endDate:"2026-08-31",scans:100,clicks:25,conversions:5,clickRate:25}]}};
  const html=renderPlanCard(plan);
  assert.match(html,/Offer:<\/strong> Free appetizer/);
  assert.match(html,/Where:<\/strong> Home Stadium/);
  assert.match(html,/When:<\/strong> 2026-08-01 through 2026-08-31/);
  assert.match(html,/\/admin\/view-campaign\/12/);
});

test("enterprise evidence links drill into the authorized source campaign", () => {
  const plan={id:9,name:"Plan",status:"pending",plan_json:{comparables:[{id:12,qrId:4,name:"Prior",offer:"Offer",placement:"Gym",startDate:"2026-08-01",endDate:"2026-08-31",scans:10,clicks:4,conversions:1,clickRate:40}]}};
  const html=renderPlanCard(plan,{organizationId:23,action:"/org-ai-approval-center/action"});
  assert.match(html,/\/org-campaign\/12\?organization_id=23&amp;qr_id=4/);
});
