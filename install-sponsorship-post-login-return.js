"use strict";
const fs=require("fs");
const path=require("path");

function install(source){
  const marker="// SPONSORSHIP_POST_LOGIN_RETURN_V1";
  if(source.includes(marker)) return source;

  const loginStart=source.indexOf('app.post("/login"');
  if(loginStart<0) throw new Error("Login route anchor not found.");

  const redirect='return res.redirect("/platform-login");';
  const redirectPos=source.indexOf(redirect,loginStart);
  if(redirectPos<0) throw new Error("Platform login redirect anchor not found.");

  const replacement=marker+`
const afterLoginReturn = String(req.session.afterLoginReturn || "").trim();
if (afterLoginReturn === "/admin/sponsorship-performance") {
  delete req.session.afterLoginReturn;
  return req.session.save(err => {
    if (err) {
      console.error("LOGIN RETURN SESSION ERROR:", err);
      return res.status(500).send("Unable to continue to Sponsorship Performance.");
    }
    return res.redirect(afterLoginReturn);
  });
}

${redirect}`;

  return source.slice(0,redirectPos)+replacement+source.slice(redirectPos+redirect.length);
}

if(require.main===module){
  const file=path.join(__dirname,"server.js");
  const before=fs.readFileSync(file,"utf8");
  const after=install(before);
  if(after!==before) fs.writeFileSync(file,after);
  console.log("Sponsorship post-login return installed.");
}
module.exports={install};
