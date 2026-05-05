const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = "https://vivid-routing-production.up.railway.app";

async function q(sql, params = []) {
  return pool.query(sql, params);
}

function money(n) {
  return "$" + Number(n || 0).toLocaleString();
}

function pct(n) {
  return Number(n || 0).toFixed(1) + "%";
}

function page(title, body) {
  return `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;font-family:Arial,sans-serif;background:#f4f7f1;color:#123d25}
.topbar{background:linear-gradient(135deg,#123d25,#2f7d46);color:white;padding:30px 40px}
.brand{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#d7eadb;font-weight:bold}
h1{margin:8px 0 6px;font-size:34px} h2{margin-top:34px}
.subtitle{color:#d7eadb;margin:0}.wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
.btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0}
.btn.secondary{background:#123d25}.btn.gold{background:#9a6a00}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 30px}
.card{background:white;border-radius:18px;padding:22px;box-shadow:0 8px 22px rgba(0,0,0,.08)}
.label{color:#65776b;font-size:13px;margin-bottom:8px}.num{font-size:30px;font-weight:bold}
table{width:100%;background:white;border-collapse:collapse;border-radius:18px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.08);margin-bottom:30px}
th,td{padding:14px;border-bottom:1px solid #e7eee7;text-align:left;vertical-align:top} th{background:#eaf3e8}
.note{background:white;border-left:6px solid #2f7d46;padding:18px;border-radius:16px;box-shadow:0 8px 18px rgba(0,0,0,.06);margin:20px 0}
.choice-card{max-width:620px;margin:36px auto;background:white;border-radius:24px;padding:32px;box-shadow:0 10px 28px rgba(0,0,0,.14)}
.choice-btn{display:block;background:#2f7d46;color:white;padding:17px;margin:12px 0;text-align:center;text-decoration:none;border-radius:14px;font-weight:bold;font-size:16px}
.choice-btn.dark{background:#123d25}.choice-btn.gold{background:#9a6a00}
.deal-pill{display:inline-block;background:#fff4d6;padding:8px 12px;border-radius:999px;color:#7a4b00;font-size:13px;font-weight:bold;margin-bottom:10px}
.pill{display:inline-block;background:#eaf3e8;padding:8px 12px;border-radius:999px;font-size:13px;font-weight:bold;margin-bottom:10px}
.good{color:#1f7a3f}.bad{color:#b00020}
input,select,textarea{width:100%;padding:11px;border-radius:10px;border:1px solid #cfdacf;margin:6px 0 14px;font-size:15px}
.formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.small{font-size:13px;color:#65776b}
@media(max-width:800px){.topbar,.wrap{padding:22px}.cards,.formgrid{grid-template-columns:1fr}h1{font-size:28px}}
</style>
</head>
<body>${body}</body>
</html>`;
}

async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name TEXT;`);

  await q(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    customer_id INT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS spaces (
    id SERIAL PRIMARY KEY,
    customer_id INT,
    name TEXT,
    description TEXT,
    location TEXT,
    host_name TEXT,
    annual_impressions INT DEFAULT 146000,
    placement_cost INT DEFAULT 800,
    host_payout INT DEFAULT 300,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS qr_codes (
    id SERIAL PRIMARY KEY,
    space_id INT,
    name TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    customer_id INT,
    name TEXT,
    advertiser TEXT,
    campaign_url TEXT,
    avg_customer_value INT DEFAULT 50,
    campaign_cost INT DEFAULT 500,
    conversion_rate INT DEFAULT 10,
    is_deal_of_day BOOLEAN DEFAULT false,
    featured_weight INT DEFAULT 80,
    standard_weight INT DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS qr_campaigns (
    id SERIAL PRIMARY KEY,
    qr_id INT,
    campaign_id INT,
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
  )`);
  
await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversion_rate INT DEFAULT 10`);
  
  await q(`CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    customer_id INT,
    name TEXT,
    address TEXT,
    maps_url TEXT,
    waze_url TEXT,
    inventory_priority INT DEFAULT 50,
    inventory_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS campaign_stores (
    id SERIAL PRIMARY KEY,
    campaign_id INT,
    store_id INT,
    weight INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true
  )`);

  await q(`CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    qr_id INT,
    campaign_id INT,
    store_id INT,
    type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const seeded = await q(`SELECT COUNT(*) FROM customers`);
  if (Number(seeded.rows[0].count) === 0) {
    const c = await q(`INSERT INTO customers (name,email) VALUES ($1,$2) RETURNING id`, ["Demo Brand / Vendor", "demo@vividspots.com"]);
    const customerId = c.rows[0].id;

    await q(`INSERT INTO users (customer_id,email,password,role) VALUES
      ($1,'admin@vividspots.com','demo','admin'),
      ($1,'customer@demo.com','demo','customer')`, [customerId]);

    const s = await q(`INSERT INTO spaces (customer_id,name,description,location,host_name,annual_impressions,placement_cost,host_payout)
      VALUES ($1,'School 1 Car Line','High-traffic parent pickup placement','Naples, FL','Demo School',146000,800,300) RETURNING id`, [customerId]);
    const spaceId = s.rows[0].id;

    const qr = await q(`INSERT INTO qr_codes (space_id,name,description) VALUES ($1,'QR 1 - Car Line','Primary QR for car line placement') RETURNING id`, [spaceId]);
    const qrId = qr.rows[0].id;

    const dunkin = await q(`INSERT INTO campaigns (customer_id,name,advertiser,campaign_url,avg_customer_value,campaign_cost,is_deal_of_day)
      VALUES ($1,'Morning Coffee Offer','Dunkin','https://www.dunkindonuts.com',50,500,true) RETURNING id`, [customerId]);

    const pepsi = await q(`INSERT INTO campaigns (customer_id,name,advertiser,campaign_url,avg_customer_value,campaign_cost,is_deal_of_day)
      VALUES ($1,'Pepsi Zero Sugar Push','Pepsi','https://www.pepsi.com',35,700,false) RETURNING id`, [customerId]);

    await q(`INSERT INTO qr_campaigns (qr_id,campaign_id,is_active) VALUES ($1,$2,true)`, [qrId, dunkin.rows[0].id]);

    const store1 = await q(`INSERT INTO stores (customer_id,name,address,maps_url,waze_url,inventory_priority,inventory_note)
      VALUES ($1,'Store A - Low Churn','Naples FL','https://www.google.com/maps/search/?api=1&query=Pepsi+Naples+FL','https://waze.com/ul?q=Pepsi%20Naples%20FL&navigate=yes',90,'Needs product movement') RETURNING id`, [customerId]);

    const store2 = await q(`INSERT INTO stores (customer_id,name,address,maps_url,waze_url,inventory_priority,inventory_note)
      VALUES ($1,'Store B - Healthy Churn','Naples FL','https://www.google.com/maps/search/?api=1&query=Grocery+Naples+FL','https://waze.com/ul?q=Grocery%20Naples%20FL&navigate=yes',30,'Normal inventory') RETURNING id`, [customerId]);

    await q(`INSERT INTO campaign_stores (campaign_id,store_id,weight,is_active) VALUES
      ($1,$2,90,true),($1,$3,30,true)`, [pepsi.rows[0].id, store1.rows[0].id, store2.rows[0].id]);
  }
}
app.get("/fix-schema", async (req, res) => {
  try {
    await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS annual_impressions INT DEFAULT 146000`);
    await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS placement_cost INT DEFAULT 800`);
    await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_payout INT DEFAULT 300`);
    await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS location TEXT`);
    await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_name TEXT`);

    await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS advertiser TEXT`);
    await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_url TEXT`);
    await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS avg_customer_value INT DEFAULT 50`);
    await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_cost INT DEFAULT 500`);
    await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_deal_of_day BOOLEAN DEFAULT false`);

    await q(`ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_id INT`);
    await q(`ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_id INT`);
    await q(`ALTER TABLE events ADD COLUMN IF NOT EXISTS store_id INT`);

    res.send("Schema fixed");
  } catch (err) {
    res.status(500).send(err.message);
  }
});
async function activeCampaignForQr(qrId) {
  const result = await q(`
    SELECT c.*, q.id AS qr_id, q.name AS qr_name, s.name AS space_name, s.location, s.annual_impressions, s.placement_cost, s.host_payout
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    JOIN qr_codes q ON q.id = qc.qr_id
    JOIN spaces s ON s.id = q.space_id
    WHERE qc.qr_id = $1 AND qc.is_active = true
    ORDER BY qc.assigned_at DESC
    LIMIT 1
  `, [qrId]);

  return result.rows[0];
}

async function pickStoreForCampaign(campaignId) {
  const result = await q(`
    SELECT st.*, cs.weight
    FROM campaign_stores cs
    JOIN stores st ON st.id = cs.store_id
    WHERE cs.campaign_id = $1 AND cs.is_active = true
    ORDER BY st.inventory_priority DESC, cs.weight DESC, st.id ASC
    LIMIT 1
  `, [campaignId]);

  return result.rows[0] || null;
}

async function saveEvent({ qrId, campaignId, storeId = null, type }) {
  try {
    await q(`INSERT INTO events (qr_id,campaign_id,store_id,type) VALUES ($1,$2,$3,$4)`, [qrId, campaignId, storeId, type]);
  } catch (err) {
    console.error("event save failed:", err.message);
  }
}

async function metrics(where = "", params = []) {
  const result = await q(`
    SELECT
      COUNT(*) FILTER (WHERE e.type='scan') AS scans,
      COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
      COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
      COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
      COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
    FROM events e
    ${where}
  `, params);

  return result.rows[0];
}

function kpis(m, cost, avgValue, annualImpressions = 146000) {
  const scans = Number(m.scans || 0);
  const intent = Number(m.intent_clicks || 0);
  const customers = Math.round(intent * 0.1);
  const revenue = customers * Number(avgValue || 50);
  const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
  const cac = customers ? cost / customers : 0;
  const cpm = annualImpressions ? (cost / annualImpressions) * 1000 : 0;
  const intentRate = scans ? (intent / scans) * 100 : 0;
  if (!topCampaign || roi > topCampaign.roi) {
  topCampaign = {
    name: c.name || "Campaign " + c.id,
    advertiser: c.advertiser || "",
    roi,
    revenue
  };
}
  return { scans, intent, customers, revenue, roi, cac, cpm, intentRate };
}

app.get("/", (req, res) => {
  res.send(page("Vivid Platform", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Vivid Smart Routing Platform</h1><p class="subtitle">QR campaigns, store routing, ROI, and inventory-aware traffic control.</p></div>
    <div class="wrap">
      <div class="note"><b>Core idea:</b> One permanent QR code can rotate campaigns, route customers to stores, preserve historical ROI, and help vendors move inventory where it needs movement.</div>
      <a class="btn" href="/r/1">Test QR</a>
      <a class="btn secondary" href="/dashboard">Dashboard</a>
      <a class="btn secondary" href="/admin">Admin</a>
      <a class="btn secondary" href="/customer/1/dashboard">Customer Dashboard</a>
      <a class="btn gold" href="/export/events.csv">Export CSV</a>
    </div>
  `));
});

app.get("/init-db", async (req, res) => {
  try {
    await initDb();
    res.send("Full Vivid DB initialized and seeded");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await q("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/r/:qrId", async (req, res) => {
  const qrId = Number(req.params.qrId);
  const campaign = await activeCampaignForQr(qrId);

  if (!campaign) return res.status(404).send("No active campaign assigned to this QR.");

  await saveEvent({ qrId, campaignId: campaign.id, type: "scan" });

  res.send(page("Vivid QR Experience", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>${campaign.advertiser}</h1><p class="subtitle">${campaign.name}</p></div>
    <div class="wrap">
      <div class="choice-card">
        ${campaign.is_deal_of_day ? `<span class="deal-pill">🔥 Deal of the Day</span>` : `<span class="pill">Smart Campaign</span>`}
        <h1>${campaign.name}</h1>
        <p><b>QR:</b> ${campaign.qr_name}<br><b>Location:</b> ${campaign.space_name}</p>
        <a class="choice-btn" href="/click/offer/${qrId}">View Offer</a>
        <a class="choice-btn dark" href="/click/maps/${qrId}">Find Store on Google Maps</a>
        <a class="choice-btn dark" href="/click/waze/${qrId}">Open in Waze</a>
        <p class="small">Vivid routes traffic based on campaign, location, and inventory priority.</p>
      </div>
    </div>
  `));
});

app.get("/click/:type/:qrId", async (req, res) => {
  const qrId = Number(req.params.qrId);
  const type = req.params.type;
  const campaign = await activeCampaignForQr(qrId);

  if (!campaign) return res.status(404).send("No active campaign.");

  let store = null;
  if (type === "maps" || type === "waze") {
    store = await pickStoreForCampaign(campaign.id);
  }

  await saveEvent({ qrId, campaignId: campaign.id, storeId: store ? store.id : null, type });

if (type === "offer") return res.redirect(campaign.campaign_url || "/");

if (type === "maps") {
  const fallbackMapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent((campaign.advertiser || campaign.name || "store") + " Naples FL");

  return res.redirect(store?.maps_url || fallbackMapsUrl);
}

if (type === "waze") {
  const fallbackWazeUrl =
    "https://waze.com/ul?q=" +
    encodeURIComponent((campaign.advertiser || campaign.name || "store") + " Naples FL") +
    "&navigate=yes";

  return res.redirect(store?.waze_url || fallbackWazeUrl);
}

  res.redirect("/");
});

app.get("/dashboard", async (req, res) => {
  try {
    const qrRows = await q(`
      SELECT 
        q.id AS qr_id,
        q.name AS qr_name,
        q.description AS qr_description,
        s.name AS location_name,
        s.location,
        s.annual_impressions,
        s.placement_cost,
        s.host_payout
      FROM qr_codes q
      LEFT JOIN spaces s ON s.id = q.space_id
      ORDER BY q.id
    `);

    const campaignRows = await q(`
      SELECT 
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.advertiser,
        c.campaign_url,
        c.avg_customer_value,
        c.campaign_cost,
        c.is_deal_of_day
      FROM campaigns c
      ORDER BY c.id
    `);

    const totals = await q(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'scan') AS scans,
        COUNT(*) FILTER (WHERE type = 'offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE type = 'maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE type = 'waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks
      FROM events
    `);
const locationRows = await q(`
  SELECT
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.advertiser,
    s.name AS location_name,
    s.location,
    s.placement_cost,
    c.avg_customer_value,
    c.conversion_rate,
    COUNT(*) FILTER (WHERE e.type = 'scan') AS scans,
    COUNT(*) FILTER (WHERE e.type = 'maps') AS maps_clicks,
    COUNT(*) FILTER (WHERE e.type = 'offer') AS offer_clicks,
    COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
  FROM events e
  JOIN campaigns c ON c.id = e.campaign_id
  JOIN qr_codes qr ON qr.id = e.qr_id
  JOIN spaces s ON s.id = qr.space_id
GROUP BY c.id, s.id
ORDER BY intent_clicks DESC, scans DESC, campaign_name ASC
`);
    const total = totals.rows[0];
    const totalIntent = Number(total.intent_clicks || 0);
    const totalScans = Number(total.scans || 0);
    const totalIntentRate = totalScans ? ((totalIntent / totalScans) * 100).toFixed(1) : "0.0";

    let qrTable = "";

    for (const qr of qrRows.rows) {
      const m = await q(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'scan') AS scans,
          COUNT(*) FILTER (WHERE type = 'offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE type = 'maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE type = 'waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks
        FROM events
        WHERE qr_id = $1
      `, [qr.qr_id]);

      const row = m.rows[0];

      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const maps = Number(row.maps_clicks || 0);
      const offers = Number(row.offer_clicks || 0);
      const waze = Number(row.waze_clicks || 0);

      const placementCost = Number(qr.placement_cost || 800);
      const avgCustomerValue = 50;
      const conversionRate = 10;
      const customers = Math.round(intent * (conversionRate / 100));
      const revenue = customers * avgCustomerValue;
      const cac = customers ? placementCost / customers : 0;
      const roi = placementCost ? ((revenue - placementCost) / placementCost) * 100 : 0;
      const intentRate = scans ? ((intent / scans) * 100).toFixed(1) : "0.0";
      const cpm = qr.annual_impressions ? ((placementCost / Number(qr.annual_impressions)) * 1000).toFixed(2) : "0.00";

      qrTable += `
        <tr>
          <td>${qr.qr_name || "QR " + qr.qr_id}</td>
          <td>${qr.location_name || ""}</td>
          <td>${qr.location || ""}</td>
          <td>${Number(qr.annual_impressions || 0).toLocaleString()}</td>
          <td>${scans}</td>
          <td>${maps}</td>
          <td>${offers}</td>
          <td>${waze}</td>
          <td>${intentRate}%</td>
          <td>${customers}</td>
          <td>${money(revenue)}</td>
          <td>${money(placementCost)}</td>
          <td>${money(cac)}</td>
          <td>$${cpm}</td>
          <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
        </tr>
      `;
    }
let topCampaign = null;
let bestLocation = null;
let bestQR = null;
    let campaignTable = "";

    for (const c of campaignRows.rows) {
      const m = await q(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'scan') AS scans,
          COUNT(*) FILTER (WHERE type = 'offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE type = 'maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE type = 'waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks
        FROM events
        WHERE campaign_id = $1
      `, [c.campaign_id]);

      const row = m.rows[0];

      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const maps = Number(row.maps_clicks || 0);
      const offers = Number(row.offer_clicks || 0);
      const waze = Number(row.waze_clicks || 0);

      const campaignCost = Number(c.campaign_cost || 0);
      const avgCustomerValue = Number(c.avg_customer_value || 50);
      const customers = Math.round(intent * 0.10);
      const revenue = customers * avgCustomerValue;
      const cac = customers ? campaignCost / customers : 0;
      const roi = campaignCost ? ((revenue - campaignCost) / campaignCost) * 100 : 0;
    
if (!topCampaign || roi > topCampaign.roi) {
  topCampaign = {
    name: c.campaign_name || c.name || c.advertiser || "Campaign " + c.id,
    advertiser: c.advertiser || "",
    roi,
    revenue
  };
}
      const intentRate = scans ? ((intent / scans) * 100).toFixed(1) : "0.0";

      campaignTable += `
        <tr>
          <td>${c.advertiser || ""}</td>
          <td>${c.campaign_name || ""}</td>
          <td>${c.is_deal_of_day ? "🔥 Deal of the Day" : "Standard"}</td>
          <td>${scans}</td>
          <td>${maps}</td>
          <td>${offers}</td>
          <td>${waze}</td>
          <td>${intentRate}%</td>
          <td>${customers}</td>
          <td>${money(avgCustomerValue)}</td>
          <td>${money(revenue)}</td>
          <td>${money(campaignCost)}</td>
          <td>${money(cac)}</td>
          <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
        </tr>
      `;
    }
let locationTable = "";

for (const row of locationRows.rows) {
  const scans = Number(row.scans || 0);
  const intent = Number(row.intent_clicks || 0);

  const conversionRate = Number(row.conversion_rate || 10);
  const customers = Math.round(intent * (conversionRate / 100));

  const avgValue = Number(row.avg_customer_value || 50);
  const revenue = customers * avgValue;

  const cost = Number(row.placement_cost || 800);
  const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
if (!bestLocation || revenue > bestLocation.revenue) {
  bestLocation = {
    name: row.location_name || row.location || "Location",
    revenue,
    roi
  };
}
  const intentRate = scans ? (intent / scans) * 100 : 0;

  locationTable += `
    <tr>
      <td>${row.advertiser || ""}</td>
      <td>${row.campaign_name || ""}</td>
      <td>${row.location_name || ""}</td>
      <td>${row.location || ""}</td>
      <td>${scans}</td>
      <td>${row.maps_clicks || 0}</td>
      <td>${row.offer_clicks || 0}</td>
      <td>${intentRate.toFixed(1)}%</td>
      <td>${customers}</td>
      <td>$${revenue.toLocaleString()}</td>
      <td class="${roi >= 0 ? "good" : "bad"}">${roi.toFixed(1)}%</td>
    </tr>
  `;
}
    res.send(page("Vivid ROI Dashboard", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>ROI Dashboard</h1>
        <p class="subtitle">QR Code ROI + Campaign ROI + Store Intent</p>
      </div>

      <div class="wrap">
      <div style="display:flex; gap:20px; margin-bottom:20px;">

  <div style="background:#fff; padding:15px; border-radius:8px;">
    <h3>🏆 Top Campaign</h3>
    <div>${topCampaign?.name || '-'}</div>
    <div>ROI: ${topCampaign ? topCampaign.roi.toFixed(1) : 0}%</div>
  </div>

  <div style="background:#fff; padding:15px; border-radius:8px;">
    <h3>📍 Best Location</h3>
    <div>${bestLocation?.name || '-'}</div>
    <div>Revenue: $${bestLocation ? bestLocation.revenue.toLocaleString() : 0}</div>
  </div>

</div>
        <a class="btn" href="/r/1">Test QR</a>
        <a class="btn secondary" href="/admin">Admin</a>
        <a class="btn secondary" href="/admin/assign">Assign Campaign</a>
        <a class="btn gold" href="/export/events.csv">Export CSV</a>

        <div class="note">
          <strong>Money View:</strong> This dashboard separates ROI by permanent QR/location and by campaign. 
          The QR stays the same. Campaigns can change. Historical ROI stays intact.
        </div>

        <div class="cards">
          <div class="card"><div class="label">Total Scans</div><div class="num">${total.scans || 0}</div></div>
          <div class="card"><div class="label">Google Maps Clicks</div><div class="num">${total.maps_clicks || 0}</div></div>
          <div class="card"><div class="label">Offer Clicks</div><div class="num">${total.offer_clicks || 0}</div></div>
          <div class="card"><div class="label">Intent Rate</div><div class="num">${totalIntentRate}%</div></div>
        </div>

        <h2>ROI by QR Code / Location</h2>
        <table>
          <tr>
            <th>QR Code</th>
            <th>Location</th>
            <th>Market</th>
            <th>Annual Impressions</th>
            <th>Scans</th>
            <th>Maps</th>
            <th>Offers</th>
            <th>Waze</th>
            <th>Intent Rate</th>
            <th>Est. Customers</th>
            <th>Est. Revenue</th>
            <th>Placement Cost</th>
            <th>CAC</th>
            <th>CPM</th>
            <th>ROI</th>
          </tr>
          ${qrTable}
        </table>

        <h2>ROI by Campaign</h2>
        <table>
          <tr>
            <th>Advertiser</th>
            <th>Campaign</th>
            <th>Type</th>
            <th>Scans</th>
            <th>Maps</th>
            <th>Offers</th>
            <th>Waze</th>
            <th>Intent Rate</th>
            <th>Est. Customers</th>
            <th>Avg Value</th>
            <th>Est. Revenue</th>
            <th>Campaign Cost</th>
            <th>CAC</th>
            <th>ROI</th>
          </tr>
          ${campaignTable}
        </table>
        <h2>Location Comparison (Campaign vs Location)</h2>
<table>
  <tr>
    <th>Advertiser</th>
    <th>Campaign</th>
    <th>Location</th>
    <th>Market</th>
    <th>Scans</th>
    <th>Maps</th>
    <th>Offers</th>
    <th>Intent Rate</th>
    <th>Customers</th>
    <th>Revenue</th>
    <th>ROI</th>
  </tr>
  ${locationTable}
</table>
      </div>
    `));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/admin", async (req, res) => {
  const customers = await q(`SELECT * FROM customers ORDER BY id`);
  const qrs = await q(`SELECT q.*, s.name AS space_name FROM qr_codes q JOIN spaces s ON s.id=q.space_id ORDER BY q.id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);

  res.send(page("Vivid Admin", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Admin Control Center</h1><p class="subtitle">Manage customers, QR codes, campaigns, assignments, and reports.</p></div>
    <div class="wrap">
      <a class="btn" href="/dashboard">Dashboard</a><a class="btn secondary" href="/admin/new-campaign">New Campaign</a><a class="btn secondary" href="/admin/assign">Assign Campaign</a>

      <h2>Customers</h2>
      <table><tr><th>ID</th><th>Name</th><th>Email</th></tr>${customers.rows.map(c=>`<tr><td>${c.id}</td><td>${c.name}</td><td>${c.email || ""}</td></tr>`).join("")}</table>

      <h2>QR Codes</h2>
      <table><tr><th>ID</th><th>QR</th><th>Space</th><th>Routing URL</th></tr>${qrs.rows.map(qr=>`<tr><td>${qr.id}</td><td>${qr.name}</td><td>${qr.space_name}</td><td>${BASE_URL}/r/${qr.id}</td></tr>`).join("")}</table>

      <h2>Campaigns</h2>
      <table><tr><th>ID</th><th>Advertiser</th><th>Campaign</th><th>URL</th><th>Avg Value</th><th>Cost</th><th>Deal</th></tr>${campaigns.rows.map(c=>`<tr><td>${c.id}</td><td>${c.advertiser}</td><td>${c.name}</td><td>${c.campaign_url}</td><td>${money(c.avg_customer_value)}</td><td>${money(c.campaign_cost)}</td><td>${c.is_deal_of_day ? "Yes" : "No"}</td></tr>`).join("")}</table>
    </div>
  `));
});

app.get("/admin/new-campaign", async (req, res) => {
  const customers = await q(`SELECT * FROM customers ORDER BY id`);
  res.send(page("New Campaign", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Create Campaign</h1><p class="subtitle">Campaign URL follows the campaign name and keeps history when switched.</p></div>
    <div class="wrap"><form method="POST" action="/admin/new-campaign">
      <div class="formgrid">
        <div><label>Customer</label><select name="customer_id">${customers.rows.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
        <div><label>Advertiser</label><input name="advertiser" value="Pepsi"></div>
        <div><label>Campaign Name</label><input name="name" value="Low Inventory Store Push"></div>
        <div><label>Campaign URL</label><input name="campaign_url" value="https://www.pepsi.com"></div>
        <div><label>Average Customer Value</label><input name="avg_customer_value" value="35"></div>
        <div><label>Campaign Cost</label><input name="campaign_cost" value="700"></div>
        <label>Conversion Rate (%)</label>
<input name="conversion_rate" value="10" />
      </div>
      <label><input type="checkbox" name="is_deal_of_day" style="width:auto"> Deal of the Day</label><br><br>
      <button class="btn" type="submit">Create Campaign</button>
    </form></div>
  `));
});

app.get("/admin/assign", async (req, res) => {
  const qrs = await q(`SELECT * FROM qr_codes ORDER BY id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  res.send(page("Assign Campaign", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Assign Campaign to QR</h1><p class="subtitle">Same QR stays permanent. Campaign changes. History stays intact.</p></div>
    <div class="wrap"><form method="POST" action="/admin/assign">
      <label>QR Code</label><select name="qr_id">${qrs.rows.map(qr=>`<option value="${qr.id}">${qr.id} - ${qr.name}</option>`).join("")}</select>
      <label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c=>`<option value="${c.id}">${c.advertiser} - ${c.name}</option>`).join("")}</select>
      <button class="btn" type="submit">Assign Campaign</button>
    </form></div>
  `));
});

app.post("/admin/assign", async (req, res) => {
  await q(`UPDATE qr_campaigns SET is_active=false, ended_at=CURRENT_TIMESTAMP WHERE qr_id=$1 AND is_active=true`, [req.body.qr_id]);
  await q(`INSERT INTO qr_campaigns (qr_id,campaign_id,is_active) VALUES ($1,$2,true)`, [req.body.qr_id, req.body.campaign_id]);
  res.redirect("/admin");
});

app.get("/customer/:id/dashboard", async (req, res) => {
  const customerId = req.params.id;
  const customer = await q(`SELECT * FROM customers WHERE id=$1`, [customerId]);
  const campaigns = await q(`SELECT * FROM campaigns WHERE customer_id=$1 ORDER BY id`, [customerId]);

  let rows = "";
  for (const c of campaigns.rows) {
    const m = await metrics(`WHERE e.campaign_id=$1`, [c.id]);
    const calc = kpis(m, c.campaign_cost, c.avg_customer_value);
    rows += `<tr><td>${c.advertiser}</td><td>${c.name}</td><td>${m.scans}</td><td>${m.maps_clicks}</td><td>${m.offer_clicks}</td><td>${money(calc.revenue)}</td><td>${pct(calc.roi)}</td></tr>`;
  }

  res.send(page("Customer Dashboard", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>${customer.rows[0]?.name || "Customer"} Dashboard</h1><p class="subtitle">Campaign performance and ROI.</p></div>
    <div class="wrap"><table><tr><th>Advertiser</th><th>Campaign</th><th>Scans</th><th>Google Maps</th><th>Offer</th><th>Revenue</th><th>ROI</th></tr>${rows}</table></div>
  `));
});

app.get("/stores", async (req, res) => {
  const stores = await q(`SELECT * FROM stores ORDER BY inventory_priority DESC`);
  res.send(page("Store Routing", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Inventory-Aware Store Routing</h1><p class="subtitle">Route customers to stores that need product movement.</p></div>
    <div class="wrap">
      <table><tr><th>Store</th><th>Address</th><th>Priority</th><th>Note</th></tr>
      ${stores.rows.map(s=>`<tr><td>${s.name}</td><td>${s.address}</td><td>${s.inventory_priority}</td><td>${s.inventory_note}</td></tr>`).join("")}
      </table>
    </div>
  `));
});

app.get("/analytics", async (req, res) => {
  const total = await metrics();
  res.json(total);
});

app.get("/export/events.csv", async (req, res) => {
  const result = await q(`
    SELECT e.id,e.created_at,e.type,e.qr_id,q.name AS qr_name,e.campaign_id,c.name AS campaign,c.advertiser,e.store_id,st.name AS store
    FROM events e
    LEFT JOIN qr_codes q ON q.id=e.qr_id
    LEFT JOIN campaigns c ON c.id=e.campaign_id
    LEFT JOIN stores st ON st.id=e.store_id
    ORDER BY e.created_at DESC
  `);

  const header = "id,created_at,type,qr_id,qr_name,campaign_id,campaign,advertiser,store_id,store\n";
  const rows = result.rows.map(r =>
    [r.id,r.created_at,r.type,r.qr_id,r.qr_name,r.campaign_id,r.campaign,r.advertiser,r.store_id,r.store]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=vivid-events.csv");
  res.send(header + rows);
});

app.listen(port, () => console.log("Server running on port " + port));
