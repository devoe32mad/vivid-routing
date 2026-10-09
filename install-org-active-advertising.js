"use strict";
const MARKER = "// ORG_ACTIVE_ADVERTISING_SHARED_V1";
function install(source) {
 if(source.includes(MARKER)) return source;
 const route = source.indexOf('if (metric === "active")');
 const start = source.indexOf('  /*', route);
 const end = source.indexOf('\n  const activeAdvertising =', start);
 if(route < 0 || start < 0 || end < 0) throw new Error("Active advertising query anchor missing");
 source = source.slice(0,start) + `
  ${MARKER}
  const activeScope = await getOrganizationScope(req, organizationId);
  if (activeScope.organizationId !== organizationId) return res.status(403).send("Access denied");
  const activeResult = await require("./org-active-advertising").load(q, activeScope);
` + source.slice(end);
 function replaceOnce(oldText,newText) {
  if(source.split(oldText).length !== 2) throw new Error("Active advertising anchor ambiguous: " + oldText);
  source = source.replace(oldText,newText);
 }
 replaceOnce('  const activeCampaignCount =\n    activeAdvertising.length;', '  const activeCampaignCount = require("./org-active-advertising").summarize(activeAdvertising).campaigns;');
 replaceOnce('      const totals = locations.reduce(', '      const currentActive = require("./org-active-advertising").summarize((await require("./org-active-advertising").load(q, scope)).rows);\n      const totals = locations.reduce(');
 replaceOnce('${totals.qrPlacements.toLocaleString()}', '${currentActive.placements.toLocaleString()}');
 const card = source.indexOf('Active Spots');
 const value = source.indexOf('${money(totals.placementValue)}', card);
 if(card < 0 || value < 0 || value-card > 1500) throw new Error("Active card value anchor missing");
 source = source.slice(0,value) + '${money(currentActive.value)}' + source.slice(value+'${money(totals.placementValue)}'.length);
 return source;
}
module.exports = {install};
