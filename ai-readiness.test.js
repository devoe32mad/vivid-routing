const test=require("node:test");
const assert=require("node:assert/strict");
const {validateProfile,scoreReadiness,renderReadinessCenter,renderAdvertiserPortfolio}=require("./ai-readiness");
const {install}=require("./install-ai-readiness");

const complete={goal:"revenue",monthlyBudget:5000,targetGeography:"Naples",targetCustomer:"Families",targetMetric:"ROI",targetValue:2,channels:["vivid","google_ads"],approvedOffers:"Approved offer",prohibitedActions:"No unapproved claims",desiredMode:"autopilot",maxAutoChangePct:10,approvalRequired:true};
const strong={campaigns:5,cost_campaigns:5,scans:500,conversions:30,conversion_value:12000,destinations:4,latest_event_at:new Date().toISOString()};

test("Autopilot requires evidence and guardrails, not score alone",()=>{
  const ready=scoreReadiness(strong,complete);assert.equal(ready.level,"Autopilot Ready");assert.equal(ready.mode,"Bounded Autopilot");
  const weak=scoreReadiness({...strong,conversions:0,conversion_value:0},complete);assert.notEqual(weak.level,"Autopilot Ready");assert.equal(weak.mode,"Observe");
});

test("saved operating mode caps the action even when evidence is strong",()=>{
  const observed=scoreReadiness(strong,{...complete,desiredMode:"observe"});
  assert.equal(observed.mode,"Observe");assert.notEqual(observed.level,"Autopilot Ready");
});

test("readiness identifies the next best proof",()=>{
  const result=scoreReadiness({campaigns:1,cost_campaigns:0,scans:20,conversions:0,destinations:0},{});
  assert.equal(result.level,"Not Ready");assert.ok(result.nextProof);assert.match(result.nextProof.fix,/Define|conversion|Collect|destination|current/i);
});

test("operating contract enforces a conservative automatic-change ceiling",()=>{
  assert.equal(validateProfile({desired_mode:"autopilot",max_auto_change_pct:26}).valid,false);
  assert.equal(validateProfile({goal:"revenue",desired_mode:"approval",max_auto_change_pct:10,approved_channels:["vivid"]}).valid,true);
});

test("Evidence Passport renders proof and permission",()=>{
  const readiness=scoreReadiness(strong,complete),html=renderReadinessCenter({profile:complete,readiness,action:"/save"});
  assert.match(html,/Vivid Evidence Passport/);assert.match(html,/Permitted action/);assert.match(html,/Next Best Proof|Autopilot Ready/);assert.match(html,/AI Operating Contract/);
});

test("enterprise portfolio preserves advertiser evidence boundaries",()=>{
  const html=renderAdvertiserPortfolio([{id:7,name:'Advertiser <One>',readiness:scoreReadiness(strong,complete)},{id:8,name:'Advertiser Two',readiness:scoreReadiness({campaigns:0},{})}],23);
  assert.match(html,/Enterprise Autonomy Portfolio/);assert.match(html,/Advertiser Evidence Passports/);
  assert.match(html,/advertiser\/7\?organization_id=23/);assert.match(html,/advertiser\/8\?organization_id=23/);
  assert.doesNotMatch(html,/Advertiser <One>/);assert.match(html,/Advertiser &lt;One&gt;/);
});

test("installer adds routes and both navigation entries once",()=>{
  const source=`const {\n  registerAiCampaignOperatorRoutes\n} = require("./ai-campaign-operator-routes");\nregisterAiCampaignOperatorRoutes({\n  app,\n  q,\n  page,\n  orgPage,\n  organizationNav,\n  requireLogin,\n  requireOrganizationPermission,\n  getOrganizationScope\n});\n  <a href="/admin/ai-approval-center" style="color:white;text-decoration:none;">\n    AI Approval Center\n  </a>\n\${navItem(\n  "AI Approval Center",\n  \`/org-ai-approval-center?organization_id=\${organizationId}\`,\n  "ai-approval-center"\n)}`;
  const once=install(source);assert.equal(install(once),once);assert.match(once,/registerAiReadinessRoutes/);assert.match(once,/admin\/ai-readiness/);assert.match(once,/org-ai-readiness/);
});
