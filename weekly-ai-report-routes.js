"use strict";

const {
  renderWeeklyAiPreferences,
  renderWeeklyAiReport
} = require("./weekly-ai-report");

function registerWeeklyAiReportRoutes({
  app,
  q,
  page,
  orgPage,
  organizationNav,
  requireLogin,
  getOrganizationScope,
  buildPriorityCenter,
  sendOrganizationNotification,
  baseUrl = "https://vivid-routing-production.up.railway.app"
}) {
  let schemaReady = false;

  async function ensureSchema() {
    if (schemaReady) return;
    await q(`
      CREATE TABLE IF NOT EXISTS ai_weekly_report_preferences (
        id BIGSERIAL PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id BIGINT NOT NULL,
        scope_id INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT false,
        delivery_day SMALLINT NOT NULL DEFAULT 1,
        delivery_hour SMALLINT NOT NULL DEFAULT 8,
        timezone TEXT NOT NULL DEFAULT 'America/New_York',
        include_external BOOLEAN NOT NULL DEFAULT true,
        last_sent_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (actor_type, actor_id, scope_id)
      )
    `);
    await q(`
      CREATE TABLE IF NOT EXISTS ai_external_guidance (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        summary TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT 'all',
        active BOOLEAN NOT NULL DEFAULT true,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await q(`ALTER TABLE ai_weekly_report_preferences ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ`);
    schemaReady = true;
  }

  async function sendDueReports() {
    if (typeof sendOrganizationNotification !== "function") return;
    try {
      await ensureSchema();
      const due = await q(`
        SELECT p.id,p.actor_type,p.actor_id,p.scope_id,p.timezone,u.email,
          COALESCE(NULLIF(TRIM(u.name),''),NULLIF(TRIM(u.email),''),'Vivid user') recipient_name
        FROM ai_weekly_report_preferences p
        JOIN users u ON u.id=p.actor_id
        WHERE p.enabled=true
          AND EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE p.timezone))::int=p.delivery_day
          AND EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE p.timezone))::int=p.delivery_hour
          AND (p.last_sent_at IS NULL OR
            (p.last_sent_at AT TIME ZONE p.timezone)::date < (CURRENT_TIMESTAMP AT TIME ZONE p.timezone)::date)
          AND NULLIF(TRIM(u.email),'') IS NOT NULL
        ORDER BY p.id
        LIMIT 50
      `);
      for (const item of due.rows) {
        const claimed = await q(
          `UPDATE ai_weekly_report_preferences
           SET last_sent_at=CURRENT_TIMESTAMP
           WHERE id=$1 AND (last_sent_at IS NULL OR
             (last_sent_at AT TIME ZONE timezone)::date < (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date)
           RETURNING id`,
          [item.id]
        );
        if (!claimed.rows.length) continue;
        const reportPath = item.actor_type === "enterprise"
          ? `/org-weekly-ai-report?organization_id=${Number(item.scope_id)}`
          : "/admin/weekly-ai-report";
        const reportUrl = `${String(baseUrl).replace(/\/$/, "")}${reportPath}`;
        const sent = await sendOrganizationNotification({
          to: item.email,
          subject: "Your Vivid AI weekly report is ready",
          senderName: "Vivid AI",
          html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033;"><div style="background:linear-gradient(135deg,#0b1f3a,#2563eb);padding:24px;border-radius:16px 16px 0 0;color:#fff;"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#dbeafe;">Vivid AI Weekly Report</div><h1 style="margin:8px 0 5px;font-size:27px;">Your report is ready</h1><p style="margin:0;color:#dbeafe;">Performance, events and recommended next actions in one clickable report.</p></div><div style="border:1px solid #dbe4f0;border-top:0;border-radius:0 0 16px 16px;padding:24px;background:#fff;"><p>Hi ${String(item.recipient_name).replace(/[<>&"']/g, "")},</p><p>Open your role-specific report to review measured results, upcoming campaign events and Vivid AI recommendations. Sign-in is required to protect account data.</p><p style="margin:22px 0;"><a href="${reportUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:800;">Open My Weekly Report</a></p><p style="font-size:12px;color:#657184;">Vivid does not automatically change campaigns, schedules, pricing or contracts.</p></div></div>`
        });
        if (!sent) {
          await q("UPDATE ai_weekly_report_preferences SET last_sent_at=NULL WHERE id=$1", [item.id]);
        }
      }
    } catch (error) {
      console.error("WEEKLY AI DELIVERY ERROR", error);
    }
  }

  function normalizeTimezone(value) {
    const allowed = new Set([
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles"
    ]);
    return allowed.has(value) ? value : "America/New_York";
  }

  async function loadPreferences(actorType, actorId, scopeId) {
    await ensureSchema();
    const result = await q(
      `SELECT enabled, delivery_day, delivery_hour, timezone, include_external
       FROM ai_weekly_report_preferences
       WHERE actor_type=$1 AND actor_id=$2 AND scope_id=$3`,
      [actorType, actorId, scopeId]
    );
    const row = result.rows[0] || {};
    return {
      enabled: row.enabled === true,
      deliveryDay: Number(row.delivery_day || 1),
      deliveryHour: Number(row.delivery_hour ?? 8),
      timezone: row.timezone || "America/New_York",
      includeExternal: row.include_external !== false
    };
  }

  async function savePreferences(req, res, actorType, actorId, scopeId, returnTo) {
    await ensureSchema();
    const deliveryDay = Math.min(5, Math.max(1, Number(req.body.delivery_day || 1)));
    const deliveryHour = Math.min(17, Math.max(6, Number(req.body.delivery_hour || 8)));
    const timezone = normalizeTimezone(String(req.body.timezone || ""));
    await q(
      `INSERT INTO ai_weekly_report_preferences
         (actor_type, actor_id, scope_id, enabled, delivery_day, delivery_hour, timezone, include_external)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (actor_type, actor_id, scope_id)
       DO UPDATE SET enabled=EXCLUDED.enabled, delivery_day=EXCLUDED.delivery_day,
         delivery_hour=EXCLUDED.delivery_hour, timezone=EXCLUDED.timezone,
         include_external=EXCLUDED.include_external, updated_at=CURRENT_TIMESTAMP`,
      [actorType, actorId, scopeId, req.body.enabled === "1", deliveryDay, deliveryHour, timezone, req.body.include_external === "1"]
    );
    res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}weekly_settings=saved`);
  }

  async function loadExternalGuidance(audience) {
    await ensureSchema();
    const result = await q(
      `SELECT title, source_name, source_url, summary
       FROM ai_external_guidance
       WHERE active=true AND audience IN ('all',$1)
       ORDER BY COALESCE(published_at,created_at) DESC
       LIMIT 3`,
      [audience]
    );
    return result.rows.map(row => ({
      title: row.title,
      source: row.source_name,
      url: row.source_url,
      summary: row.summary
    }));
  }

  async function loadMetrics(whereSql, params, startOffsetDays, endOffsetDays) {
    const result = await q(
      `SELECT
         COUNT(e.id) FILTER (WHERE e.type='scan')::int scans,
         COUNT(e.id) FILTER (WHERE e.type IN ('offer','maps','waze','destination_click'))::int clicks,
         COUNT(e.id) FILTER (WHERE e.type='conversion')::int conversions,
         COALESCE(SUM(e.value) FILTER (WHERE e.type='conversion'),0)::numeric revenue
       FROM events e
       LEFT JOIN campaigns c ON c.id=e.campaign_id
       LEFT JOIN qr_codes qr ON qr.id=e.qr_id
       LEFT JOIN spaces s ON s.id=qr.space_id
       WHERE e.created_at >= CURRENT_TIMESTAMP - ($${params.length + 1}::int * INTERVAL '1 day')
         AND e.created_at < CURRENT_TIMESTAMP - ($${params.length + 2}::int * INTERVAL '1 day')
         AND (${whereSql})`,
      [...params, startOffsetDays, endOffsetDays]
    );
    return result.rows[0] || {};
  }

  async function loadCampaigns(whereSql, params, role, organizationId) {
    const result = await q(
      `SELECT c.id,c.name,c.advertiser,
         COALESCE(m.scans,0)::int scans,
         COALESCE(m.engagement,0)::int engagement,
         COALESCE(m.conversions,0)::int conversions,
         COALESCE(m.revenue,0)::numeric revenue
       FROM campaigns c
       LEFT JOIN qr_campaigns qc ON qc.campaign_id=c.id
       LEFT JOIN qr_codes qr ON qr.id=qc.qr_id
       LEFT JOIN spaces s ON s.id=qr.space_id
       LEFT JOIN (
         SELECT campaign_id,
           COUNT(id) FILTER (WHERE type='scan') scans,
           COUNT(id) FILTER (WHERE type IN ('offer','maps','waze','destination_click')) engagement,
           COUNT(id) FILTER (WHERE type='conversion') conversions,
           COALESCE(SUM(value) FILTER (WHERE type='conversion'),0) revenue
         FROM events
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         GROUP BY campaign_id
       ) m ON m.campaign_id=c.id
       WHERE (${whereSql}) AND COALESCE(c.is_archived,false)=false
       GROUP BY c.id,c.name,c.advertiser,m.scans,m.engagement,m.conversions,m.revenue
       ORDER BY c.id`,
      params
    );
    return result.rows.map(row => ({
      ...row,
      href: role === "enterprise"
        ? `/org-performance?organization_id=${organizationId}`
        : `/admin/edit-campaign/${Number(row.id)}`
    }));
  }

  async function loadEvents(whereSql, params, role, organizationId) {
    const result = await q(
      `SELECT cs.event_name,cs.event_type,cs.event_start_at,cs.event_timezone,
         c.name campaign_name,qr.name qr_name
       FROM campaign_schedules cs
       LEFT JOIN campaigns c ON c.id=cs.campaign_id
       LEFT JOIN qr_codes qr ON qr.id=cs.qr_id
       LEFT JOIN spaces s ON s.id=qr.space_id
       WHERE COALESCE(cs.schedule_kind,'weekly')='event'
         AND COALESCE(cs.is_active,true)=true
         AND cs.event_start_at >= CURRENT_TIMESTAMP
         AND cs.event_start_at < CURRENT_TIMESTAMP + INTERVAL '14 days'
         AND (${whereSql})
       ORDER BY cs.event_start_at LIMIT 12`,
      params
    );
    const href = role === "enterprise"
      ? `/org-performance?organization_id=${organizationId}`
      : "/admin/event-calendar";
    return result.rows.map(row => ({
      name: row.event_name,
      type: row.event_type,
      startsAt: row.event_start_at,
      timezone: row.event_timezone,
      campaign: row.campaign_name,
      placement: row.qr_name,
      href
    }));
  }

  app.get("/admin/weekly-ai-report", requireLogin, async (req, res) => {
    try {
      const actor = req.session.user;
      const actorId = Number(actor.id || 0);
      const superAdmin = actor.role === "super_admin";
      const whereSql = superAdmin ? "true" : "(c.user_id=$1 OR s.user_id=$1)";
      const params = superAdmin ? [] : [actorId];
      const [metrics, previousMetrics, campaigns, events, preferences] = await Promise.all([
        loadMetrics(whereSql, params, 7, 0),
        loadMetrics(whereSql, params, 14, 7),
        loadCampaigns(whereSql, params, "advertiser", 0),
        loadEvents(whereSql, params, "advertiser", 0),
        loadPreferences("advertiser", actorId, 0)
      ]);
      const externalSignals = preferences.includeExternal ? await loadExternalGuidance("advertiser") : [];
      const center = buildPriorityCenter({ role: "advertiser", campaigns });
      const body = renderWeeklyAiReport({
        role: "advertiser",
        accountName: actor.name || actor.email || "Advertiser performance",
        rangeLabel: "Last 7 days",
        metrics,
        previousMetrics,
        events,
        priorities: center.priorities,
        externalSignals
      }) + renderWeeklyAiPreferences(preferences, { action: "/admin/weekly-ai-report/preferences" });
      res.send(page("Vivid AI Weekly Report", body));
    } catch (error) {
      console.error("WEEKLY AI REPORT ERROR", error);
      res.status(500).send(page("Weekly AI Report", `<div class="wrap"><div class="card"><h1>Unable to load weekly report</h1><p>${String(error.message || "Unexpected error")}</p></div></div>`));
    }
  });

  app.post("/admin/weekly-ai-report/preferences", requireLogin, async (req, res) => {
    try {
      await savePreferences(req, res, "advertiser", Number(req.session.user.id), 0, "/admin/weekly-ai-report");
    } catch (error) {
      console.error("WEEKLY AI SETTINGS ERROR", error);
      res.status(500).send("Unable to save weekly report settings");
    }
  });

  app.get("/org-weekly-ai-report", async (req, res) => {
    try {
      const scope = await getOrganizationScope(req);
      const organizationId = Number(scope.organizationId);
      const actor = req.session.orgUser || req.session.user;
      const actorId = Number(actor?.id || 0);
      if (!actorId || !organizationId) return res.status(403).send("Access denied");
      const organizationResult = await q("SELECT name FROM organizations WHERE id=$1", [organizationId]);
      if (!organizationResult.rows.length) return res.status(404).send("Organization not found");
      const whereSql = "s.organization_id=$1";
      const params = [organizationId];
      const [metrics, previousMetrics, campaigns, events, preferences] = await Promise.all([
        loadMetrics(whereSql, params, 7, 0),
        loadMetrics(whereSql, params, 14, 7),
        loadCampaigns(whereSql, params, "enterprise", organizationId),
        loadEvents(whereSql, params, "enterprise", organizationId),
        loadPreferences("enterprise", actorId, organizationId)
      ]);
      const externalSignals = preferences.includeExternal ? await loadExternalGuidance("enterprise") : [];
      const center = buildPriorityCenter({ role: "enterprise", campaigns });
      const accountName = organizationResult.rows[0].name;
      const body = organizationNav({
        organizationId,
        organizationName: accountName,
        activePage: "weekly-ai-report",
        userName: actor.name || actor.email || ""
      }) + renderWeeklyAiReport({
        role: "enterprise",
        organizationId,
        accountName,
        rangeLabel: "Last 7 days",
        metrics,
        previousMetrics,
        events,
        priorities: center.priorities,
        externalSignals
      }) + renderWeeklyAiPreferences(preferences, { action: `/org-weekly-ai-report/preferences?organization_id=${organizationId}` });
      res.send(orgPage("Vivid AI Weekly Report", body));
    } catch (error) {
      console.error("ORGANIZATION WEEKLY AI REPORT ERROR", error);
      res.status(500).send("Unable to load weekly AI report");
    }
  });

  app.post("/org-weekly-ai-report/preferences", async (req, res) => {
    try {
      const scope = await getOrganizationScope(req);
      const organizationId = Number(scope.organizationId);
      const actor = req.session.orgUser || req.session.user;
      const actorId = Number(actor?.id || 0);
      if (!actorId || !organizationId) return res.status(403).send("Access denied");
      await savePreferences(req, res, "enterprise", actorId, organizationId, `/org-weekly-ai-report?organization_id=${organizationId}`);
    } catch (error) {
      console.error("ORGANIZATION WEEKLY AI SETTINGS ERROR", error);
      res.status(500).send("Unable to save weekly report settings");
    }
  });

  const scheduler = setInterval(sendDueReports, 15 * 60 * 1000);
  if (typeof scheduler.unref === "function") scheduler.unref();
  setTimeout(sendDueReports, 15 * 1000).unref?.();
}

module.exports = { registerWeeklyAiReportRoutes };
