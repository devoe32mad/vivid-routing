"use strict";
const fs=require("node:fs"),path=require("node:path");
function install(source){
  const marker='// ASSIGNMENT_DATE_EDIT';
  if(source.includes(marker))return source;
  const route='app.get("/my-setup", requireLogin, async (req, res) => {';
  const archive='<a href="/admin/archive-assignment/${a.id}">Archive</a>';
  const date='<td>${dateLabel(a.effective_start_date)}</td>';
  for(const anchor of [route,archive,date])if(source.split(anchor).length!==2)throw Error("Assignment date edit: expected one anchor: "+anchor);
  source=source.replace(route,`${marker}\nrequire("./assignment-edit").registerAssignmentEditRoutes({app,q,page,requireLogin});\n${route}`);
  source=source.replace(archive,'<a href="/admin/edit-assignment/${a.id}">Edit</a> &nbsp;|&nbsp; '+archive);
  source=source.replace(date,'<td>${dateLabel(a.effective_start_date)}<br><small>Assignment: ${dateLabel(a.started_at || a.assigned_at)}</small></td>');
  const heading='<h2>Active Campaign Assignments</h2>';
  source=source.replace(heading,heading+'\n<p>The start shown is the latest assignment, QR or campaign start. Use Edit to change an existing assignment.</p>');
  return source;
}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));console.log("Assignment date editor installed.");}
module.exports={install};
