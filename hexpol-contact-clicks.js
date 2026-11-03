"use strict";
const nativeEmail = require("./hexpol-quality-email");
const {polymerBooth} = require("./website-page-config");
const quality = polymerBooth.pages.find(page => page.name === "Quality Journey");
const pageUrl = quality.url.replace(/\/$/, "");
const buttons = new Map([
  ["contact_today", "Contact Us Today"],
  ["start_conversation", "Contact us to Start the Conversation"]
]);
const uuid = value => typeof value === "string" && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);

function isContactCampaign(campaign) {
  return Number(campaign.id) === quality.campaignId &&
    String(campaign.advertiser).trim().toLowerCase() === "hexpol";
}
function createContactClicks(q) {
  let ready;
  function ensureSchema() {
    if (!ready) ready = q(`CREATE TABLE IF NOT EXISTS hexpol_contact_clicks (
      click_event_id UUID PRIMARY KEY, scan_event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      qr_id INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
      button_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function record(data, origin) {
    if (origin !== new URL(pageUrl).origin || data?.page_url !== pageUrl ||
        !buttons.has(data?.button_key) || !uuid(data.vivid_click_id) || !uuid(data.click_event_id)) return;
    await ensureSchema();
    if (data.campaign_id != null && ![polymerBooth.installCampaignId,quality.campaignId,nativeEmail.campaignId].includes(data.campaign_id)) return;
    // A cached tag may still identify itself as the original installation.
    // Route by the actual booth scan; never credit an old scan to campaign 94.
    if (data.campaign_id === nativeEmail.campaignId ||
        (await q("SELECT 1 FROM events WHERE vivid_click_id=$1 AND qr_id=$2 AND campaign_id=$3 AND type='scan' LIMIT 1",
          [data.vivid_click_id,polymerBooth.qrId,nativeEmail.campaignId])).rows.length) {
      return nativeEmail.recordNativeEmailClick(q, data);
    }
    // Accept only recent Summit scan IDs from HEXPOL's own campaigns. Recording
    // the action must not depend on which of the click/visit requests arrives first.
    await q(`INSERT INTO hexpol_contact_clicks(click_event_id,scan_event_id,campaign_id,qr_id,button_key)
      SELECT $1::uuid, e.id, c.id, e.qr_id, $2 FROM events e
      JOIN campaigns s ON s.id=e.campaign_id
      JOIN campaigns c ON c.id=$5 AND c.user_id=s.user_id
      JOIN campaigns install ON install.id=$7 AND install.user_id=c.user_id
      WHERE e.vivid_click_id=$3 AND e.type='scan' AND e.qr_id=$4 AND e.campaign_id=ANY($6::int[])
        AND LOWER(TRIM(s.advertiser))='hexpol' AND LOWER(TRIM(c.advertiser))='hexpol'
        AND LOWER(TRIM(install.advertiser))='hexpol' AND NOT COALESCE(c.is_archived,false)
        AND (c.start_date IS NULL OR c.start_date<=CURRENT_DATE) AND (c.end_date IS NULL OR c.end_date>=CURRENT_DATE)
        AND EXISTS (SELECT 1 FROM qr_campaigns a WHERE a.qr_id=e.qr_id AND a.campaign_id=c.id AND COALESCE(a.is_active,true))
        AND EXISTS (SELECT 1 FROM campaign_destinations d WHERE d.campaign_id=c.id AND COALESCE(d.is_active,true) AND RTRIM(d.destination_url,'/')=$8)
        AND e.created_at BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '24 hours' AND (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      ORDER BY e.created_at,e.id LIMIT 1 ON CONFLICT (click_event_id) DO NOTHING`,
    [data.click_event_id, data.button_key, data.vivid_click_id, polymerBooth.qrId, quality.campaignId,
      polymerBooth.pages.map(page => page.campaignId), polymerBooth.installCampaignId, pageUrl]);
  }
  async function summary(campaign, days) {
    if (!isContactCampaign(campaign)) return null;
    await ensureSchema();
    return (await q(`SELECT button_key,COUNT(*)::int AS clicks,COUNT(DISTINCT scan_event_id)::int AS visits
      FROM hexpol_contact_clicks WHERE campaign_id=$1 AND qr_id=$2
        AND created_at>=CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 day')
      GROUP BY GROUPING SETS ((),(button_key))`, [campaign.id,polymerBooth.qrId,days])).rows;
  }
  return {record, summary};
}
function renderContactClicks(rows) {
  if (!rows) return "";
  const total = rows.find(row => row.button_key === null) || {clicks:0,visits:0};
  const tr = (label, row) => `<tr><td>${label}</td><td>${Number(row?.clicks || 0)}</td><td>${Number(row?.visits || 0)}</td></tr>`;
  return `<section id="contact-clicks" class="card"><h2>Contact email clicks</h2>
    <p>Counts taps on Quality Journey’s two email buttons after a Polymer Booth QR scan. A visitor can tap more than once during one QR visit. Sending an email is a separate action in the visitor’s mail app.</p>
    <table><thead><tr><th>Button</th><th>Contact clicks</th><th>QR visits that clicked</th></tr></thead>
    <tbody>${Array.from(buttons,([key,label])=>tr(label,rows.find(row=>row.button_key===key))).join("")}</tbody>
    <tfoot>${tr("<strong>Both buttons combined</strong>",total)}</tfoot></table>
    ${total.clicks ? "" : "<p>No contact clicks recorded for this period. Verify the WordPress tracking tag with a fresh QR scan.</p>"}</section>`;
}
module.exports = {createContactClicks, isContactCampaign, renderContactClicks};
