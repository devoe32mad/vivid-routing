"use strict";
const crypto = require("node:crypto");
const PATH = "/admin/edit-assignment/:assignmentId";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
function effectiveStart(assignment, start = assignment.start_date) {
  return [start || assignment.today, assignment.qr_start || assignment.today,
    assignment.campaign_start || assignment.campaign_live || assignment.qr_start || assignment.today].filter(Boolean).sort().at(-1);
}
function renderAssignmentEdit({assignment:a,csrf,start=a.start_date,error="",saved=false}) {
  const effective = effectiveStart(a,validDate(start)?start:a.start_date);
  return `<main class="wrap" style="max-width:850px;margin:28px auto;padding:0 18px;color:#102b50">
    <a href="/my-setup">← My Setup</a><h1>Edit Assignment</h1>
    ${saved?'<p role="status" style="padding:14px;background:#eaf7ee;border-radius:8px">Assignment start date saved.</p>':""}
    ${error?`<p role="alert" style="padding:14px;background:#fff2e7;border-radius:8px">${esc(error)}</p>`:""}
    <section class="card"><h2>${esc(a.campaign_name)}</h2><p>${esc(a.advertiser)}</p>
    <dl><dt>QR placement</dt><dd>${esc(a.qr_name)}</dd><dt>Location</dt><dd>${esc(a.location_name)}</dd><dt>Assignment end</dt><dd>${esc(a.end_date || "No end date")}</dd></dl>
    <form method="post" action="/admin/edit-assignment/${Number(a.id)}">
      <input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="version" value="${esc(a.version)}">
      <label for="assignment-start">Assignment start date</label>
      <input id="assignment-start" name="start_date" type="date" required value="${esc(start || "")}" style="display:block;padding:12px;margin:8px 0 16px;font:inherit;max-width:100%">
      <p>This updates the start date on this existing assignment. Its QR, campaign, end date and recurring or event schedules stay the same.</p>
      <p>Moving the start date also changes the assignment’s days-in-market and allocated-cost calculations.</p>
      <button class="btn" type="submit">Save start date</button> <a class="btn secondary" href="/my-setup">Cancel</a>
    </form></section>
    <section class="card" style="margin-top:18px"><h2>Related dates</h2>
      <p>Effective start in My Setup: <strong>${esc(effective)}</strong>. This uses the latest assignment, QR and campaign start date.</p>
      <p>Campaign start: ${esc(a.campaign_start || a.campaign_live || "Not set")} · <a href="/admin/edit-campaign/${Number(a.campaign_id)}">Edit campaign</a></p>
      <p>QR live date: ${esc(a.qr_start || "Not set")} · <a href="/admin/view-qr/${Number(a.qr_id)}">View QR placement</a></p>
      ${effective > start ? '<p><strong>A later related date applies.</strong> Changing this assignment alone will not move the effective start earlier than that date.</p>' : ""}
      <p>Existing schedule days, hours and event windows still apply.</p>
    </section></main>`;
}
function registerAssignmentEditRoutes({app,q,page,requireLogin}) {
  const validId = (req,res,next) => /^\d+$/.test(req.params.assignmentId || "") && Number.isSafeInteger(Number(req.params.assignmentId)) && Number(req.params.assignmentId)>0 ? next() : res.status(400).send("Valid assignment ID required.");
  const actor = req => ({id:Number(req.session.user.id),superAdmin:req.session.user.role === "super_admin"});
  async function load(req) {
    const user = actor(req);
    return (await q(`SELECT qc.id,qc.qr_id,qc.campaign_id,qc.xmin::text AS version,
      COALESCE(qc.started_at,qc.assigned_at,CURRENT_TIMESTAMP)::date::text AS start_date,
      qc.ended_at::date::text AS end_date,c.name AS campaign_name,c.advertiser,
      c.start_date::date::text AS campaign_start,c.live_date::date::text AS campaign_live,
      qr.name AS qr_name,qr.live_date::date::text AS qr_start,s.name AS location_name,CURRENT_DATE::text AS today
      FROM qr_campaigns qc JOIN campaigns c ON c.id=qc.campaign_id
      JOIN qr_codes qr ON qr.id=qc.qr_id LEFT JOIN spaces s ON s.id=qr.space_id
      WHERE qc.id=$1 AND ($2::boolean OR c.user_id=$3)
        AND COALESCE(qc.is_active,true)=true AND COALESCE(c.is_archived,false)=false`,
      [Number(req.params.assignmentId),user.superAdmin,user.id])).rows[0];
  }
  function show(req,res,assignment,options={}) {
    req.session.assignmentEditCsrf ||= crypto.randomBytes(32).toString("hex");
    res.set("Cache-Control","no-store");
    return res.send(page("Edit Assignment",renderAssignmentEdit({assignment,csrf:req.session.assignmentEditCsrf,...options})));
  }
  const handle = fn => async(req,res) => {try {await fn(req,res);} catch(error) {console.error("ASSIGNMENT DATE EDIT ERROR",error);res.status(500).send("Unable to edit this assignment. Please try again.");}};
  app.get(PATH,requireLogin,validId,handle(async(req,res)=>{
    const assignment=await load(req);
    if(!assignment)return res.status(404).send("Assignment not found or access denied.");
    show(req,res,assignment,{saved:req.query.saved==="1"});
  }));
  app.post(PATH,requireLogin,validId,handle(async(req,res)=>{
    const token=req.body?.csrf,expected=req.session.assignmentEditCsrf;
    if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)||typeof expected!=="string"||token.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return res.status(403).send("This form has expired. Reload the assignment and try again.");
    const assignment=await load(req);
    if(!assignment)return res.status(404).send("Assignment not found or access denied.");
    const start=req.body.start_date;
    if(!validDate(start))return show(req,res.status(400),assignment,{start:typeof start==="string"?start:"",error:"Choose a valid assignment start date."});
    if(assignment.end_date && start>assignment.end_date)return show(req,res.status(400),assignment,{start,error:"The start date must be on or before the existing assignment end date."});
    if(typeof req.body.version!=="string"||req.body.version!==assignment.version)return show(req,res.status(409),assignment,{error:"This assignment changed after you opened it. Review the current dates and save again."});
    const user=actor(req);
    const changed=await q(`UPDATE qr_campaigns qc SET started_at=CASE
      WHEN COALESCE(qc.started_at,qc.assigned_at)::date=$2::date THEN qc.started_at ELSE $2::date::timestamp END
      FROM campaigns c WHERE qc.id=$1 AND qc.campaign_id=c.id AND ($3::boolean OR c.user_id=$4)
        AND qc.xmin::text=$5 AND COALESCE(qc.is_active,true)=true AND COALESCE(c.is_archived,false)=false
      RETURNING qc.id`,[Number(assignment.id),start,user.superAdmin,user.id,assignment.version]);
    if(!changed.rows.length)return res.status(409).send("This assignment changed while saving. Reload it and try again.");
    res.redirect(303,`/admin/edit-assignment/${Number(assignment.id)}?saved=1`);
  }));
}
module.exports={validDate,effectiveStart,renderAssignmentEdit,registerAssignmentEditRoutes};
