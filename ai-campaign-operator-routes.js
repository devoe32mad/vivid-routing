"use strict";

const { prepareCampaignPlan, renderOperatorPage, renderPlanCard, validateCampaignBrief } = require("./ai-campaign-operator");

function registerAiCampaignOperatorRoutes({ app, q, page, orgPage, organizationNav, requireLogin, requireOrganizationPermission, getOrganizationScope }) {
  let schemaReady = false;
  async function ensureSchema() {
    if (schemaReady) return;
    await q(`CREATE TABLE IF NOT EXISTS ai_campaign_plans (
      id BIGSERIAL PRIMARY KEY, actor_type TEXT NOT NULL, actor_id BIGINT NOT NULL,
      scope_id INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, objective TEXT NOT NULL,
      placement_id INTEGER NOT NULL, brief_json JSONB NOT NULL, plan_json JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', approved_by BIGINT, approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE INDEX IF NOT EXISTS idx_ai_campaign_plans_scope ON ai_campaign_plans(actor_type,actor_id,scope_id,status,created_at DESC)`);
    schemaReady = true;
  }

  async function placementsFor(role, actorId, scopeId, superAdmin) {
    const result = role === "enterprise"
      ? await q(`SELECT qr.id,COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id WHERE s.organization_id=$1 AND COALESCE(qr.is_archived,false)=false ORDER BY name`,[scopeId])
      : await q(superAdmin
        ? `SELECT qr.id,COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE COALESCE(qr.is_archived,false)=false ORDER BY name`
        : `SELECT qr.id,COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE s.user_id=$1 AND COALESCE(qr.is_archived,false)=false ORDER BY name`, superAdmin?[]:[actorId]);
    return result.rows;
  }

  async function placementAllowed(role, actorId, scopeId, placementId, superAdmin) {
    const result = role === "enterprise"
      ? await q(`SELECT COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id WHERE qr.id=$1 AND s.organization_id=$2`,[placementId,scopeId])
      : await q(superAdmin
        ? `SELECT COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE qr.id=$1`
        : `SELECT COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE qr.id=$1 AND s.user_id=$2`, superAdmin?[placementId]:[placementId,actorId]);
    return result.rows[0] || null;
  }

  async function loadPlans(actorType, actorId, scopeId) {
    await ensureSchema();
    const result = actorType === "enterprise"
      ? await q(`SELECT * FROM ai_campaign_plans WHERE actor_type='enterprise' AND scope_id=$1 ORDER BY created_at DESC LIMIT 25`,[scopeId])
      : await q(`SELECT * FROM ai_campaign_plans WHERE actor_type=$1 AND actor_id=$2 AND scope_id=$3 ORDER BY created_at DESC LIMIT 25`,[actorType,actorId,scopeId]);
    return result.rows;
  }

  async function prepare(req,res,role,actorId,scopeId,superAdmin,redirectBase) {
    await ensureSchema();
    const checked = validateCampaignBrief({name:req.body.name,objective:req.body.objective,audience:req.body.audience,offer:req.body.offer,placementId:req.body.placement_id,startDate:req.body.start_date,endDate:req.body.end_date,budget:req.body.budget,eventNotes:req.body.event_notes});
    if (!checked.valid) return res.status(400).send(checked.errors.join(" "));
    const placement = await placementAllowed(role,actorId,scopeId,checked.value.placementId,superAdmin);
    if (!placement) return res.status(403).send("You do not have access to that placement.");
    const evidenceResult = await q(`SELECT COUNT(*) FILTER(WHERE type='scan')::int scans,COUNT(*) FILTER(WHERE type IN('offer','maps','waze','destination_click'))::int clicks,COUNT(*) FILTER(WHERE type='conversion')::int conversions FROM events WHERE qr_id=$1 AND created_at>=CURRENT_TIMESTAMP-INTERVAL '90 days'`,[checked.value.placementId]);
    const evidence = evidenceResult.rows[0] || {};
    const ownership = role === 'enterprise' ? `s.organization_id=$2` : (superAdmin ? `TRUE` : `c.user_id=$2`);
    const ownerValue = role === 'enterprise' ? scopeId : actorId;
    const comparableResult = await q(`
      SELECT c.id,c.name,COALESCE(NULLIF(qr.name,''),s.name,'Placement '||qr.id) placement,
        COUNT(*) FILTER(WHERE e.type='scan')::int scans,
        COUNT(*) FILTER(WHERE e.type IN('offer','maps','waze','destination_click'))::int clicks,
        COUNT(*) FILTER(WHERE e.type='conversion')::int conversions,
        CASE WHEN e.qr_id=$1 THEN 'same_placement' ELSE 'account' END source
      FROM events e JOIN campaigns c ON c.id=e.campaign_id JOIN qr_codes qr ON qr.id=e.qr_id LEFT JOIN spaces s ON s.id=qr.space_id
      WHERE ${ownership} AND e.created_at>=CURRENT_TIMESTAMP-INTERVAL '365 days'
      GROUP BY c.id,c.name,qr.id,qr.name,s.name,e.qr_id
      HAVING COUNT(*) FILTER(WHERE e.type='scan')>=10
      ORDER BY CASE WHEN e.qr_id=$1 THEN 0 ELSE 1 END,
        (COUNT(*) FILTER(WHERE e.type IN('offer','maps','waze','destination_click')))::numeric/NULLIF(COUNT(*) FILTER(WHERE e.type='scan'),0) DESC,
        COUNT(*) FILTER(WHERE e.type='conversion') DESC LIMIT 3`, superAdmin?[checked.value.placementId]:[checked.value.placementId,ownerValue]);
    const cohortResult = await q(`
      WITH campaign_metrics AS (
        SELECT s.organization_id,c.id,
          COUNT(*) FILTER(WHERE e.type='scan')::int scans,
          COUNT(*) FILTER(WHERE e.type IN('offer','maps','waze','destination_click'))::int clicks,
          COUNT(*) FILTER(WHERE e.type='conversion')::int conversions
        FROM events e JOIN campaigns c ON c.id=e.campaign_id JOIN qr_codes qr ON qr.id=e.qr_id JOIN spaces s ON s.id=qr.space_id
        WHERE e.created_at>=CURRENT_TIMESTAMP-INTERVAL '365 days'
        GROUP BY s.organization_id,c.id HAVING COUNT(*) FILTER(WHERE e.type='scan')>=10
      ) SELECT COUNT(DISTINCT organization_id)::int organizations,COUNT(*)::int campaigns,
          SUM(scans)::int scans,SUM(clicks)::int clicks,SUM(conversions)::int conversions
        FROM campaign_metrics`);
    const cohort = cohortResult.rows[0] || {};
    const benchmark = Number(cohort.organizations||0)>=10 && Number(cohort.campaigns||0)>=30 ? cohort : null;
    const plan = prepareCampaignPlan(checked.value,{placementName:placement.name,metrics:evidence,comparables:comparableResult.rows,benchmark,evidence:`The selected placement recorded ${Number(evidence.scans||0)} scans, ${Number(evidence.clicks||0)} clicks and ${Number(evidence.conversions||0)} conversions in the last 90 days.`});
    await q(`INSERT INTO ai_campaign_plans(actor_type,actor_id,scope_id,name,objective,placement_id,brief_json,plan_json,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'pending')`,[role,actorId,scopeId,checked.value.name,checked.value.objective,checked.value.placementId,JSON.stringify(checked.value),JSON.stringify(plan)]);
    res.redirect(`${redirectBase}${redirectBase.includes("?")?"&":"?"}prepared=1`);
  }

  async function decide(req,res,role,actorId,scopeId,returnTo) {
    await ensureSchema();
    const planId=Number(req.body.plan_id||0), decision=String(req.body.decision||"");
    if (!Number.isInteger(planId)||!['approved','dismissed'].includes(decision)) return res.status(400).send("Invalid decision");
    const result = role === "enterprise"
      ? await q(`UPDATE ai_campaign_plans SET status=$1,approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END,approved_at=CASE WHEN $1='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND actor_type='enterprise' AND scope_id=$4 AND status='pending' RETURNING id`,[decision,actorId,planId,scopeId])
      : await q(`UPDATE ai_campaign_plans SET status=$1,approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END,approved_at=CASE WHEN $1='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND actor_type=$4 AND actor_id=$2 AND scope_id=$5 AND status='pending' RETURNING id`,[decision,actorId,planId,role,scopeId]);
    if(!result.rows.length)return res.status(404).send("Plan not found or already reviewed.");
    res.redirect(`${returnTo}${returnTo.includes("?")?"&":"?"}decision=${decision}`);
  }

  app.get("/admin/ai-campaign-operator",requireLogin,async(req,res)=>{try{const actor=req.session.user,id=Number(actor.id),superAdmin=actor.role==='super_admin';const [placements,plans]=await Promise.all([placementsFor('advertiser',id,0,superAdmin),loadPlans('advertiser',id,0)]);res.send(page("Vivid AI Campaign Operator",renderOperatorPage({role:'advertiser',placements,plans})));}catch(error){console.error("AI CAMPAIGN OPERATOR ERROR",error);res.status(500).send("Unable to load campaign operator");}});
  app.post("/admin/ai-campaign-operator",requireLogin,async(req,res)=>{try{const actor=req.session.user;await prepare(req,res,'advertiser',Number(actor.id),0,actor.role==='super_admin','/admin/ai-approval-center');}catch(error){console.error("AI CAMPAIGN PREPARE ERROR",error);res.status(500).send("Unable to prepare campaign");}});
  app.get("/admin/ai-approval-center",requireLogin,async(req,res)=>{try{const plans=await loadPlans('advertiser',Number(req.session.user.id),0);res.send(page("AI Approval Center",`<main class="wrap"><div class="topbar"><div class="brand">Vivid AI</div><h1>Approval Center</h1><p class="subtitle">Review AI-prepared work before anything changes.</p></div><a class="btn" href="/admin/ai-campaign-operator">Prepare Campaign</a><div style="display:grid;gap:13px;margin-top:18px;">${plans.length?plans.map(p=>renderPlanCard(p)).join(''):'<div class="card">No campaign plans are waiting for review.</div>'}</div></main>`));}catch(error){res.status(500).send("Unable to load approval center");}});
  app.post("/admin/ai-approval-center/action",requireLogin,async(req,res)=>{try{await decide(req,res,'advertiser',Number(req.session.user.id),0,'/admin/ai-approval-center');}catch(error){res.status(500).send("Unable to review plan");}});

  const requireOrgAiManager = requireOrganizationPermission("manage_advertisers");
  app.get("/org-ai-campaign-operator",requireOrgAiManager,async(req,res)=>{try{const scope=await getOrganizationScope(req),orgId=Number(scope.organizationId),actor=req.session.orgUser||req.session.user,id=Number(actor?.id||0);if(!id||!orgId)return res.status(403).send("Access denied");const org=(await q("SELECT name FROM organizations WHERE id=$1",[orgId])).rows[0];const [placements,plans]=await Promise.all([placementsFor('enterprise',id,orgId,false),loadPlans('enterprise',id,orgId)]);res.send(orgPage("Vivid AI Campaign Operator",organizationNav({organizationId:orgId,organizationName:org?.name||'Organization',activePage:'ai-approval-center',userName:actor.name||actor.email||''})+renderOperatorPage({role:'enterprise',organizationId:orgId,placements,plans})));}catch(error){console.error("ORG AI CAMPAIGN OPERATOR ERROR",error);res.status(500).send("Unable to load campaign operator");}});
  app.post("/org-ai-campaign-operator",requireOrgAiManager,async(req,res)=>{try{const scope=await getOrganizationScope(req),orgId=Number(scope.organizationId),actor=req.session.orgUser||req.session.user,id=Number(actor?.id||0);if(!id||!orgId)return res.status(403).send("Access denied");await prepare(req,res,'enterprise',id,orgId,false,`/org-ai-approval-center?organization_id=${orgId}`);}catch(error){res.status(500).send("Unable to prepare campaign");}});
  app.get("/org-ai-approval-center",requireOrgAiManager,async(req,res)=>{try{const scope=await getOrganizationScope(req),orgId=Number(scope.organizationId),actor=req.session.orgUser||req.session.user,id=Number(actor?.id||0);if(!id||!orgId)return res.status(403).send("Access denied");const org=(await q("SELECT name FROM organizations WHERE id=$1",[orgId])).rows[0],plans=await loadPlans('enterprise',id,orgId);res.send(orgPage("AI Approval Center",organizationNav({organizationId:orgId,organizationName:org?.name||'Organization',activePage:'ai-approval-center',userName:actor.name||actor.email||''})+`<main class="wrap"><div class="topbar"><div class="brand">Vivid AI</div><h1>Approval Center</h1><p class="subtitle">Review AI-prepared work before anything changes.</p></div><a class="btn" href="/org-ai-campaign-operator?organization_id=${orgId}">Prepare Campaign</a><div style="display:grid;gap:13px;margin-top:18px;">${plans.length?plans.map(p=>renderPlanCard(p,{action:'/org-ai-approval-center/action',organizationId:orgId})).join(''):'<div class="card">No campaign plans are waiting for review.</div>'}</div></main>`));}catch(error){res.status(500).send("Unable to load approval center");}});
  app.post("/org-ai-approval-center/action",requireOrgAiManager,async(req,res)=>{try{const scope=await getOrganizationScope(req),orgId=Number(scope.organizationId),actor=req.session.orgUser||req.session.user,id=Number(actor?.id||0);if(!id||!orgId)return res.status(403).send("Access denied");await decide(req,res,'enterprise',id,orgId,`/org-ai-approval-center?organization_id=${orgId}`);}catch(error){res.status(500).send("Unable to review plan");}});
}

module.exports={registerAiCampaignOperatorRoutes};
