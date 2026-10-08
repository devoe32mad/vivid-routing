"use strict";
const fs=require("fs"),path=require("path");
const MARKER="// HFHS_CARD_ROUTE_REGISTERED_V1";
function install(source){
 if(source.includes(MARKER))return source;
 const anchor='  "/advertise/:slug",';
 const pos=source.indexOf(anchor);
 if(pos<0)throw new Error("Generic marketplace route anchor not found");
 const appGet=source.lastIndexOf("app.get(",pos);
 if(appGet<0)throw new Error("Generic marketplace app.get not found");
 const line=`${MARKER}\nrequire("./hfhs-marketplace-route")(app,{q,escapeHtml});\n`;
 return source.slice(0,appGet)+line+source.slice(appGet);
}
if(require.main===module){try{const f=path.join(__dirname,"server.js"),s=fs.readFileSync(f,"utf8"),n=require("./install-hfhs-report-scope").install(require("./hfhs-demo-setup-scope").install(install(s)));if(n!==s)fs.writeFileSync(f,n);console.log("HFHS card route installed.");}catch(e){console.error("HFHS card route install skipped:",e.message);}}
module.exports={install};