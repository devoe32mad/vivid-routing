"use strict";
const {performanceCampaignScope}=require("./performance-campaign-scope");
const crypto=require("node:crypto");
const {amounts}=require("./square-production-sales");
const {canPreviewAi}=require("./ai-preview-access");
const {dateRange,renderCommandCenter}=require("./marketing-command-center");
const {dashboardEvidence}=require("./google-ads-readonly-store");
const {configuration}=require("./google-ads-readonly");
const {dashboardEvidence:metaDashboardEvidence}=require("./meta-ads-store");
const {configuration:metaConfiguration}=require("./meta-ads-readonly");
const {dashboardEvidence:linkedinDashboardEvidence}=require("./linkedin-ads-store");
const {configuration:linkedinConfiguration}=require("./linkedin-ads-readonly");
const {dashboardEvidence:tiktokDashboardEvidence}=require("./tiktok-ads-store");
const {configuration:tiktokConfiguration}=require("./tiktok-ads-readonly");
const {dashboardEvidence:redditDashboardEvidence}=require("./reddit-ads-store");
const {configuration:redditConfiguration}=require("./reddit-ads-readonly");
const {dashboardEvidence:pinterestDashboardEvidence}=require("./pinterest-ads-store");
const {configuration:pinterestConfiguration}=require("./pinterest-ads-readonly");
const {dashboardEvidence:analyticsDashboardEvidence}=require("./google-analytics-store");
const {configuration:analyticsConfiguration}=require("./google-analytics-readonly");
const {dashboardEvidence:searchConsoleDashboardEvidence,createStore:createSearchConsoleStore}=require("./google-search-console-store");
const {configuration:searchConsoleConfiguration,createReader:createSearchConsoleReader}=require("./google-search-console-readonly");
const {dashboardEvidence:youtubeDashboardEvidence}=require("./youtube-analytics-store");
const {configuration:youtubeConfiguration}=require("./youtube-analytics-readonly");
const {createMarketingEconomicsStore}=require("./marketing-economics-store");
const {loadVividBenchmark}=require("./vivid-benchmarks");
const {
  loadAdvertiserSponsorshipState,
  renderBasicSponsorshipDashboard,
  registerSponsorshipPerformanceRoutes
}=require("./sponsorship-performance-plan");
function registerMarketingCommandCenterRoutes({app,q,pool,page,orgPage,organizationNav,requireLogin,requireOrganizationPermission,getOrganizationScope,env=process.env}) {
  const economicsStore=createMarketingEconomicsStore(q);
  registerSponsorshipPerformanceRoutes({app,q,requireLogin,page});
  async function loadCampaigns(scope,range) {
    const enterprise=scope.kind==="enterprise";
    const params=enterprise?[scope.orgId,scope.advertiserId,range.from,range.to]:[scope.userId,range.from,range.to];
    const first=enterprise?3:2;
    // Ownership is fixed server-side, including for platform administrators.
    // Square projections are a subset of Vivid events, never another source total.
    return (await q(`SELECT c.id,c.name,COALESCE((to_jsonb(c)->>'is_archived')::boolean,false) AS is_archived,
      COUNT(e.id) FILTER(WHERE e.type='scan')::int scans,
      COUNT(e.id) FILTER(WHERE e.type IN('offer','maps','waze','destination_click'))::int clicks,
      COUNT(e.id) FILTER(WHERE e.type='conversion')::int conversions,
      COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion'),0) conversion_value,
      COUNT(e.id) FILTER(WHERE e.type='conversion' AND to_jsonb(e)->>'square_payment_key' IS NOT NULL)::int square_conversions,
      COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion' AND to_jsonb(e)->>'square_payment_key' IS NOT NULL),0) square_value
      FROM campaigns c LEFT JOIN events e ON e.campaign_id=c.id
      AND e.created_at >= $${first}::date AND e.created_at < ($${first+1}::date + INTERVAL '1 day')
      WHERE ${enterprise?"c.organization_id=$1 AND c.advertiser_id=$2 AND COALESCE(c.is_test,false)=false":performanceCampaignScope()}
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
  const equal=(a,b)=>{const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);};
  const handle=fn=>async(req,res)=>{
    let range;
    try{
      range=dateRange(req.query);
      if(req.query.platform!==undefined && !["vivid","square","paid_media","google_ads","meta","linkedin","tiktok","reddit","pinterest","youtube","ga4","ai_traffic","organic"].includes(req.query.platform))return res.status(400).send("Choose a supported platform.");
      if(req.query.campaign!==undefined && (typeof req.query.campaign!=="string" || (["ga4","ai_traffic"].includes(req.query.platform) ? (!req.query.campaign || req.query.campaign.length>500 || /[\u0000-\u001f]/.test(req.query.campaign)) : !/^\d+(?::\d+)?$/.test(req.query.campaign))))return res.status(400).send("Choose a valid campaign or traffic source.");
    }catch(error){return res.status(400).send(error.message);}
    try{await fn(req,res,range);}catch(error){console.error("MARKETING COMMAND CENTER ERROR",error.code||error.name);res.status(500).send("Unable to load marketing evidence. Please try again.");}
  };
  app.post("/admin/marketing-command-center/economics",requireLogin,async(req,res)=>{
    try{
      if(!validId(req.session?.user?.id))return res.status(403).send("Account required.");
      if(!equal(req.body?.csrf,req.session.marketingEconomicsCsrf))return res.status(403).send("Reload the Marketing Command Center and try again.");
      const ownId=Number(req.session.user.id),canSelect=String(req.session.user.role||"").toLowerCase()==="super_admin",targetId=canSelect&&validId(req.session.marketingAccountId)?Number(req.session.marketingAccountId):ownId;
      let margin=null;
      if(req.body?.action!=="unknown"){
        const raw=String(req.body?.gross_margin_pct||"").trim();
        if(!/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/.test(raw))return res.status(400).send("Enter an amount from 0 to 100, or choose I’m not sure.");
        margin=Number(raw);
      }
      await economicsStore.save(targetId,margin);
      const saved=req.session.marketingReturn||{},params=new URLSearchParams();
      if(canSelect)params.set("account",targetId);
      if(saved.from)params.set("from",saved.from);if(saved.to)params.set("to",saved.to);
      params.set("economics","saved");
      res.redirect("/admin/marketing-command-center?"+params);
    }catch(error){console.error("MARKETING ECONOMICS ERROR",error.code||error.name);res.status(500).send("Unable to save the margin. Please try again.");}
  });
  app.get("/admin/marketing-command-center",requireLogin,handle(async(req,res,range)=>{
    if(!validId(req.session?.user?.id))return res.status(403).send("Account required.");
    const user=req.session.user, ownId=Number(user.id);
    const canSelect=String(user.role||"").toLowerCase()==="super_admin";
    const requested=req.query.account;
    if(requested!==undefined && (typeof requested!=="string" || !/^[1-9]\d*$/.test(requested) || !validId(requested)))return res.status(400).send("Choose a valid account.");
    if(!canSelect && requested!==undefined && Number(requested)!==ownId)return res.status(403).send("Account access denied.");
    const demoScope=await require("./hfhs-demo-setup-scope").reportScope(q,user);
    if(demoScope)return res.send(page("Marketing Command Center",await renderHfhsMarketingDemo({q,range,scope:demoScope,user,platform:req.query.platform||"",campaign:req.query.campaign||""})));
    const accounts=canSelect?(await q("SELECT id,name FROM users WHERE role='customer' OR id=$1 ORDER BY name,id",[ownId])).rows:[];
    let selectedId=canSelect?Number(requested ?? req.session.marketingAccountId ?? ownId):ownId;
    if(selectedId!==ownId && !accounts.some(a=>Number(a.id)===selectedId)) {
      if(requested!==undefined)return res.status(404).send("Account not found.");
      selectedId=ownId;
    }
    const scope={kind:"advertiser",userId:selectedId,accountSelection:canSelect,
      accountName:accounts.find(a=>Number(a.id)===selectedId)?.name || user.name || "Your account",
      accounts,privateAdsAllowed:selectedId===ownId};
    if(!scope.privateAdsAllowed && ["paid_media","google_ads","meta","linkedin","tiktok","reddit","pinterest","youtube","ga4","ai_traffic","organic"].includes(req.query.platform))return res.status(403).send("Private platform accounts are available in your own account view.");
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
    let tiktokEnabled=false;
    if(env.TIKTOK_ADS_OBSERVATION_ENABLED==="true"){
      try{tiktokConfiguration(env);tiktokEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let redditEnabled=false;
    if(env.REDDIT_ADS_OBSERVATION_ENABLED==="true"){
      try{redditConfiguration(env);redditEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let pinterestEnabled=false;
    if(env.PINTEREST_ADS_OBSERVATION_ENABLED==="true"){
      try{pinterestConfiguration(env);pinterestEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let analyticsEnabled=false;
    if(env.GOOGLE_ANALYTICS_ENABLED==="true"){
      try{analyticsConfiguration(env);analyticsEnabled=true;}catch{/* Keep setup unavailable until valid. */}
    }
    let searchConsoleEnabled=false,searchConsoleStore=null;
    if(env.GOOGLE_SEARCH_CONSOLE_ENABLED==="true"){
      try{const config=searchConsoleConfiguration(env);searchConsoleEnabled=true;if(pool)searchConsoleStore=createSearchConsoleStore({pool,q,config,reader:createSearchConsoleReader({config})});}catch{/* Keep setup unavailable until valid. */}
    }
    let youtubeEnabled=false;
    if(env.YOUTUBE_ANALYTICS_ENABLED==="true")try{youtubeConfiguration(env);youtubeEnabled=true;}catch{}

    // Sponsorship plans are opt-in and placement-specific. Existing advertiser
    // accounts remain unchanged unless a marketplace-created QR is explicitly
    // enrolled in Basic or Vivid Performance.
    const campaigns=await loadCampaigns(scope,range);
    const sponsorshipState=await loadAdvertiserSponsorshipState(q,selectedId,range,campaigns);
    if(sponsorshipState.sponsorshipOnly){
      return res.redirect(303,"/reports");
    }

    req.session.marketingEconomicsCsrf||=crypto.randomBytes(32).toString("hex");
    let [status,economics,googleEvidence,metaEvidence,linkedinEvidence,tiktokEvidence,redditEvidence,pinterestEvidence,youtubeEvidence,analyticsEvidence,searchConsoleEvidence]=await Promise.all([squareStatus(scope.userId,range),economicsStore.load(scope.userId),
      googleEnabled&&scope.privateAdsAllowed?dashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      metaEnabled&&scope.privateAdsAllowed?metaDashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      linkedinDashboardEvidence(q,scope.userId,range),
      tiktokDashboardEvidence(q,scope.userId,range),
      redditDashboardEvidence(q,scope.userId,range),
      pinterestDashboardEvidence(q,scope.userId,range),
      youtubeEnabled?youtubeDashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      analyticsEnabled&&scope.privateAdsAllowed?analyticsDashboardEvidence(q,scope.userId,range):Promise.resolve(null),
      searchConsoleEnabled&&scope.privateAdsAllowed?searchConsoleDashboardEvidence(q,scope.userId,range):Promise.resolve(null)]);
    if(searchConsoleStore&&scope.privateAdsAllowed&&searchConsoleEvidence?.connections?.length&&searchConsoleEvidence.summary.length<searchConsoleEvidence.connections.length){
      await searchConsoleStore.ready();
      for(const connection of searchConsoleEvidence.connections.filter(c=>c.status==="connected"&&!searchConsoleEvidence.summary.some(s=>String(s.connection_id)===String(c.id)))){
        try{await searchConsoleStore.sync(scope.userId,connection.id,range);}catch(error){console.warn("google_search_console_selected_period_failure "+JSON.stringify({connectionId:String(connection.id),code:error.code||"failed",...(error.diagnostic||{})}));}
      }
      searchConsoleEvidence=await searchConsoleDashboardEvidence(q,scope.userId,range);
    }
    if(canSelect&&!(linkedinEvidence?.connections||[]).length)try{const assignments=(await q("SELECT owner_user_id,dashboard_user_id,COUNT(*)::int connections FROM linkedin_ads_private_connections GROUP BY owner_user_id,dashboard_user_id ORDER BY owner_user_id,dashboard_user_id")).rows;console.log("linkedin_dashboard_assignment_mismatch "+JSON.stringify({selectedId,ownId,privateAdsAllowed:scope.privateAdsAllowed,assignments}));}catch(error){if(error.code!=="42P01"&&error.code!=="42703")throw error;}
    let benchmark=null;
    if(canPreviewAi(req.session)&&scope.privateAdsAllowed)try{const subject=campaigns.reduce((sum,c)=>({campaigns:sum.campaigns+1,scans:sum.scans+Number(c.scans||0),engagement:sum.engagement+Number(c.clicks||0),conversions:sum.conversions+Number(c.conversions||0),revenue:sum.revenue+Number(c.conversion_value||0)}),{campaigns:0,scans:0,engagement:0,conversions:0,revenue:0});benchmark=await loadVividBenchmark(q,{startDate:range.from,endDate:range.to,subject});}catch(error){console.warn("vivid_benchmark_unavailable "+JSON.stringify({code:error.code||"failed"}));}
    // Save only the account and dates resolved by the authorized dashboard route.
    req.session.marketingReturn={accountId:selectedId,from:range.from,to:range.to};
    res.set?.("Cache-Control","no-store");
    res.send(page("Marketing Command Center",renderCommandCenter({aiVisible:canPreviewAi(req.session),title:"Your marketing, together",scope,range,campaigns,squareStatus:status,economics,economicsCsrf:req.session.marketingEconomicsCsrf,googleEvidence,googleEnabled,googleAutoSync:env.GOOGLE_ADS_AUTO_SYNC!=="false",metaEvidence,metaEnabled,metaAutoSync:env.META_ADS_AUTO_SYNC!=="false",linkedinEvidence,linkedinEnabled,linkedinAutoSync:env.LINKEDIN_ADS_AUTO_SYNC!=="false",tiktokEvidence,tiktokEnabled,tiktokAutoSync:env.TIKTOK_ADS_AUTO_SYNC!=="false",redditEvidence,redditEnabled,redditAutoSync:env.REDDIT_ADS_AUTO_SYNC!=="false",pinterestEvidence,pinterestEnabled,pinterestAutoSync:env.PINTEREST_ADS_AUTO_SYNC!=="false",youtubeEvidence,youtubeEnabled,youtubeAutoSync:env.YOUTUBE_ANALYTICS_AUTO_SYNC!=="false",analyticsEvidence,analyticsEnabled,analyticsAutoSync:env.GOOGLE_ANALYTICS_AUTO_SYNC!=="false",searchConsoleEvidence,searchConsoleEnabled,searchConsoleAutoSync:env.GOOGLE_SEARCH_CONSOLE_AUTO_SYNC!=="false",benchmark,platform:req.query.platform||"",campaign:req.query.campaign||""})));
  }));
  app.get("/org-marketing-command-center/advertiser/:advertiserId",requireOrganizationPermission("manage_advertisers"),handle(async(req,res,range)=>{
    if(["google_ads","meta","linkedin","tiktok","reddit","pinterest"].includes(req.query.platform))return res.status(403).send("Private advertising accounts are only available in their owner’s dashboard.");
    const authorized=await getOrganizationScope(req);
    if(!validId(authorized?.organizationId)||!validId(req.params.advertiserId))return res.status(404).send("Advertiser not found.");
    const scope={kind:"enterprise",orgId:Number(authorized.organizationId),advertiserId:Number(req.params.advertiserId)};
    const advertiser=(await q(`SELECT a.id,a.name,o.name organization_name FROM advertisers a JOIN organizations o ON o.id=a.organization_id
      WHERE a.id=$1 AND a.organization_id=$2 AND COALESCE(a.is_active,true)=true`,[scope.advertiserId,scope.orgId])).rows[0];
    if(!advertiser)return res.status(404).send("Advertiser not found.");
    const campaigns=await loadCampaigns(scope,range);
    let benchmark=null;
    if(canPreviewAi(req.session,req))try{const subject=campaigns.reduce((sum,c)=>({campaigns:sum.campaigns+1,scans:sum.scans+Number(c.scans||0),engagement:sum.engagement+Number(c.clicks||0),conversions:sum.conversions+Number(c.conversions||0),revenue:sum.revenue+Number(c.conversion_value||0)}),{campaigns:0,scans:0,engagement:0,conversions:0,revenue:0});benchmark=await loadVividBenchmark(q,{startDate:range.from,endDate:range.to,subject});}catch(error){console.warn("vivid_benchmark_unavailable "+JSON.stringify({code:error.code||"failed"}));}
    res.send(orgPage("Marketing Command Center",organizationNav({organizationId:scope.orgId,organizationName:advertiser.organization_name,activePage:"ai-readiness",userName:(req.session.orgUser||req.session.user)?.name||""})+
      renderCommandCenter({aiVisible:canPreviewAi(req.session,req),title:advertiser.name,scope,range,campaigns,squareStatus:"Only shared campaign conversions",benchmark,platform:req.query.platform||"",campaign:req.query.campaign||""})));
  }));
}
module.exports={registerMarketingCommandCenterRoutes};


async function renderHfhsMarketingDemo({q,range,scope,user,platform="",campaign=""}){
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  if(user.ccpsReview)scope={...scope,campaignIds:scope.campaignIds.filter(id=>Number(id)===69),qrIds:scope.qrIds.filter(id=>Number(id)===98)};
  const campaigns=(await q(`SELECT c.id,c.name,COUNT(e.id) FILTER(WHERE e.type='scan')::int scans,
    COUNT(e.id) FILTER(WHERE e.type IN('offer','maps','waze','destination_click'))::int clicks,
    COUNT(e.id) FILTER(WHERE e.type='conversion')::int conversions,
    COALESCE(SUM(e.value) FILTER(WHERE e.type='conversion'),0) conversion_value
    FROM campaigns c LEFT JOIN events e ON e.campaign_id=c.id AND e.qr_id=ANY($2::int[])
      AND e.created_at >= $3::date AND e.created_at < $4::date+INTERVAL '1 day'
    WHERE c.id=ANY($1::int[]) AND COALESCE(c.is_archived,false)=false GROUP BY c.id,c.name ORDER BY c.name`,[scope.campaignIds,scope.qrIds,range.from,range.to])).rows;
  const rubberWorld=require('./rubber-world-review').isDemo(user);
  if(!rubberWorld&&!user.ccpsReview&&require('./hfhs-demo-setup-scope').isHfhsDemo(user))return renderHfhsChannelDemo({range,scope,user,campaigns,platform,campaign});
  const banner=rubberWorld?'<div class="wrap"><div class="note"><strong>Rubber World advertiser demonstration</strong><p>Placement results belong to this sample advertiser. Digital platforms show their connection status; no private accounts are connected.</p></div></div>':user.ccpsReview?'<div class="wrap" style="padding:20px"><strong>CCPS · Vivid Performance — $35/month per placement</strong><p>Gulf Coast is the paid-placement example. All displayed placement results are illustrative demo data; no payment was processed. Website and advertising connectors show what the sponsor can connect; no private accounts are connected in this demo.</p><a href="/reports">Back to Reports</a> · <a href="/my-setup">My Setup</a></div>':'<div class="wrap"><div class="note"><strong>HFHS demonstration</strong><p>Placement results use HFHS sample campaigns. Digital platforms show their connection status; no simulated advertising results or unrelated account data are included.</p></div></div>';
  return banner+renderCommandCenter({title:"Your marketing, together",scope:{kind:"advertiser",userId:Number(user.id),accountName:rubberWorld?"Rubber World advertiser demo":user.ccpsReview?"CCPS Performance demo":"HFHS advertiser demo",accountSelection:false,privateAdsAllowed:true},range,campaigns,
    squareStatus:"Not connected",googleEnabled:true,metaEnabled:true,linkedinEnabled:true,tiktokEnabled:true,redditEnabled:true,pinterestEnabled:true,youtubeEnabled:true,analyticsEnabled:true,
    platform,campaign,aiVisible:false});
}

module.exports.renderHfhsMarketingDemo=renderHfhsMarketingDemo;


// HFHS-only presentation fixtures. Never written to campaign, connector or event tables.
function renderHfhsChannelDemo({range,scope,user,campaigns,platform,campaign}) {
  const {buildPlatforms,platformCard,dashboardHref}=require('./marketing-platform-dashboard');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dates=Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,8,21+i)).toISOString().slice(0,10));
  const selectedDates=dates.filter(d=>d>=range.from&&d<=range.to);
  const split=(total,i)=>Math.floor(total*(i+1)/30)-Math.floor(total*i/30);
  const conn=id=>[{id,status:'connected',account_name:'HFHS demo sponsor · sample account',property_name:'Demo sponsor website',channel_name:'Demo sponsor stories',site_url:'Sample sponsor website',account_timezone:'America/New_York',last_synced_at:new Date().toISOString(),owner_user_id:Number(user.id)}];
  const paid=(id,label,impressions,clicks,spend,conversions,value)=>{
    const daily=[];
    for(let c=0;c<2;c++)for(let i=0;i<30;i++)if(selectedDates.includes(dates[i])){
      const share=c===0?.6:.4,amount=n=>split(Math.round(n*share),i);
      daily.push({connection_id:id,campaign_id:c+1,campaign_name:label+' · '+(c===0?'Event discovery':'Sponsor offer'),campaign_status:'ENABLED',channel:'SEARCH',objective:'WEBSITE_CONVERSIONS',date:dates[i],currency_code:'USD',impressions:amount(impressions),clicks:amount(clicks),link_clicks:amount(clicks*.8),outbound_clicks:amount(clicks*.7),cost_micros:amount(spend*100)*10000,conversions:amount(conversions),purchases:amount(conversions),leads:amount(conversions*.5),conversion_value:amount(value),purchase_value:amount(value),conversion_value_micros:amount(value)*1e6,reactions:amount(clicks*.4),comments:amount(clicks*.08),shares:amount(clicks*.06),saves:amount(clicks*.1),video_views:amount(impressions*.35),video_views_2s:amount(impressions*.25),video_views_6s:amount(impressions*.12)});
    }
    return {connections:conn(id),rows:daily,daily};
  };
  const evidence={googleEvidence:paid(901,'Golf event',18000,540,810,18,2700),metaEvidence:paid(902,'Gala partnership',24000,432,540,12,1800),linkedinEvidence:paid(903,'Conference partnership',8500,102,510,4,1200),tiktokEvidence:paid(904,'Community event',16000,192,240,5,500),redditEvidence:paid(905,'Community discovery',6000,90,135,3,300),pinterestEvidence:paid(906,'Event inspiration',9000,135,180,4,400)};
  const traffic=[['google','organic',360,270,230,18,1800],['google','cpc',420,330,265,20,2400],['facebook','paid_social',260,210,143,10,1000],['(direct)','(none)',300,250,198,16,1600],['instagram','organic_social',140,112,85,5,400],['chatgpt.com','referral',65,52,46,4,300],['perplexity.ai','referral',25,20,17,1,100],['linkedin','paid_social',80,65,52,4,600]];
  const rows=traffic.map(([source,medium,sessions,users,engaged_sessions,key_events,revenue])=>{
    const scale=v=>selectedDates.reduce((sum,d)=>sum+split(v,dates.indexOf(d)),0);
    return {connection_id:907,source,medium,sessions:scale(sessions),users:scale(users),engaged_sessions:scale(engaged_sessions),event_count:scale(sessions*3),key_events:scale(key_events),revenue:scale(revenue)};
  }).filter(r=>r.sessions>0);
  evidence.analyticsEvidence={connections:conn(907),rows};
  const searchRows=[['Sponsor event offers',8000,220,12.4],['Local community partners',5000,140,16.1]].map(([label,impressions,clicks,position])=>{const scale=v=>selectedDates.reduce((sum,d)=>sum+split(v,dates.indexOf(d)),0);return {connection_id:908,label,row_type:'query',impressions:scale(impressions),clicks:scale(clicks),position,ctr:impressions?clicks/impressions:0};});
  evidence.searchConsoleEvidence={connections:conn(908),summary:searchRows,rows:searchRows};
  const scale=v=>selectedDates.reduce((sum,d)=>sum+split(v,dates.indexOf(d)),0);
  evidence.youtubeEvidence={connections:conn(909),rows:selectedDates.length?[{connection_id:909,video_id:1,video_title:'Golf partnership: meet the sponsor',views:scale(820),watch_minutes:scale(615),average_view_seconds:45,likes:scale(42),comments:scale(8),shares:scale(12),subscribers_gained:scale(9),subscribers_lost:0},{connection_id:909,video_id:2,video_title:'Community event: sponsor offer',views:scale(560),watch_minutes:scale(280),average_view_seconds:30,likes:scale(28),comments:scale(5),shares:scale(9),subscribers_gained:scale(6),subscribers_lost:0}]:[]};
  const viewScope={kind:'advertiser',userId:Number(user.id),accountName:'HFHS demo sponsor · illustrative channel reporting',accountSelection:false,privateAdsAllowed:true};
  const options={title:'Your marketing, together',scope:viewScope,range,campaigns,squareStatus:'Not connected',googleEnabled:true,metaEnabled:true,linkedinEnabled:true,tiktokEnabled:true,redditEnabled:true,pinterestEnabled:true,youtubeEnabled:true,analyticsEnabled:true,searchConsoleEnabled:true,platform,campaign,aiVisible:false,...evidence};
  const platforms=buildPlatforms(options),active=platforms.find(p=>p.id===platform),chosen=active?.rows.find(r=>r.key===campaign);
  let html=renderCommandCenter(options);
  // Keep the production layout and drill-downs, without exposing connector actions for fixtures.
  html=html.replace(/<section class="mcc-economics">[\s\S]*?<\/section>/,'');
  html=html.replace(/<a\b[^>]*href="\/admin\/connectors\/[^\"]*"[^>]*>[\s\S]*?<\/a>/g,'');
  html=html.replace(/Automatic hourly sync|Awaiting fresh reports/g,'Illustrative demo data').replace(/Live campaign records/g,'Saved HFHS demo campaign records');
  html=html.replace(/<p class="mcc-freshness">[\s\S]*?<\/p>/g,'<p class="mcc-freshness">Demo reporting · selected dates · no live channel connection</p>');
  html=html.replace(/Test campaigns are excluded; archived campaign results remain in period totals\./g,'This view includes the selected sponsor’s active HFHS demo campaigns.');
  const yt=platforms.find(p=>p.id==='youtube');
  if(!platform&&yt)html=html.replace('<section class="mcc-platform-grid">','<section class="mcc-platform-grid">'+platformCard({...yt,status:'Illustrative demo data',freshness:'Sample video results · selected dates'},viewScope,range));
  let detail='';
  if(platform==='ga4'||platform==='ai_traffic'){
    const sourceRows=chosen?rows.filter(r=>`${r.connection_id}:${r.source}:${r.medium}`===campaign):platform==='ai_traffic'?rows.filter(r=>/chatgpt|perplexity/.test(r.source)):rows;
    const pages=[['/event-partnership','Event partnership overview',.5],['/sponsor-offer','Sponsor offer and details',.3],['/contact','Contact / enquiry',.2]];
    const totals=sourceRows.reduce((s,r)=>({sessions:s.sessions+r.sessions,engaged:s.engaged+r.engaged_sessions,actions:s.actions+r.key_events,revenue:s.revenue+r.revenue}),{sessions:0,engaged:0,actions:0,revenue:0});
    const alloc=(n,i)=>i===0?Math.floor(n*.5):i===1?Math.floor(n*.3):n-Math.floor(n*.5)-Math.floor(n*.3);
    detail='<h2>Landing-page breakdown</h2><p>Illustrative sponsor pages behind '+(chosen?esc(chosen.name):'these traffic totals')+'. Page rows reconcile to the selected source totals; these are sample paths, not live HFHS pages.</p><div class="mcc-scroll"><table><thead><tr><th>Page</th><th>Sessions</th><th>Engaged sessions</th><th>Key actions</th><th>Reported revenue</th></tr></thead><tbody>'+pages.map(([path,title],i)=>'<tr><td><strong>'+esc(title)+'</strong><br><small>'+path+'</small></td><td>'+alloc(totals.sessions,i)+'</td><td>'+alloc(totals.engaged,i)+'</td><td>'+alloc(totals.actions,i)+'</td><td>$'+alloc(totals.revenue,i)+'</td></tr>').join('')+'</tbody></table></div>';
  } else if(chosen&&['linkedin','tiktok','reddit','pinterest'].includes(platform)){
    const key={linkedin:'linkedinEvidence',tiktok:'tiktokEvidence',reddit:'redditEvidence',pinterest:'pinterestEvidence'}[platform];
    const daily=evidence[key].daily.filter(r=>`${r.connection_id}:${r.campaign_id}`===campaign);
    detail='<h2>Daily campaign detail</h2><div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Conversions</th><th>Reported value</th></tr></thead><tbody>'+daily.map(r=>'<tr><td>'+r.date+'</td><td>'+r.impressions+'</td><td>'+r.clicks+'</td><td>$'+(r.cost_micros/1e6).toFixed(2)+'</td><td>'+r.conversions+'</td><td>$'+r.conversion_value+'</td></tr>').join('')+'</tbody></table></div>';
  }
  const definitions='<details class="mcc-panel"><summary><strong>What the numbers mean</strong></summary><p><strong>Impressions:</strong> ad displays, not unique people. <strong>CTR:</strong> clicks ÷ impressions. <strong>ROAS:</strong> reported conversion value ÷ ad spend. ROI is unavailable without a sponsor-provided margin.</p><p><strong>Website sessions:</strong> visits; visitors are summed source-level counts and may overlap across sources. <strong>Engaged sessions:</strong> meaningful visits. <strong>Key actions:</strong> sample enquiries or purchases, not necessarily unique customers.</p><p>Website, AI, organic and paid-channel results can overlap. Do not add them together as unique visitors or revenue. Channel figures are illustrative, not verified sales or HFHS sponsorship income. Vivid placement results come from saved HFHS demo records.</p></details>';
  html=html.replace('</main>',(detail?'<section class="mcc-panel" id="hfhs-channel-evidence">'+detail+'</section>':'')+definitions+'</main>');
  const colors={ga4:'#b45309',ai_traffic:'#6d28d9',organic:'#15803d',vivid:'#2563eb',google_ads:'#2563eb',meta:'#1d4ed8',linkedin:'#075985',tiktok:'#0f766e',reddit:'#c2410c',pinterest:'#be123c',youtube:'#b91c1c'};
  const css=Object.entries(colors).map(([id,c])=>`#hfhs-mcc [data-platform="${id}"]{border-top:5px solid ${c};background:linear-gradient(160deg,${c}10,#fff 45%)}#hfhs-mcc [data-platform="${id}"] h3{color:${c}}`).join('');
  return '<div id="hfhs-mcc"><style>'+css+'#hfhs-mcc .mcc-summary-card{border-top:5px solid #2563eb;background:linear-gradient(160deg,#eff6ff,#fff 45%)}#hfhs-mcc .mcc-platform:hover{box-shadow:0 8px 24px #102b5018}#hfhs-mcc .mcc-metrics>div{padding:10px;border-radius:10px;background:#f6f8fc}#hfhs-mcc .mcc-status{background:#eaf2ff;color:#183d67}#hfhs-mcc .mcc-ga4-table{overflow:auto}#hfhs-mcc .mcc-ga4-table table{min-width:720px}#hfhs-mcc .mcc-primary{background:#2563eb;color:white!important;padding:11px;border-radius:10px}#hfhs-mcc .mcc-panel>h2{margin-top:0}</style><div class="wrap"><div class="note"><strong>HFHS Marketing Command Center · illustrative channel data</strong><p>Explore every card, then open a campaign, video or traffic source. Sample digital activity covers September 21–October 20, 2026; date filters select activity within that window. No live advertising accounts are connected, and these examples do not change sponsorship or campaign records.</p><a class="btn" href="'+esc(dashboardHref(viewScope,{from:'2026-09-21',to:'2026-10-20'}))+'">View full sample period</a></div></div>'+html+'</div>';
}
