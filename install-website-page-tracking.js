"use strict";
const fs=require("node:fs"),path=require("node:path");
function install(source) {
  const marker="// ATTRIBUTED_WEBSITE_PAGE_TRACKING";
  if(source.includes(marker))return source;
  const anchor='app.get("/vivid-conversion.js", (req, res) => {';
  const edit='<a href="/admin/edit-campaign/${c.id}">Edit</a>';
  const form='              <form\n                id="editCampaignForm"';
  for(const target of [anchor,edit,form])if(source.split(target).length!==2)throw Error("Website tracking installer: anchor is not unique");
  source=source.replace(anchor,marker+'\nrequire("./website-page-tracking").registerWebsitePageTracking({app,q,page,requireLogin,express});\n\n'+anchor);
  source=source.replace(edit,edit+'\n  &nbsp;|&nbsp; <a href="/admin/campaign/${c.id}/website-pages">Website visits</a>');
  source=source.replace(form,'              <p><a class="btn" href="/admin/campaign/${campaign.id}/website-pages">Website page visits</a></p>\n'+form);
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));console.log("Attributed website page tracking installed.");}
module.exports={install};
