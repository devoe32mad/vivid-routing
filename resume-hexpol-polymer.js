"use strict";
const {Pool} = require("pg");
const {polymerBooth} = require("./website-page-config");

// The booth QR was reactivated with five new assignments on Nov. 3.
// Clear only the previous show end date; retain its original campaign history.
async function resume(client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(610093)");
    const eligible = await client.query(`SELECT qr.id FROM qr_codes qr
      JOIN spaces s ON s.id=qr.space_id
      JOIN campaigns original ON original.id=$2 AND LOWER(TRIM(original.advertiser))='hexpol'
      WHERE qr.id=$1 AND qr.name='2026 Polymer Booth' AND qr.space_id=41
        AND s.name='2026 Global Polymer Summit' AND NOT COALESCE(qr.is_archived,false)
        AND qr.end_date::date=DATE '2026-10-14'
        AND (SELECT COUNT(DISTINCT c.id) FROM campaigns c JOIN qr_campaigns a ON a.campaign_id=c.id
          WHERE a.qr_id=qr.id AND COALESCE(a.is_active,true) AND NOT COALESCE(c.is_archived,false)
            AND c.user_id=original.user_id AND LOWER(TRIM(c.advertiser))='hexpol'
            AND c.id=ANY($3::int[]))=5 FOR UPDATE OF qr`, [
      polymerBooth.qrId, polymerBooth.installCampaignId, polymerBooth.pages.map(p=>p.campaignId)
    ]);
    if (eligible.rows.length) {
      await client.query("CREATE TABLE IF NOT EXISTS vivid_setup_migrations (key TEXT PRIMARY KEY, completed_at TIMESTAMPTZ DEFAULT NOW())");
      const mark = await client.query("INSERT INTO vivid_setup_migrations(key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING key", ["hexpol-polymer-61-resume-2026-11"]);
      if (mark.rows.length) await client.query("UPDATE qr_codes SET end_date=NULL WHERE id=$1", [polymerBooth.qrId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
if (require.main === module && process.env.RAILWAY_SERVICE_ID === "e7c635e4-6f2b-474d-a85c-10f176056372" && process.env.RAILWAY_ENVIRONMENT_ID === "37e4aa25-f4f4-4d61-a38b-fa95a256e006") {
  (async()=>{
    const pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
    try {
      const client = await pool.connect();
      try {
        await resume(client);
        const result = await require("./hexpol-quality-email").provisionContactEmail(client);
        console.log("HEXPOL Quality Journey contact tracking:",result);
      } finally {client.release();}
    } catch (error) {
      // This metadata update must not take other customers offline.
      console.error("Polymer Booth setup failed:",error.code || "internal");
    } finally {await pool.end();}
  })();
}
module.exports={resume};
