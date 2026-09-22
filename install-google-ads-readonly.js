"use strict";
const fs = require("node:fs"), path = require("node:path");
function install(source) {
  const line = 'const { registerGoogleAdsReadOnlyRoutes } = require("./google-ads-readonly-routes");';
  const anchor = 'const { registerMarketingCommandCenterRoutes } = require("./marketing-command-center-routes");';
  if(!source.includes(line)) {
    if(!source.includes(anchor)) throw Error("Google read-only import anchor missing");
    source = source.replace(anchor,anchor+"\n"+line);
  }
  const registration = "registerGoogleAdsReadOnlyRoutes({app,q,pool,page,requireLogin});";
  if(!source.includes(registration)) {
    const route = "registerMarketingCommandCenterRoutes({";
    if(!source.includes(route)) throw Error("Google read-only route anchor missing");
    source = source.replace(route,registration+"\n\n"+route);
  }
  return source;
}
if(require.main===module) {
  const file = path.join(__dirname,"server.js");
  fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));
}
module.exports = {install};
