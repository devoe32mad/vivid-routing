"use strict";

const fs = require("fs");
const path = require("path");

function install(source) {
  const importLine = 'const { registerMarketplaceCampaignBuilderRoutes } = require("./marketplace-campaign-builder-routes");';
  const importAnchor = 'const { registerAiReadinessRoutes } = require("./ai-readiness-routes");';
  if (!source.includes(importLine)) {
    if (!source.includes(importAnchor)) throw new Error("Marketplace Campaign Builder import anchor not found.");
    source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
  }

  const registrationMarker = "registerMarketplaceCampaignBuilderRoutes({";
  const registrationAnchor = `registerAiReadinessRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  requireOrganizationPermission,
  getOrganizationScope
});`;
  if (!source.includes(registrationMarker)) {
    if (!source.includes(registrationAnchor)) throw new Error("Marketplace Campaign Builder registration anchor not found.");
    source = source.replace(registrationAnchor, `${registrationAnchor}\n\nregisterMarketplaceCampaignBuilderRoutes({\n  app,\n  q,\n  orgPage,\n  organizationNav,\n  requireOrganizationPermission,\n  getOrganizationScope,\n  sendOrganizationNotification\n});`);
  }

  const ctaMarker = "Build My Campaign</a>";
  const ctaAnchor = `              ${'${escapeHtml(description)}'}
            </p>`;
  if (!source.includes(ctaMarker)) {
    if (!source.includes(ctaAnchor)) throw new Error("Public marketplace CTA anchor not found.");
    source = source.replace(ctaAnchor, `${ctaAnchor}\n\n            <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:22px;">\n              <a href="/advertise/${'${encodeURIComponent(organization.slug)}'}/build-my-campaign" style="display:inline-block;border-radius:10px;padding:13px 18px;background:#176b3a;color:white;font-weight:bold;text-decoration:none;">Build My Campaign</a>\n              <span style="align-self:center;color:#65776b;font-size:13px;">Tell Vivid your goal. Review the plan before anything runs.</span>\n            </div>`);
  }

  const navMarker = '"Campaign Builder",\n  `/org-campaign-builder-requests?organization_id=${organizationId}`';
  const navAnchor = `${'${navItem('}
  "AI Readiness",
  \`/org-ai-readiness?organization_id=${'${organizationId}'}\`,
  "ai-readiness"
)}`;
  if (!source.includes(navMarker)) {
    if (!source.includes(navAnchor)) throw new Error("Campaign Builder organization navigation anchor not found.");
    source = source.replace(navAnchor, `${navAnchor}\n${'${navItem('}\n  "Campaign Builder",\n  \`/org-campaign-builder-requests?organization_id=${'${organizationId}'}\`,\n  "campaign-builder"\n)}`);
  }
  return source;
}

if (require.main === module) {
  const file = path.join(__dirname, "server.js");
  const before = fs.readFileSync(file, "utf8");
  const after = install(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log("Marketplace Campaign Builder installed.");
}

module.exports = { install };
