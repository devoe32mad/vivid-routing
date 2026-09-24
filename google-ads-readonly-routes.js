"use strict";
const {canPreviewAi}=require("./ai-preview-access");
const crypto = require("node:crypto");
const {dateRange} = require("./marketing-command-center");
const {PATH,SCOPE,ConnectorError,configuration,customerId,equal,hash,importRange,createGoogleReader} = require("./google-ads-readonly");
const {createStore,dashboardEvidence} = require("./google-ads-readonly-store");
const {renderHome,renderAccount} = require("./google-ads-readonly-view");
const {createAutoSync} = require("./google-ads-auto-sync");
function registerGoogleAdsReadOnlyRoutes({app,q,pool,page,requireLogin,env=process.env,fetcher=fetch,logger=console,startBackground=true}) {
  let config;
  if(env.GOOGLE_ADS_OBSERVATION_ENABLED === "true") {
    try { config = configuration(env); } catch { /* Fail closed without breaking the whole application. */ }
  }
  const store = config && createStore({pool,q,config,reader:createGoogleReader({config,fetcher})});
  const autoSync = Boolean(store) && env.GOOGLE_ADS_AUTO_SYNC !== "false";
  if(store && startBackground) createAutoSync({store,enabled:autoSync,logger}).start();
  const save = req => new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
  const owner = (req,res,next) => {
    if(!Number.isSafeInteger(Number(req.session?.user?.id)) || Number(req.session.user.id)<=0) return res.status(403).send("Advertiser login required.");
    req.googleOwner = Number(req.session.user.id);
    res.set("Cache-Control","no-store"); res.set("Referrer-Policy","no-referrer");
    next();
  };
  const wrap = fn => async(req,res) => {
    try { await fn(req,res); }
    catch(error) {
      if (error instanceof ConnectorError && error.diagnostic) {
        // Do not log req, the error stack, or the provider response body.
        logger.warn("google_ads_readonly_failure " + JSON.stringify(error.diagnostic));
      }
      const messages = {state:"Authorization expired or was already used. Start again from Google connections.",
        not_found:"Google account not found.","55P03":"An import is already running for this account. Try again shortly.",
        date_range:"Choose at most 31 days per import.",authorization:"Google authorization needs renewal. Reconnect this account.",
        temporary:"Google is temporarily unavailable or limiting requests. Retry later; existing evidence is unchanged.",
        google_access:"Google did not grant account access. Check the selected account, manager ID and Vivid’s Google API access.",
        oauth_client:"Google rejected Vivid’s OAuth application credentials. Check the Google Ads client ID and matching client secret in Railway, then deploy and reconnect.",
        oauth_redirect:"Vivid’s Google callback address does not match its OAuth configuration. Ask the Vivid administrator to check the redirect URI.",
        customer_signup:"Google reports that this Ads account’s signup is incomplete. Review the account setup in Google Ads; you do not need to launch a campaign to connect reporting.",
        customer_missing:"Google could not find the selected Ads customer account. Verify the 10-digit customer ID in Google Ads.",
        customer_inactive:"Google reports that this Ads account is not enabled. Check its account status in Google Ads.",
        account_permission:"The selected Google login cannot access this Ads account through the supplied manager ID. Use a login with account access; leave Manager ID blank for direct access.",
        manager_invalid:"Google rejected the Manager ID. Leave it blank for direct account access, or enter the manager account used to access this customer.",
        project_access:"Vivid’s Google Cloud project is not approved for this production Ads account. Check Google Ads API access in Google Cloud; Explorer access or higher is required.",
        api_disabled:"The Google Ads API is disabled for Vivid’s Google Cloud project. Enable it for the project that owns the OAuth client.",
        oauth_scope:"Google did not grant the required Ads permission. Reconnect and review the Google Ads permission on Google’s consent screen.",
        account:"Choose an accessible production advertising account, not a manager or test account.",
        report_too_large:"This report is too large for one import. Choose a shorter date range."};
      res.status(error.code==="not_found"?404:error.code==="state"?403:error.code==="55P03"?409:502)
        .send(messages[error.code] || "Unable to complete the Google connection request. Retry from Google connections. Existing evidence is preserved.");
    }
  };
  const enabled = (req,res,next) => config ? next() : res.status(503).send("Google reporting connection is awaiting Vivid application setup.");
  const csrf = (req,res,next) => equal(req.body?.csrf,req.session.googleAdsCsrf) ? next() : res.status(403).send("Reload Google connections and try again.");
  const route = (method,path,...handlers) => app[method](PATH+path,requireLogin,owner,...handlers);
  route("get","",wrap(async(req,res)=>{
    req.session.googleAdsCsrf ||= crypto.randomBytes(32).toString("hex"); await save(req);
    if(store) await store.ready();
    const connections = store ? await store.list(req.googleOwner) : [];
    const notice = req.query.notice==="connected"?(autoSync?"Account connected. Your first automatic sync is queued and will begin shortly.":"Account connected. Automatic syncing is disabled by the administrator."):req.query.notice==="denied"?"Google authorization was not completed.":req.query.notice==="disconnected"?"Connection and imported Google evidence removed.":"";
    res.send(page("Google Ads connection",renderHome({configured:Boolean(config),connections,csrf:req.session.googleAdsCsrf,notice,autoSync})));
  }));
  route("post","/connect",enabled,csrf,wrap(async(req,res)=>{
    const id = customerId(req.body.customer_id), manager = req.body.manager_id === undefined || req.body.manager_id === "" ? "" : customerId(req.body.manager_id);
    if(!id || (req.body.manager_id && !manager)) return res.status(400).send("Use a 10-digit Google customer ID and, if needed, a valid manager ID.");
    await store.ready();
    const state = crypto.randomBytes(32).toString("hex"), until = Date.now()+600000;
    await q("DELETE FROM google_ads_private_states WHERE expires_at<NOW() OR owner_user_id=$1",[req.googleOwner]);
    await q("INSERT INTO google_ads_private_states(state_hash,owner_user_id,expires_at) VALUES($1,$2,$3)",[hash(state),req.googleOwner,new Date(until)]);
    req.session.googleAdsPending = {state,hash:hash(state),userId:req.googleOwner,customerId:id,managerId:manager,until};
    await save(req);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirect,response_type:"code",
      scope:SCOPE,access_type:"offline",prompt:"consent",state}).toString();
    res.redirect(url.href);
  }));
  route("get","/callback",enabled,wrap(async(req,res)=>{
    const pending = req.session.googleAdsPending;
    if(!pending || pending.userId !== req.googleOwner || pending.until < Date.now() || !equal(req.query.state,pending.state)) return res.status(403).send("Authorization expired or invalid. Start again in Vivid.");
    delete req.session.googleAdsPending; await save(req); await store.ready();
    // Validate persistent state before exchanging codes. Final consumption is atomic
    // with saving credentials, so replay and disconnect races cannot save a token.
    const states = await q("SELECT state_hash FROM google_ads_private_states WHERE state_hash=$1 AND owner_user_id=$2 AND expires_at>NOW()",[pending.hash,req.googleOwner]);
    if(!states.rows.length) return res.status(403).send("Authorization already used or expired.");
    try {
      if(req.query.error) return res.redirect(PATH+"?notice=denied");
      if(typeof req.query.code !== "string" || !req.query.code || req.query.code.length>4096) return res.status(400).send("Missing authorization code.");
      const reader = createGoogleReader({config,fetcher}), token = await reader.exchange(req.query.code);
      const account = await reader.account(token.access_token,pending.customerId,pending.managerId);
      await store.authorize(req.googleOwner,pending,token,account);
      res.redirect(PATH+"?notice=connected");
    } finally { await q("DELETE FROM google_ads_private_states WHERE state_hash=$1 AND owner_user_id=$2",[pending.hash,req.googleOwner]); }
  }));
  route("get","/:connectionId",enabled,wrap(async(req,res)=>{
    let range;
    try { range = dateRange(req.query); } catch { return res.status(400).send("Choose valid reporting dates."); }
    await store.ready();
    const evidence = await dashboardEvidence(q,req.googleOwner,range);
    const connection = evidence.connections.find(c=>String(c.id)===req.params.connectionId);
    if(!connection) return res.status(404).send("Google account not found.");
    req.session.googleAdsCsrf ||= crypto.randomBytes(32).toString("hex"); await save(req);
    const syncs = (await q(`SELECT s.started_at,s.date_from::text,s.date_to::text,s.status,s.rows_imported,s.api_version,s.error_code
      FROM google_ads_private_syncs s JOIN google_ads_private_connections c ON c.id=s.connection_id
      WHERE c.owner_user_id=$1 AND c.id=$2 ORDER BY s.id DESC LIMIT 20`,[req.googleOwner,connection.id])).rows;
    res.send(page("Google Ads dashboard",renderAccount({aiVisible:canPreviewAi(req.session),connection,campaigns:(evidence.campaigns||[]).filter(r=>String(r.connection_id)===String(connection.id)),rows:evidence.rows.filter(r=>String(r.connection_id)===String(connection.id)),daily:evidence.daily.filter(r=>String(r.connection_id)===String(connection.id)),syncs,range,csrf:req.session.googleAdsCsrf,autoSync,
      notice:req.query.imported==="1"?"Import completed. Google’s reported conversions remain separate from verified sales.":""})));
  }));
  const validConnection = (req,res,next) => /^\d+$/.test(req.params.connectionId) && Number.isSafeInteger(Number(req.params.connectionId)) && Number(req.params.connectionId)>0 ? next() : res.status(404).send("Google account not found.");
  route("post","/:connectionId/sync",enabled,csrf,validConnection,wrap(async(req,res)=>{
    let range;
    try { range = importRange(req.body); } catch { return res.status(400).send("Choose valid dates spanning at most 31 days."); }
    await store.ready(); await store.sync(req.googleOwner,req.params.connectionId,range);
    res.redirect(`${PATH}/${req.params.connectionId}?from=${range.from}&to=${range.to}&imported=1`);
  }));
  route("post","/:connectionId/disconnect",enabled,csrf,validConnection,wrap(async(req,res)=>{
    if(req.body.confirm!=="remove") return res.status(400).send("Confirm removal of this connection and its Google evidence.");
    await store.ready(); await store.disconnect(req.googleOwner,req.params.connectionId);
    delete req.session.googleAdsPending; await save(req);
    res.redirect(PATH+"?notice=disconnected");
  }));
}
module.exports = {registerGoogleAdsReadOnlyRoutes};
