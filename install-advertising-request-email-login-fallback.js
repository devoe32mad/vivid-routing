"use strict";

const fs = require("fs");
const path = require("path");

function install(source) {
  const marker = "// ADVERTISING_REQUEST_EMAIL_LOGIN_FALLBACK_V2";
  if (source.includes(marker)) return source;

  const oldBlock = `
      if (
        !organizationId &&
        !req.session.user &&
        !req.session.orgUser &&
        Number.isInteger(requestedOrganizationId) &&
        requestedOrganizationId > 0
      ) {
        const returnTo =
          \`/org-advertising-request/\${requestId}?organization_id=\${requestedOrganizationId}\`;

        return res.redirect(
          303,
          \`/org-login?organization_id=\${requestedOrganizationId}&return_to=\${encodeURIComponent(returnTo)}\`
        );
      }
`;

  const newBlock = `
      // ADVERTISING_REQUEST_EMAIL_LOGIN_FALLBACK_V2
      if (
        Number.isInteger(requestedOrganizationId) &&
        requestedOrganizationId > 0 &&
        (
          !Number.isInteger(organizationId) ||
          organizationId <= 0 ||
          organizationId !== requestedOrganizationId
        )
      ) {
        const returnTo =
          \`/org-advertising-request/\${requestId}?organization_id=\${requestedOrganizationId}\`;

        return res.redirect(
          303,
          \`/org-login?organization_id=\${requestedOrganizationId}&return_to=\${encodeURIComponent(returnTo)}\`
        );
      }
`;

  if (!source.includes(oldBlock)) {
    throw new Error("Advertising request email login fallback anchor not found.");
  }

  return source.replace(oldBlock, newBlock);
}

if (require.main === module) {
  const file = path.join(__dirname, "server.js");
  const before = fs.readFileSync(file, "utf8");
  const after = install(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log("Advertising request email login fallback installed.");
}

module.exports = { install };
