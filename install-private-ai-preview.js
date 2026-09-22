"use strict";
const fs = require("fs"), path = require("path");
const RENDERERS = ["renderOrganizationIntelligence", "renderCampaignIntelligence", "renderAdvertiserIntelligence", "renderAskVivid", "renderComparativeIntelligence", "renderRenewalPricingRecommendations", "renderVividBenchmark", "renderPriorityCenter"];
function install(source) {
  const marker = '// PRIVATE_AI_PREVIEW_ACCESS';
  if (source.includes(marker)) return source;
  for (const name of RENDERERS) {
    const pattern = new RegExp('(^  )' + name + '(,?\\r?\\n)', 'm');
    if (!pattern.test(source)) throw Error(`Private AI preview: missing renderer import ${name}`);
    source = source.replace(pattern, `$1${name}: ${name}Unrestricted$2`);
  }
  const anchor = '/*\n=========================================================\nDISABLED PUBLIC MAINTENANCE ROUTES';
  if (!source.includes(anchor)) throw Error("Private AI preview: session middleware anchor not found");
  const block = `${marker}
const {aiPreviewMiddleware, aiPreviewEnabled, previewRenderer} = require("./ai-preview-access");
${RENDERERS.map(name => `const ${name} = previewRenderer(${name}Unrestricted);`).join('\n')}
app.use(aiPreviewMiddleware);

`;
  // The legacy performance pages also contain executive interpretation cards.
  // Gate those cards, preserving the surrounding measured scorecards/rankings.
  const sections = [
    ["<!-- WHAT VIVID SEES -->", "\n\n              </div>\n\n            </div>\n          `"],
    ["<!-- =========================================\n     WHAT VIVID SEES\n========================================== -->", "\n</div>\n\n        </div>"]
  ];
  for (const [startMarker, endMarker] of sections) {
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw Error("Private AI preview: executive interpretation section not found");
    source = source.slice(0,start) + '${aiPreviewEnabled()?`' + source.slice(start,end) + '`:""}' + source.slice(end);
  }
  return source.replace(anchor, block + anchor)
    .replaceAll("Run Reports and AI Insights", "Run Reports and Performance Insights")
    .replaceAll("Reports & AI Insights", "Reports & Performance Insights")
    .replaceAll('>AI Insights</a>', '>Performance Insights</a>');
}
if (require.main === module) {
  const file = path.join(__dirname, "server.js");
  fs.writeFileSync(file, install(fs.readFileSync(file,"utf8")));
  console.log("Private AI preview access installed.");
}
module.exports = {install, RENDERERS};
