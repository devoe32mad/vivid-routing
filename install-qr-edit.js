"use strict";
const fs=require("node:fs"),path=require("node:path");
function install(source){
  const marker="// QR_LIVE_DATE_EDITOR";
  if(source.includes(marker))return source;
  const start='app.get("/admin/edit-qr/:qrId", requireLogin, async (req, res) => {';
  const end='app.get(\n  "/admin/qr-setup-choice",';
  if(source.split(start).length!==2||source.split(end).length!==2)throw Error("QR editor: route anchors are not unique");
  const from=source.indexOf(start),to=source.indexOf(end,from);
  if(to<from)throw Error("QR editor: invalid route order");
  return source.slice(0,from)+marker+'\nrequire("./qr-edit").registerQrEditRoutes({app,q,page,requireLogin});\n'+source.slice(to);
}
if(require.main===module){const file=path.join(__dirname,"server.js");fs.writeFileSync(file,install(fs.readFileSync(file,"utf8")));console.log("QR live date editor installed.");}
module.exports={install};
