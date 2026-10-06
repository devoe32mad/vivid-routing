"use strict";

const crypto = require("node:crypto");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.BASE_URL || "https://vivid-routing-production.up.railway.app";

const PLAN_BASIC = "basic";
const PLAN_PERFORMANCE = "performance";
const MONTHLY_PRICE = 35;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function validId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

async function ensureSchema(q) {
  await q(`
    CREATE TABLE IF NOT EXISTS sponsorship_performance_plans (
      qr_id INTEGER PRIMARY KEY REFERENCES qr_codes(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'basic'
        CHECK (plan IN ('basic','performance')),
      monthly_price NUMERIC(10,2) NOT NULL DEFAULT 35,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','upgrade_requested','cancelled')),
      upgrade_requested_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function attachBasicPlanToMarketplaceQr(q,{qrId,marketplaceRequestId,userId}) {
  if(!validId(qrId)||!validId(marketplaceRequestId)||!validId(userId)) return false;
  await ensureSchema(q);
  const result = await q(`
    INSERT INTO sponsorship_performance_plans (
      qr_id, plan, monthly_price, status, activated_at, created_at, updated_at
    )
    SELECT
      qr.id, 'basic', $4, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM qr_codes qr
    JOIN organization_advertising_requests ar
      ON ar.created_qr_id = qr.id
    WHERE qr.id = $1
      AND ar.id = $2
      AND ar.created_vivid_user_id = $3
      AND ar.status = 'Approved'
    ON CONFLICT (qr_id) DO NOTHING
    RETURNING qr_id
  `,[Number(qrId),Number(marketplaceRequestId),Number(userId),MONTHLY_PRICE]);
  return result.rows.length > 0;
}

async function loadAdvertiserSponsorshipState(q,userId,range,campaigns=[],userEmail="",requestId=0) {
  await ensureSchema(q);
  const rows=(await q(`
    SELECT
      ar.id AS request_id,
      ar.organization_id,
      ar.created_vivid_user_id,
      ar.email AS request_email,
      qr.id AS qr_id,
      qr.name AS qr_name,
      qr.description AS destination_url,
      s.name AS space_name,
      s.location,
      COALESCE(spp.plan,'basic') AS plan,
      COALESCE(spp.monthly_price,$5::numeric) AS monthly_price,
      COALESCE(spp.status,'active') AS status,
      spp.upgrade_requested_at,
      qc.campaign_id,
      c.name AS campaign_name,
      COUNT(e.id) FILTER (WHERE e.type='scan')::int AS scans
    FROM organization_advertising_requests ar
    LEFT JOIN users owner_user ON owner_user.id=ar.created_vivid_user_id
    JOIN qr_codes qr ON qr.id=ar.created_qr_id
    JOIN spaces s ON s.id=qr.space_id
    LEFT JOIN sponsorship_performance_plans spp ON spp.qr_id=qr.id
    LEFT JOIN qr_campaigns qc
      ON qc.qr_id=qr.id AND COALESCE(qc.is_active,true)=true
    LEFT JOIN campaigns c ON c.id=qc.campaign_id
    LEFT JOIN events e
      ON e.qr_id=qr.id
      AND (qc.campaign_id IS NULL OR e.campaign_id=qc.campaign_id)
      AND e.type='scan'
      AND e.created_at >= $3::date
      AND e.created_at < ($4::date + INTERVAL '1 day')
    WHERE ar.status='Approved'
      AND ar.created_qr_id IS NOT NULL
      AND (
        (
          $6::int > 0
          AND ar.id=$6
          AND (
            ar.created_vivid_user_id=$1
            OR owner_user.advertiser_customer_id=$1
            OR (
              NULLIF(TRIM($2::text),'') IS NOT NULL
              AND (
                LOWER(TRIM(ar.email))=LOWER(TRIM($2::text))
                OR LOWER(TRIM(owner_user.email))=LOWER(TRIM($2::text))
              )
            )
          )
        )
        OR (
          $6::int = 0
          AND (
            ar.created_vivid_user_id=$1
            OR owner_user.advertiser_customer_id=$1
            OR (
              NULLIF(TRIM($2::text),'') IS NOT NULL
              AND (
                LOWER(TRIM(ar.email))=LOWER(TRIM($2::text))
                OR LOWER(TRIM(owner_user.email))=LOWER(TRIM($2::text))
              )
            )
          )
        )
      )
      AND COALESCE(spp.status,'active') <> 'cancelled'
    GROUP BY
      ar.id,ar.organization_id,ar.created_vivid_user_id,ar.email,
      owner_user.advertiser_customer_id,owner_user.email,
      qr.id,qr.name,qr.description,s.name,s.location,
      spp.plan,spp.monthly_price,spp.status,spp.upgrade_requested_at,
      qc.campaign_id,c.name
    ORDER BY ar.id DESC,qr.id,qc.campaign_id
  `,[
    Number(userId),
    String(userEmail||""),
    range.from,
    range.to,
    MONTHLY_PRICE,
    validId(requestId)?Number(requestId):0
  ])).rows;

  const explicitCampaignIds=new Set(rows.filter(r=>validId(r.campaign_id)).map(r=>Number(r.campaign_id)));
  const hasLegacyCampaigns=(campaigns||[]).some(c=>!explicitCampaignIds.has(Number(c.id)));
  const hasPerformance=rows.some(r=>r.plan===PLAN_PERFORMANCE && r.status==="active");
  const hasBasic=rows.some(r=>r.plan===PLAN_BASIC && r.status!=="cancelled");
  return {
    rows,
    hasLegacyCampaigns,
    hasPerformance,
    hasBasic,
    sponsorshipOnly: rows.length > 0,
    basicOnly: rows.length > 0 && !hasPerformance
  };
}

function renderBasicSponsorshipDashboard({title="Your sponsorship performance",range,placements=[],csrf="",upgradeRequested=false,isPlatformAdmin=false}) {
  const grouped=new Map();
  for(const row of placements) {
    if(!grouped.has(Number(row.qr_id))) grouped.set(Number(row.qr_id),{...row,scans:0,campaigns:[]});
    const item=grouped.get(Number(row.qr_id));
    item.scans+=Number(row.scans||0);
    if(row.campaign_name) item.campaigns.push(row.campaign_name);
    if(row.status==="upgrade_requested") item.status="upgrade_requested";
    if(row.plan===PLAN_PERFORMANCE && row.status==="active") {
      item.plan=PLAN_PERFORMANCE;
      item.status="active";
    }
  }
  const items=[...grouped.values()];
  const totalScans=items.reduce((sum,item)=>sum+Number(item.scans||0),0);
  const anyUpgradeRequested=upgradeRequested||items.some(item=>item.status==="upgrade_requested");
  const locked=(label)=>`<div class="sp-card sp-locked"><span class="sp-muted">${esc(label)}</span><div class="sp-upgrade">${anyUpgradeRequested?"Upgrade requested":"Upgrade"}</div><small>${anyUpgradeRequested?"Vivid will complete activation":"Available with Vivid Performance"}</small></div>`;
  return `<style>
.sp-basic{max-width:1050px;margin:28px auto;padding:0 20px 50px;color:#122b49;font:15px/1.5 system-ui,sans-serif}
.sp-hero{background:#102b50;color:#fff;border-radius:18px;padding:26px}.sp-hero h1{margin:5px 0 8px;font-size:30px}
.sp-grid,.sp-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:18px}
.sp-card{border:1px solid #d9e2ed;border-radius:14px;background:#fff;padding:18px}.sp-card h3{margin:3px 0 8px}
.sp-metric{font-size:34px;font-weight:850;color:#1559c7}.sp-muted{color:#60748b}
.sp-locked{background:#f8fafc}.sp-upgrade{font-size:24px;font-weight:850;color:#1559c7;margin:8px 0 3px}
.sp-lock{margin-top:22px;border:1px solid #b9cbe1;background:#f7fbff;border-radius:16px;padding:20px}
.sp-lock button{background:#1559c7;color:#fff;border:0;border-radius:9px;padding:11px 15px;font-weight:800;cursor:pointer}
.sp-url{overflow-wrap:anywhere;font-size:13px;color:#52667e}
</style>
<main class="sp-basic">
<section class="sp-hero"><small>SPONSORSHIP · BASIC</small><h1>${esc(title)}</h1>
<p>See how many people engage with your physical placement. Deeper website activity, conversions, revenue and ROI are available with Vivid Performance.</p></section>
${anyUpgradeRequested?`<section class="sp-card" style="margin-top:18px;border-color:#8fb3df;background:#f3f8ff"><strong>Vivid Performance upgrade requested.</strong><p style="margin-bottom:0">Your request has been received. Basic scan reporting remains active while Vivid completes the Performance activation.</p></section>`:""}
<form method="get" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:18px 0">
<label>From<br><input type="date" name="from" value="${esc(range.from)}" required></label>
<label>To<br><input type="date" name="to" value="${esc(range.to)}" required></label>
<button style="padding:8px 12px">Update period</button></form>
<section class="sp-metrics">
<div class="sp-card"><span class="sp-muted">Scans</span><div class="sp-metric">${totalScans.toLocaleString("en-US")}</div><small>Included with Basic</small></div>
${locked("Website activity")}
${locked("Conversions")}
${locked("Attributed revenue")}
${locked("ROI")}
</section>
<section class="sp-grid">${items.map(item=>`<article class="sp-card">
<small class="sp-muted">${esc(item.space_name||"Placement")}</small><h3>${esc(item.qr_name||"Sponsorship placement")}</h3>
<div class="sp-metric">${Number(item.scans||0).toLocaleString("en-US")}</div><strong>Scans</strong>
${item.destination_url?`<p class="sp-url"><strong>Current destination:</strong><br>${esc(item.destination_url)}</p>`:""}
${item.campaigns.length?`<p class="sp-muted">Campaign: ${esc([...new Set(item.campaigns)].join(" · "))}</p>`:""}
${item.plan===PLAN_PERFORMANCE && item.status==="active"
? `<p><strong>Vivid Performance active · $35/month</strong></p>`
: item.status==="upgrade_requested"
? `<p><strong>Vivid Performance upgrade requested.</strong></p>${isPlatformAdmin?`<form method="post" action="/admin/sponsorship-performance/activate" style="margin-top:12px"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="qr_id" value="${Number(item.qr_id)}"><button type="submit">Activate Vivid Performance</button></form>`:""}`
: `<form method="post" action="/admin/sponsorship-performance/upgrade">
<input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="qr_id" value="${Number(item.qr_id)}">
<button type="submit">Request Vivid Performance Upgrade — $35/month</button>
</form>`}
</article>`).join("")}</section>
<section class="sp-lock"><h2 style="margin-top:0">Unlock the full performance view</h2>
<p>Vivid Performance adds website activity after the scan, CTA activity, leads, conversions, attributed revenue, ROI, recommendations and campaign controls.</p>
</section></main>`;
}

async function sessionHasBasicSponsorship(q,sessionUser={}) {
  await ensureSchema(q);
  const primaryId=Number(sessionUser.login_user_id||sessionUser.id||0);
  const secondaryId=Number(sessionUser.id||0);
  const email=String(sessionUser.email||"").trim().toLowerCase();

  const row=(await q(`
    SELECT 1
    FROM organization_advertising_requests ar
    LEFT JOIN users u ON u.id=ar.created_vivid_user_id
    LEFT JOIN sponsorship_performance_plans spp ON spp.qr_id=ar.created_qr_id
    WHERE ar.status='Approved'
      AND ar.created_qr_id IS NOT NULL
      AND COALESCE(spp.plan,'basic')='basic'
      AND COALESCE(spp.status,'active') IN ('active','upgrade_requested')
      AND (
        ($1::int > 0 AND ar.created_vivid_user_id=$1)
        OR ($2::int > 0 AND u.advertiser_customer_id=$2)
        OR (
          NULLIF($3::text,'') IS NOT NULL
          AND (
            LOWER(TRIM(ar.email))=$3
            OR LOWER(TRIM(u.email))=$3
          )
        )
      )
    LIMIT 1
  `,[
    Number.isSafeInteger(primaryId)&&primaryId>0?primaryId:0,
    Number.isSafeInteger(secondaryId)&&secondaryId>0?secondaryId:0,
    email
  ])).rows[0];

  return Boolean(row);
}

async function basicRestrictionApplies(q,userId) {
  if(!validId(userId)) return false;
  await ensureSchema(q);
  const row=(await q(`
    SELECT 1
    FROM sponsorship_performance_plans spp
    JOIN qr_codes qr ON qr.id=spp.qr_id
    JOIN organization_advertising_requests ar
      ON ar.created_qr_id=qr.id
     AND ar.created_vivid_user_id=$1
     AND ar.status='Approved'
    WHERE spp.plan='basic'
      AND spp.status IN ('active','upgrade_requested')
    LIMIT 1
  `,[Number(userId)])).rows[0];
  return Boolean(row);
}

async function basicQrRestricted(q,userId,qrId) {
  if(!validId(userId)||!validId(qrId)) return false;
  await ensureSchema(q);
  const row=(await q(`
    SELECT 1
    FROM sponsorship_performance_plans spp
    JOIN qr_codes qr ON qr.id=spp.qr_id
    JOIN organization_advertising_requests ar
      ON ar.created_qr_id=qr.id
     AND ar.created_vivid_user_id=$1
     AND ar.status='Approved'
    WHERE spp.qr_id=$2
      AND spp.plan='basic'
      AND spp.status IN ('active','upgrade_requested')
    LIMIT 1
  `,[Number(userId),Number(qrId)])).rows[0];
  return Boolean(row);
}

async function basicCampaignRestricted(q,userId,campaignId) {
  if(!validId(userId)||!validId(campaignId)) return false;
  await ensureSchema(q);
  const row=(await q(`
    SELECT 1
    FROM qr_campaigns qc
    JOIN sponsorship_performance_plans spp ON spp.qr_id=qc.qr_id
    JOIN qr_codes qr ON qr.id=spp.qr_id
    JOIN organization_advertising_requests ar
      ON ar.created_qr_id=qr.id
     AND ar.created_vivid_user_id=$1
     AND ar.status='Approved'
    WHERE qc.campaign_id=$2
      AND COALESCE(qc.is_active,true)=true
      AND spp.plan='basic'
      AND spp.status IN ('active','upgrade_requested')
    LIMIT 1
  `,[Number(userId),Number(campaignId)])).rows[0];
  return Boolean(row);
}

async function initialMarketplaceCampaignAllowed(q,userId,qrId,marketplaceRequestId) {
  if(!validId(userId)||!validId(qrId)||!validId(marketplaceRequestId)) return false;
  const row=(await q(`
    SELECT 1
    FROM organization_advertising_requests ar
    WHERE ar.id=$1
      AND ar.created_vivid_user_id=$2
      AND ar.created_qr_id=$3
      AND ar.status='Approved'
      AND ar.created_campaign_id IS NULL
    LIMIT 1
  `,[Number(marketplaceRequestId),Number(userId),Number(qrId)])).rows[0];
  return Boolean(row);
}

async function completeBasicMarketplaceSetup(q,{userId,qrId,campaignId,marketplaceRequestId}) {
  if(!validId(userId)||!validId(qrId)||!validId(campaignId)||!validId(marketplaceRequestId)) return false;
  await ensureSchema(q);

  const approved=(await q(`
    SELECT id
    FROM organization_advertising_requests
    WHERE id=$1
      AND created_vivid_user_id=$2
      AND created_qr_id=$3
      AND status='Approved'
    LIMIT 1
  `,[Number(marketplaceRequestId),Number(userId),Number(qrId)])).rows[0];

  if(!approved) return false;

  await q(`
    INSERT INTO qr_campaigns (
      qr_id,campaign_id,is_active,assigned_at,started_at,ended_at
    )
    SELECT $1,$2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM qr_campaigns
      WHERE qr_id=$1
        AND campaign_id=$2
        AND COALESCE(is_active,true)=true
    )
  `,[Number(qrId),Number(campaignId)]);

  await q(`
    UPDATE organization_advertising_requests
    SET created_campaign_id=$1,
        setup_status='Complete',
        setup_completed_at=COALESCE(setup_completed_at,CURRENT_TIMESTAMP),
        updated_at=CURRENT_TIMESTAMP
    WHERE id=$2
      AND created_vivid_user_id=$3
      AND created_qr_id=$4
      AND status='Approved'
  `,[
    Number(campaignId),
    Number(marketplaceRequestId),
    Number(userId),
    Number(qrId)
  ]);

  await q(`
    UPDATE contracts
    SET qr_id=$1,
        status='Active',
        activated_at=COALESCE(activated_at,CURRENT_TIMESTAMP),
        updated_at=CURRENT_TIMESTAMP
    WHERE advertising_request_id=$2
  `,[Number(qrId),Number(marketplaceRequestId)]);

  return true;
}

function registerSponsorshipPerformanceRoutes({app,q,requireLogin,page}) {
  app.get("/admin/sponsorship-performance",async(req,res)=>{
    if(!req.session?.user){
      req.session.afterLoginReturn="/admin/sponsorship-performance";
      return req.session.save(err=>{
        if(err){
          console.error("SPONSORSHIP RETURN SESSION ERROR",err);
          return res.status(500).send("Unable to preserve sponsorship destination.");
        }
        return res.redirect(302,"/login");
      });
    }
    try{
      const sessionUser=req.session?.user||{};
      const userId=Number(sessionUser.login_user_id||sessionUser.id);
      const isPlatformAdmin=["admin","super_admin","platform"].includes(String(sessionUser.role||sessionUser.user_role||"").toLowerCase());
      if(!validId(userId))return res.status(403).send("Account required.");
      const iso=/^\\d{4}-\\d{2}-\\d{2}$/;
      const today=new Date();
      const to=iso.test(String(req.query?.to||""))?String(req.query.to):today.toISOString().slice(0,10);
      const fromDate=new Date(to+"T00:00:00Z");
      fromDate.setUTCDate(fromDate.getUTCDate()-29);
      const from=iso.test(String(req.query?.from||""))?String(req.query.from):fromDate.toISOString().slice(0,10);
      const range={from,to};
      const requestedRequestId=Number(
        req.query?.request_id ||
        req.session?.marketplaceSetup?.request_id ||
        0
      );

      // Repair any approved marketplace sponsorship that reached QR creation
      // before the Basic plan row was attached (including legacy test-account
      // ID mismatches between advertiser/customer id and login user id).
      await ensureSchema(q);
      await q(`
        INSERT INTO sponsorship_performance_plans (
          qr_id,plan,monthly_price,status,activated_at,created_at,updated_at
        )
        SELECT DISTINCT
          ar.created_qr_id,'basic',$2::numeric,'active',
          CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        FROM organization_advertising_requests ar
        JOIN qr_codes qr ON qr.id=ar.created_qr_id
        WHERE ar.created_vivid_user_id=$1
          AND ar.status='Approved'
          AND ar.created_qr_id IS NOT NULL
        ON CONFLICT (qr_id) DO NOTHING
      `,[userId,MONTHLY_PRICE]);

      let state=await loadAdvertiserSponsorshipState(q,userId,range,[],sessionUser.email||"",requestedRequestId);

      // Platform/admin support users may inspect an exact approved sponsorship
      // by request ID without being treated as the advertiser owner.
      if(!state.rows.length && isPlatformAdmin && validId(requestedRequestId)){
        const rows=(await q(`
          SELECT
            ar.id AS request_id,
            ar.organization_id,
            ar.created_vivid_user_id,
            ar.email AS request_email,
            qr.id AS qr_id,
            qr.name AS qr_name,
            qr.description AS destination_url,
            s.name AS space_name,
            s.location,
            COALESCE(spp.plan,'basic') AS plan,
            COALESCE(spp.monthly_price,$4::numeric) AS monthly_price,
            COALESCE(spp.status,'active') AS status,
            spp.upgrade_requested_at,
            qc.campaign_id,
            c.name AS campaign_name,
            COUNT(e.id) FILTER (WHERE e.type='scan')::int AS scans
          FROM organization_advertising_requests ar
          JOIN qr_codes qr ON qr.id=ar.created_qr_id
          JOIN spaces s ON s.id=qr.space_id
          LEFT JOIN sponsorship_performance_plans spp ON spp.qr_id=qr.id
          LEFT JOIN qr_campaigns qc ON qc.qr_id=qr.id AND COALESCE(qc.is_active,true)=true
          LEFT JOIN campaigns c ON c.id=qc.campaign_id
          LEFT JOIN events e
            ON e.qr_id=qr.id
            AND (qc.campaign_id IS NULL OR e.campaign_id=qc.campaign_id)
            AND e.type='scan'
            AND e.created_at >= $2::date
            AND e.created_at < ($3::date + INTERVAL '1 day')
          WHERE ar.id=$1
            AND ar.status='Approved'
            AND ar.created_qr_id IS NOT NULL
            AND COALESCE(spp.status,'active') <> 'cancelled'
          GROUP BY
            ar.id,ar.organization_id,ar.created_vivid_user_id,ar.email,
            qr.id,qr.name,qr.description,s.name,s.location,
            spp.plan,spp.monthly_price,spp.status,spp.upgrade_requested_at,
            qc.campaign_id,c.name
          ORDER BY qr.id,qc.campaign_id
        `,[Number(requestedRequestId),range.from,range.to,MONTHLY_PRICE])).rows;
        state={
          rows,
          hasLegacyCampaigns:false,
          hasPerformance:rows.some(r=>r.plan===PLAN_PERFORMANCE && r.status==="active"),
          hasBasic:rows.some(r=>r.plan===PLAN_BASIC && r.status!=="cancelled"),
          sponsorshipOnly:rows.length>0,
          basicOnly:rows.length>0 && !rows.some(r=>r.plan===PLAN_PERFORMANCE && r.status==="active")
        };
      }

      if(!state.rows.length){
        return res.status(404).send(
          requestedRequestId
            ? "This approved sponsorship could not be matched to your signed-in account."
            : "No active sponsorship placements were found for this account."
        );
      }
      req.session.sponsorshipPerformanceCsrf||=crypto.randomBytes(32).toString("hex");
      res.set?.("Cache-Control","no-store");
      const body=renderBasicSponsorshipDashboard({
        title:"Your sponsorship performance",
        range,
        placements:state.rows,
        csrf:req.session.sponsorshipPerformanceCsrf,
        upgradeRequested:req.query.upgrade==="requested",
        isPlatformAdmin
      });
      return res.send(typeof page==="function"?page("Sponsorship Performance",body):body);
    }catch(error){
      console.error("SPONSORSHIP PERFORMANCE DASHBOARD ERROR",error);
      return res.status(500).send("Unable to load sponsorship performance. Please try again.");
    }
  });

  app.post("/admin/sponsorship-performance/activate",requireLogin,async(req,res)=>{
    try{
      const role=String(req.session?.user?.role||"").trim().toLowerCase();
      if(!["admin","super_admin"].includes(role))return res.status(403).send("Vivid administrator access required.");
      if(!validId(req.body?.qr_id))return res.status(400).send("Valid placement required.");

      const expected=String(req.session.sponsorshipPerformanceCsrf||""),provided=String(req.body?.csrf||"");
      const a=Buffer.from(expected),b=Buffer.from(provided);
      if(!expected||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(403).send("Reload the sponsorship dashboard and try again.");

      await ensureSchema(q);
      const activation=(await q(`
        UPDATE sponsorship_performance_plans spp
        SET plan='performance',
            status='active',
            activated_at=CURRENT_TIMESTAMP,
            upgrade_requested_at=NULL,
            updated_at=CURRENT_TIMESTAMP
        WHERE spp.qr_id=$1
          AND spp.plan='basic'
          AND spp.status='upgrade_requested'
        RETURNING spp.qr_id
      `,[Number(req.body.qr_id)])).rows[0];

      if(!activation)return res.status(404).send("This placement is not waiting for activation.");

      const detail=(await q(`
        SELECT
          ar.id AS request_id,
          ar.email AS advertiser_email,
          ar.business_name,
          s.name AS placement_name,
          s.location AS placement_location
        FROM organization_advertising_requests ar
        JOIN qr_codes qr ON qr.id=ar.created_qr_id
        JOIN spaces s ON s.id=qr.space_id
        WHERE ar.created_qr_id=$1
          AND ar.status='Approved'
        ORDER BY ar.id DESC
        LIMIT 1
      `,[Number(req.body.qr_id)])).rows[0];

      if(detail?.advertiser_email){
        try{
          const advertiser=detail.business_name||detail.advertiser_email;
          const {error}=await resend.emails.send({
            from:"Vivid <notifications@vividspots.com>",
            to:detail.advertiser_email,
            replyTo:"mike@vividspots.com",
            subject:"Vivid Performance is now active",
            html:`<div style="font-family:Arial,sans-serif;line-height:1.5;color:#17304f">
              <h2>Vivid Performance is now active</h2>
              <p>${esc(advertiser)}, your Vivid Performance upgrade is active for <strong>${esc(detail.placement_name||"your sponsorship placement")}</strong>.</p>
              <p>You can now access the deeper performance view, including website activity, conversions, attributed revenue and ROI.</p>
              <p><a href="${BASE_URL}/admin/sponsorship-performance?request_id=${Number(detail.request_id)}">Open Sponsorship Performance</a></p>
            </div>`
          });
          if(error)console.error("SPONSORSHIP ACTIVATION EMAIL ERROR",error);
          else console.log("SPONSORSHIP ACTIVATION EMAIL SENT",{requestId:Number(detail.request_id),to:detail.advertiser_email});
        }catch(emailError){
          console.error("SPONSORSHIP ACTIVATION EMAIL EXCEPTION",emailError);
        }
      }

      const suffix=detail?.request_id?"?request_id="+Number(detail.request_id)+"&activated=1":"?activated=1";
      return res.redirect(303,"/admin/sponsorship-performance"+suffix);
    }catch(error){
      console.error("SPONSORSHIP PERFORMANCE ACTIVATE ERROR",error);
      return res.status(500).send("Unable to activate Vivid Performance. Please try again.");
    }
  });

  app.post("/admin/sponsorship-performance/upgrade",requireLogin,async(req,res)=>{
    try{
      const userId=Number(req.session?.user?.login_user_id||req.session?.user?.id);
      if(!validId(userId)||!validId(req.body?.qr_id))return res.status(400).send("Valid placement required.");
      const expected=String(req.session.sponsorshipPerformanceCsrf||""),provided=String(req.body?.csrf||"");
      const a=Buffer.from(expected),b=Buffer.from(provided);
      if(!expected||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(403).send("Reload your sponsorship dashboard and try again.");
      await ensureSchema(q);
      const result=await q(`
        UPDATE sponsorship_performance_plans spp
        SET status='upgrade_requested',
            upgrade_requested_at=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP
        FROM qr_codes qr
        JOIN organization_advertising_requests ar
          ON ar.created_qr_id=qr.id
         AND ar.created_vivid_user_id=$2
         AND ar.status='Approved'
        WHERE spp.qr_id=qr.id
          AND spp.qr_id=$1
          AND spp.plan='basic'
          AND spp.status='active'
        RETURNING spp.qr_id
      `,[Number(req.body.qr_id),userId]);
      if(!result.rows.length)return res.status(404).send("Placement not found or already upgraded.");

      const upgradeDetail=(await q(`
        SELECT
          ar.id AS request_id,
          ar.email AS advertiser_email,
          ar.business_name,
          s.name AS placement_name,
          s.location AS placement_location,
          qr.name AS qr_name
        FROM organization_advertising_requests ar
        JOIN qr_codes qr ON qr.id=ar.created_qr_id
        JOIN spaces s ON s.id=qr.space_id
        WHERE ar.created_qr_id=$1
          AND ar.status='Approved'
        ORDER BY ar.id DESC
        LIMIT 1
      `,[Number(req.body.qr_id)])).rows[0];

      if(upgradeDetail){
        try{
          const advertiser=upgradeDetail.business_name || upgradeDetail.advertiser_email || "Advertiser";
          const placement=upgradeDetail.placement_name || upgradeDetail.qr_name || ("QR "+Number(req.body.qr_id));
          const requestId=Number(upgradeDetail.request_id);
          const { error }=await resend.emails.send({
            from:"Vivid <notifications@vividspots.com>",
            to:"mike@vividspots.com",
            replyTo:"mike@vividspots.com",
            subject:`Vivid Performance upgrade requested — ${advertiser}`,
            html:`<div style="font-family:Arial,sans-serif;line-height:1.5;color:#17304f">
              <h2>Vivid Performance upgrade requested</h2>
              <p><strong>Advertiser:</strong> ${esc(advertiser)}</p>
              <p><strong>Email:</strong> ${esc(upgradeDetail.advertiser_email||"—")}</p>
              <p><strong>Placement:</strong> ${esc(placement)}</p>
              <p><strong>Location:</strong> ${esc(upgradeDetail.placement_location||"—")}</p>
              <p><strong>Request ID:</strong> ${requestId}</p>
              <p><a href="${BASE_URL}/admin/sponsorship-performance?request_id=${requestId}">Review sponsorship</a></p>
            </div>`
          });
          if(error) console.error("SPONSORSHIP UPGRADE EMAIL ERROR",error);
          else console.log("SPONSORSHIP UPGRADE EMAIL SENT",{requestId,to:"mike@vividspots.com"});
        }catch(emailError){
          console.error("SPONSORSHIP UPGRADE EMAIL EXCEPTION",emailError);
        }
      }

      const reqRow=(await q(`
        SELECT ar.id
        FROM organization_advertising_requests ar
        WHERE ar.created_qr_id=$1
          AND ar.status='Approved'
        ORDER BY ar.id DESC
        LIMIT 1
      `,[Number(req.body.qr_id)])).rows[0];
      const suffix=reqRow?.id
        ? "?request_id="+Number(reqRow.id)+"&upgrade=requested"
        : "?upgrade=requested";
      return res.redirect(303,"/admin/sponsorship-performance"+suffix);
    }catch(error){
      console.error("SPONSORSHIP PERFORMANCE UPGRADE ERROR",error);
      return res.status(500).send("Unable to request the upgrade. Please try again.");
    }
  });
}

module.exports={
  PLAN_BASIC,PLAN_PERFORMANCE,MONTHLY_PRICE,
  ensureSchema,attachBasicPlanToMarketplaceQr,
  loadAdvertiserSponsorshipState,renderBasicSponsorshipDashboard,
  registerSponsorshipPerformanceRoutes,
  sessionHasBasicSponsorship,
  basicRestrictionApplies,basicQrRestricted,basicCampaignRestricted,initialMarketplaceCampaignAllowed,completeBasicMarketplaceSetup,
  async isBasicSponsorshipAdvertiser(q,userId) {
    if(!validId(userId)) return false;
    await ensureSchema(q);
    const row=(await q(`
      SELECT 1
      FROM sponsorship_performance_plans spp
      JOIN qr_codes qr ON qr.id=spp.qr_id
      JOIN organization_advertising_requests ar
        ON ar.created_qr_id=qr.id
       AND ar.created_vivid_user_id=$1
       AND ar.status='Approved'
      WHERE spp.plan='basic'
        AND spp.status IN ('active','upgrade_requested')
      LIMIT 1
    `,[Number(userId)])).rows[0];
    return Boolean(row);
  }
};
