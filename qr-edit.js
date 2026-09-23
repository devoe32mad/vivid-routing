"use strict";
const crypto = require("node:crypto");
const {validDate} = require("./assignment-edit");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validId = value => typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value)>0;
function renderQrEdit({qr,spaces,csrf,saved=false,error=""}) {
  return `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Edit QR Code</h1></div>
  <main class="wrap"><a href="/my-setup">← My Setup</a>
  ${saved?'<p role="status">QR changes saved.</p>':""}
  ${error?`<p role="alert">${esc(error)}</p>`:""}
  <form method="post" action="/admin/edit-qr/${Number(qr.id)}">
    <input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="version" value="${esc(qr.version)}">
    <label for="qr-name">Advertising Placement Name</label><input id="qr-name" name="name" value="${esc(qr.name)}">
    ${qr.is_imported?`<label for="qr-destination">Current Destination URL</label><input id="qr-destination" value="${esc(qr.description)}" readonly>`:""}
    <label for="qr-space">Location</label><select id="qr-space" name="space_id">
    ${spaces.map(s=>`<option value="${Number(s.id)}" ${Number(s.id)===Number(qr.space_id)?"selected":""}>${esc(s.name || "Location")} - ${esc(s.location)}</option>`).join("")}</select>
    <label for="qr-live-date">Live Date</label><input id="qr-live-date" name="live_date" type="date" value="${esc(qr.live_date_text || "")}">
    <p>The date this placement starts. Changing it updates days in market and related assignment cost calculations.</p>
    <p>Current end date: <strong>${esc(qr.end_date_text || "No end date")}</strong>.</p>
    <p>The QR code, destination, campaign links and schedule settings stay the same. Campaign and location dates can still affect the dates shown in My Setup.</p>
    <button class="btn" type="submit">Save QR</button> <a href="/my-setup">Cancel</a>
  </form></main>`;
}
function registerQrEditRoutes({app,q,page,requireLogin}) {
  const path="/admin/edit-qr/:qrId";
  const actor=req=>[req.session.user.role==="super_admin",Number(req.session.user.id)];
  const checkId=(req,res,next)=>validId(req.params.qrId)?next():res.status(400).send("Valid QR ID required.");
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){console.error("QR EDIT ERROR",error);res.status(500).send("Unable to save QR changes. Please try again.");}};
  const load=async req=>(await q(`SELECT qr.*,qr.live_date::date::text AS live_date_text,qr.end_date::date::text AS end_date_text,qr.xmin::text AS version
    FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id
    WHERE qr.id=$1 AND ($2::boolean OR s.user_id=$3)`,[Number(req.params.qrId),...actor(req)])).rows[0];
  async function show(req,res,qr,options={}) {
    const spaces=(await q("SELECT id,name,location FROM spaces WHERE ($1::boolean OR user_id=$2) ORDER BY id",actor(req))).rows;
    req.session.qrEditCsrf ||= crypto.randomBytes(32).toString("hex");
    res.set("Cache-Control","no-store");
    return res.send(page("Edit QR",renderQrEdit({qr,spaces,csrf:req.session.qrEditCsrf,...options})));
  }
  app.get(path,requireLogin,checkId,handle(async(req,res)=>{
    const qr=await load(req);if(!qr)return res.status(404).send("QR not found or access denied.");
    return show(req,res,qr,{saved:req.query.saved==="1"});
  }));
  app.post(path,requireLogin,checkId,handle(async(req,res)=>{
    const token=req.body?.csrf,expected=req.session.qrEditCsrf;
    if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)||typeof expected!=="string"||token.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return res.status(403).send("This form has expired. Reload the QR editor and try again.");
    const qr=await load(req);if(!qr)return res.status(404).send("QR not found or access denied.");
    const {name,space_id,live_date,version}=req.body;
    const reject=(code,error)=>show(req,res.status(code),qr,{error});
    if(typeof name!=="string"||!validId(space_id))return reject(400,"Enter a placement name and choose a valid location.");
    // Preserve an existing unset date, but do not silently erase a configured date.
    if(!(live_date===""&&!qr.live_date_text)&&!validDate(live_date))return reject(400,"Choose a valid live date.");
    if(qr.end_date_text&&live_date>qr.end_date_text)return reject(400,"Live date must be on or before the current end date.");
    if(typeof version!=="string"||version!==qr.version)return reject(409,"This QR changed after you opened it. Review its current settings and save again.");
    const updated=await q(`UPDATE qr_codes qr SET name=$2,space_id=$3,live_date=NULLIF($4,'')::date
      FROM spaces current_space,spaces destination
      WHERE qr.id=$1 AND qr.xmin::text=$5 AND current_space.id=qr.space_id AND destination.id=$3
        AND ($6::boolean OR (current_space.user_id=$7 AND destination.user_id=$7))
      RETURNING qr.id`,[Number(qr.id),name,Number(space_id),live_date,version,...actor(req)]);
    if(!updated.rows.length)return res.status(409).send("This QR or its location changed, or the selected location is unavailable. Reload the editor and try again.");
    return res.redirect(303,`/admin/edit-qr/${Number(qr.id)}?saved=1`);
  }));
}
module.exports={renderQrEdit,registerQrEditRoutes};
