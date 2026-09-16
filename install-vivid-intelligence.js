"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "server.js");
let source = fs.readFileSync(serverPath, "utf8");

const importAnchor = 'const crypto = require("crypto");';
const importBlock = `${importAnchor}
const {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence
} = require("./vivid-intelligence");`;

const builderAnchor = `const pendingRevenue =
  Number(pendingMetricsResult.rows[0]?.pending_revenue || 0);
const locationCards = locations.map(location => \``;
const builderBlock = `const pendingRevenue =
  Number(pendingMetricsResult.rows[0]?.pending_revenue || 0);
const organizationIntelligence =
  buildOrganizationIntelligence({
    organizationId: org.id,
    organizationName: org.name,
    totals,
    locations,
    availableSpots,
    pendingSpots,
    pendingRevenue,
    advertiserCount,
    activeContracts,
    queryString: dateQueryString
  });
const locationCards = locations.map(location => \``;

const renderAnchor = `\${orgDateFilterForm({
  action: \`/org-organization/\${org.id}\`,
  fromDate,
  toDate
})}
        <div`;
const renderBlock = `\${orgDateFilterForm({
  action: \`/org-organization/\${org.id}\`,
  fromDate,
  toDate
})}
\${renderOrganizationIntelligence(
  organizationIntelligence
)}
        <div`;

const patches = [
  {
    marker: 'require("./vivid-intelligence")',
    anchor: importAnchor,
    replacement: importBlock,
    label: "module import"
  },
  {
    marker: "const organizationIntelligence =",
    anchor: builderAnchor,
    replacement: builderBlock,
    label: "organization intelligence builder"
  },
  {
    marker: "${renderOrganizationIntelligence(",
    anchor: renderAnchor,
    replacement: renderBlock,
    label: "organization intelligence panel"
  }
];

for (const patch of patches) {
  if (source.includes(patch.marker)) {
    continue;
  }

  const matches = source.split(patch.anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Unable to install ${patch.label}: expected one anchor, found ${matches}.`
    );
  }

  source = source.replace(patch.anchor, patch.replacement);
}

fs.writeFileSync(serverPath, source, "utf8");
console.log("Vivid intelligence preview installed.");
