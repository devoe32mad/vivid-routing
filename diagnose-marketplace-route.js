"use strict";
const fs=require("fs");
const path=require("path");
const file=path.join(__dirname,"server.js");
try{const s=fs.readFileSync(file,"utf8");
const needles=["\"/advertise/:slug\"","\"/advertise/:slug/location/:locationId\"","organization_opportunities"];
for(const n of needles){const i=s.indexOf(n);if(i>=0){const excerpt=s.slice(Math.max(0,i-3500),Math.min(s.length,i+12000));console.log("MARKETPLACE ROUTE DIAGNOSTIC",n,"\n"+excerpt);}else{console.log("MARKETPLACE ROUTE DIAGNOSTIC missing",n);}}}
catch(e){console.error("MARKETPLACE ROUTE DIAGNOSTIC ERROR",e.message);}
