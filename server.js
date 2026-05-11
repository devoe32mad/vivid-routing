const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const BASE_URL =
  process.env.BASE_URL || "https://vivid-routing-production.up.railway.app";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
    body{margin:0;font-family:Arial,sans-serif;background:#f4f7f1;color:#073b22}
    .topbar{background:linear-gradient(135deg,#123d25,#2f7d46);color:white;padding:30px 40px}
    .brand{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d7eadb;font-weight:bold}
    h1{margin:8px 0 6px;font-size:34px}
    h2{margin-top:34px}
    .subtitle{color:#d7eadb;margin:0}
    .wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
    .btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0}
    .btn.secondary{background:#123d25}
    .btn.gold{background:#9a6a00}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 30px}
    .card{background:white;border-radius:18px;padding:22px;box-shadow:0 8px 22px rgba(0,0,0,.08)}
    .label{color:#65776b;font-size:13px;margin-bottom:8px}
    .num{font-size:30px;font-weight:bold}
    table{width:100%;background:white;border-collapse:collapse;border-radius:18px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.08);margin-bottom:30px}
    th,td{padding:13px;border-bottom:1px solid #e7eee7;text-align:left;vertical-align:top;font-size:14px}
    th{background:#eaf3e8}
    .note{background:white;border-left:6px solid #2f7d46;padding:18px;border-radius:16px;box-shadow:0 8px 18px rgba(0,0,0,.06);margin:20px 0}
    .choice-card{max-width:620px;margin:36px auto;background:white;border-radius:24px;padding:32px;box-shadow:0 10px 28px rgba(0,0,0,.14)}
    .choice-btn{display:block;background:#2f7d46;color:white;padding:17px;margin:12px 0;text-align:center;text-decoration:none;border-radius:14px;font-weight:bold;font-size:16px}
    .choice-btn.dark{background:#123d25}
    .pill{display:inline-block;background:#eaf3e8;padding:8px 12px;border-radius:999px;font-size:13px;font-weight:bold;margin-bottom:10px}
    .deal{display:inline-block;background:#fff4d6;padding:8px 12px;border-radius:999px;color:#7a4b00;font-size:13px;font-weight:bold;margin-bottom:10px}
    .good{color:#1f7a3f;font-weight:bold}
    .bad{color:#b00020;font-weight:bold}
    input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #cfdacf;margin:6px 0 14px;font-size:15px}
    .formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .small{font-size:13px;color:#65776b}
    a{color:#176b3a;font-weight:bold}
    @media(max-width:800px){.topbar,.wrap{padding:22px}.cards,.formgrid{grid-template-columns:1fr}h1{font-size:28px}}
  </style>
</head>
<body>${body}</body>
</html>`;
}

async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT,
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
    name TEXT,
    advertiser TEXT,
    campaign_url TEXT,
    avg_customer_value INT DEFAULT 50,
    campaign_cost INT DEFAULT 500,
    conversion_rate INT DEFAULT 10,
    is_deal_of_day BOOLEAN DEFAULT false,
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

  await q(`CREATE TABLE IF NOT EXISTS campaign_schedules (
    id SERIAL PRIMARY KEY,
    qr_id INT,
    campaign_id INT,
    day_of_week INT DEFAULT 0,
    start_time TEXT DEFAULT '00:00',
    end_time TEXT DEFAULT '23:59',
    priority INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name TEXT,
    address TEXT,
    maps_url TEXT,
    waze_url TEXT,
    inventory_priority INT DEFAULT 50,
    inventory_units INT DEFAULT 0,
    days_on_hand INT DEFAULT 0,
    inventory_velocity INT DEFAULT 0,
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

  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS annual_impressions INT DEFAULT 146000`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS placement_cost INT DEFAULT 800`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_payout INT DEFAULT 300`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversion_rate INT DEFAULT 10`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_cost INT DEFAULT 500`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS avg_customer_value INT DEFAULT 50`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_priority INT DEFAULT 50`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_units INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS days_on_hand INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_velocity INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_note TEXT`);
  await q(`ALTER TABLE events ADD COLUMN IF NOT EXISTS store_id INT`);

  const customers = await q(`SELECT COUNT(*) FROM customers`);
  if (Number(customers.rows[0].count) === 0) {
    await q(`INSERT INTO customers (name,email) VALUES ('Demo Brand / Vendor','demo@vividspots.com')`);
  }

  const spaces = await q(`SELECT COUNT(*) FROM spaces`);
  if (Number(spaces.rows[0].count) === 0) {
    await q(`
      INSERT INTO spaces (customer_id,name,description,location,host_name,annual_impressions,placement_cost,host_payout)
      VALUES (1,'School 1 Car Line','High-traffic parent pickup placement','Naples, FL','Demo School',146000,800,300)
    `);
  }

  const qrs = await q(`SELECT COUNT(*) FROM qr_codes`);
  if (Number(qrs.rows[0].count) === 0) {
    await q(`INSERT INTO qr_codes (space_id,name,description) VALUES (1,'QR 1 - Car Line','Primary QR for car line placement')`);
  }

  const campaigns = await q(`SELECT COUNT(*) FROM campaigns`);
  if (Number(campaigns.rows[0].count) === 0) {
    await q(`
      INSERT INTO campaigns (name,advertiser,campaign_url,avg_customer_value,campaign_cost,conversion_rate,is_deal_of_day)
      VALUES 
      ('Morning Coffee Offer','Dunkin','https://www.dunkindonuts.com',50,300,10,true),
      ('Low Inventory Store Push','Pepsi','https://www.pepsi.com',35,700,15,false)
    `);
  }

  const stores = await q(`SELECT COUNT(*) FROM stores`);
  if (Number(stores.rows[0].count) === 0) {
    await q(`
      INSERT INTO stores (name,address,maps_url,waze_url,inventory_priority,inventory_units,days_on_hand,inventory_velocity,inventory_note)
      VALUES 
      ('Dunkin Naples','Naples FL','https://www.google.com/maps/search/?api=1&query=Dunkin+Naples+FL','https://waze.com/ul?q=Dunkin%20Naples%20FL&navigate=yes',70,120,12,10,'Normal inventory'),
      ('Store A - Low Churn','Naples FL','https://www.google.com/maps/search/?api=1&query=Pepsi+Naples+FL','https://waze.com/ul?q=Pepsi%20Naples%20FL&navigate=yes',90,500,45,3,'Needs traffic push')
    `);
  }

  const assignments = await q(`SELECT COUNT(*) FROM qr_campaigns`);
  if (Number(assignments.rows[0].count) === 0) {
    await q(`INSERT INTO qr_campaigns (qr_id,campaign_id,is_active) VALUES (1,1,true)`);
  }

  const campaignStores = await q(`SELECT COUNT(*) FROM campaign_stores`);
  if (Number(campaignStores.rows[0].count) === 0) {
    await q(`INSERT INTO campaign_stores (campaign_id,store_id,weight,is_active) VALUES (1,1,70,true),(2,2,90,true)`);
  }
}

async function activeCampaignForQr(qrId) {
  const scheduled = await q(`
    SELECT c.*, qr.id AS qr_id, qr.name AS qr_name, s.name AS space_name, s.location
    FROM campaign_schedules cs
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN qr_codes qr ON qr.id = cs.qr_id
    JOIN spaces s ON s.id = qr.space_id
    WHERE cs.qr_id = $1
      AND cs.is_active = true
      AND (cs.day_of_week = EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INT OR cs.day_of_week = 0)
      AND CURRENT_TIME BETWEEN cs.start_time::time AND cs.end_time::time
    ORDER BY cs.priority DESC, cs.created_at DESC
    LIMIT 1
  `, [qrId]);

  if (scheduled.rows[0]) return scheduled.rows[0];

  const fallback = await q(`
    SELECT c.*, qr.id AS qr_id, qr.name AS qr_name, s.name AS space_name, s.location
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    JOIN qr_codes qr ON qr.id = qc.qr_id
    JOIN spaces s ON s.id = qr.space_id
    WHERE qc.qr_id = $1 AND qc.is_active = true
    ORDER BY qc.assigned_at DESC
    LIMIT 1
  `, [qrId]);

  return fallback.rows[0] || null;
}

async function pickBestStoreForCampaign(campaign) {
  const stores = await q(`
    SELECT s.*, cs.weight
    FROM campaign_stores cs
    JOIN stores s ON s.id = cs.store_id
    WHERE cs.campaign_id = $1 AND cs.is_active = true
  `, [campaign.id]);

  let bestStore = null;

  for (const s of stores.rows) {
    const metrics = await q(`
      SELECT COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent
      FROM events
      WHERE store_id = $1 AND campaign_id = $2
    `, [s.id, campaign.id]);

    const intent = Number(metrics.rows[0].intent || 0);
    const conversionRate = Number(campaign.conversion_rate || 10);
    const customers = Math.round(intent * (conversionRate / 100));
    const revenue = customers * Number(campaign.avg_customer_value || 50);
    const score =
      revenue +
      Number(s.inventory_priority || 0) * 10 +
      Number(s.weight || 0) * 5;

    if (!bestStore || score > bestStore.score) {
      bestStore = { store: s, score };
    }
  }

  return bestStore ? bestStore.store : null;
}

async function saveEvent({ qrId, campaignId, storeId = null, type }) {
  await q(
    `INSERT INTO events (qr_id,campaign_id,store_id,type) VALUES ($1,$2,$3,$4)`,
    [qrId, campaignId, storeId, type]
  );
}

app.get("/", (req, res) => {
  res.send(page("Vivid Platform", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Smart QR Routing Platform</h1>
      <p class="subtitle">Campaign switching, ROI tracking, store routing, schedules, and inventory-aware demand activation.</p>
    </div>
    <div class="wrap">
      <a class="btn" href="/dashboard">Dashboard</a>
      <a class="btn secondary" href="/admin">Admin</a>
      <a class="btn gold" href="/r/1">Test QR</a>
    </div>
  `));
});

app.get("/init-db", async (req, res) => {
  try {
    await initDb();
    res.send("Full Vivid DB initialized and updated");
  } catch (err) {
    res.status(500).send("INIT DB ERROR: " + err.message);
  }
});

app.get("/db-test", async (req, res) => {
  const result = await q("SELECT NOW()");
  res.json(result.rows[0]);
});

app.get("/r/:qrId", async (req, res) => {
  const qrId = Number(req.params.qrId);
  const campaign = await activeCampaignForQr(qrId);

  if (!campaign) return res.status(404).send("No active campaign assigned to this QR.");

  await saveEvent({ qrId, campaignId: campaign.id, type: "scan" });

  res.send(page("Vivid QR Experience", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>${campaign.advertiser || "Campaign"}</h1>
      <p class="subtitle">${campaign.name || ""}</p>
    </div>
    <div class="wrap">
      <div class="choice-card">
        ${campaign.is_deal_of_day ? `<span class="deal">🔥 Deal of the Day</span>` : `<span class="pill">Smart Campaign</span>`}
        <h1>${campaign.name || "Campaign"}</h1>
        <p><b>QR:</b> ${campaign.qr_name || qrId}<br><b>Location:</b> ${campaign.space_name || ""}</p>
        <a class="choice-btn" href="/click/offer/${qrId}">View Offer</a>
        <a class="choice-btn dark" href="/click/maps/${qrId}">Find Store on Google Maps</a>
        <a class="choice-btn dark" href="/click/waze/${qrId}">Open in Waze</a>
        <p class="small">Vivid routes traffic based on campaign, performance, schedule, and inventory priority.</p>
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
    store = await pickBestStoreForCampaign(campaign);
  }

  await saveEvent({ qrId, campaignId: campaign.id, storeId: store ? store.id : null, type });

  if (type === "offer") return res.redirect(campaign.campaign_url || "/");

  if (type === "maps") {
    const fallback = "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent((campaign.advertiser || campaign.name || "store") + " Naples FL");
    return res.redirect(store?.maps_url || fallback);
  }

  if (type === "waze") {
    const fallback = "https://waze.com/ul?q=" +
      encodeURIComponent((campaign.advertiser || campaign.name || "store") + " Naples FL") +
      "&navigate=yes";
    return res.redirect(store?.waze_url || fallback);
  }

  res.redirect("/");
});

app.get("/dashboard", async (req, res) => {
  try {
    const start = req.query.start || "";
    const end = req.query.end || "";
    const hasDate = !!(start && end);
    const dateSql = hasDate ? "AND e.created_at BETWEEN $1::date AND ($2::date + interval '1 day')" : "";
    const dateParams = hasDate ? [start, end] : [];

    const totalResult = await q(`
      SELECT
        COUNT(*) FILTER (WHERE e.type='scan') AS scans,
        COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM events e
      WHERE 1=1 ${dateSql}
    `, dateParams);

    const trendResult = await q(`
      SELECT DATE(e.created_at) AS day,
        COUNT(*) FILTER (WHERE e.type='scan') AS scans,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM events e
      WHERE 1=1 ${dateSql}
      GROUP BY DATE(e.created_at)
      ORDER BY day DESC
      LIMIT 14
    `, dateParams);

    const qrRows = await q(`
      SELECT qr.id AS qr_id, qr.name AS qr_name, s.name AS space_name, s.location, s.annual_impressions, s.placement_cost
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      ORDER BY qr.id
    `);

    const campaignRows = await q(`SELECT * FROM campaigns ORDER BY id`);

    const locationRows = await q(`
      SELECT c.id AS campaign_id, c.name AS campaign_name, c.advertiser,
        s.id AS space_id, s.name AS location_name, s.location, s.placement_cost,
        c.avg_customer_value, c.conversion_rate,
        COUNT(*) FILTER (WHERE e.type='scan') AS scans,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM events e
      JOIN campaigns c ON c.id = e.campaign_id
      JOIN qr_codes qr ON qr.id = e.qr_id
      JOIN spaces s ON s.id = qr.space_id
      WHERE 1=1 ${dateSql}
      GROUP BY c.id, s.id
      ORDER BY intent_clicks DESC, scans DESC
    `, dateParams);

    const storeRows = await q(`
      SELECT st.id AS store_id, st.name AS store_name, st.address,
        st.inventory_priority, st.inventory_units, st.days_on_hand,
        st.inventory_velocity, st.inventory_note,
        c.name AS campaign_name, c.advertiser, c.avg_customer_value, c.conversion_rate,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM stores st
      LEFT JOIN events e ON e.store_id = st.id ${hasDate ? "AND e.created_at BETWEEN $1::date AND ($2::date + interval '1 day')" : ""}
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      GROUP BY st.id, c.id
      ORDER BY intent_clicks DESC, st.inventory_priority DESC
    `, dateParams);

    const activeSchedules = await q(`
      SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM campaign_schedules cs
      JOIN qr_codes qr ON qr.id = cs.qr_id
      JOIN campaigns c ON c.id = cs.campaign_id
      WHERE cs.is_active = true
      ORDER BY cs.qr_id, cs.priority DESC
    `);

    const total = totalResult.rows[0];
    const totalScans = Number(total.scans || 0);
    const totalIntent = Number(total.intent_clicks || 0);
    const totalIntentRate = totalScans ? (totalIntent / totalScans) * 100 : 0;

    let trendTable = "";
    for (const r of trendResult.rows) {
      trendTable += `<tr><td>${new Date(r.day).toLocaleDateString()}</td><td>${r.scans || 0}</td><td>${r.intent_clicks || 0}</td></tr>`;
    }

    let topCampaign = null;
    let bestLocation = null;

    let qrTable = "";
    for (const qr of qrRows.rows) {
      const m = await q(`
        SELECT COUNT(*) FILTER (WHERE e.type='scan') AS scans,
          COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
        FROM events e
        WHERE e.qr_id = $1
        ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
      `, hasDate ? [qr.qr_id, start, end] : [qr.qr_id]);

      const row = m.rows[0];
      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const customers = Math.round(intent * 0.10);
      const revenue = customers * 50;
      const cost = Number(qr.placement_cost || 800);
      const cac = customers ? cost / customers : 0;
      const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
      const cpm = qr.annual_impressions ? (cost / Number(qr.annual_impressions)) * 1000 : 0;
      const intentRate = scans ? (intent / scans) * 100 : 0;

      qrTable += `<tr>
        <td><a href="/qr-admin/${qr.qr_id}">${qr.qr_name || "QR " + qr.qr_id}</a></td>
        <td>${qr.space_name || ""}</td><td>${qr.location || ""}</td>
        <td>${Number(qr.annual_impressions || 0).toLocaleString()}</td>
        <td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${row.waze_clicks || 0}</td>
        <td>${pct(intentRate)}</td><td>${customers}</td><td>${money(revenue)}</td><td>${money(cost)}</td><td>${money(cac)}</td><td>$${cpm.toFixed(2)}</td>
        <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
      </tr>`;
    }

    let campaignTable = "";
    for (const c of campaignRows.rows) {
      const m = await q(`
        SELECT COUNT(*) FILTER (WHERE e.type='scan') AS scans,
          COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
        FROM events e
        WHERE e.campaign_id = $1
        ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
      `, hasDate ? [c.id, start, end] : [c.id]);

      const row = m.rows[0];
      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const conversionRate = Number(c.conversion_rate || 10);
      const customers = Math.round(intent * (conversionRate / 100));
      const avgValue = Number(c.avg_customer_value || 50);
      const revenue = customers * avgValue;
      const cost = Number(c.campaign_cost || 0);
      const cac = customers ? cost / customers : 0;
      const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
      const intentRate = scans ? (intent / scans) * 100 : 0;

      if (!topCampaign || revenue > topCampaign.revenue) {
        topCampaign = { name: c.name || "Campaign " + c.id, advertiser: c.advertiser || "", revenue, roi };
      }

      campaignTable += `<tr>
        <td>${c.advertiser || ""}</td><td><a href="/campaign-admin/${c.id}">${c.name || ""}</a></td><td>${c.is_deal_of_day ? "🔥 Deal" : "Standard"}</td>
        <td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${row.waze_clicks || 0}</td>
        <td>${pct(intentRate)}</td><td>${customers}</td><td>${money(avgValue)}</td><td>${money(revenue)}</td><td>${money(cost)}</td><td>${money(cac)}</td>
        <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
      </tr>`;
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
      const intentRate = scans ? (intent / scans) * 100 : 0;

      if (!bestLocation || revenue > bestLocation.revenue) {
        bestLocation = { name: row.location_name || row.location || "Location", revenue, roi };
      }

      locationTable += `<tr>
        <td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td><td>${row.location_name || ""}</td><td>${row.location || ""}</td>
        <td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${pct(intentRate)}</td><td>${customers}</td><td>${money(revenue)}</td>
        <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
      </tr>`;
    }

    let storeTable = "";
    for (const row of storeRows.rows) {
      const intent = Number(row.intent_clicks || 0);
      const conversionRate = Number(row.conversion_rate || 10);
      const avgValue = Number(row.avg_customer_value || 50);
      const customers = Math.round(intent * (conversionRate / 100));
      const revenue = customers * avgValue;
      const priority = Number(row.inventory_priority || 0);
      const status = priority >= 80 ? "High Priority Push" : priority >= 50 ? "Normal Priority" : "Low Priority";

      storeTable += `<tr>
        <td>${row.store_name || ""}</td><td>${row.address || ""}</td><td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td>
        <td>${priority}</td><td>${row.inventory_units || 0}</td><td>${row.days_on_hand || 0}</td><td>${row.inventory_velocity || 0}</td><td>${row.inventory_note || ""}</td>
        <td>${row.maps_clicks || 0}</td><td>${row.waze_clicks || 0}</td><td>${intent}</td><td>${customers}</td><td>${money(revenue)}</td><td>${status}</td>
      </tr>`;
    }

    let activeScheduleTable = "";
    for (const row of activeSchedules.rows) {
      const dayText =
        row.day_of_week == 0 ? "Every Day / Sunday" :
        row.day_of_week == 1 ? "Monday" :
        row.day_of_week == 2 ? "Tuesday" :
        row.day_of_week == 3 ? "Wednesday" :
        row.day_of_week == 4 ? "Thursday" :
        row.day_of_week == 5 ? "Friday" : "Saturday";

      activeScheduleTable += `<tr>
        <td>${row.qr_name || row.qr_id}</td><td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td>
        <td>${dayText}</td><td>${row.start_time}</td><td>${row.end_time}</td><td>${row.priority}</td><td>${row.is_active ? "Active" : "Inactive"}</td>
      </tr>`;
    }

    res.send(page("Vivid ROI Dashboard", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>ROI Dashboard</h1>
        <p class="subtitle">QR ROI + Campaign ROI + Store Intent + Inventory Routing + Scheduled Campaigns</p>
      </div>

      <div class="wrap">
        <form method="GET" action="/dashboard" style="margin-bottom:20px;">
          <label>Start Date</label><input type="date" name="start" value="${start}" />
          <label>End Date</label><input type="date" name="end" value="${end}" />
          <button class="btn" type="submit">Apply Date Filter</button>
        </form>

        <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;">
          <div class="card" style="width:220px;"><h3>🏆 Top Campaign</h3><div>${topCampaign?.name || "-"}</div><div class="small">${topCampaign?.advertiser || ""}</div><div>Revenue: ${money(topCampaign?.revenue || 0)}</div><div>ROI: ${pct(topCampaign?.roi || 0)}</div></div>
          <div class="card" style="width:220px;"><h3>📍 Best Location</h3><div>${bestLocation?.name || "-"}</div><div>Revenue: ${money(bestLocation?.revenue || 0)}</div><div>ROI: ${pct(bestLocation?.roi || 0)}</div></div>
        </div>

        <a class="btn" href="/r/1">Test QR</a>
        <a class="btn secondary" href="/admin">Admin</a>
        <a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a>
        <a class="btn secondary" href="/admin/assign">Assign Campaign</a>
        <a class="btn gold" href="/export/events.csv">Export CSV</a>

        <div class="note"><strong>Money View:</strong> This dashboard separates ROI by QR/location, campaign, store routing, inventory priority, and scheduled campaign placements.</div>

        <div class="cards">
          <div class="card"><div class="label">Total Scans</div><div class="num">${total.scans || 0}</div></div>
          <div class="card"><div class="label">Google Maps Clicks</div><div class="num">${total.maps_clicks || 0}</div></div>
          <div class="card"><div class="label">Offer Clicks</div><div class="num">${total.offer_clicks || 0}</div></div>
          <div class="card"><div class="label">Intent Rate</div><div class="num">${pct(totalIntentRate)}</div></div>
        </div>

        <h2>Daily Trend Activity</h2>
        <table><tr><th>Date</th><th>Scans</th><th>Intent Clicks</th></tr>${trendTable || `<tr><td colspan="3">No activity for selected range.</td></tr>`}</table>

        <h2>Active Campaign Schedules</h2>
        <table><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th><th>Status</th></tr>${activeScheduleTable || `<tr><td colspan="8">No active schedules.</td></tr>`}</table>

        <h2>ROI by QR Code / Location</h2>
        <table><tr><th>QR Code</th><th>Location</th><th>Market</th><th>Annual Impressions</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Waze</th><th>Intent Rate</th><th>Est. Customers</th><th>Est. Revenue</th><th>Placement Cost</th><th>CAC</th><th>CPM</th><th>ROI</th></tr>${qrTable}</table>

        <h2>ROI by Campaign</h2>
        <table><tr><th>Advertiser</th><th>Campaign</th><th>Type</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Waze</th><th>Intent Rate</th><th>Est. Customers</th><th>Avg Value</th><th>Est. Revenue</th><th>Campaign Cost</th><th>CAC</th><th>ROI</th></tr>${campaignTable}</table>

        <h2>Location Comparison</h2>
        <table><tr><th>Advertiser</th><th>Campaign</th><th>Location</th><th>Market</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Intent Rate</th><th>Customers</th><th>Revenue</th><th>ROI</th></tr>${locationTable}</table>

        <h2>Store Performance / Inventory Routing</h2>
        <table><tr><th>Store</th><th>Address</th><th>Advertiser</th><th>Campaign</th><th>Inventory Priority</th><th>Units</th><th>Days On Hand</th><th>Velocity</th><th>Inventory Note</th><th>Maps</th><th>Waze</th><th>Intent</th><th>Customers</th><th>Revenue</th><th>Routing Status</th></tr>${storeTable}</table>
      </div>
    `));
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).send("Dashboard error: " + err.message);
  }
});

app.get("/admin", async (req, res) => {
  const qrs = await q(`SELECT qr.*, s.name AS space_name FROM qr_codes qr LEFT JOIN spaces s ON s.id = qr.space_id ORDER BY qr.id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  const stores = await q(`SELECT * FROM stores ORDER BY inventory_priority DESC`);

  res.send(page("Vivid Admin", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Admin Control Center</h1><p class="subtitle">Manage locations, QR codes, campaigns, stores, inventory, and schedules.</p></div>
    <div class="wrap">
      <a class="btn" href="/dashboard">Dashboard</a>
      <a class="btn secondary" href="/admin/new-location">New Location</a>
      <a class="btn secondary" href="/admin/new-qr">New QR</a>
      <a class="btn secondary" href="/admin/new-campaign">New Campaign</a>
      <a class="btn secondary" href="/admin/new-store">New Store</a>
      <a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a>
      <a class="btn secondary" href="/admin/assign">Assign Campaign</a>

      <h2>QR Codes</h2>
      <table><tr><th>ID</th><th>QR</th><th>Space</th><th>Routing URL</th><th>QR Image</th></tr>
      ${qrs.rows.map(qr => `<tr><td>${qr.id}</td><td>${qr.name || ""}</td><td>${qr.space_name || ""}</td><td><a href="/r/${qr.id}" target="_blank">${BASE_URL}/r/${qr.id}</a></td><td><a href="/qr/${qr.id}.png" target="_blank">Download QR</a></td></tr>`).join("")}
      </table>

      <h2>Campaigns</h2>
      <table><tr><th>ID</th><th>Advertiser</th><th>Campaign</th><th>URL</th><th>Avg Value</th><th>Cost</th><th>Conversion</th></tr>
      ${campaigns.rows.map(c => `<tr><td>${c.id}</td><td>${c.advertiser || ""}</td><td>${c.name || ""}</td><td>${c.campaign_url || ""}</td><td>${money(c.avg_customer_value)}</td><td>${money(c.campaign_cost)}</td><td>${c.conversion_rate || 10}%</td></tr>`).join("")}
      </table>

      <h2>Stores / Inventory</h2>
      <table><tr><th>Store</th><th>Address</th><th>Priority</th><th>Units</th><th>Days</th><th>Velocity</th><th>Note</th><th>Edit</th></tr>
      ${stores.rows.map(s => `<tr><td>${s.name || ""}</td><td>${s.address || ""}</td><td>${s.inventory_priority || 0}</td><td>${s.inventory_units || 0}</td><td>${s.days_on_hand || 0}</td><td>${s.inventory_velocity || 0}</td><td>${s.inventory_note || ""}</td><td>
  <a href="/admin/edit-store/${s.id}">Edit</a>
</td></tr>`).join("")}
      </table>
    </div>
  `));
});

app.get("/admin/new-location", async (req, res) => {
  res.send(page("Add Location", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Add Location / Space</h1></div>
    <div class="wrap">
      <form method="POST" action="/admin/new-location">
        <label>Name</label><input name="name" required />
        <label>Market</label><input name="location" placeholder="Naples, FL" />
        <label>Description</label><input name="description" />
        <label>Annual Impressions</label><input name="annual_impressions" type="number" value="100000" />
        <label>Placement Cost</label><input name="placement_cost" type="number" value="800" />
        <button class="btn" type="submit">Create Location</button>
      </form>
    </div>
  `));
});

app.post("/admin/new-location", async (req, res) => {
  try {
    await q(`INSERT INTO spaces (name,location,description,annual_impressions,placement_cost) VALUES ($1,$2,$3,$4,$5)`,
      [req.body.name, req.body.location, req.body.description, Number(req.body.annual_impressions || 0), Number(req.body.placement_cost || 0)]);
    res.send("✅ Location created <br><a href='/admin/new-qr'>Add QR</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/admin/new-qr", async (req, res) => {
  const spaces = await q(`SELECT * FROM spaces ORDER BY id`);
  res.send(page("Add QR", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Add QR Code</h1></div>
    <div class="wrap">
      <form method="POST" action="/admin/new-qr">
        <label>Select Location</label>
        <select name="space_id">${spaces.rows.map(s => `<option value="${s.id}">${s.name} (${s.location})</option>`).join("")}</select>
        <label>QR Name</label><input name="name" placeholder="Car Line QR" />
        <label>Description</label><input name="description" />
        <button class="btn" type="submit">Create QR</button>
      </form>
    </div>
  `));
});

app.post("/admin/new-qr", async (req, res) => {
  try {
    await q(`INSERT INTO qr_codes (space_id,name,description) VALUES ($1,$2,$3)`,
      [Number(req.body.space_id), req.body.name, req.body.description]);
    res.send("✅ QR created <br><a href='/admin/assign'>Assign Campaign</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/admin/new-campaign", async (req, res) => {
  res.send(page("New Campaign", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Create Campaign</h1></div>
    <div class="wrap">
      <form method="POST" action="/admin/new-campaign">
        <div class="formgrid">
          <div><label>Advertiser</label><input name="advertiser" value="Pepsi" /></div>
          <div><label>Campaign Name</label><input name="name" value="Low Inventory Store Push" /></div>
          <div><label>Campaign URL</label><input name="campaign_url" value="https://www.pepsi.com" /></div>
          <div><label>Avg Customer Value</label><input name="avg_customer_value" value="35" /></div>
          <div><label>Campaign Cost</label><input name="campaign_cost" value="700" /></div>
          <div><label>Conversion Rate (%)</label><input name="conversion_rate" value="10" /></div>
        </div>
        <label><input type="checkbox" name="is_deal_of_day" style="width:auto" /> Deal of the Day</label><br><br>
        <button class="btn" type="submit">Create Campaign</button>
      </form>
    </div>
  `));
});

app.post("/admin/new-campaign", async (req, res) => {
  try {
    await q(`INSERT INTO campaigns (name,advertiser,campaign_url,avg_customer_value,campaign_cost,conversion_rate,is_deal_of_day)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.body.name || "", req.body.advertiser || "", req.body.campaign_url || "", Number(req.body.avg_customer_value || 50), Number(req.body.campaign_cost || 500), Number(req.body.conversion_rate || 10), req.body.is_deal_of_day === "on"]);
    res.send("✅ Campaign created <br><a href='/admin/assign'>Go Assign</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/admin/new-store", async (req, res) => {
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  res.send(page("New Store", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Add Store / Inventory Target</h1></div>
    <div class="wrap">
      <form method="POST" action="/admin/new-store">
        <label>Store Name</label><input name="name" required />
        <label>Address / Market</label><input name="address" placeholder="Naples FL" />
        <label>Google Maps URL</label><input name="maps_url" />
        <label>Waze URL</label><input name="waze_url" />
        <label>Inventory Priority (0-100)</label><input name="inventory_priority" type="number" value="50" />
        <label>Units On Hand</label><input name="inventory_units" type="number" value="0" />
        <label>Days On Hand</label><input name="days_on_hand" type="number" value="0" />
        <label>Velocity</label><input name="inventory_velocity" type="number" value="0" />
        <label>Inventory Note</label><input name="inventory_note" />
        <label>Attach to Campaign</label>
        <select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select>
        <button class="btn" type="submit">Create Store</button>
      </form>
    </div>
  `));
});

app.post("/admin/new-store", async (req, res) => {
  try {
    const store = await q(`INSERT INTO stores (name,address,maps_url,waze_url,inventory_priority,inventory_units,days_on_hand,inventory_velocity,inventory_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.body.name, req.body.address, req.body.maps_url, req.body.waze_url, Number(req.body.inventory_priority || 50), Number(req.body.inventory_units || 0), Number(req.body.days_on_hand || 0), Number(req.body.inventory_velocity || 0), req.body.inventory_note]);
    await q(`INSERT INTO campaign_stores (campaign_id,store_id,weight,is_active) VALUES ($1,$2,50,true)`,
      [Number(req.body.campaign_id), store.rows[0].id]);
    res.send("✅ Store created and attached <br><a href='/dashboard'>Dashboard</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/admin/edit-store/:storeId", async (req, res) => {
  const storeId = req.params.storeId;

  const store = await q(`SELECT * FROM stores WHERE id = $1`, [storeId]);
  const s = store.rows[0];

  if (!s) return res.status(404).send("Store not found");

  res.send(page("Edit Store", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit Store / Inventory</h1>
      <p class="subtitle">${s.name || ""}</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/admin">Back to Admin</a>

      <form method="POST" action="/admin/edit-store/${storeId}">
        <label>Store Name</label>
        <input name="name" value="${s.name || ""}" />

        <label>Address / Market</label>
        <input name="address" value="${s.address || ""}" />

        <label>Google Maps URL</label>
        <input name="maps_url" value="${s.maps_url || ""}" />

        <label>Waze URL</label>
        <input name="waze_url" value="${s.waze_url || ""}" />

        <label>Inventory Priority (0-100)</label>
        <input name="inventory_priority" type="number" value="${s.inventory_priority || 0}" />

        <label>Units On Hand</label>
        <input name="inventory_units" type="number" value="${s.inventory_units || 0}" />

        <label>Days On Hand</label>
        <input name="days_on_hand" type="number" value="${s.days_on_hand || 0}" />

        <label>Velocity</label>
        <input name="inventory_velocity" type="number" value="${s.inventory_velocity || 0}" />

        <label>Inventory Note</label>
        <input name="inventory_note" value="${s.inventory_note || ""}" />

        <button class="btn" type="submit">Save Store</button>
      </form>
    </div>
  `));
});
app.post("/admin/edit-store/:storeId", async (req, res) => {
  try {
    await q(`
      UPDATE stores
      SET
        name = $1,
        address = $2,
        maps_url = $3,
        waze_url = $4,
        inventory_priority = $5,
        inventory_units = $6,
        days_on_hand = $7,
        inventory_velocity = $8,
        inventory_note = $9
      WHERE id = $10
    `, [
      req.body.name,
      req.body.address,
      req.body.maps_url,
      req.body.waze_url,
      Number(req.body.inventory_priority || 0),
      Number(req.body.inventory_units || 0),
      Number(req.body.days_on_hand || 0),
      Number(req.body.inventory_velocity || 0),
      req.body.inventory_note,
      req.params.storeId
    ]);

    res.send("✅ Store updated <br><a href='/admin'>Back to Admin</a> | <a href='/dashboard'>Dashboard</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/admin/schedule", async (req, res) => {
  const qrs = await q(`SELECT * FROM qr_codes ORDER BY id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  const schedules = await q(`
    SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
    FROM campaign_schedules cs
    LEFT JOIN qr_codes qr ON qr.id = cs.qr_id
    LEFT JOIN campaigns c ON c.id = cs.campaign_id
    ORDER BY cs.qr_id, cs.day_of_week, cs.start_time
  `);

  res.send(page("Campaign Schedule", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Master QR Campaign Schedule</h1><p class="subtitle">Add multiple campaigns to one QR and rotate by day/time.</p></div>
    <div class="wrap">
      <a class="btn" href="/admin">Admin</a>
      <a class="btn secondary" href="/dashboard">Dashboard</a>

      <form method="POST" action="/admin/schedule">
        <div class="formgrid">
          <div><label>Master QR</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select></div>
          <div><label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select></div>
          <div><label>Day</label><select name="day_of_week"><option value="0">Every Day / Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></div>
          <div><label>Start Time</label><input name="start_time" value="00:00" /></div>
          <div><label>End Time</label><input name="end_time" value="23:59" /></div>
          <div><label>Priority</label><input name="priority" type="number" value="100" /></div>
        </div>
        <button class="btn" type="submit">Add Campaign to Master QR</button>
      </form>

      <h2>Current Scheduled Campaigns</h2>
      <table><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th><th>Status</th></tr>
      ${schedules.rows.map(s => `<tr><td>${s.qr_name || s.qr_id}</td><td>${s.advertiser || ""}</td><td>${s.campaign_name || ""}</td><td>${s.day_of_week}</td><td>${s.start_time}</td><td>${s.end_time}</td><td>${s.priority}</td><td>${s.is_active ? "Active" : "Inactive"}</td></tr>`).join("")}
      </table>
    </div>
  `));
});

app.post("/admin/schedule", async (req, res) => {
  try {
    await q(`INSERT INTO campaign_schedules (qr_id,campaign_id,day_of_week,start_time,end_time,priority,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [Number(req.body.qr_id), Number(req.body.campaign_id), Number(req.body.day_of_week || 0), req.body.start_time || "00:00", req.body.end_time || "23:59", Number(req.body.priority || 50)]);
    res.send("✅ Campaign scheduled <br><a href='/admin/schedule'>Back to Schedule</a> | <a href='/r/" + req.body.qr_id + "'>Test QR</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/admin/assign", async (req, res) => {
  const qrs = await q(`SELECT * FROM qr_codes ORDER BY id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);

  res.send(page("Assign Campaign", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Assign Campaign to QR</h1></div>
    <div class="wrap">
      <form method="POST" action="/admin/assign">
        <label>QR Code</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select>
        <label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select>
        <button class="btn" type="submit">Assign Campaign</button>
      </form>
    </div>
  `));
});

app.post("/admin/assign", async (req, res) => {
  try {
    await q(`UPDATE qr_campaigns SET is_active=false, ended_at=CURRENT_TIMESTAMP WHERE qr_id=$1 AND is_active=true`, [req.body.qr_id]);
    await q(`INSERT INTO qr_campaigns (qr_id,campaign_id,is_active) VALUES ($1,$2,true)`, [req.body.qr_id, req.body.campaign_id]);
    res.send("✅ Campaign assigned <br><a href='/r/" + req.body.qr_id + "'>Test QR</a> | <a href='/dashboard'>Dashboard</a>");
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/qr-admin/:qrId", async (req, res) => {
  const qrId = req.params.qrId;
  const start = req.query.start || "";
  const end = req.query.end || "";
  const hasDate = !!(start && end);

  const qr = await q(`SELECT qr.*, s.name AS space_name, s.location FROM qr_codes qr LEFT JOIN spaces s ON s.id = qr.space_id WHERE qr.id = $1`, [qrId]);

  const events = await q(`
    SELECT e.*, c.name AS campaign_name, c.advertiser
    FROM events e LEFT JOIN campaigns c ON c.id = e.campaign_id
    WHERE e.qr_id = $1 ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
    ORDER BY e.created_at DESC LIMIT 100
  `, hasDate ? [qrId, start, end] : [qrId]);

  res.send(page("QR Detail", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>${qr.rows[0]?.name || "QR Detail"}</h1><p class="subtitle">${qr.rows[0]?.space_name || ""}</p></div>
    <div class="wrap">
      <form method="GET" action="/qr-admin/${qrId}"><input type="date" name="start" value="${start}" /><input type="date" name="end" value="${end}" /><button class="btn" type="submit">Apply Date Filter</button></form>
      <a class="btn" href="/dashboard">Back</a><a class="btn secondary" href="/r/${qrId}" target="_blank">Open QR</a><a class="btn gold" href="/qr/${qrId}.png" target="_blank">Download QR</a>
      <div class="note"><strong>Live Link:</strong> ${BASE_URL}/r/${qrId}</div>
      <h2>Recent QR Activity</h2>
      <table><tr><th>Time</th><th>Type</th><th>Advertiser</th><th>Campaign</th></tr>
      ${events.rows.map(e => `<tr><td>${new Date(e.created_at).toLocaleString()}</td><td>${e.type}</td><td>${e.advertiser || ""}</td><td>${e.campaign_name || ""}</td></tr>`).join("")}
      </table>
    </div>
  `));
});

app.get("/campaign-admin/:campaignId", async (req, res) => {
  const campaignId = req.params.campaignId;
  const start = req.query.start || "";
  const end = req.query.end || "";
  const hasDate = !!(start && end);

  const campaign = await q(`SELECT * FROM campaigns WHERE id=$1`, [campaignId]);

  const events = await q(`
    SELECT e.*, qr.name AS qr_name, s.name AS location_name
    FROM events e
    LEFT JOIN qr_codes qr ON qr.id = e.qr_id
    LEFT JOIN spaces s ON s.id = qr.space_id
    WHERE e.campaign_id = $1 ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
    ORDER BY e.created_at DESC LIMIT 100
  `, hasDate ? [campaignId, start, end] : [campaignId]);

  res.send(page("Campaign Detail", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>${campaign.rows[0]?.name || "Campaign Detail"}</h1><p class="subtitle">${campaign.rows[0]?.advertiser || ""}</p></div>
    <div class="wrap">
      <form method="GET" action="/campaign-admin/${campaignId}"><input type="date" name="start" value="${start}" /><input type="date" name="end" value="${end}" /><button class="btn" type="submit">Apply Date Filter</button></form>
      <a class="btn" href="/dashboard">Back</a>
      <div class="note"><strong>Avg Customer Value:</strong> ${money(campaign.rows[0]?.avg_customer_value || 0)}<br><strong>Campaign Cost:</strong> ${money(campaign.rows[0]?.campaign_cost || 0)}<br><strong>Conversion Rate:</strong> ${campaign.rows[0]?.conversion_rate || 10}%</div>
      <h2>Recent Campaign Activity</h2>
      <table><tr><th>Time</th><th>Type</th><th>QR</th><th>Location</th></tr>
      ${events.rows.map(e => `<tr><td>${new Date(e.created_at).toLocaleString()}</td><td>${e.type}</td><td>${e.qr_name || ""}</td><td>${e.location_name || ""}</td></tr>`).join("")}
      </table>
    </div>
  `));
});

app.get("/qr/:qrId.png", (req, res) => {
  const qrId = req.params.qrId;
  const url = `${BASE_URL}/r/${qrId}`;
  res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`);
});

app.get("/export/events.csv", async (req, res) => {
  const result = await q(`
    SELECT e.id,e.created_at,e.type,e.qr_id,qr.name AS qr_name,e.campaign_id,c.name AS campaign,c.advertiser,e.store_id,st.name AS store
    FROM events e
    LEFT JOIN qr_codes qr ON qr.id=e.qr_id
    LEFT JOIN campaigns c ON c.id=e.campaign_id
    LEFT JOIN stores st ON st.id=e.store_id
    ORDER BY e.created_at DESC
  `);

  const header = "id,created_at,type,qr_id,qr_name,campaign_id,campaign,advertiser,store_id,store\n";
  const rows = result.rows.map(r =>
    [r.id,r.created_at,r.type,r.qr_id,r.qr_name,r.campaign_id,r.campaign,r.advertiser,r.store_id,r.store]
      .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=vivid-events.csv");
  res.send(header + rows);
});

app.get("/analytics", async (req, res) => {
  const result = await q(`
    SELECT COUNT(*) FILTER (WHERE type='scan') AS scans,
      COUNT(*) FILTER (WHERE type='offer') AS offer_clicks,
      COUNT(*) FILTER (WHERE type='maps') AS maps_clicks,
      COUNT(*) FILTER (WHERE type='waze') AS waze_clicks,
      COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks
    FROM events
  `);
  res.json(result.rows[0]);
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
