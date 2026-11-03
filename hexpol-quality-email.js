"use strict";
const {polymerBooth} = require("./website-page-config");
const campaignId = 94;
const websiteKey = "hexpol-quality-contact-email";
const pageUrl = "https://www.hexpol.com/rubber/what-we-offer/qualityjourney";
const emailUrl = "mailto:HCA.InsideSales@hexpol.com";

async function provisionContactEmail(client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(610094)");
    // Only configure the actual HEXPOL account with the expected live QR,
    // landing page and ownership. An unrelated database is a no-op.
    const guard = await client.query(`SELECT c.id FROM campaigns c
      JOIN campaigns former ON former.id=$3 AND former.user_id=c.user_id
      JOIN qr_codes qr ON qr.id=$2 AND qr.space_id=41 AND qr.name='2026 Polymer Booth'
      WHERE c.id=$1 AND LOWER(TRIM(c.advertiser))='hexpol' AND LOWER(TRIM(former.advertiser))='hexpol'
        AND NOT COALESCE(qr.is_archived,false) AND NOT COALESCE(c.is_archived,false)
        AND EXISTS (SELECT 1 FROM qr_campaigns a WHERE a.campaign_id=c.id AND a.qr_id=qr.id AND COALESCE(a.is_active,true))
        AND EXISTS (SELECT 1 FROM campaign_destinations d WHERE d.campaign_id=c.id AND COALESCE(d.is_active,true)
          AND RTRIM(d.destination_url,'/')=$4)
      FOR UPDATE OF c`, [campaignId,polymerBooth.qrId,polymerBooth.installCampaignId,pageUrl]);
    if (!guard.rows.length) {
      await client.query("ROLLBACK");
      return "not applicable";
    }
    const saved = await client.query("SELECT id FROM campaign_destinations d WHERE campaign_id=$1 AND to_jsonb(d)->>'website_click_key'=$2", [campaignId,websiteKey]);
    if (saved.rows.length) {
      await client.query("COMMIT");
      return "already configured";
    }
    // Do not silently repurpose a customer's own email action.
    const conflict = await client.query(`SELECT id FROM campaign_destinations WHERE campaign_id=$1
      AND COALESCE(is_active,true) AND (LOWER(TRIM(name))='contact email' OR LOWER(TRIM(destination_url))=LOWER($2))`, [campaignId,emailUrl]);
    if (conflict.rows.length) {
      await client.query("ROLLBACK");
      return "existing email action needs review";
    }
    await client.query("ALTER TABLE campaign_destinations ADD COLUMN IF NOT EXISTS website_click_key TEXT");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS campaign_website_click_key ON campaign_destinations(campaign_id,website_click_key) WHERE website_click_key IS NOT NULL");
    await client.query(`INSERT INTO campaign_destinations
        (campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active,website_click_key)
      SELECT $1,'Contact Email','email',$2,0,COALESCE(MAX(display_order),0)+1,true,$3
        FROM campaign_destinations WHERE campaign_id=$1`, [campaignId,emailUrl,websiteKey]);
    await client.query("COMMIT");
    return "configured";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function recordNativeEmailClick(q, data) {
  // Claim the browser event ID and write the normal reporting event in one
  // SQL statement: a retry is harmless and a failed insert can be retried.
  await q(`WITH eligible AS (
      SELECT e.id AS scan_event_id,e.vivid_click_id,e.qr_id,c.id AS campaign_id,d.id AS action_id
      FROM events e JOIN campaigns c ON c.id=e.campaign_id
      JOIN qr_codes qr ON qr.id=e.qr_id AND NOT COALESCE(qr.is_archived,false)
      JOIN campaign_destinations d ON d.campaign_id=c.id AND COALESCE(d.is_active,true)
      WHERE e.vivid_click_id=$1 AND e.type='scan' AND e.qr_id=$2 AND c.id=$3
        AND LOWER(TRIM(c.advertiser))='hexpol' AND NOT COALESCE(c.is_archived,false)
        AND (c.start_date IS NULL OR c.start_date<=CURRENT_DATE) AND (c.end_date IS NULL OR c.end_date>=CURRENT_DATE)
        AND to_jsonb(d)->>'website_click_key'=$4
        AND EXISTS (SELECT 1 FROM qr_campaigns a WHERE a.qr_id=e.qr_id AND a.campaign_id=c.id AND COALESCE(a.is_active,true))
        AND e.created_at BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '24 hours' AND (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      ORDER BY e.created_at,e.id LIMIT 1
    ), claimed AS (
      INSERT INTO hexpol_contact_clicks(click_event_id,scan_event_id,campaign_id,qr_id,button_key)
      SELECT $5::uuid,scan_event_id,campaign_id,qr_id,$6 FROM eligible
      ON CONFLICT (click_event_id) DO NOTHING RETURNING scan_event_id
    )
    INSERT INTO events (qr_id,campaign_id,campaign_destination_id,vivid_click_id,type,value)
    SELECT e.qr_id,e.campaign_id,e.action_id,e.vivid_click_id,'destination_click',0
    FROM eligible e JOIN claimed USING (scan_event_id)`,
  [data.vivid_click_id,polymerBooth.qrId,campaignId,websiteKey,data.click_event_id,data.button_key]);
}
module.exports = {campaignId, provisionContactEmail, recordNativeEmailClick};
