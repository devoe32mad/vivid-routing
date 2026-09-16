"use strict";

const {
  EVENT_TYPES,
  EVENT_TIMEZONES,
  validateEventSchedule,
  renderCampaignCalendar
} = require("./campaign-calendar");

function registerCampaignCalendarRoutes({ app, q, requireLogin, page, escapeHtml }) {
  app.get("/admin/event-calendar", requireLogin, async (req, res) => {
    const user = req.session.user;
    const superAdmin = user.role === "super_admin";
    const qrs = await q(superAdmin
      ? `SELECT qr.id, qr.name FROM qr_codes qr WHERE COALESCE(qr.is_archived,false)=false ORDER BY qr.name, qr.id`
      : `SELECT qr.id, qr.name FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id WHERE s.user_id=$1 AND COALESCE(qr.is_archived,false)=false ORDER BY qr.name, qr.id`,
      superAdmin ? [] : [user.id]);
    const campaigns = await q(superAdmin
      ? `SELECT id,name,advertiser FROM campaigns WHERE COALESCE(is_archived,false)=false ORDER BY advertiser,name`
      : `SELECT id,name,advertiser FROM campaigns WHERE user_id=$1 AND COALESCE(is_archived,false)=false ORDER BY advertiser,name`,
      superAdmin ? [] : [user.id]);
    const events = await q(superAdmin
      ? `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs JOIN qr_codes qr ON qr.id=cs.qr_id JOIN campaigns c ON c.id=cs.campaign_id WHERE cs.schedule_kind='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at`
      : `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs JOIN qr_codes qr ON qr.id=cs.qr_id JOIN spaces s ON s.id=qr.space_id JOIN campaigns c ON c.id=cs.campaign_id WHERE s.user_id=$1 AND cs.schedule_kind='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at`,
      superAdmin ? [] : [user.id]);

    res.send(page("Campaign Event Calendar", `
      <div class="topbar"><div class="brand">Vivid Spots</div><h1>Campaign Event Calendar</h1><p class="subtitle">Pre-schedule the campaign that should run for each game, event, or activation.</p></div>
      <div class="wrap">
        <div class="card"><form method="POST" action="/admin/event-calendar">
          <div class="formgrid">
            <div><label>Event Name</label><input name="event_name" required placeholder="Home Football vs. Barron Collier"></div>
            <div><label>Event Type</label><select name="event_type">${EVENT_TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select></div>
            <div><label>QR Placement</label><select name="qr_id" required>${qrs.rows.map(row => `<option value="${row.id}">${escapeHtml(row.name || `QR ${row.id}`)}</option>`).join("")}</select></div>
            <div><label>Campaign</label><select name="campaign_id" required>${campaigns.rows.map(row => `<option value="${row.id}">${escapeHtml(row.advertiser || "")} — ${escapeHtml(row.name || "Campaign")}</option>`).join("")}</select></div>
            <div><label>Starts</label><input type="datetime-local" name="event_start_at" required></div>
            <div><label>Ends</label><input type="datetime-local" name="event_end_at" required></div>
            <div><label>Timezone</label><select name="event_timezone">${EVENT_TIMEZONES.map(zone => `<option value="${zone}" ${zone === "America/New_York" ? "selected" : ""}>${zone.replace("America/", "")}</option>`).join("")}</select></div>
            <div><label>Priority</label><input type="number" name="priority" value="100"></div>
            <div style="grid-column:1/-1"><label>Notes</label><input name="event_notes" placeholder="Opponent, audience, promotion, or instructions"></div>
          </div><button class="btn" type="submit">Add Event to Calendar</button> <a class="btn secondary" href="/admin/schedule">Recurring Schedules</a>
        </form></div>
        ${renderCampaignCalendar(events.rows, { action: "/admin/event-calendar" })}
      </div>`));
  });

  app.post("/admin/event-calendar", requireLogin, async (req, res) => {
    const validated = validateEventSchedule({
      eventName: req.body.event_name,
      eventType: req.body.event_type,
      startAt: req.body.event_start_at,
      endAt: req.body.event_end_at,
      timezone: req.body.event_timezone,
      qrId: req.body.qr_id,
      campaignId: req.body.campaign_id,
      notes: req.body.event_notes
    });
    if (!validated.valid) {
      return res.status(400).send(page("Event Error", `<div class="wrap"><div class="card"><h1>Check the event</h1><ul>${validated.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul><a class="btn" href="/admin/event-calendar">Back</a></div></div>`));
    }
    const value = validated.value;
    const conflict = await q(`SELECT event_name FROM campaign_schedules WHERE qr_id=$1 AND schedule_kind='event' AND COALESCE(is_active,true)=true AND ($2::timestamp AT TIME ZONE $4)<event_end_at AND ($3::timestamp AT TIME ZONE $4)>event_start_at LIMIT 1`, [value.qrId,value.startAt,value.endAt,value.timezone]);
    if (conflict.rows.length) {
      return res.status(409).send(page("Schedule Conflict", `<div class="wrap"><div class="card"><h1>Schedule conflict</h1><p>This placement already has <strong>${escapeHtml(conflict.rows[0].event_name || "another campaign")}</strong> scheduled during that time.</p><a class="btn" href="/admin/event-calendar">Back to Calendar</a></div></div>`));
    }
    await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_notes,event_timezone,priority,is_active,start_time,end_time) VALUES ($1,$2,'event',$3,$4,$5::timestamp AT TIME ZONE $8,$6::timestamp AT TIME ZONE $8,$7,$8,$9,true,'00:00','23:59')`, [value.qrId,value.campaignId,value.eventName,value.eventType,value.startAt,value.endAt,value.notes||null,value.timezone,Number(req.body.priority||100)]);
    res.redirect("/admin/event-calendar");
  });
}

module.exports = { registerCampaignCalendarRoutes };
