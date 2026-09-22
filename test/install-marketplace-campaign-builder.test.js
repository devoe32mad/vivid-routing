"use strict";

const assert = require("assert");
const { install } = require("../install-marketplace-campaign-builder");

const source = `
const { registerAiReadinessRoutes } = require("./ai-readiness-routes");
function organizationNav({organizationId}) {
  return \`${'${navItem('}
  "AI Readiness",
  \\/org-ai-readiness?organization_id=${'${organizationId}'}\\,
  "ai-readiness"
)}\`;
}
registerAiReadinessRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  requireOrganizationPermission,
  getOrganizationScope
});
function render(organization, description) {
  return \`<p>
              ${'${escapeHtml(description)}'}
            </p>\`;
}`.replace("\\/org", "`/org").replace("\\,", "`,");
const installed = install(source);
assert(installed.includes('require("./marketplace-campaign-builder-routes")'));
assert(installed.includes("registerMarketplaceCampaignBuilderRoutes({"));
assert(installed.includes("Build My Campaign</a>"));
assert(installed.includes('"Campaign Builder",'));
assert.equal(install(installed), installed);
console.log("install-marketplace-campaign-builder tests passed");
