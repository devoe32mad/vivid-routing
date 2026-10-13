'use strict';
const fs=require('fs'),path=require('path');
function once(source,from,to){if(source.split(from).length!==2)throw Error('Rubber World install anchor missing: '+from);return source.replace(from,to);}
function install(source){
 source=require("./rubber-world-native-navigation").install(source);
 source=require("./demo-session-isolation").install(source);
 source=require("./ccps-native-experience").install(source);
 const marker='// RUBBER_WORLD_DEMO_V1';if(source.includes(marker))return source;
 const entry=source.includes('require("./hfhs-review-access").register(app,{q});')?'require("./hfhs-review-access").register(app,{q});':'const disabledPublicMaintenanceRoutes =';
 source=once(source,entry,'require("./rubber-world-review").register(app,{q});\n'+entry);
 const permission='function requireOrganizationPermission(permissionKey) {\n  return async (req, res, next) => {\n    try {';
 source=once(source,permission,permission+'\n      if(req.rubberWorldReviewVerified)return next(); // Scoped read-only demo guard ran first.');
 const anchor='  "/advertise/:slug",',pos=source.indexOf(anchor),at=source.lastIndexOf('app.get(',pos);
 if(pos<0||at<0)throw Error('Rubber World marketplace registration missing');
 source=source.slice(0,at)+'require("./rubber-world-marketplace")(app,{q,escapeHtml});\n'+source.slice(at);
 return source+'\n'+marker+'\n';
}
if(require.main===module){const file=path.join(__dirname,'server.js');fs.writeFileSync(file,install(fs.readFileSync(file,'utf8')));console.log('Rubber World demo routes installed.');}
module.exports={install};
