"use strict";
const fs=require("node:fs"),path=require("node:path");
function install(source){const line='const { registerGoogleAnalyticsRoutes } = require("./google-analytics-routes");',anchor='const { registerGoogleAdsReadOnlyRoutes } = require("./google-ads-readonly-routes");';if(!source.includes(line)){if(!source.includes(anchor))throw Error("GA4 import anchor missing");source=source.replace(anchor,anchor+"\n"+line);}const registration="registerGoogleAnalyticsRoutes({app,q,pool,page,requireLogin});";if(!source.includes(registration)){const route="registerGoogleAdsReadOnlyRoutes({app,q,pool,page,requireLogin});";if(!source.includes(route))throw Error("GA4 route anchor missing");source=source.replace(route,route+"\n"+registration);}return source;}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));}
module.exports={install};
