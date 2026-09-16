"use strict";
const fs = require("fs");
const path = require("path");
const serverPath = path.join(__dirname, "server.js");
let source = fs.readFileSync(serverPath, "utf8");

source = source.replace('app.get("/admin/schedule", async (req, res) => {', 'app.get("/admin/schedule", requireLogin, async (req, res) => {');

const importAnchor = 'const crypto = require("crypto");';
if (!source.includes('require("./campaign-calendar-routes")')) {
  source = source.replace(importAnchor, `${importAnchor}\nconst { registerCampaignCalendarRoutes } = require("./campaign-calendar-routes");`);
}

const migrationAnchor = 'await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);';
if (!source.includes("event_timezone TEXT")) {
  source = source.replace(migrationAnchor, `${migrationAnchor}
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS schedule_kind TEXT DEFAULT 'weekly'\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_name TEXT\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_type TEXT\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_start_at TIMESTAMPTZ\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_end_at TIMESTAMPTZ\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_notes TEXT\`);
await q(\`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS event_timezone TEXT DEFAULT 'America/New_York'\`);
await q(\`CREATE INDEX IF NOT EXISTS idx_campaign_schedules_event_window ON campaign_schedules (qr_id,event_start_at,event_end_at) WHERE schedule_kind='event' AND is_active=true\`);`);
}

const activeStart = "async function activeCampaignForQr(qrId) {";
const activeEnd = 'app.get("/debug-campaign-destinations"';
if (!source.includes("selected.source_rank ASC")) {
  const start = source.indexOf(activeStart);
  const end = source.indexOf(activeEnd, start);
  if (start < 0 || end < 0) throw new Error("Unable to install event-aware campaign routing.");
  const replacement = `async function activeCampaignForQr(qrId) {
  const result = await q(\`
    SELECT c.*, selected.campaign_id, qr.name AS qr_name, s.name AS space_name
    FROM (
      SELECT cs.id,cs.qr_id,cs.campaign_id,1 source_rank,COALESCE(cs.priority,50) selection_priority
      FROM campaign_schedules cs
      WHERE cs.qr_id=$1 AND COALESCE(cs.is_active,true)=true AND (
        (COALESCE(cs.schedule_kind,'weekly')='event' AND CURRENT_TIMESTAMP>=cs.event_start_at AND CURRENT_TIMESTAMP<cs.event_end_at)
        OR (COALESCE(cs.schedule_kind,'weekly')='weekly' AND (NULLIF(cs.days_of_week,'') IS NULL OR EXTRACT(DOW FROM CURRENT_TIMESTAMP)::text=ANY(string_to_array(cs.days_of_week,','))) AND CURRENT_TIME>=cs.start_time::time AND CURRENT_TIME<=cs.end_time::time)
      )
      UNION ALL
      SELECT qc.id,qc.qr_id,qc.campaign_id,2 source_rank,0 selection_priority FROM qr_campaigns qc WHERE qc.qr_id=$1 AND COALESCE(qc.is_active,true)=true
    ) selected
    JOIN campaigns c ON c.id=selected.campaign_id JOIN qr_codes qr ON qr.id=selected.qr_id LEFT JOIN spaces s ON s.id=qr.space_id
    WHERE COALESCE(c.is_archived,false)=false AND (c.start_date IS NULL OR c.start_date<=CURRENT_DATE) AND (c.end_date IS NULL OR c.end_date>=CURRENT_DATE)
    ORDER BY selected.source_rank ASC,selected.selection_priority DESC,selected.id DESC LIMIT 1
  \`,[qrId]);
  return result.rows[0] || null;
}
`;
  source = source.slice(0, start) + replacement + source.slice(end);
}

if (!source.includes("registerCampaignCalendarRoutes({")) {
  const routeAnchor = source.includes('app.get("/admin/schedule", requireLogin, async (req, res) => {')
    ? 'app.get("/admin/schedule", requireLogin, async (req, res) => {'
    : 'app.get("/admin/schedule", async (req, res) => {';
  source = source.replace(routeAnchor, `registerCampaignCalendarRoutes({ app, q, requireLogin, page, escapeHtml });\n${routeAnchor}`);
}

source = source.replace('<h1>Master QR Campaign Schedule</h1><p><a class="btn" href="/admin/event-calendar">Open Event Calendar</a></p>', '<h1>Master QR Campaign Schedule</h1>');
if (!source.includes('title="Import or add games and events')) {
  source = source.replace("<h1>Master QR Campaign Schedule</h1>", '<h1>Master QR Campaign Schedule <span title="Import or add games and events, then assign campaigns to run automatically on selected QR placements before, during, or after each event." style="cursor:help;font-size:.55em;vertical-align:middle;">ⓘ</span></h1>');
  source = source.replace("Add multiple campaigns to one QR and rotate by day/time.</p>", 'Add multiple campaigns to one QR and rotate by day/time.</p><iframe title="Campaign Event Calendar" src="/admin/event-calendar?embed=1" style="width:100%;min-height:1050px;border:0;border-radius:12px;background:#fff;margin-top:20px;"></iframe>');
}
if (!source.includes("Import a CSV or Excel event schedule")) {
  source = source.replace("<li>Rotate multiple campaigns.</li>", `<li>Rotate multiple campaigns.</li>
        <li>Add football, basketball, school, community, and other dated events.</li>
        <li>Import a CSV or Excel event schedule with Event Name, Starts, Ends, Event Type, Timezone, and Notes columns.</li>
        <li>Event campaigns start and stop automatically; the QR returns to its normal eligible campaign afterward.</li>
        <li>Vivid blocks overlapping active events on the same QR placement.</li>`);
}

fs.writeFileSync(serverPath, source);
console.log("Campaign event calendar installed.");
