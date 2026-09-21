"use strict";
const fs=require("fs"),path=require("path");
function install(source){
  const importLine='const { registerAiReadinessRoutes } = require("./ai-readiness-routes");';
  const importAnchor=`const {
  registerAiCampaignOperatorRoutes
} = require("./ai-campaign-operator-routes");`;
  if(!source.includes(importLine)){if(!source.includes(importAnchor))throw new Error("AI readiness import anchor not found.");source=source.replace(importAnchor,`${importAnchor}\n${importLine}`);}
  const marker='registerAiReadinessRoutes({';
  const anchor=`registerAiCampaignOperatorRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  requireOrganizationPermission,
  getOrganizationScope
});`;
  const block=`${anchor}

registerAiReadinessRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  requireOrganizationPermission,
  getOrganizationScope
});`;
  if(!source.includes(marker)){if(!source.includes(anchor))throw new Error("AI readiness route anchor not found.");source=source.replace(anchor,block);}
  const adminMarker='href="/admin/ai-readiness"';
  const adminAnchor=`  <a href="/admin/ai-approval-center" style="color:white;text-decoration:none;">
    AI Approval Center
  </a>`;
  if(!source.includes(adminMarker)){if(!source.includes(adminAnchor))throw new Error("AI readiness admin navigation anchor not found.");source=source.replace(adminAnchor,`${adminAnchor}\n  <a href="/admin/ai-readiness" style="color:white;text-decoration:none;">\n    AI Readiness\n  </a>`);}
  const orgMarker='"AI Readiness",\n  `/org-ai-readiness?organization_id=${organizationId}`';
  const orgAnchor=`${'${navItem('}
  "AI Approval Center",
  \`/org-ai-approval-center?organization_id=${'${organizationId}'}\`,
  "ai-approval-center"
)}`;
  const orgBlock=`${orgAnchor}
${'${navItem('}
  "AI Readiness",
  \`/org-ai-readiness?organization_id=${'${organizationId}'}\`,
  "ai-readiness"
)}`;
  if(!source.includes(orgMarker)){if(!source.includes(orgAnchor))throw new Error("AI readiness enterprise navigation anchor not found.");source=source.replace(orgAnchor,orgBlock);}
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js"),before=fs.readFileSync(file,"utf8"),after=install(before);if(after!==before)fs.writeFileSync(file,after);console.log("AI Readiness Center installed.");}
module.exports={install};
