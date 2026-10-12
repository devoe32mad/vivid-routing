"use strict";
const MARKER = "// ORG_ACTIVE_ADVERTISING_SHARED_V1";
function install(source) {
 source = installAdvertiserConversions(source);
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

function installAdvertiserConversions(source) {
 const marker='// ADVERTISER_CONVERSION_CARDS_V1';
 if(source.includes(marker))return source;
 const start=source.indexOf('  "/org-advertisers",'),end=source.indexOf('\napp.',start);
 if(start<0||end<0)throw Error('Advertiser overview route missing');
 let part=source.slice(start,end);
 const anchor='            <div style="grid-column:1/-1;" title="Total value';
 if(part.split(anchor).length!==2)throw Error('Advertiser conversion card anchor missing');
 part=part.replace(anchor,`            <div style="grid-column:1/-1;">
              <div style="font-size:10px;color:#65776b;">Conversions</div>
              <div style="font-size:16px;font-weight:bold;">
                \${Number(advertiser.conversions || 0).toLocaleString()}
              </div>
            </div>

`+anchor);
 const summary='\${advertiserSummaryCard(\n  "Revenue Generated",';
 if(part.split(summary).length!==2)throw Error('Advertiser conversion summary anchor missing');
 part=part.replace(summary,`\${advertiserSummaryCard(
  "Conversions",
  totals.conversions.toLocaleString(),
  \`/org-performance?\${advertiserDetailQuery}\`
)}

`+summary);
 return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}
