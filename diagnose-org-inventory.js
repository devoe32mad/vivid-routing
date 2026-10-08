"use strict";
const fs=require("fs"),path=require("path");
try{
 const s=fs.readFileSync(path.join(__dirname,"server.js"),"utf8");
 const needles=["AVAILABLE INVENTORY","Inventory","organization_opportunities","/org-marketplace","/org-opportun","Pending","Sold"];
 for(const n of needles){
   let from=0,count=0;
   while(count<6){
     const i=s.indexOf(n,from); if(i<0) break;
     console.log("ORG INVENTORY DIAGNOSTIC",n,"AT",i,"\n"+s.slice(Math.max(0,i-1800),Math.min(s.length,i+5000)));
     from=i+n.length; count++;
   }
 }
}catch(e){console.error("ORG INVENTORY DIAGNOSTIC ERROR",e.message);}
