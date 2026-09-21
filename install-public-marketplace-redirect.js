const fs = require("fs");
const path = require("path");

function install(source) {
  const importLine = 'const { resolvePublicMarketplaceRedirect } = require("./public-marketplace-redirect");';
  const importAnchor = 'const crypto = require("crypto");';
  if (!source.includes(importLine)) {
    if (!source.includes(importAnchor)) throw new Error("Public marketplace import anchor not found.");
    source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
  }

  const routeAnchor = '  "/org-marketplace",\n  async (req, res) => {\n    try {';
  const redirectBlock = `      const publicRedirect = await resolvePublicMarketplaceRedirect(req, q);
      if (publicRedirect) {
        if (publicRedirect.location) return res.redirect(publicRedirect.location);
        return res.status(publicRedirect.status).send(publicRedirect.message);
      }
`;
  if (!source.includes(redirectBlock)) {
    if (!source.includes(routeAnchor)) throw new Error("Public marketplace route anchor not found.");
    source = source.replace(routeAnchor, `${routeAnchor}\n${redirectBlock}`);
  }
  return source;
}

if (require.main === module) {
  const serverPath = path.join(__dirname, "server.js");
  const before = fs.readFileSync(serverPath, "utf8");
  const after = install(before);
  if (after !== before) fs.writeFileSync(serverPath, after);
  console.log("Public marketplace redirect installed.");
}

module.exports = { install };
