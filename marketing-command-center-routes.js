"use strict";
const {dateRange,renderCommandCenter}=require("./marketing-command-center");
const {dashboardEvidence}=require("./google-ads-readonly-store");
const {configuration}=require("./google-ads-readonly");
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
  async function squareStatus(id) {
    if(env.SQUARE_PRODUCTION_ENABLED!=="true")return "Not enabled";
    try {
      const row=(await q("SELECT expires_at FROM square_production_connections WHERE customer_id=$1",[id])).rows[0];
      if(!row)return "Not connected";
      let state;
      try{state=(await q("SELECT status,last_success FROM square_production_sync WHERE customer_id=$1",[id])).rows[0];}
      catch(error){if(error.code!=="42P01")throw error;}
      const label=env.SQUARE_PRODUCTION_AUTO_SYNC==="false"?"Automatic sync disabled":state?.status==="retry"?"Sync needs attention · retry scheduled":state?.status==="syncing"?"Syncing sales and refunds":"Automatic sync every 5 minutes";
      return {label,connected:true,lastSuccess:state?.last_success};
    } catch(error) {
      if(error.code==="42P01")return "Not connected";
      throw error;
    }
  }
  const validId=x=>Number.isSafeInteger(Number(x)) && Number(x)>0;
  const handle=fn=>async(req,res)=>{
    let range;
    try{range=dateRange(req.query);}catch(error){return res.status(400).send(error.message);}
    try{await fn(req,res,range);}catch(error){console.error("MARKETING COMMAND CENTER ERROR",error.code||error.name);res.status(500).send("Unable to load marketing evidence. Please try again.");}
  };
  app.get("/admin/marketing-command-center",requireLogin,handle(async(req,res,range)=>{
    if(!validId(req.session?.user?.id))return res.status(403).send("Account required.");
    const scope={kind:"advertiser",userId:Number(req.session.user.id)};
    let googleEnabled=false;
    if(env.GOOGLE_ADS_OBSERVATION_ENABLED==="true"){
      try{configuration(env);googleEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    const [campaigns,status,googleEvidence]=await Promise.all([loadCampaigns(scope,range),squareStatus(scope.userId),
      googleEnabled?dashboardEvidence(q,scope.userId,range):Promise.resolve(null)]);
    res.set?.("Cache-Control","no-store");
    res.send(page("Marketing Command Center",renderCommandCenter({title:"Your marketing, together",scope,range,campaigns,squareStatus:status,googleEvidence,googleEnabled,googleAutoSync:env.GOOGLE_ADS_AUTO_SYNC!=="false"})));
  }));
  app.get("/org-marketing-command-center/advertiser/:advertiserId",requireOrganizationPermission("manage_advertisers"),handle(async(req,res,range)=>{
    const authorized=await getOrganizationScope(req);
    if(!validId(authorized?.organizationId)||!validId(req.params.advertiserId))return res.status(404).send("Advertiser not found.");
    const scope={kind:"enterprise",orgId:Number(authorized.organizationId),advertiserId:Number(req.params.advertiserId)};
    const advertiser=(await q(`SELECT a.id,a.name,o.name organization_name FROM advertisers a JOIN organizations o ON o.id=a.organization_id
      WHERE a.id=$1 AND a.organization_id=$2 AND COALESCE(a.is_active,true)=true`,[scope.advertiserId,scope.orgId])).rows[0];
    if(!advertiser)return res.status(404).send("Advertiser not found.");
    const campaigns=await loadCampaigns(scope,range);
    res.send(orgPage("Marketing Command Center",organizationNav({organizationId:scope.orgId,organizationName:advertiser.organization_name,activePage:"ai-readiness",userName:(req.session.orgUser||req.session.user)?.name||""})+
      renderCommandCenter({title:advertiser.name,scope,range,campaigns,squareStatus:"Only shared campaign conversions"})));
  }));
}
module.exports={registerMarketingCommandCenterRoutes};
