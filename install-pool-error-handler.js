"use strict";
const fs = require("node:fs");
const path = require("node:path");
const handler = `// pg removes disconnected idle clients; future queries can reconnect.
pool.on("error", error => {
  console.error("postgres_idle_client_error", { code: error.code || "unknown" });
});

`;
function install(source) {
  if (source.includes('"postgres_idle_client_error"')) return source;
  const anchor = 'app.set("trust proxy", 1);';
  if (!source.includes(anchor)) throw Error("Pool error handler anchor missing");
  return source.replace(anchor, handler + anchor);
}
if (require.main === module) {
  const file = path.join(__dirname, "server.js");
  fs.writeFileSync(file, install(fs.readFileSync(file, "utf8")));
}
module.exports = {install};
