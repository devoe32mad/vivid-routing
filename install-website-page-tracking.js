"use strict";
const fs=require("node:fs"),path=require("node:path");
function install(source) {
  const marker="// ATTRIBUTED_WEBSITE_PAGE_TRACKING";
  if(!source.includes(marker)) {
  const anchor='app.get("/vivid-conversion.js", (req, res) => {';
  const edit='<a href="/admin/edit-campaign/${c.id}">Edit</a>';
  const form='              <form\n                id="editCampaignForm"';
  for(const target of [anchor,edit,form])if(source.split(target).length!==2)throw Error("Website tracking installer: anchor is not unique");
  source=source.replace(anchor,marker+'\nrequire("./website-page-tracking").registerWebsitePageTracking({app,q,page,requireLogin,express});\n\n'+anchor);
  source=source.replace(edit,edit+'\n  &nbsp;|&nbsp; <a href="/admin/campaign/${c.id}/website-pages">Website visits</a>');
  source=source.replace(form,'              <p><a class="btn" href="/admin/campaign/${campaign.id}/website-pages">Website page visits</a></p>\n'+form);
  }
  const setupMarker="// MY_SETUP_WEBSITE_TRACKING";
  if(!source.includes(setupMarker)) {
    const route='app.get("/my-setup", requireLogin, async (req, res) => {';
    const from=source.indexOf(route),to=source.indexOf('\napp.',from+route.length);
    if(from<0||to<0)throw Error("Website tracking: My Setup route missing");
    let setup=source.slice(from,to);
    const render='    res.send(page("My Setup", `';
    const schedules='<h2>Schedules</h2>';
    const campaignButton='    + New Campaign\n  </a>';
    for(const target of [render,schedules,campaignButton])if(setup.split(target).length!==2)throw Error("Website tracking: My Setup anchor is not unique");
    setup=setup.replace(render,setupMarker+'\n    const websiteTrackingSection = await require("./website-page-tracking").mySetupWebsiteTracking({q,user:currentUser,campaigns:campaigns.rows});\n'+render);
    setup=setup.replace(schedules,'${websiteTrackingSection}\n\n'+schedules);
    setup=setup.replace(campaignButton,campaignButton+'\n  <a class="btn secondary" href="#website-page-tracking">Website Page Tracking</a>');
    source=source.slice(0,from)+setup+source.slice(to);
  }
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));console.log("Attributed website page tracking installed.");}
module.exports={install};
