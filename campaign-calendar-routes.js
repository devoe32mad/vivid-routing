"use strict";

const multer = require("multer");
const ExcelJS = require("exceljs");
const { Readable } = require("stream");
const { EVENT_TYPES, EVENT_TIMEZONES, validateEventSchedule, renderCampaignCalendar } = require("./campaign-calendar");
const eventUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function registerCampaignCalendarRoutes({ app, q, requireLogin, page, escapeHtml }) {
  let schemaReady = false;

  async function ensureCalendarSchema() {
    if (schemaReady) return;
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS schedule_kind TEXT DEFAULT 'weekly'`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_name TEXT`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_type TEXT`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_start_at TIMESTAMPTZ`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_end_at TIMESTAMPTZ`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_notes TEXT`);
    await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_timezone TEXT DEFAULT 'America/New_York'`);
    await q(`CREATE INDEX IF NOT EXISTS idx_campaign_schedules_event_window ON campaign_schedules (qr_id,event_start_at,event_end_at) WHERE schedule_kind='event' AND is_active=true`);
    schemaReady = true;
  }

  async function loadCalendarData(user) {
    await ensureCalendarSchema();
    const superAdmin = user.role === "super_admin";
    const qrs = await q(superAdmin
      ? `SELECT id,name FROM qr_codes ORDER BY id`
      : `SELECT qr.id,qr.name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE s.user_id=$1 ORDER BY qr.id`,
    superAdmin ? [] : [user.id]);
    const campaigns = await q(superAdmin
      ? `SELECT id,name,advertiser FROM campaigns ORDER BY id`
      : `SELECT id,name,advertiser FROM campaigns WHERE user_id=$1 ORDER BY id`,
    superAdmin ? [] : [user.id]);
    const events = await q(superAdmin
      ? `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs LEFT JOIN qr_codes qr ON qr.id=cs.qr_id LEFT JOIN campaigns c ON c.id=cs.campaign_id WHERE COALESCE(cs.schedule_kind,'weekly')='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at`
      : `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs LEFT JOIN qr_codes qr ON qr.id=cs.qr_id LEFT JOIN spaces s ON s.id=qr.space_id LEFT JOIN campaigns c ON c.id=cs.campaign_id WHERE s.user_id=$1 AND COALESCE(cs.schedule_kind,'weekly')='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at`,
    superAdmin ? [] : [user.id]);
    return { qrs, campaigns, events };
  }

  async function selectionAllowed(user, qrId, campaignId) {
    if (user.role === "super_admin") return true;
    const qr = await q(`SELECT qr.id FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE qr.id=$1 AND s.user_id=$2`, [qrId,user.id]);
    const campaign = await q(`SELECT id FROM campaigns WHERE id=$1 AND user_id=$2`, [campaignId,user.id]);
    return Boolean(qr.rows.length && campaign.rows.length);
  }

  const optionLists = (qrs, campaigns) => ({
    qrs: qrs.rows.map(row => `<option value="${row.id}">${escapeHtml(row.name || `QR ${row.id}`)}</option>`).join(""),
    campaigns: campaigns.rows.map(row => `<option value="${row.id}">${escapeHtml(row.advertiser || "")} — ${escapeHtml(row.name || "Campaign")}</option>`).join("")
  });

  const tabs = active => `<nav class="schedule-tabs" aria-label="Campaign scheduling">
    <a class="${active === "calendar" ? "active" : ""}" href="/admin/event-calendar">Event Calendar</a>
    <a class="${active === "recurring" ? "active" : ""}" href="/admin/schedule">Recurring Schedules</a>
    <a class="${active === "import" ? "active" : ""}" href="/admin/event-calendar?view=import">Import Events</a>
  </nav>`;

  const shellStyles = `<style>
    .schedule-shell{max-width:1500px;margin:0 auto;padding:28px 32px 52px}.schedule-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.schedule-hero h1{margin:0 0 7px;color:#102b50}.schedule-hero p{margin:0;color:#657184}.schedule-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;padding:6px;background:#eaf0f8;border-radius:12px}.schedule-tabs a{padding:11px 16px;border-radius:8px;color:#24415f;text-decoration:none;font-weight:800}.schedule-tabs a.active{background:#fff;color:#1559c7;box-shadow:0 2px 8px rgba(16,43,80,.12)}.schedule-actions{display:flex;gap:10px;flex-wrap:wrap}.schedule-card{background:#fff;border-radius:14px;padding:22px;margin-bottom:18px;box-shadow:0 6px 24px rgba(16,43,80,.08)}.schedule-card h2{margin-top:0;color:#102b50}.schedule-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.schedule-form label{display:block;font-weight:700;margin-bottom:6px}.schedule-form input,.schedule-form select{width:100%;box-sizing:border-box;padding:11px;border:1px solid #d5ddea;border-radius:8px;font-size:16px}.schedule-btn{display:inline-block;background:#2868e8;color:#fff;border:0;border-radius:9px;padding:11px 18px;font-weight:800;text-decoration:none;cursor:pointer}.schedule-btn.secondary{background:#fff;color:#2459a9;border:1px solid #b8cae6}.schedule-help{color:#657184;line-height:1.55}.schedule-empty{text-align:center;padding:46px 22px}.schedule-empty h2{margin-bottom:8px}.mobile-event-list{display:none}@media(max-width:700px){.schedule-shell{padding:18px 12px 36px}.schedule-hero{align-items:flex-start;flex-direction:column}.schedule-tabs{display:grid;grid-template-columns:1fr}.schedule-tabs a{text-align:center}.schedule-form{grid-template-columns:1fr}.schedule-card{padding:16px}.desktop-calendar{display:none}.mobile-event-list{display:block}}
    .schedule-btn{color:#fff!important}.schedule-btn.secondary{color:#2459a9!important}
  </style>`;

  app.get("/admin/event-calendar", requireLogin, async (req, res) => {
    try {
      const { qrs, campaigns, events } = await loadCalendarData(req.session.user);
      const options = optionLists(qrs, campaigns);
      const view = req.query.view === "add" || req.query.view === "import" ? req.query.view : "calendar";
      const header = `${shellStyles}<main class="schedule-shell"><div class="schedule-hero"><div><h1>Campaign Scheduling</h1><p>Plan dated events or recurring campaign rotations from one place.</p></div>${view === "calendar" ? `<div class="schedule-actions"><a class="schedule-btn" href="/admin/event-calendar?view=add">Add Event</a><a class="schedule-btn secondary" href="/admin/event-calendar?view=import">Import Events</a></div>` : ""}</div>${tabs(view === "import" ? "import" : "calendar")}`;
      let content;

      if (view === "add") {
        content = `<section class="schedule-card"><h2>Add an event</h2><p class="schedule-help">Choose the event, placement, campaign, and exact time window. Vivid will switch campaigns automatically and return to the normal schedule afterward.</p><form method="POST" action="/admin/event-calendar"><div class="schedule-form"><div><label>Event Name</label><input name="event_name" required placeholder="Home Football vs. Barron Collier"></div><div><label>Event Type</label><select name="event_type">${EVENT_TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select></div><div><label>QR Placement</label><select name="qr_id" required>${options.qrs}</select></div><div><label>Campaign</label><select name="campaign_id" required>${options.campaigns}</select></div><div><label>Starts</label><input type="datetime-local" name="event_start_at" required></div><div><label>Ends</label><input type="datetime-local" name="event_end_at" required></div><div><label>Timezone</label><select name="event_timezone">${EVENT_TIMEZONES.map(zone => `<option value="${zone}" ${zone === "America/New_York" ? "selected" : ""}>${zone.replace("America/", "")}</option>`).join("")}</select></div><div><label>Priority</label><input type="number" name="priority" value="100"></div><div style="grid-column:1/-1"><label>Notes</label><input name="event_notes" placeholder="Opponent, audience, promotion, or instructions"></div></div><div class="schedule-actions" style="margin-top:18px"><button class="schedule-btn" type="submit">Save Event</button><a class="schedule-btn secondary" href="/admin/event-calendar">Cancel</a></div></form></section>`;
      } else if (view === "import") {
        content = `<section class="schedule-card"><h2>Import an event schedule</h2><p class="schedule-help">Upload a football, basketball, school, community, or other event schedule. Every valid row will use the placement and campaign selected below.</p><form method="POST" action="/admin/event-calendar/import" enctype="multipart/form-data"><div class="schedule-form"><div><label>QR Placement</label><select name="qr_id" required>${options.qrs}</select></div><div><label>Campaign</label><select name="campaign_id" required>${options.campaigns}</select></div><div style="grid-column:1/-1"><label>CSV or Excel File</label><input type="file" name="event_schedule" accept=".csv,.xlsx" required></div></div><p class="schedule-help"><strong>Required columns:</strong> Event Name, Starts, Ends.<br><strong>Optional columns:</strong> Event Type, Timezone, Notes.</p><div class="schedule-actions"><button class="schedule-btn" type="submit">Import Schedule</button><a class="schedule-btn secondary" href="/admin/event-calendar">Cancel</a></div></form></section>`;
      } else if (!events.rows.length) {
        content = `<section class="schedule-card schedule-empty"><h2>Your event calendar is ready</h2><p class="schedule-help">Add a single event or import a full season schedule. Events will appear here after they are scheduled.</p><div class="schedule-actions" style="justify-content:center;margin-top:18px"><a class="schedule-btn" href="/admin/event-calendar?view=add">Add First Event</a><a class="schedule-btn secondary" href="/admin/event-calendar?view=import">Import a Schedule</a></div></section>`;
      } else {
        content = renderCampaignCalendar(events.rows, { action: "/admin/event-calendar?view=add" });
      }

      res.send(page("Campaign Scheduling", `${header}${content}</main>`));
    } catch (error) {
      console.error("EVENT CALENDAR ERROR:", error);
      res.status(500).send(page("Event Calendar", `<div class="wrap"><div class="card"><h1>Unable to load Event Calendar</h1><p>${escapeHtml(error.message)}</p><a class="btn" href="/admin/schedule">Back to Campaign Schedules</a></div></div>`));
    }
  });

  app.post("/admin/event-calendar", requireLogin, async (req, res) => {
    await ensureCalendarSchema();
    const checked = validateEventSchedule({ eventName:req.body.event_name,eventType:req.body.event_type,startAt:req.body.event_start_at,endAt:req.body.event_end_at,timezone:req.body.event_timezone,qrId:req.body.qr_id,campaignId:req.body.campaign_id,notes:req.body.event_notes });
    if (!checked.valid) return res.status(400).send(page("Event Error", `<div class="wrap"><div class="card"><h1>Check the event</h1><ul>${checked.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul><a class="btn" href="/admin/event-calendar?view=add">Back</a></div></div>`));
    const value = checked.value;
    if (!await selectionAllowed(req.session.user,value.qrId,value.campaignId)) return res.status(403).send("You do not have access to that QR placement or campaign.");
    const conflict = await q(`SELECT event_name FROM campaign_schedules WHERE qr_id=$1 AND COALESCE(schedule_kind,'weekly')='event' AND COALESCE(is_active,true)=true AND ($2::timestamp AT TIME ZONE $4)<event_end_at AND ($3::timestamp AT TIME ZONE $4)>event_start_at LIMIT 1`, [value.qrId,value.startAt,value.endAt,value.timezone]);
    if (conflict.rows.length) return res.status(409).send(page("Schedule Conflict", `<div class="wrap"><div class="card"><h1>Schedule conflict</h1><p>This placement already has <strong>${escapeHtml(conflict.rows[0].event_name || "another campaign")}</strong> scheduled during that time.</p><a class="btn" href="/admin/event-calendar?view=add">Back to Event</a></div></div>`));
    await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_notes,event_timezone,priority,is_active,start_time,end_time) VALUES ($1,$2,'event',$3,$4,$5::timestamp AT TIME ZONE $8,$6::timestamp AT TIME ZONE $8,$7,$8,$9,true,'00:00','23:59')`, [value.qrId,value.campaignId,value.eventName,value.eventType,value.startAt,value.endAt,value.notes||null,value.timezone,Number(req.body.priority||100)]);
    res.redirect("/admin/event-calendar");
  });

  app.post("/admin/event-calendar/import", requireLogin, eventUpload.single("event_schedule"), async (req, res) => {
    try {
      await ensureCalendarSchema();
      if (!req.file) return res.status(400).send("Choose a CSV or Excel schedule.");
      const qrId=Number(req.body.qr_id), campaignId=Number(req.body.campaign_id), workbook=new ExcelJS.Workbook(), filename=String(req.file.originalname||"").toLowerCase();
      if (!await selectionAllowed(req.session.user,qrId,campaignId)) return res.status(403).send("You do not have access to that QR placement or campaign.");
      if (filename.endsWith(".csv")) await workbook.csv.read(Readable.from(req.file.buffer)); else if (filename.endsWith(".xlsx")) await workbook.xlsx.load(req.file.buffer); else return res.status(400).send("Upload a .csv or .xlsx file.");
      const sheet=workbook.worksheets[0], normalize=value=>String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,""), headers={};
      if (!sheet) return res.status(400).send("The schedule is empty.");
      sheet.getRow(1).eachCell((cell,index)=>{headers[normalize(cell.text)]=index;});
      const col=(...names)=>names.map(normalize).map(name=>headers[name]).find(Boolean), nameCol=col("Event Name","Event","Game"), startCol=col("Starts","Start","Start Date"), endCol=col("Ends","End","End Date");
      if (!nameCol||!startCol||!endCol) return res.status(400).send("Required columns are Event Name, Starts, and Ends.");
      const get=(row,index)=>{if(!index)return "";const value=row.getCell(index).value;return value instanceof Date?value.toISOString():row.getCell(index).text;}, events=[], errors=[];
      sheet.eachRow((row,rowNumber)=>{if(rowNumber===1||!row.hasValues)return;const checked=validateEventSchedule({eventName:get(row,nameCol),eventType:get(row,col("Event Type","Sport","Type")),startAt:get(row,startCol),endAt:get(row,endCol),timezone:get(row,col("Timezone","Time Zone"))||"America/New_York",notes:get(row,col("Notes","Opponent","Description")),qrId,campaignId});if(checked.valid)events.push({...checked.value,rowNumber});else errors.push(`Row ${rowNumber}: ${checked.errors.join(" ")}`);});
      events.sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)); for(let i=1;i<events.length;i+=1)if(new Date(events[i].startAt)<new Date(events[i-1].endAt))errors.push(`Rows ${events[i-1].rowNumber} and ${events[i].rowNumber} overlap.`); if(!events.length)errors.push("No valid event rows were found.");
      for(const event of events){const conflict=await q(`SELECT id FROM campaign_schedules WHERE qr_id=$1 AND COALESCE(schedule_kind,'weekly')='event' AND COALESCE(is_active,true)=true AND $2::timestamptz<event_end_at AND $3::timestamptz>event_start_at LIMIT 1`,[qrId,event.startAt,event.endAt]);if(conflict.rows.length)errors.push(`Row ${event.rowNumber} overlaps an existing event.`);}
      if(errors.length)return res.status(400).send(page("Import Error",`<div class="wrap"><div class="card"><h1>Review the schedule</h1><ul>${errors.map(error=>`<li>${escapeHtml(error)}</li>`).join("")}</ul><a class="btn" href="/admin/event-calendar?view=import">Back</a></div></div>`));
      for(const event of events)await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_notes,event_timezone,priority,is_active,start_time,end_time) VALUES ($1,$2,'event',$3,$4,$5::timestamptz,$6::timestamptz,$7,$8,100,true,'00:00','23:59')`,[qrId,campaignId,event.eventName,event.eventType,event.startAt,event.endAt,event.notes||null,event.timezone]);
      res.redirect("/admin/event-calendar");
    } catch(error){console.error("EVENT IMPORT ERROR:",error);res.status(500).send(page("Import Error",`<div class="wrap"><div class="card"><h1>Unable to import schedule</h1><p>${escapeHtml(error.message)}</p><a class="btn" href="/admin/event-calendar?view=import">Back</a></div></div>`));}
  });
}

module.exports = { registerCampaignCalendarRoutes };
