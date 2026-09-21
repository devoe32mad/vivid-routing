"use strict";
const {validateProfile,scoreReadiness,renderReadinessCenter}=require("./ai-readiness");

function registerAiReadinessRoutes({app,q,page,orgPage,organizationNav,requireLogin,requireOrganizationPermission,getOrganizationScope}){
  let schemaReady=false;
  async function ensureSchema(){if(schemaReady)return;await q(`CREATE TABLE IF NOT EXISTS ai_marketing_profiles(
    id BIGSERIAL PRIMARY KEY,actor_type TEXT NOT NULL,actor_id BIGINT NOT NULL,scope_id INTEGER NOT NULL DEFAULT 0,
    goal TEXT NOT NULL DEFAULT '',monthly_budget NUMERIC NOT NULL DEFAULT 0,target_geography TEXT NOT NULL DEFAULT '',
    target_customer TEXT NOT NULL DEFAULT '',target_metric TEXT NOT NULL DEFAULT '',target_value NUMERIC NOT NULL DEFAULT 0,
    approved_channels JSONB NOT NULL DEFAULT '[]'::jsonb,approved_offers TEXT NOT NULL DEFAULT '',prohibited_actions TEXT NOT NULL DEFAULT '',
    desired_mode TEXT NOT NULL DEFAULT 'observe',max_auto_change_pct NUMERIC NOT NULL DEFAULT 0,approval_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(actor_type,actor_id,scope_id))`);schemaReady=true;}
  const profileFrom=row=>({goal:row?.goal||"",monthlyBudget:Number(row?.monthly_budget||0),targetGeography:row?.target_geography||"",targetCustomer:row?.target_customer||"",targetMetric:row?.target_metric||"",targetValue:Number(row?.target_value||0),channels:Array.isArray(row?.approved_channels)?row.approved_channels:[],approvedOffers:row?.approved_offers||"",prohibitedActions:row?.prohibited_actions||"",desiredMode:row?.desired_mode||"observe",maxAutoChangePct:Number(row?.max_auto_change_pct||0),approvalRequired:row?row.approval_required!==false:false});
  async function loadProfile(type,actorId,scopeId){await ensureSchema();return profileFrom((await q(`SELECT * FROM ai_marketing_profiles WHERE actor_type=$1 AND actor_id=$2 AND scope_id=$3`,[type,actorId,scopeId])).rows[0]);}
  async function saveProfile(type,actorId,scopeId,value){await ensureSchema();await q(`INSERT INTO ai_marketing_profiles(actor_type,actor_id,scope_id,goal,monthly_budget,target_geography,target_customer,target_metric,target_value,approved_channels,approved_offers,prohibited_actions,desired_mode,max_auto_change_pct,approval_required)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)
    ON CONFLICT(actor_type,actor_id,scope_id) DO UPDATE SET goal=EXCLUDED.goal,monthly_budget=EXCLUDED.monthly_budget,target_geography=EXCLUDED.target_geography,target_customer=EXCLUDED.target_customer,target_metric=EXCLUDED.target_metric,target_value=EXCLUDED.target_value,approved_channels=EXCLUDED.approved_channels,approved_offers=EXCLUDED.approved_offers,prohibited_actions=EXCLUDED.prohibited_actions,desired_mode=EXCLUDED.desired_mode,max_auto_change_pct=EXCLUDED.max_auto_change_pct,approval_required=EXCLUDED.approval_required,updated_at=CURRENT_TIMESTAMP`,[type,actorId,scopeId,value.goal,value.monthlyBudget,value.targetGeography,value.targetCustomer,value.targetMetric,value.targetValue,JSON.stringify(value.channels),value.approvedOffers,value.prohibitedActions,value.desiredMode,value.maxAutoChangePct,value.approvalRequired]);}
  async function factsFor(type,ownerId,superAdmin=false){
    const owner=type==='enterprise'?`s.organization_id=$1`:(superAdmin?'TRUE':`s.user_id=$1`),params=superAdmin?[]:[ownerId];
    const result=await q(`WITH scoped_campaigns AS (
      SELECT DISTINCT c.id,c.campaign_cost FROM campaigns c JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id JOIN spaces s ON s.id=qr.space_id WHERE ${owner} AND COALESCE(c.is_test,false)=false
    ), scoped_events AS (
      SELECT e.* FROM events e JOIN qr_codes qr ON qr.id=e.qr_id JOIN spaces s ON s.id=qr.space_id WHERE ${owner}
    ) SELECT (SELECT COUNT(*) FROM scoped_campaigns)::int campaigns,
      (SELECT COUNT(*) FROM scoped_campaigns WHERE COALESCE(campaign_cost,0)>0)::int cost_campaigns,
      COUNT(*) FILTER(WHERE type='scan')::int scans,
      COUNT(*) FILTER(WHERE type IN('offer','maps','waze','destination_click'))::int clicks,
      COUNT(*) FILTER(WHERE type='conversion')::int conversions,
      COALESCE(SUM(value) FILTER(WHERE type='conversion'),0)::numeric conversion_value,
      MAX(created_at) latest_event_at,
      (SELECT COUNT(*) FROM campaign_destinations cd JOIN scoped_campaigns sc ON sc.id=cd.campaign_id WHERE COALESCE(cd.is_active,true)=true)::int destinations
      FROM scoped_events`,params);return result.rows[0]||{};
  }
  async function renderAdmin(req,res){const actor=req.session.user,actorId=Number(actor.id),superAdmin=String(actor.role)==='super_admin';const [profile,facts]=await Promise.all([loadProfile('advertiser',actorId,0),factsFor('advertiser',actorId,superAdmin)]);res.send(page("AI Readiness Center",renderReadinessCenter({profile,readiness:scoreReadiness(facts,profile),action:"/admin/ai-readiness",backHref:"/admin/ai-insights",saved:req.query.saved==='1'})));}
  app.get('/admin/ai-readiness',requireLogin,async(req,res)=>{try{await renderAdmin(req,res);}catch(error){console.error('AI READINESS ERROR',error);res.status(500).send('Unable to load AI Readiness Center.');}});
  app.post('/admin/ai-readiness',requireLogin,async(req,res)=>{try{const checked=validateProfile(req.body);if(!checked.valid)return res.status(400).send(checked.errors.join(' '));await saveProfile('advertiser',Number(req.session.user.id),0,checked.value);res.redirect('/admin/ai-readiness?saved=1');}catch(error){console.error('AI READINESS SAVE ERROR',error);res.status(500).send('Unable to save AI operating contract.');}});
  const requireOrgManager=requireOrganizationPermission('manage_advertisers');
  async function orgContext(req){const scope=await getOrganizationScope(req),orgId=Number(scope.organizationId),actor=req.session.orgUser||req.session.user,actorId=Number(actor?.id||0);if(!orgId||!actorId)throw new Error('Access denied');return{scope,orgId,actor,actorId};}
  app.get('/org-ai-readiness',requireOrgManager,async(req,res)=>{try{const c=await orgContext(req);const [org,profile,facts]=await Promise.all([q('SELECT name FROM organizations WHERE id=$1',[c.orgId]),loadProfile('enterprise',0,c.orgId),factsFor('enterprise',c.orgId)]);const name=org.rows[0]?.name||'Organization';res.send(orgPage('AI Readiness Center',organizationNav({organizationId:c.orgId,organizationName:name,activePage:'ai-readiness',userName:c.actor.name||c.actor.email||''})+renderReadinessCenter({title:`${name} AI Readiness Center`,profile,readiness:scoreReadiness(facts,profile),action:`/org-ai-readiness?organization_id=${c.orgId}`,backHref:`/org-performance?organization_id=${c.orgId}`,saved:req.query.saved==='1'})));}catch(error){console.error('ORG AI READINESS ERROR',error);res.status(500).send('Unable to load AI Readiness Center.');}});
  app.post('/org-ai-readiness',requireOrgManager,async(req,res)=>{try{const c=await orgContext(req),checked=validateProfile(req.body);if(!checked.valid)return res.status(400).send(checked.errors.join(' '));await saveProfile('enterprise',0,c.orgId,checked.value);res.redirect(`/org-ai-readiness?organization_id=${c.orgId}&saved=1`);}catch(error){console.error('ORG AI READINESS SAVE ERROR',error);res.status(500).send('Unable to save AI operating contract.');}});
}
module.exports={registerAiReadinessRoutes};
