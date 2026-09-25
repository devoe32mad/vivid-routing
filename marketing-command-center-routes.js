"use strict";
const {amounts}=require("./square-production-sales");
const {canPreviewAi}=require("./ai-preview-access");
const {dateRange,renderCommandCenter}=require("./marketing-command-center");
const {dashboardEvidence}=require("./google-ads-readonly-store");
const {configuration}=require("./google-ads-readonly");
const {dashboardEvidence:metaDashboardEvidence}=require("./meta-ads-store");
const {configuration:metaConfiguration}=require("./meta-ads-readonly");
const {dashboardEvidence:linkedinDashboardEvidence}=require("./linkedin-ads-store");
const {configuration:linkedinConfiguration}=require("./linkedin-ads-readonly");
function registerMarketingCommandCenterRoutes({app,q,page,orgPage,organizationNav,requireLogin,requireOrganizationPermission,getOrganizationScope,env=process.env}) {
  async function loadCampaigns(scope,range) {
    const enterprise=scope.kind==="enterprise";
    const params=enterprise?[scope.orgId,scope.advertiserId,range.from,range.to]:[scope.userId,range.from,range.to];
    const first=enterprise?3:2;
    // Ownership is fixed server-side, including for platform administrators.
    // Square projections are a subset of Vivid events, never another source total.
    return (await q(`SELECT c.id,c.name,
      COUNT(e.id) FILTER(WHERE e.type='scan')::int scans,
      COUNT(e.id) FILTER(WHERE e.type IN('offer','maps','waze','destination_click'))::int clicks,
      COUNT(e.id) FILTER(WHERE e.type='conversion')::int conversions,
      COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion'),0) conversion_value,
      COUNT(e.id) FILTER(WHERE e.type='conversion' AND to_jsonb(e)->>'square_payment_key' IS NOT NULL)::int square_conversions,
      COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion' AND to_jsonb(e)->>'square_payment_key' IS NOT NULL),0) square_value
      FROM campaigns c LEFT JOIN events e ON e.campaign_id=c.id
      AND e.created_at >= $${first}::date AND e.created_at < ($${first+1}::date + INTERVAL '1 day')
      WHERE ${enterprise?"c.organization_id=$1 AND c.advertiser_id=$2":"c.user_id=$1"} AND COALESCE(c.is_test,false)=false
      GROUP BY c.id,c.name ORDER BY conversions DESC,clicks DESC,c.id`,params)).rows;
  }
  async function squareStatus(id,range) {
    if(env.SQUARE_PRODUCTION_ENABLED!=="true")return "Not enabled";
    try {
      const row=(await q("SELECT expires_at FROM square_production_connections WHERE customer_id=$1",[id])).rows[0];
      if(!row)return "Not connected";
      let state;
      try{state=(await q("SELECT status,last_success FROM square_production_sync WHERE customer_id=$1",[id])).rows[0];}
      catch(error){if(error.code!=="42P01")throw error;}
      const label=env.SQUARE_PRODUCTION_AUTO_SYNC==="false"?"Automatic sync disabled":state?.status==="retry"?"Sync needs attention · retry scheduled":state?.status==="syncing"?"Syncing sales and refunds":"Automatic sync every 5 minutes";
      let totals=null;
      try {
        const payments=(await q(`SELECT l.payment,l.refunds FROM square_production_ledger l
          JOIN square_production_connections c USING(customer_id,merchant_id)
          WHERE l.customer_id=$1 AND (l.payment->>'created_at')::timestamptz >= $2::date
          AND (l.payment->>'created_at')::timestamptz < ($3::date+INTERVAL '1 day')`,[id,range.from,range.to])).rows;
        if(state?.last_success || payments.length) {
          const groups=new Map();
          for(const {payment,refunds} of payments) {
            if(payment.status!=="COMPLETED")continue;
            const code=payment.total.currency, a=amounts(payment,refunds||[]);
            if(!groups.has(code))groups.set(code,{currency:code,payments:0,gross:0,refunded:0,net:0});
            const g=groups.get(code);g.payments++;for(const k of ["gross","refunded","net"])g[k]+=a[k];
          }
          totals=[...groups.values()];
        }
      } catch(error) {if(error.code!=="42P01")throw error;}
      return {label,connected:true,lastSuccess:state?.last_success,totals};
    } catch(error) {
      if(error.code==="42P01")return "Not connected";
      throw error;
    }
  }
  const validId=x=>Number.isSafeInteger(Number(x)) && Number(x)>0;
  const handle=fn=>async(req,res)=>{
    let range;
    try{
      range=dateRange(req.query);
      if(req.query.platform!==undefined && !["vivid","square","google_ads","meta","linkedin"].includes(req.query.platform))return res.status(400).send("Choose a supported platform.");
      if(req.query.campaign!==undefined && (typeof req.query.campaign!=="string" || !/^\d+(?::\d+)?$/.test(req.query.campaign)))return res.status(400).send("Choose a valid campaign.");
    }catch(error){return res.status(400).send(error.message);}
    try{await fn(req,res,range);}catch(error){console.error("MARKETING COMMAND CENTER ERROR",error.code||error.name);res.status(500).send("Unable to load marketing evidence. Please try again.");}
  };
  app.get("/admin/marketing-command-center",requireLogin,handle(async(req,res,range)=>{
    if(!validId(req.session?.user?.id))return res.status(403).send("Account required.");
    const user=req.session.user, ownId=Number(user.id);
    const canSelect=String(user.role||"").toLowerCase()==="super_admin";
    const requested=req.query.account;
    if(requested!==undefined && (typeof requested!=="string" || !/^[1-9]\d*$/.test(requested) || !validId(requested)))return res.status(400).send("Choose a valid account.");
    if(!canSelect && requested!==undefined && Number(requested)!==ownId)return res.status(403).send("Account access denied.");
    const accounts=canSelect?(await q("SELECT id,name FROM users WHERE role='customer' OR id=$1 ORDER BY name,id",[ownId])).rows:[];
    let selectedId=canSelect?Number(requested ?? req.session.marketingAccountId ?? ownId):ownId;
    if(selectedId!==ownId && !accounts.some(a=>Number(a.id)===selectedId)) {
      if(requested!==undefined)return res.status(404).send("Account not found.");
      selectedId=ownId;
    }
    const scope={kind:"advertiser",userId:selectedId,accountSelection:canSelect,
      accountName:accounts.find(a=>Number(a.id)===selectedId)?.name || user.name || "Your account",
      accounts,privateAdsAllowed:selectedId===ownId};
    if(!scope.privateAdsAllowed && ["google_ads","meta"].includes(req.query.platform))return res.status(403).send("Private ad accounts are available in your own account view.");
    if(canSelect)req.session.marketingAccountId=selectedId;
    let googleEnabled=false;
    if(env.GOOGLE_ADS_OBSERVATION_ENABLED==="true"){
      try{configuration(env);googleEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let metaEnabled=false;
    if(env.META_ADS_OBSERVATION_ENABLED==="true"){
      try{metaConfiguration(env);metaEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let linkedinEnabled=false;
    if(env.LINKEDIN_ADS_OBSERVATION_ENABLED==="true"){
      try{linkedinConfiguration(env);linkedinEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    const [campaigns,status,googleEvidence,metaEvidence,linkedinEvidence]=await Promise.all([loadCampaigns(scope,range),squareStatus(scope.userId,range),
      googleEnabled&&scope.privateAdsAllowed?dashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      metaEnabled&&scope.privateAdsAllowed?metaDashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      linkedinDashboardEvidence(q,scope.userId,range)]);
    if(canSelect&&!(linkedinEvidence?.connections||[]).length)try{const assignments=(await q("SELECT owner_user_id,dashboard_user_id,COUNT(*)::int connections FROM linkedin_ads_private_connections GROUP BY owner_user_id,dashboard_user_id ORDER BY owner_user_id,dashboard_user_id")).rows;console.log("linkedin_dashboard_assignment_mismatch "+JSON.stringify({selectedId,ownId,privateAdsAllowed:scope.privateAdsAllowed,assignments}));}catch(error){if(error.code!=="42P01"&&error.code!=="42703")throw error;}
    res.set?.("Cache-Control","no-store");
    res.send(page("Marketing Command Center",renderCommandCenter({aiVisible:canPreviewAi(req.session),title:"Your marketing, together",scope,range,campaigns,squareStatus:status,googleEvidence,googleEnabled,googleAutoSync:env.GOOGLE_ADS_AUTO_SYNC!=="false",metaEvidence,metaEnabled,metaAutoSync:env.META_ADS_AUTO_SYNC!=="false",linkedinEvidence,linkedinEnabled,linkedinAutoSync:env.LINKEDIN_ADS_AUTO_SYNC!=="false",platform:req.query.platform||"",campaign:req.query.campaign||""})));
  }));
  app.get("/org-marketing-command-center/advertiser/:advertiserId",requireOrganizationPermission("manage_advertisers"),handle(async(req,res,range)=>{
    if(["google_ads","meta","linkedin"].includes(req.query.platform))return res.status(403).send("Private advertising accounts are only available in their owner’s dashboard.");
    const authorized=await getOrganizationScope(req);
    if(!validId(authorized?.organizationId)||!validId(req.params.advertiserId))return res.status(404).send("Advertiser not found.");
    const scope={kind:"enterprise",orgId:Number(authorized.organizationId),advertiserId:Number(req.params.advertiserId)};
    const advertiser=(await q(`SELECT a.id,a.name,o.name organization_name FROM advertisers a JOIN organizations o ON o.id=a.organization_id
      WHERE a.id=$1 AND a.organization_id=$2 AND COALESCE(a.is_active,true)=true`,[scope.advertiserId,scope.orgId])).rows[0];
    if(!advertiser)return res.status(404).send("Advertiser not found.");
    const campaigns=await loadCampaigns(scope,range);
    res.send(orgPage("Marketing Command Center",organizationNav({organizationId:scope.orgId,organizationName:advertiser.organization_name,activePage:"ai-readiness",userName:(req.session.orgUser||req.session.user)?.name||""})+
      renderCommandCenter({aiVisible:canPreviewAi(req.session,req),title:advertiser.name,scope,range,campaigns,squareStatus:"Only shared campaign conversions",platform:req.query.platform||"",campaign:req.query.campaign||""})));
  }));
}
module.exports={registerMarketingCommandCenterRoutes};
