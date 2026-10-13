'use strict';
const fs=require('fs'),path=require('path');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Responsibility install anchor missing: '+a);return s.replace(a,b);}
function install(source){
 source=require("./install-pdf-report-responsibility").install(source);
 const requestMarker='// REQUEST_CARD_DRILLDOWNS_V1';
 if(!source.includes(requestMarker)){
  const start=source.indexOf('      const requestLocationCards ='),end=source.indexOf('      const statusOptions =',start);
  if(start<0||end<0)throw Error('Request location card renderer not found');
  source=source.slice(0,start)+'      '+requestMarker+'\n      const requestLocationCards = require("./org-request-location-cards")(requestLocationSummaries, organizationId, escapeHtml);\n'+source.slice(end);
 }
 const marker='// DATABASE_RESPONSIBILITY_V1';if(source.includes(marker))return source;
 source=once(source,'const disabledPublicMaintenanceRoutes =',marker+'\nrequire("./responsibility-routes").register(app,{q,organizationNav});\nconst disabledPublicMaintenanceRoutes =');
 const nav='${navItem(\n  "Renewals",\n  `/org-renewals?organization_id=${organizationId}`,\n  "renewals"\n)}';
 source=once(source,nav,nav+'\n${navItem("Sales Rep Report", `/org-sales-reps?organization_id=${organizationId}`, "sales-reps")}');
 // Explicit inventory and renewal markers survive demo guards that hide edit links.
 const opportunity='<span class="marketplace-status">\n  ${opportunity.status}';
 source=once(source,opportunity,'<div data-responsibility-kind="opportunity" data-responsibility-id="${opportunity.id}"></div>\n  '+opportunity);
 const renewal='        return rows\n  .map(contract => `\n    <div\n      class="card"';
 source=once(source,renewal,'        return rows\n  .map(contract => `\n    <div\n      data-responsibility-contract="${contract.id}"\n      class="card"');
 const renewalTitle='const buildRenewalCards =';const start=source.indexOf(renewalTitle),end=source.indexOf('app.',start);
 let part=source.slice(start,end);const anchor='        box-sizing:border-box;';const p=part.indexOf(anchor);if(p<0)throw Error('Renewal card style missing');const close=part.indexOf('>',p);part=part.slice(0,close+1)+'\n<div data-responsibility-kind="contract" data-responsibility-id="${contract.id}"></div>'+part.slice(close+1);source=source.slice(0,start)+part+source.slice(end);
 return source;
}
async function main(){await require('./responsibility-store').migrate();const file=path.join(__dirname,'server.js');fs.writeFileSync(file,install(fs.readFileSync(file,'utf8')));console.log('Persistent responsibility and sales rep report installed.');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={install};
