"use strict";
const fs=require("fs"),path=require("path");
function install(source){
  if(source.includes("function organizationUserManagementId(req)"))return source;
  const begin=source.indexOf("/*\n=========================================================\nADD ORGANIZATION USER FORM");
  const end=source.indexOf("  /*\n=========================================================\nEDIT ORGANIZATION USER FORM",begin);
  if(begin<0||end<0)throw new Error("Add User route markers changed");
  let part=source.slice(begin,end);
  const old=/const organizationId = Number\(\s*req\.session\.orgUser\.organization_id\s*\);/g;
  if([...part.matchAll(old)].length!==2)throw new Error("Unexpected Add User organization selectors");
  part=part.replace(old,"const organizationId = organizationUserManagementId(req);")
    .replaceAll('href="/org-users/new"','href="/org-users/new?organization_id=${organizationId}"')
    .replaceAll('href="/org-users"','href="/org-users?organization_id=${organizationId}"')
    .replace('action="/org-users"','action="/org-users?organization_id=${organizationId}"');
  return source.slice(0,begin)+"function organizationUserManagementId(req) {\n  const role = String(req.session.user?.role || \"\").trim().toLowerCase();\n  const sessionId = req.session.orgUser?.organization_id;\n  if (role === \"super_admin\" || role === \"admin\") {\n    const queryId = req.query?.organization_id;\n    const bodyId = req.body?.organization_id;\n    if (queryId !== undefined && bodyId !== undefined &&\n        Number(queryId) !== Number(bodyId)) return NaN;\n    return Number(queryId ?? bodyId ?? sessionId);\n  }\n  // Organization users cannot select another tenant through a query or form.\n  return Number(sessionId);\n}\n"+part+source.slice(end);
}
if(require.main===module){
  const file=path.join(__dirname,"server.js");
  try{const s=fs.readFileSync(file,"utf8");const next=install(s);if(next!==s)fs.writeFileSync(file,next);}
  catch(e){console.error("Organization Add User correction not applied:",e.message);}
}
module.exports={install};
