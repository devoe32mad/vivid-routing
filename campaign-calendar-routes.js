"use strict";

const multer = require("multer");
const ExcelJS = require("exceljs");
const { Readable } = require("stream");
const { EVENT_TYPES, EVENT_TIMEZONES, validateEventSchedule, renderCampaignCalendar } = require("./campaign-calendar");
const eventUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function registerCampaignCalendarRoutes({ app, q, requireLogin, page, escapeHtml }) {
  async function loadCalendarData(user) {
    const superAdmin = user.role === "super_admin";
    const qrs = await q(superAdmin ? `SELECT id,name FROM qr_codes ORDER BY id` : `SELECT qr.id,qr.name FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE s.user_id=$1 ORDER BY qr.id`, superAdmin ? [] : [user.id]);
    const campaigns = await q(superAdmin ? `SELECT id,name,advertiser FROM campaigns ORDER BY id` : `SELECT id,name,advertiser FROM campaigns WHERE user_id=$1 ORDER BY id`, superAdmin ? [] : [user.id]);
    const events = await q(superAdmin ? `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs LEFT JOIN qr_codes qr ON qr.id=cs.qr_id LEFT JOIN campaigns c ON c.id=cs.campaign_id WHERE COALESCE(cs.schedule_kind,'weekly')='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at` : `SELECT cs.*,qr.name qr_name,c.name campaign_name,c.advertiser FROM campaign_schedules cs LEFT JOIN qr_codes qr ON qr.id=cs.qr_id LEFT JOIN spaces s ON s.id=qr.space_id LEFT JOIN campaigns c ON c.id=cs.campaign_id WHERE s.user_id=$1 AND COALESCE(cs.schedule_kind,'weekly')='event' AND COALESCE(cs.is_active,true)=true ORDER BY cs.event_start_at`, superAdmin ? [] : [user.id]);
    return { qrs, campaigns, events };
  }
  async function selectionAllowed(user, qrId, campaignId) {
    if (user.role === "super_admin") return true;
    const qr = await q(`SELECT qr.id FROM qr_codes qr LEFT JOIN spaces s ON s.id=qr.space_id WHERE qr.id=$1 AND s.user_id=$2`, [qrId,user.id]);
    const campaign = await q(`SELECT id FROM campaigns WHERE id=$1 AND user_id=$2`, [campaignId,user.id]);
    return Boolean(qr.rows.length && campaign.rows.length);
  }

  app.get("/admin/event-calendar", requireLogin, async (req, res) => {
    try {
      const { qrs, campaigns, events } = await loadCalendarData(req.session.user);
      const content = `<div class="wrap"><div class="card"><h2>Event Calendar <span title="Import or add games and events, then assign campaigns to run automatically on selected QR placements before, during, or after each event." style="cursor:help;font-size:.7em;">ⓘ</span></h2><form method="POST" action="/admin/event-calendar"><div class="formgrid"><div><label>Event Name</label><input name="event_name" required placeholder="Home Football vs. Barron Collier"></div><div><label>Event Type</label><select name="event_type">${EVENT_TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select></div><div><label>QR Placement</label><select name="qr_id" required>${qrs.rows.map(row => `<option value="${row.id}">${escapeHtml(row.name || `QR ${row.id}`)}</option>`).join("")}</select></div><div><label>Campaign</label><select name="campaign_id" required>${campaigns.rows.map(row => `<option value="${row.id}">${escapeHtml(row.advertiser || "")} — ${escapeHtml(row.name || "Campaign")}</option>`).join("")}</select></div><div><label>Starts</label><input type="datetime-local" name="event_start_at" required></div><div><label>Ends</label><input type="datetime-local" name="event_end_at" required></div><div><label>Timezone</label><select name="event_timezone">${EVENT_TIMEZONES.map(zone => `<option value="${zone}" ${zone === "America/New_York" ? "selected" : ""}>${zone.replace("America/", "")}</option>`).join("")}</select></div><div><label>Priority</label><input type="number" name="priority" value="100"></div><div style="grid-column:1/-1"><label>Notes</label><input name="event_notes" placeholder="Opponent, audience, promotion, or instructions"></div></div><button class="btn" type="submit">Add Event</button></form></div><div class="card"><h2>Import CSV or Excel <span title="Apply one QR placement and campaign to every valid event row in the uploaded schedule." style="cursor:help;font-size:.7em;">ⓘ</span></h2><form method="POST" action="/admin/event-calendar/import" enctype="multipart/form-data"><div class="formgrid"><div><label>QR Placement</label><select name="qr_id" required>${qrs.rows.map(row => `<option value="${row.id}">${escapeHtml(row.name || `QR ${row.id}`)}</option>`).join("")}</select></div><div><label>Campaign</label><select name="campaign_id" required>${campaigns.rows.map(row => `<option value="${row.id}">${escapeHtml(row.advertiser || "")} — ${escapeHtml(row.name || "Campaign")}</option>`).join("")}</select></div><div><label>Schedule File</label><input type="file" name="event_schedule" accept=".csv,.xlsx" required></div></div><p>Required columns: Event Name, Starts, Ends. Optional: Event Type, Timezone, Notes.</p><button class="btn" type="submit">Import Schedule</button></form></div>${renderCampaignCalendar(events.rows, { action: "/admin/event-calendar" })}</div>`;
      res.send(req.query.embed === "1" ? page("Event Calendar", content) : page("Campaign Event Calendar", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Campaign Event Calendar</h1></div>${content}`));
    } catch (error) {
      console.error("EVENT CALENDAR ERROR:", error);
      res.status(500).send(page("Event Calendar", `<div class="wrap"><div class="card"><h1>Unable to load Event Calendar</h1><p>${escapeHtml(error.message)}</p><a class="btn" href="/admin/schedule">Back to Campaign Schedules</a></div></div>`));
    }
  });

  app.post("/admin/event-calendar", requireLogin, async (req, res) => {
    const checked = validateEventSchedule({ eventName:req.body.event_name,eventType:req.body.event_type,startAt:req.body.event_start_at,endAt:req.body.event_end_at,timezone:req.body.event_timezone,qrId:req.body.qr_id,campaignId:req.body.campaign_id,notes:req.body.event_notes });
    if (!checked.valid) return res.status(400).send(page("Event Error", `<div class="wrap"><div class="card"><h1>Check the event</h1><ul>${checked.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul><a class="btn" href="/admin/event-calendar">Back</a></div></div>`));
    const value = checked.value;
    if (!await selectionAllowed(req.session.user,value.qrId,value.campaignId)) return res.status(403).send("You do not have access to that QR placement or campaign.");
    const conflict = await q(`SELECT event_name FROM campaign_schedules WHERE qr_id=$1 AND COALESCE(schedule_kind,'weekly')='event' AND COALESCE(is_active,true)=true AND ($2::timestamp AT TIME ZONE $4)<event_end_at AND ($3::timestamp AT TIME ZONE $4)>event_start_at LIMIT 1`, [value.qrId,value.startAt,value.endAt,value.timezone]);
    if (conflict.rows.length) return res.status(409).send(page("Schedule Conflict", `<div class="wrap"><div class="card"><h1>Schedule conflict</h1><p>This placement already has <strong>${escapeHtml(conflict.rows[0].event_name || "another campaign")}</strong> scheduled during that time.</p><a class="btn" href="/admin/event-calendar">Back</a></div></div>`));
    await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_notes,event_timezone,priority,is_active,start_time,end_time) VALUES ($1,$2,'event',$3,$4,$5::timestamp AT TIME ZONE $8,$6::timestamp AT TIME ZONE $8,$7,$8,$9,true,'00:00','23:59')`, [value.qrId,value.campaignId,value.eventName,value.eventType,value.startAt,value.endAt,value.notes||null,value.timezone,Number(req.body.priority||100)]);
    res.redirect("/admin/schedule");
  });

  app.post("/admin/event-calendar/import", requireLogin, eventUpload.single("event_schedule"), async (req, res) => {
    try {
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
      if(errors.length)return res.status(400).send(page("Import Error",`<div class="wrap"><div class="card"><h1>Review the schedule</h1><ul>${errors.map(error=>`<li>${escapeHtml(error)}</li>`).join("")}</ul><a class="btn" href="/admin/schedule">Back</a></div></div>`));
      for(const event of events)await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_notes,event_timezone,priority,is_active,start_time,end_time) VALUES ($1,$2,'event',$3,$4,$5::timestamptz,$6::timestamptz,$7,$8,100,true,'00:00','23:59')`,[qrId,campaignId,event.eventName,event.eventType,event.startAt,event.endAt,event.notes||null,event.timezone]);
      res.redirect("/admin/schedule");
    } catch(error){console.error("EVENT IMPORT ERROR:",error);res.status(500).send(page("Import Error",`<div class="wrap"><div class="card"><h1>Unable to import schedule</h1><p>${escapeHtml(error.message)}</p><a class="btn" href="/admin/schedule">Back</a></div></div>`));}
  });
}

module.exports = { registerCampaignCalendarRoutes };
