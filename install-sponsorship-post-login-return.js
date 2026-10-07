"use strict";
const fs=require("fs");
const path=require("path");

function install(source){
  const marker="// SPONSORSHIP_POST_LOGIN_RETURN_V1";
  if(source.includes(marker)) {
    source=source.replace('if (afterLoginReturn === "/admin/sponsorship-performance") {',
      'if (afterLoginReturn === "/admin/sponsorship-performance" || /^\\/admin\\/(?:new-location\\?marketplace_request_id=[1-9][0-9]*|qr-setup-choice\\?space_id=[1-9][0-9]*&marketplace_request_id=[1-9][0-9]*)$/.test(afterLoginReturn)) {');
    return installMarketplaceReturn(source);
  }

  const loginStart=source.indexOf('app.post("/login"');
  if(loginStart<0) throw new Error("Login route anchor not found.");

  const redirect='return res.redirect("/platform-login");';
  const redirectPos=source.indexOf(redirect,loginStart);
  if(redirectPos<0) throw new Error("Platform login redirect anchor not found.");

  const replacement=marker+`
const afterLoginReturn = String(req.session.afterLoginReturn || "").trim();
if (afterLoginReturn === "/admin/sponsorship-performance" ||
    /^\\/admin\\/(?:new-location\\?marketplace_request_id=[1-9][0-9]*|qr-setup-choice\\?space_id=[1-9][0-9]*&marketplace_request_id=[1-9][0-9]*)$/.test(afterLoginReturn)) {
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

  return installMarketplaceReturn(source.slice(0,redirectPos)+replacement+source.slice(redirectPos+redirect.length));
}

function installMarketplaceReturn(source){
  const marker="// MARKETPLACE_LOGIN_RETURN_V1";
  if(source.includes(marker)) return source;
  const oldGuard=`function requireLogin(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login");
  }`;
  const newGuard=`function requireLogin(req, res, next) {

  if (!req.session.user) {
    ${marker}
    // Preserve only known setup destinations; ownership is checked after login.
    const requestId = String(req.query?.marketplace_request_id || "");
    const spaceId = String(req.query?.space_id || "");
    if (req.method === "GET" && /^[1-9][0-9]*$/.test(requestId)) {
      if (req.path === "/admin/new-location") {
        req.session.afterLoginReturn = \`/admin/new-location?marketplace_request_id=\${requestId}\`;
      } else if (req.path === "/admin/qr-setup-choice" && /^[1-9][0-9]*$/.test(spaceId)) {
        req.session.afterLoginReturn = \`/admin/qr-setup-choice?space_id=\${spaceId}&marketplace_request_id=\${requestId}\`;
      }
    }
    return req.session.save(err => {
      if (err) return res.status(500).send("Unable to continue to login. Please try again.");
      return res.redirect("/login");
    });
  }`;
  if(!source.includes(oldGuard)) throw new Error("Marketplace login guard anchor not found.");
  source=source.replace(oldGuard,newGuard);
  // New accounts must enter the same request-specific path as existing accounts.
  const start=source.indexOf('app.post(\n  "/vivid-account-setup/:token",');
  const end=source.indexOf('app.get(',start);
  if(start<0 || end<0) throw new Error("Marketplace password route anchor not found.");
  let route=source.slice(start,end);
  const oldRedirect='return res.redirect(\n          "/admin/new-location"\n        );';
  if(!route.includes(oldRedirect)) throw new Error("Marketplace password redirect anchor not found.");
  route=route.replace(oldRedirect,'return res.redirect(\n          `/admin/new-location?marketplace_request_id=${setup.request_id}`\n        );');
  return source.slice(0,start)+route+source.slice(end);
}

if(require.main===module){
  const file=path.join(__dirname,"server.js");
  const before=fs.readFileSync(file,"utf8");
  const after=install(before);
  if(after!==before) fs.writeFileSync(file,after);
  console.log("Sponsorship post-login return installed.");
}
module.exports={install};
