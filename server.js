const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const PDFDocument = require("pdfkit");
const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "https://vivid-routing-production.up.railway.app";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: "vivid-secret-key",
  resave: false,
  saveUninitialized: false
}));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function q(sql, params = []) {
  return pool.query(sql, params);
}

function money(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pct(n) {
  return Number(n || 0).toFixed(1) + "%";
}

function dayLabel(n) {
  const d = Number(n || 0);
  if (d === 0) return "Sunday";
  if (d === 1) return "Monday";
  if (d === 2) return "Tuesday";
  if (d === 3) return "Wednesday";
  if (d === 4) return "Thursday";
  if (d === 5) return "Friday";
  if (d === 6) return "Saturday";
  return String(n || "");
}
function daysActive(createdAt, endedAt = null) {
  if (!createdAt) return 0;

  const start = new Date(createdAt);
  const end = endedAt ? new Date(endedAt) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const endDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  const diffDays = Math.floor(
    (endDay - startDay) / (1000 * 60 * 60 * 24)
  );

  return Math.max(1, diffDays + 1);
}
function dayLabels(days) {
  if (!days) return "";

  const map = {
    "0": "Sun",
    "1": "Mon",
    "2": "Tue",
    "3": "Wed",
    "4": "Thu",
    "5": "Fri",
    "6": "Sat"
  };

  const arr = days.split(",");

  if (arr.length === 7) return "Everyday";

  return arr.map(d => map[d]).join(", ");
}
function page(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f4f7f1;color:#073b22}
    .topbar{background:linear-gradient(135deg,#123d25,#2f7d46);color:white;padding:30px 40px}
    .brand{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d7eadb;font-weight:bold}
    h1{margin:4px 0 6px;font-size:34px}
    h2{margin-top:34px}
    .subtitle{color:#d7eadb;margin:0}
    .wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
    .btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0;cursor:pointer}
    .btn.secondary{background:#123d25}.btn.gold{background:#9a6a00}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 30px}
.card{
  background:white;
  border-radius:18px;
  padding:18px;
  box-shadow:0 8px 22px rgba(0,0,0,.08);
  
  
  
  margin:8px 0;

}
    .label{color:#65776b;font-size:13px;margin-bottom:8px}.num{font-size:30px;font-weight:bold}
    table{width:100%;background:white;border-collapse:collapse;border-radius:18px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.08);margin-bottom:30px}
    th{background:#eaf3e8}
   th,td{
  padding:13px;
  border-bottom:1px solid #e7eee7;
  text-align:center;
  vertical-align:middle;
  font-size:14px
}
    .note{background:white;border-left:6px solid #2f7d46;padding:18px;border-radius:16px;box-shadow:0 8px 18px rgba(0,0,0,.06);margin:20px 0}
    .choice-card{max-width:620px;margin:36px auto;background:white;border-radius:24px;padding:32px;box-shadow:0 10px 28px rgba(0,0,0,.14)}
    .choice-btn{display:block;background:#2f7d46;color:white;padding:17px;margin:12px 0;text-align:center;text-decoration:none;border-radius:14px;font-weight:bold;font-size:16px}
    .choice-btn.dark{background:#123d25}
    .pill{display:inline-block;background:#eaf3e8;padding:8px 12px;border-radius:999px;font-size:13px;font-weight:bold;margin-bottom:10px}
    .deal{display:inline-block;background:#fff4d6;padding:8px 12px;border-radius:999px;color:#7a4b00;font-size:13px;font-weight:bold;margin-bottom:10px}
    .good{color:#1f7a3f;font-weight:bold}.bad{color:#b00020;font-weight:bold}.small{font-size:13px;color:#65776b}
    input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #cfdacf;margin:6px 0 14px;font-size:15px;box-sizing:border-box}
    .formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}a{color:#176b3a;font-weight:bold}
    @media(max-width:800px){.topbar,.wrap{padding:22px}.cards,.formgrid{grid-template-columns:1fr}h1{font-size:28px}}
  </style>
</head>
<body>

<div style="background:#123d25;padding:14px 24px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">

  <a href="/my-setup" style="color:white;text-decoration:none;font-weight:bold;">
  My Setup
</a>

  <a href="/reports" style="color:white;text-decoration:none;">
    Reports
  </a>

  <a href="/admin/ai-insights" style="color:white;text-decoration:none;">
    AI Insights
  </a>

 

 
  <a href="/admin/archived-campaigns" style="color:white;text-decoration:none;">
  Archive Center
<a href="/admin/reports" style="color:white;text-decoration:none;">
  Export Center
</a>
<a href="/help" style="color:white;text-decoration:none;">
  Help
</a>

</div>

${body}

</body>
</html>`;
}
function successPage(title, message, nextStep, buttons = []) {
  const buttonHtml = buttons.map((b, i) => `
    <a href="${b.href}"
       ${b.target ? `target="${b.target}"` : ""}
       class="btn ${i === 0 ? "" : "secondary"}">
      ${b.label}
    </a>
  `).join("");

  return page(title, `
    <div class="card" style="max-width:760px;margin:40px auto;padding:32px;">
      <h1 style="margin-top:0;">✅ ${title}</h1>

      <p style="font-size:17px;line-height:1.5;">
        ${message}
      </p>

      <div class="note" style="margin:24px 0;padding:18px;border-left:5px solid #2f7d46;">
        <strong>Next Recommended Step:</strong><br>
        ${nextStep}
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;">
        ${buttonHtml}
      </div>

      <hr style="border:none;border-top:1px solid #ddd;margin:30px 0 18px 0;">

      <p style="font-size:14px;color:#315b4c;margin:0;">
        Workflow: Location → QR Code → Campaign → Assign Campaign → Schedule → Analytics
      </p>
    </div>
  `);
}
app.get("/seed-admin", async (req, res) => {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'advertiser',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await q(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Vivid Admin', 'admin@vividspots.com', 'admin123', 'admin')
      ON CONFLICT (email)
      DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        name = EXCLUDED.name
    `);

    res.send("✅ Admin user reset. Go to <a href='/login'>Login</a>");
  } catch (err) {
    res.send("SEED ADMIN ERROR: " + err.message);
  }
});
function requireLogin(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}
function requireSuperAdmin(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "super_admin") {
    return res.send("Access denied");
  }

  next();
}
function requireAdmin(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "admin") {
    return res.send("Access denied");
  }

  next();
}
async function initDb() {
  await q(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'advertiser',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
  await q(`
  CREATE TABLE IF NOT EXISTS campaign_stores (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER,
    store_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
  await q(`
  CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    brand VARCHAR(255),
    name VARCHAR(255),
    address TEXT,
    inventory_status VARCHAR(50) DEFAULT 'normal',
    maps_url TEXT,
    waze_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);
await q(`
  CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    brand VARCHAR(255),
    name VARCHAR(255),
    address TEXT,
    inventory_status VARCHAR(50) DEFAULT 'normal',
    maps_url TEXT,
    waze_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS user_id INTEGER
`);
  const userCount = await q(`
  SELECT COUNT(*) FROM users
`);

if (Number(userCount.rows[0].count) === 0) {
await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS user_id INTEGER
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS brand VARCHAR(255)
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS name VARCHAR(255)
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS address TEXT
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS inventory_status VARCHAR(50) DEFAULT 'normal'
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS maps_url TEXT
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS waze_url TEXT
`);
  await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false
`);

  await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
`);
await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
`);

await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS archive_reason TEXT
`);
  await q(`
    INSERT INTO users (
      name,
      email,
      password,
      role
    )
    VALUES (
      'Vivid Admin',
      'admin@vividspots.com',
      'admin123',
      'admin'
    )
  `);

}
  await q(`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

await q(`CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  name TEXT,
  location TEXT,
  annual_impressions NUMERIC DEFAULT 146000,
  placement_cost NUMERIC DEFAULT 800,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);
await q(`
  ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false
`);
  await q(`
  UPDATE spaces
  SET annual_impressions = 146000
  WHERE annual_impressions IS NULL OR annual_impressions = 0
`);

await q(`
  UPDATE spaces
  SET placement_cost = 800
  WHERE placement_cost IS NULL OR placement_cost = 0
`);
  await q(`CREATE TABLE IF NOT EXISTS qr_codes (
    id SERIAL PRIMARY KEY,
    space_id INT,
    name TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
await q(`
  ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false
`);
  await q(`
  ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS annual_cost NUMERIC DEFAULT 800
`);
  await q(`
  ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS annual_impressions NUMERIC DEFAULT 146000
`);
  await q(`
  UPDATE qr_codes qr
  SET annual_cost = COALESCE(s.placement_cost, 800)
  FROM spaces s
  WHERE s.id = qr.space_id
  AND (qr.annual_cost IS NULL OR qr.annual_cost = 0)
`);
  await q(`
  UPDATE qr_codes qr
  SET annual_impressions = COALESCE(s.annual_impressions, 146000)
  FROM spaces s
  WHERE s.id = qr.space_id
  AND (qr.annual_impressions IS NULL OR qr.annual_impressions = 0)
`);
  await q(`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT,
    advertiser TEXT,
    campaign_url TEXT,
    avg_customer_value INT DEFAULT 50,
    campaign_cost INT DEFAULT 0,
    conversion_rate INT DEFAULT 10,
    is_deal_of_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
`);
  await q(`
  UPDATE campaigns
  SET created_at = CURRENT_TIMESTAMP
  WHERE created_at IS NULL
`);
  await q(`CREATE TABLE IF NOT EXISTS qr_campaigns (
    id SERIAL PRIMARY KEY,
    qr_id INT,
    campaign_id INT,
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
  )`);

  await q(`CREATE TABLE IF NOT EXISTS campaign_schedules (
    id SERIAL PRIMARY KEY,
    qr_id INT,
    days_of_week TEXT,
    campaign_id INT,
    day_of_week INT DEFAULT 0,
    start_time TEXT DEFAULT '00:00',
    end_time TEXT DEFAULT '23:59',
    priority INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
await q(`
  ALTER TABLE campaign_schedules
  ADD COLUMN IF NOT EXISTS days_of_week TEXT
`);
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
await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS user_id INTEGER
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS brand VARCHAR(255)
`);

await q(`
  ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS inventory_status VARCHAR(50) DEFAULT 'normal'
`);


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
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS avg_customer_value INT DEFAULT 50`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_cost INT DEFAULT 0`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversion_rate INT DEFAULT 10`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
await q(`UPDATE qr_campaigns SET assigned_at = CURRENT_TIMESTAMP WHERE assigned_at IS NULL`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_priority INT DEFAULT 50`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_units INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS days_on_hand INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_velocity INT DEFAULT 0`);
  await q(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_note TEXT`);
  await q(`ALTER TABLE events ADD COLUMN IF NOT EXISTS store_id INT`);
  await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false
`);
await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS user_id INT
`);
  await q(`
  ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS user_id INT
  `);
  await q(`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0
`);

  const customers = await q(`SELECT COUNT(*) FROM customers`);
  if (Number(customers.rows[0].count) === 0) await q(`INSERT INTO customers (name,email) VALUES ('Demo Brand / Vendor','demo@vividspots.com')`);

  const spaces = await q(`SELECT COUNT(*) FROM spaces`);
  if (Number(spaces.rows[0].count) === 0) {
    await q(`INSERT INTO spaces (customer_id,name,description,location,host_name,annual_impressions,placement_cost,host_payout)
      VALUES (1,'School 1 Car Line','High-traffic parent pickup placement','Naples, FL','Demo School',146000,800,300)`);
  }

  const qrs = await q(`SELECT COUNT(*) FROM qr_codes`);
  if (Number(qrs.rows[0].count) === 0) await q(`INSERT INTO qr_codes (space_id,name,description) VALUES (1,'QR 1 - Car Line','Primary QR for car line placement')`);

  const campaigns = await q(`SELECT COUNT(*) FROM campaigns`);
  if (Number(campaigns.rows[0].count) === 0) {
    await q(`INSERT INTO campaigns (name,advertiser,campaign_url,avg_customer_value,campaign_cost,conversion_rate,is_deal_of_day)
      VALUES ('Morning Coffee Offer','Dunkin','https://www.dunkindonuts.com',50,0,10,true),
             ('Low Inventory Store Push','Pepsi','https://www.pepsi.com',35,0,15,false)`);
  }

  const stores = await q(`SELECT COUNT(*) FROM stores`);
  if (Number(stores.rows[0].count) === 0) {
    await q(`INSERT INTO stores (name,address,maps_url,waze_url,inventory_priority,inventory_units,days_on_hand,inventory_velocity,inventory_note)
      VALUES ('Dunkin Naples','Naples FL','https://www.google.com/maps/search/?api=1&query=Dunkin+Naples+FL','https://waze.com/ul?q=Dunkin%20Naples%20FL&navigate=yes',70,120,12,10,'Normal inventory'),
             ('Store A - Low Churn','Naples FL','https://www.google.com/maps/search/?api=1&query=Pepsi+Naples+FL','https://waze.com/ul?q=Pepsi%20Naples%20FL&navigate=yes',90,500,45,3,'Needs traffic push')`);
  }

  const assignments = await q(`SELECT COUNT(*) FROM qr_campaigns`);
  if (Number(assignments.rows[0].count) === 0) await q(`INSERT INTO qr_campaigns (qr_id,campaign_id,is_active) VALUES (1,1,true)`);

  const campaignStores = await q(`SELECT COUNT(*) FROM campaign_stores`);
  if (Number(campaignStores.rows[0].count) === 0) await q(`INSERT INTO campaign_stores (campaign_id,store_id,weight,is_active) VALUES (1,1,70,true),(2,2,90,true)`);
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function allocatedSpotCostForCampaign(campaignId, start = "", end = "") {
  const hasDate = Boolean(start && end);
  const rangeStart = hasDate ? new Date(start) : null;
  const rangeEnd = hasDate ? new Date(end + "T23:59:59") : new Date();

  const assignments = await q(`
  SELECT
    qr.annual_cost AS placement_cost,
    COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP) AS started_at,
    qc.ended_at
  FROM qr_campaigns qc
  JOIN qr_codes qr ON qr.id = qc.qr_id
  JOIN spaces s ON s.id = qr.space_id
  WHERE qc.campaign_id = $1
`, [campaignId]);
  
  const schedules = await q(`
    SELECT qr.annual_cost AS placement_cost, cs.created_at AS started_at
    FROM campaign_schedules cs
    JOIN qr_codes qr ON qr.id = cs.qr_id
    JOIN spaces s ON s.id = qr.space_id
    WHERE cs.campaign_id = $1 AND cs.is_active = true
  `, [campaignId]);

  let total = 0;

  for (const a of assignments.rows) {
    let sDate = new Date(a.started_at || new Date());
    let eDate = a.ended_at ? new Date(a.ended_at) : new Date();
    if (hasDate) {
      if (sDate < rangeStart) sDate = rangeStart;
      if (eDate > rangeEnd) eDate = rangeEnd;
    }
    if (eDate >= sDate) total += (Number(a.placement_cost || 0) / 365) * Math.max(1, daysBetween(sDate, eDate));
  }

  for (const a of schedules.rows) {
    let sDate = new Date(a.started_at || new Date());
    let eDate = new Date();
    if (hasDate) {
      if (sDate < rangeStart) sDate = rangeStart;
      if (eDate > rangeEnd) eDate = rangeEnd;
    }
    if (eDate >= sDate) total += (Number(a.placement_cost || 0) / 365) * Math.max(1, daysBetween(sDate, eDate));
  }

  return total;
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
    const metrics = await q(`SELECT COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent FROM events WHERE store_id = $1 AND campaign_id = $2`, [s.id, campaign.id]);
    const intent = Number(metrics.rows[0].intent || 0);
    const customers = Math.round(intent * (Number(campaign.conversion_rate || 10) / 100));
    const revenue = customers * Number(campaign.avg_customer_value || 50);
    const score = revenue + Number(s.inventory_priority || 0) * 10 + Number(s.weight || 0) * 5;
    if (!bestStore || score > bestStore.score) bestStore = { store: s, score };
  }
  return bestStore ? bestStore.store : null;
}

async function saveEvent({ qrId, campaignId, storeId = null, type }) {
  await q(`INSERT INTO events (qr_id,campaign_id,store_id,type) VALUES ($1,$2,$3,$4)`, [qrId, campaignId, storeId, type]);
}

app.get("/", (req, res) => {
  res.send(page("Vivid Platform", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Smart QR Routing Platform</h1><p class="subtitle">Campaign switching, ROI tracking, store routing, schedules, and inventory-aware demand activation.</p></div>
    <div class="wrap"><a class="btn" href="/dashboard">Dashboard</a><a class="btn secondary" href="/admin">Admin</a><a class="btn gold" href="/r/1">Test QR</a></div>
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
  const importedQr = await q(`
  SELECT *
  FROM qr_codes
  WHERE id = $1
  AND description IS NOT NULL
  AND description LIKE 'http%'
`, [qrId]);

if (importedQr.rows[0]) {
  await saveEvent({
    qrId,
    campaignId: null,
    type: "scan"
  });

  return res.redirect(importedQr.rows[0].description);
}
  const campaign = await activeCampaignForQr(qrId);
  if (!campaign) return res.status(404).send("No active campaign assigned to this QR.");
  await saveEvent({ qrId, campaignId: campaign.id, type: "scan" });
try {
  const routedStore = await q(`
    SELECT s.*
    FROM campaign_stores cs
    JOIN stores s
      ON s.id = cs.store_id
    WHERE cs.campaign_id = $1
      AND s.maps_url IS NOT NULL
      AND s.maps_url <> ''
    ORDER BY
      CASE
        WHEN s.inventory_status = 'high' THEN 1
        WHEN s.inventory_status = 'normal' THEN 2
        WHEN s.inventory_status = 'low' THEN 3
        ELSE 4
      END,
      s.id ASC
    LIMIT 1
  `, [campaign.campaign_id || campaign.id]);

  if (routedStore.rows[0]) {
    await saveEvent({
      qrId,
      campaignId: campaign.campaign_id || campaign.id,
      type: "maps"
    });

    return res.redirect(routedStore.rows[0].maps_url);
  }

} catch (err) {
  return res.send("STORE ROUTING ERROR: " + err.message);
}
  res.send(page("Vivid QR Experience", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>${campaign.advertiser || "Campaign"}</h1><p class="subtitle">${campaign.name || ""}</p></div>
    <div class="wrap"><div class="choice-card">
      ${campaign.is_deal_of_day ? `<span class="deal">🔥 Deal of the Day</span>` : `<span class="pill">Smart Campaign</span>`}
      <h1>${campaign.name || "Campaign"}</h1>
      <p><b>QR:</b> ${campaign.qr_name || qrId}<br><b>Location:</b> ${campaign.space_name || ""}</p>
      <a class="choice-btn" href="/click/offer/${qrId}">View Offer</a>
      <a class="choice-btn dark" href="/click/maps/${qrId}">Find Store on Google Maps</a>
      <a class="choice-btn dark" href="/click/waze/${qrId}">Open in Waze</a>
      <p class="small">Vivid routes traffic based on campaign, performance, schedule, and inventory priority.</p>
    </div></div>
  `));
});

app.get("/click/:type/:qrId", async (req, res) => {
  const qrId = Number(req.params.qrId);
  const type = req.params.type;
  const campaign = await activeCampaignForQr(qrId);
  if (!campaign) return res.status(404).send("No active campaign.");
  let store = null;
  if (type === "maps" || type === "waze") store = await pickBestStoreForCampaign(campaign);

console.log("CLICK EVENT:", { 
  type, 
  qrId, 
  campaignId: campaign.id, 
  storeId: store ? store.id : null 
});

await saveEvent({ qrId, campaignId: campaign.id, storeId: store ? store.id : null, type });
  if (type === "offer") return res.redirect(campaign.campaign_url || "/");
if (type === "maps") {
  const searchTerm = campaign.advertiser || campaign.name || "store";

  return res.redirect(
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(searchTerm + " near me")
  );
}
  if (type === "waze") {
    const fallback = "https://waze.com/ul?q=" + encodeURIComponent((campaign.advertiser || campaign.name || "store") + " Naples FL") + "&navigate=yes";
    return res.redirect(store?.waze_url || fallback);
  }
  res.redirect("/");
});
app.get("/reset-admin", async (req, res) => {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await q(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'super_admin'
    `);

    await q(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password TEXT
    `);

    await q(`
      INSERT INTO users (email, password, role)
      VALUES ('admin@vividspots.com', 'admin123', 'super_admin')
      ON CONFLICT (email)
      DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role
    `);

    res.send("Admin reset complete. Go to <a href='/login'>login</a>.");
  } catch (err) {
    res.send("RESET ADMIN ERROR: " + err.message);
  }
});
app.get("/logout", (req, res) => {

  req.session.destroy(() => {
    res.redirect("/login");
  });

});
app.get("/help", requireLogin, async (req, res) => {

  res.send(page("Help", `
    <div class="card">

      <h1>Vivid Help Center</h1>

      <h2>My Setup</h2>
      <p>
        Create and manage Locations, QR Codes, Campaigns, and Schedules.
      </p>

      <h2>
  <a href="/admin/new-location" style="text-decoration:none;color:inherit;">
    Locations →
  </a>
</h2>
      <ul>
        <li>Create advertising locations.</li>
        <li>Set annual impressions and placement cost.</li>
        <li>Archive locations when no longer active.</li>
      </ul>

      <h2>
  <a href="/admin/new-qr" style="text-decoration:none;color:inherit;">
    QR Codes →
  </a>
</h2>
      <ul>
        <li>Create tracking QR Codes.</li>
        <li>Import existing destination URLs.</li>
        <li>Assign campaigns through Scheduling.</li>
      </ul>

      <h2>
  <a href="/admin/new-campaign" style="text-decoration:none;color:inherit;">
    Campaigns →
  </a>
</h2>
      <ul>
        <li>Create advertiser campaigns.</li>
        <li>Track performance and ROI.</li>
        <li>Archive campaigns when complete.</li>
      </ul>

      <h2>
  <a href="/admin/schedule" style="text-decoration:none;color:inherit;">
    Scheduling →
  </a>
</h2>
      <ul>
        <li>Assign campaigns to QR Codes.</li>
        <li>Control active days and times.</li>
        <li>Rotate multiple campaigns.</li>
      </ul>

      <h2>
  <a href="/admin/reports" style="text-decoration:none;color:inherit;">
    Reports →
  </a>
</h2>
      <ul>
        <li>View scans, impressions, engagement, and ROI.</li>
        <li>Compare campaigns and locations.</li>
        <li>Export reporting data.</li>
      </ul>

      <h2>
  <a href="/admin/archived-campaigns" style="text-decoration:none;color:inherit;">
    Archive Center →
  </a>
</h2>
      <ul>
        <li>Restore archived Locations.</li>
        <li>Restore archived QR Codes.</li>
        <li>Restore archived Campaigns.</li>
        <li>Restore archived Schedules.</li>
      </ul>

    </div>
  `));

});
app.get("/login", (req, res) => {

  res.send(page("Login", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Login</h1>
      <p class="subtitle">
        Access your Vivid platform
      </p>
    </div>

    <div class="wrap">

      <form method="POST" action="/login">

        <label>Email</label>
        <input
          name="email"
          type="email"
          required
        />

        <label>Password</label>
        <input
          name="password"
          type="password"
          required
        />

        <button class="btn" type="submit">
          Login
        </button>

      </form>

    </div>
  `));

});
app.post("/login", async (req, res) => {

  try {

    const user = await q(`
      SELECT *
      FROM users
      WHERE email = $1
      AND password = $2
      LIMIT 1
    `, [
      req.body.email,
      req.body.password
    ]);

    if (!user.rows[0]) {

      return res.send(`
        Invalid login
        <br><br>
        <a href="/login">Try Again</a>
      `);

    }

    req.session.user = {
  id: user.rows[0].id,
  name: user.rows[0].name,
  email: user.rows[0].email,
  role: user.rows[0].role,
  customer_id: user.rows[0].customer_id
};

    res.redirect("/my-setup");

  } catch (err) {

    res.send("LOGIN ERROR: " + err.message);

  }

});
app.get("/dashboard", requireLogin, async (req, res) => {
 if (req.session.user && req.session.user.role !== "super_admin") {
  return res.redirect("/my-setup");
}
  const currentUser = req.session.user;
const isSuperAdmin = currentUser.role === "super_admin";
  try {
   const currentUser = req.session.user;
    console.log("CURRENT USER:", currentUser);
const isSuperAdmin = currentUser.role === "super_admin"; 
    const userFilterSql = isSuperAdmin ? "" : "AND c.user_id = $1";
const userParams = isSuperAdmin ? [] : [currentUser.id];
    const start = req.query.start || "";
    const end = req.query.end || "";
    const hasDate = Boolean(start && end);
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
  JOIN campaigns c ON c.id = e.campaign_id
  WHERE 1=1
  ${userFilterSql}
`, userParams);

const trendResult = await q(`
  SELECT DATE(e.created_at) AS day,
    COUNT(*) FILTER (WHERE e.type='scan') AS scans,
    COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
  FROM events e
  JOIN campaigns c ON c.id = e.campaign_id
  WHERE 1=1 ${userFilterSql} ${dateSql}
  GROUP BY DATE(e.created_at)
  ORDER BY day DESC
  LIMIT 14
`, [...userParams, ...dateParams]);

const qrRows = await q(
  isSuperAdmin
    ? `
      SELECT DISTINCT
        qr.id AS qr_id,
        qr.name AS qr_name,
        qr.created_at,
        s.name AS space_name,
        s.location,
      qr.annual_impressions,
qr.annual_cost AS placement_cost
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      ORDER BY qr.id
    `
    : `
      SELECT DISTINCT
        qr.id AS qr_id,
        qr.name AS qr_name,
        qr.created_at,
        s.name AS space_name,
        s.location,
     qr.annual_impressions,
qr.annual_cost AS placement_cost
      FROM qr_codes qr
      JOIN qr_campaigns qc ON qc.qr_id = qr.id
      JOIN campaigns c ON c.id = qc.campaign_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE c.user_id = $1
      ORDER BY qr.id
    `,
  isSuperAdmin ? [] : [currentUser.id]
);

const campaignRows = await q(
  isSuperAdmin
 ? `SELECT * FROM campaigns WHERE COALESCE(is_archived,false) = false ORDER BY id`
: `SELECT * FROM campaigns WHERE COALESCE(is_archived,false) = false AND user_id = $1 ORDER BY id`,
  isSuperAdmin ? [] : [currentUser.id]
);

const locationRows = await q(
  isSuperAdmin
    ? `
      SELECT c.id AS campaign_id, c.name AS campaign_name, c.advertiser,
        s.id AS space_id, s.name AS location_name, s.location, qr.annual_cost AS placement_cost,
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
      GROUP BY
  c.id,
  c.name,
  c.advertiser,
  c.avg_customer_value,
  c.conversion_rate,
  s.id,
  s.name,
  s.location,
  qr.annual_cost
      ORDER BY intent_clicks DESC, scans DESC
    `
    : `
      SELECT c.id AS campaign_id, c.name AS campaign_name, c.advertiser,
        s.id AS space_id, s.name AS location_name, s.location, qr.annual_cost AS placement_cost,
        c.avg_customer_value, c.conversion_rate,
        COUNT(*) FILTER (WHERE e.type='scan') AS scans,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM events e
      JOIN campaigns c ON c.id = e.campaign_id
      JOIN qr_codes qr ON qr.id = e.qr_id
      JOIN spaces s ON s.id = qr.space_id
      WHERE c.user_id = $1 ${dateSql}
      GROUP BY c.id, s.id
      ORDER BY intent_clicks DESC, scans DESC
    `,
  isSuperAdmin
    ? dateParams
    : [currentUser.id, ...dateParams]
);

    const storeRows = await q(
  isSuperAdmin
    ? `
      SELECT
        st.id AS store_id,
        st.name AS store_name,
        st.address,
        st.inventory_priority,
        st.inventory_units,
        st.days_on_hand,
        st.inventory_velocity,
        st.inventory_note,
        c.name AS campaign_name,
        c.advertiser,
        c.avg_customer_value,
        c.conversion_rate,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM stores st
      LEFT JOIN events e
        ON e.store_id = st.id
        ${hasDate ? "AND e.created_at BETWEEN $1::date AND ($2::date + interval '1 day')" : ""}
      LEFT JOIN campaigns c
        ON c.id = e.campaign_id
      GROUP BY st.id, c.id
      ORDER BY intent_clicks DESC, st.inventory_priority DESC
    `
    : `
      SELECT
        st.id AS store_id,
        st.name AS store_name,
        st.address,
        st.inventory_priority,
        st.inventory_units,
        st.days_on_hand,
        st.inventory_velocity,
        st.inventory_note,
        c.name AS campaign_name,
        c.advertiser,
        c.avg_customer_value,
        c.conversion_rate,
        COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM stores st
      LEFT JOIN events e
        ON e.store_id = st.id
        ${hasDate ? "AND e.created_at BETWEEN $1::date AND ($2::date + interval '1 day')" : ""}
      LEFT JOIN campaigns c
        ON c.id = e.campaign_id
      WHERE st.user_id = ${hasDate ? "$3" : "$1"}
      GROUP BY st.id, c.id
      ORDER BY intent_clicks DESC, st.inventory_priority DESC
    `,
  isSuperAdmin
    ? dateParams
    : hasDate
      ? [...dateParams, currentUser.id]
      : [currentUser.id]
);

const myAssignments = await q(
  isSuperAdmin
    ? `
      SELECT qc.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM qr_campaigns qc
      JOIN qr_codes qr ON qr.id = qc.qr_id
      JOIN campaigns c ON c.id = qc.campaign_id
      ORDER BY qc.id DESC
    `
    : `
      SELECT qc.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM qr_campaigns qc
      JOIN qr_codes qr ON qr.id = qc.qr_id
      JOIN campaigns c ON c.id = qc.campaign_id
      WHERE c.user_id = $1
      ORDER BY qc.id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);


    const total = totalResult.rows[0];
    const totalScans = Number(total.scans || 0);
    const totalIntent = Number(total.intent_clicks || 0);
    const totalIntentRate = totalScans ? (totalIntent / totalScans) * 100 : 0;

    let trendTable = "";
    for (const r of trendResult.rows) trendTable += `<tr><td>${new Date(r.day).toLocaleDateString()}</td><td>${r.scans || 0}</td><td>${r.intent_clicks || 0}</td></tr>`;

    let topCampaign = null;
    let bestLocation = null;
let bestQr = null;
    let qrTable = "";
    for (const qr of qrRows.rows) {
      const m = await q(`
        SELECT COUNT(*) FILTER (WHERE e.type='scan') AS scans,
          COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
        FROM events e WHERE e.qr_id = $1 ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
      `, hasDate ? [qr.qr_id, start, end] : [qr.qr_id]);
      const row = m.rows[0];
      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const customers = Math.round(intent * 0.10);
      const revenue = customers * 50;
      const liveDays = daysBetween(qr.created_at, new Date());
const cost =
  (Number(qr.placement_cost || 800) / 365) *
  liveDays;
      const cac = customers ? cost / customers : 0;
      const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
      if (!bestQr || roi > bestQr.roi) {
  bestQr = {
    name: qr.qr_name || "QR " + qr.qr_id,
    roi: roi,
    revenue: revenue,
    scans: scans
  };
}
      const cpm = qr.annual_impressions ? (cost / Number(qr.annual_impressions)) * 1000 : 0;
      const intentRate = scans ? (intent / scans) * 100 : 0;
      qrTable += `<tr><td><a href="/qr-admin/${qr.qr_id}">${qr.qr_name || "QR " + qr.qr_id}</a></td><td>${qr.space_name || ""}</td><td>${qr.location || ""}</td><td>${Number(qr.annual_impressions || 0).toLocaleString()}</td><td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${row.waze_clicks || 0}</td><td>${pct(intentRate)}</td><td>${customers}</td><td>${money(revenue)}</td><td>${money(cost)}</td><td>${money(cac)}</td><td>$${cpm.toFixed(2)}</td><td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td></tr>`;
    }

    let campaignTable = "";
    for (const c of campaignRows.rows) {
      const m = await q(`
        SELECT COUNT(*) FILTER (WHERE e.type='scan') AS scans,
          COUNT(*) FILTER (WHERE e.type='offer') AS offer_clicks,
          COUNT(*) FILTER (WHERE e.type='maps') AS maps_clicks,
          COUNT(*) FILTER (WHERE e.type='waze') AS waze_clicks,
          COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
        FROM events e WHERE e.campaign_id = $1 ${hasDate ? "AND e.created_at BETWEEN $2::date AND ($3::date + interval '1 day')" : ""}
      `, hasDate ? [c.id, start, end] : [c.id]);
      const row = m.rows[0];
      const scans = Number(row.scans || 0);
      const intent = Number(row.intent_clicks || 0);
      const conversionRate = Number(c.conversion_rate || 10);
      const customers = Math.round(intent * (conversionRate / 100));
      const avgValue = Number(c.avg_customer_value || 50);
      const revenue = customers * avgValue;
      const cost = await allocatedSpotCostForCampaign(c.id, start, end);
      const cac = customers ? cost / customers : 0;
      const roi = cost ? ((revenue - cost) / cost) * 100 : 0;
      const intentRate = scans ? (intent / scans) * 100 : 0;
      if (!topCampaign || revenue > topCampaign.revenue) topCampaign = { name: c.name || "Campaign " + c.id, advertiser: c.advertiser || "", revenue, roi };
      campaignTable += `<tr><td>${c.advertiser || ""} (user ${c.user_id})</td><td><a href="/admin/edit-campaign/${c.id}">${c.name || ""}</a></td><td>${c.is_deal_of_day ? "🔥 Deal" : "Standard"}</td><td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${row.waze_clicks || 0}</td><td>${pct(intentRate)}</td><td>${customers}</td><td>${money(avgValue)}</td><td>${money(revenue)}</td><td>${money(cost)}</td><td>${money(cac)}</td><td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td></tr>`;
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
     
      if (!bestLocation || revenue > bestLocation.revenue) bestLocation = { name: row.location_name || row.location || "Location", revenue, roi };
      locationTable += `<tr><td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td><td>${row.location_name || ""}</td><td>${row.location || ""}</td><td>${scans}</td><td>${row.maps_clicks || 0}</td><td>${row.offer_clicks || 0}</td><td>${pct(intentRate)}</td><td>${customers}</td><td>${money(revenue)}</td><td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td></tr>`;
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
      storeTable += `<tr><td>${row.store_name || ""}</td><td>${row.address || ""}</td><td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td><td>${priority}</td><td>${row.inventory_units || 0}</td><td>${row.days_on_hand || 0}</td><td>${row.inventory_velocity || 0}</td><td>${row.inventory_note || ""}</td><td>${row.maps_clicks || 0}</td><td>${row.waze_clicks || 0}</td><td>${intent}</td><td>${customers}</td><td>${money(revenue)}</td><td>${status}</td></tr>`;
    }
let activeScheduleTable = "";
    

    res.send(page("Vivid ROI Dashboard", `
      <div class="topbar"><div class="brand">Vivid Spots</div><h1>
  ${isSuperAdmin ? "Super Admin Dashboard" : "Customer Dashboard"}
</h1>

<p style="color:white; font-weight:bold;">
  Logged in as:
  ${currentUser.email}
  |
  Role:
  ${currentUser.role}
</p><p class="subtitle">QR ROI + Campaign ROI + Store Intent + Inventory Routing + Scheduled Campaigns</p></div>
      <div class="wrap">
        <form method="GET" action="/dashboard" style="margin-bottom:20px;"><label>Start Date</label><input type="date" name="start" value="${start}" /><label>End Date</label><input type="date" name="end" value="${end}" /><button class="btn" type="submit">Apply Date Filter</button></form>
        <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;"><div class="card" style="width:220px;"><h3>🏆 Top Campaign</h3><div>${topCampaign?.name || "-"}</div><div class="small">${topCampaign?.advertiser || ""}</div><div>Revenue: ${money(topCampaign?.revenue || 0)}</div><div>ROI: ${pct(topCampaign?.roi || 0)}</div></div><div class="card" style="width:220px;">
  <h3>Best QR Code</h3>
  <div>${bestQr?.name || "-"}</div>
  <div>ROI: ${pct(bestQr?.roi || 0)}</div>
  <div>Revenue: ${money(bestQr?.revenue || 0)}</div>
  <div>Scans: ${bestQr?.scans || 0}</div>
</div><div class="card" style="width:220px;"><h3>📍 Best Location</h3><div>${bestLocation?.name || "-"}</div><div>Revenue: ${money(bestLocation?.revenue || 0)}</div><div>ROI: ${pct(bestLocation?.roi || 0)}</div></div></div>
        <a class="btn" href="/r/1">Test QR</a>
        <a class="btn gold" href="/my-setup">My Setup</a>
        <a class="btn gold" href="/reports">Reports</a>
<a class="btn" href="/admin/new-campaign">New Campaign</a>
<a class="btn" href="/admin/new-location">New Location</a>
<a class="btn" href="/admin/new-qr">New QR Code</a>
<a class="btn secondary" href="/admin/import-qr">Import Existing QR</a>
${isSuperAdmin ? `
  <a class="btn secondary" href="/admin">Admin</a>
  <a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a>
  <a class="btn secondary" href="/admin/assign">Assign Campaign</a>
  
  <a class="btn gold" href="/export/events.csv">Export CSV</a>
` : ""}
   <a class="btn secondary" href="#" onclick="const p=document.getElementById('helpPanel'); if(p){p.style.display=p.style.display==='none'?'block':'none';} return false;">Help</a>
       <div id="helpPanel" style="display:none;margin-bottom:20px;">
  <div class="note">
    <h3>Quick Start Guide</h3>

    <ol>
      <li>Create Locations</li>
      <li>Create QR Codes</li>
      <li>Create Campaigns</li>
      <li>Assign Campaigns to QR Codes</li>
      <li>Schedule Campaigns (optional)</li>
      <li>Run Reports and AI Insights</li>
    </ol>

    <p>
      <strong>Estimated Revenue Formula:</strong><br>
      Offer Clicks × Conversion Rate × Average Customer Value
    </p>
  </div>
</div> <div class="note"><strong>Money View:</strong> Campaign ROI now uses allocated spot cost: annual placement cost / 365 × active days.</div>
        <div class="cards"><div class="card"><div class="label">Total Scans</div><div class="num">${total.scans || 0}</div></div><div class="card"><div class="label">Google Maps Clicks</div><div class="num">${total.maps_clicks || 0}</div></div><div class="card"><div class="label">Offer Clicks</div><div class="num">${total.offer_clicks || 0}</div></div><div class="card"><div class="label">Intent Rate</div><div class="num">${pct(totalIntentRate)}</div></div></div>
        <h2>Daily Trend Activity</h2><table><tr><th>Date</th><th>Scans</th><th>Intent Clicks</th></tr>${trendTable || `<tr><td colspan="3">No activity for selected range.</td></tr>`}</table>
        <h2>Active Campaign Schedules</h2><table><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th><th>Status</th><th>Action</th></tr>${activeScheduleTable || `<tr><td colspan="8">No active schedules.</td></tr>`}</table>
        <h2>ROI by QR Code / Location</h2><table><tr><th>QR Code</th><th>Location</th><th>Market</th><th>Annual Impressions</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Waze</th><th>Intent Rate</th><th>Est. Customers</th><th>Est. Revenue</th><th>Placement Cost</th><th>CAC</th><th>CPM</th><th>ROI</th></tr>${qrTable}</table>
        <h2>ROI by Campaign</h2><table><tr><th>Advertiser</th><th>Campaign</th><th>Type</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Waze</th><th>Intent Rate</th><th>Est. Customers</th><th>Avg Value</th><th>Est. Revenue</th><th>Allocated Spot Cost</th><th>CAC</th><th>ROI</th></tr>${campaignTable}</table>
        <h2>Location Comparison</h2><table><tr><th>Advertiser</th><th>Campaign</th><th>Location</th><th>Market</th><th>Scans</th><th>Maps</th><th>Offers</th><th>Intent Rate</th><th>Customers</th><th>Revenue</th><th>ROI</th></tr>${locationTable}</table>
        <h2>Store Performance / Inventory Routing</h2><table><tr><th>Store</th><th>Address</th><th>Advertiser</th><th>Campaign</th><th>Inventory Priority</th><th>Units</th><th>Days On Hand</th><th>Velocity</th><th>Inventory Note</th><th>Maps</th><th>Waze</th><th>Intent</th><th>Customers</th><th>Revenue</th><th>Routing Status</th></tr>${storeTable}</table>
      </div>
    `));
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).send("Dashboard error: " + err.message);
  }
});
app.get("/my-setup", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

const locations = await q(
  isSuperAdmin
    ? `
      SELECT *
      FROM spaces
      WHERE COALESCE(is_archived,false) = false
      ORDER BY id DESC
    `
    : `
      SELECT *
      FROM spaces
      WHERE user_id = $1
      AND COALESCE(is_archived,false) = false
      ORDER BY id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);

    const qrs = await q(
      isSuperAdmin
        ? `
          SELECT qr.*, s.name AS location_name, s.location AS location
        FROM qr_codes qr
LEFT JOIN spaces s ON s.id = qr.space_id
WHERE COALESCE(qr.is_archived,false) = false
ORDER BY qr.id DESC
        `
        : `
          SELECT qr.*, s.name AS location_name, s.location AS location
          FROM qr_codes qr
JOIN spaces s ON s.id = qr.space_id
WHERE s.user_id = $1
AND COALESCE(qr.is_archived,false) = false
ORDER BY qr.id DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );
const relationships = await q(`
  SELECT DISTINCT
    s.id AS location_id,
    qr.id AS qr_id,
    c.id AS campaign_id,
    COALESCE(qc.started_at, qc.assigned_at, c.created_at) AS created_at
  FROM spaces s
  LEFT JOIN qr_codes qr
    ON qr.space_id = s.id

  LEFT JOIN qr_campaigns qc
    ON qc.qr_id = qr.id
    AND COALESCE(qc.is_active, true) = true

  LEFT JOIN campaign_schedules cs
    ON cs.qr_id = qr.id

  LEFT JOIN campaigns c
    ON c.id = COALESCE(qc.campaign_id, cs.campaign_id)

  WHERE s.user_id = $1
    AND COALESCE(s.is_archived,false) = false
`, [currentUser.id]);
    const campaigns = await q(
      isSuperAdmin
        ? `
          SELECT *
          FROM campaigns
          WHERE is_archived = false
          ORDER BY id DESC
        `
        : `
          SELECT *
          FROM campaigns
          WHERE is_archived = false
          AND user_id = $1
          ORDER BY id DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );
const archivedCampaigns = await q(
  isSuperAdmin
    ? `
      SELECT *
      FROM campaigns
      WHERE COALESCE(is_archived,false) = true
      ORDER BY id DESC
    `
    : `
      SELECT *
      FROM campaigns
      WHERE COALESCE(is_archived,false) = true
      AND user_id = $1
      ORDER BY id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);
    const assignments = await q(
      isSuperAdmin
        ? `
  SELECT
  qc.*,
  qr.name AS qr_name,
  c.name AS campaign_name,
  c.advertiser,
  s.location AS market,
  s.name AS location_name,
  COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP) AS started_at,
qc.ended_at,
qr.annual_cost AS placement_cost,
GREATEST(
  1,
  CURRENT_DATE - DATE(COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP)) + 1
) AS assignment_days
,

ROUND(
  (
    qr.annual_cost / 365.0
  ) *
  GREATEST(
    1,
    CURRENT_DATE - DATE(COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP))
  ),
  2
) AS allocated_cost
FROM qr_campaigns qc
JOIN qr_codes qr ON qr.id = qc.qr_id
JOIN spaces s ON s.id = qr.space_id
JOIN campaigns c ON c.id = qc.campaign_id
WHERE COALESCE(qc.is_active,true) = true
ORDER BY qc.id DESC 
        `
        : `
SELECT
  qc.*,
  qr.name AS qr_name,
  c.name AS campaign_name,
  c.advertiser,
  s.location AS market,
  s.name AS location_name,
  COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP) AS started_at,
  qc.ended_at,
  qr.annual_cost AS placement_cost,

  GREATEST(
    1,
    FLOOR(
      EXTRACT(EPOCH FROM (
        NOW() - COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP)
      )) / 86400
    )
  ) AS assignment_days,

  ROUND(
   (qr.annual_cost / 365.0) *
    GREATEST(
      1,
      FLOOR(
        EXTRACT(EPOCH FROM (
          NOW() - COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP)
        )) / 86400
      )
    ),
    2
  ) AS allocated_cost
FROM qr_campaigns qc
JOIN qr_codes qr ON qr.id = qc.qr_id
JOIN spaces s ON s.id = qr.space_id
JOIN campaigns c ON c.id = qc.campaign_id
WHERE c.user_id = $1
AND qc.is_active = true
ORDER BY qc.id DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );
const schedules = await q(
  isSuperAdmin
    ? `
      SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM campaign_schedules cs
      JOIN qr_codes qr ON qr.id = cs.qr_id
      JOIN campaigns c ON c.id = cs.campaign_id
      ORDER BY cs.id DESC
    `
    : `
      SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM campaign_schedules cs
      JOIN qr_codes qr ON qr.id = cs.qr_id
      JOIN campaigns c ON c.id = cs.campaign_id
      WHERE c.user_id = $1
      ORDER BY cs.id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);
    const hasLocations = locations.rows.length > 0;
    const hasQrs = qrs.rows.length > 0;
    const hasCampaigns = campaigns.rows.length > 0;
    const hasAssignments = assignments.rows.length > 0;

const activeScheduleCount =
  schedules.rows.filter(s => s.is_active).length;

const hasSchedules = activeScheduleCount > 0;
    let locationTable = "";
    for (const s of locations.rows) {
      locationTable += `
        <tr>
         <td>${s.id}</td>
<td>${s.name || ""}</td>
<td>${s.location || ""}</td>
<td>${
  qrs.rows
    .filter(qr => String(qr.space_id) === String(s.id))
    .map(qr => qr.name)
    .filter(Boolean)
    .join(", ")
}</td>

<td>${
  relationships.rows
    .filter(r => String(r.location_id) === String(s.id))
    .map(r => {
      const campaign = campaigns.rows.find(
        c => String(c.id) === String(r.campaign_id)
      );
      return campaign ? campaign.name : "";
    })
    .filter(Boolean)
    .join(", ")
}</td>
<td>${daysActive(s.created_at)}</td>


          <td><a href="/admin/edit-location/${s.id}">Edit</a></td>

<td>
  <a href="/admin/archive-location/${s.id}">
    Archive
  </a>
</td>
        </tr>
      `;
    }

    let qrTable = "";
    for (const qr of qrs.rows) {
      qrTable += `
        <tr>
          <td>${qr.id}</td>
<td>${qr.name || ""}</td>
<td>${
  relationships.rows
    .filter(r => String(r.qr_id) === String(qr.id))
    .map(r => {
      const campaign = campaigns.rows.find(c => String(c.id) === String(r.campaign_id));
      return campaign ? campaign.advertiser : "";
    })
    .filter(Boolean)
    .join(", ")
}</td>
<td>
${qr.description && qr.description.startsWith("http")
  ? "Imported"
  : "Native"}
</td>
<td>${qr.location || ""}</td>
          <td>${qr.location_name || ""}</td>
          <td>${
  relationships.rows
    .filter(r => String(r.qr_id) === String(qr.id))
    .map(r => {
      const campaign = campaigns.rows.find(
        c => String(c.id) === String(r.campaign_id)
      );
      return campaign ? campaign.name : "";
    })
    .filter(Boolean)
    .join(", ")
}</td>

          <td>${daysActive(qr.created_at)}</td>
          <td>${Number(qr.annual_impressions || 0).toLocaleString()}</td>
<td>${money(qr.annual_cost || 0)}</td>
          <td><a href="/r/${qr.id}" target="_blank">Open</a></td>
          <td>
  <a href="/admin/edit-qr/${qr.id}">
    Edit
  </a>
</td>
          <td><a href="/qr/${qr.id}.png" target="_blank">Download</a></td>
<td>
  <a href="/admin/archive-qr/${qr.id}"
     onclick="return confirm('Archive this QR code?')"
     style="color:red;">
     Archive
  </a>
</td>
</tr>
        
      `;
    }

    let campaignTable = "";
    for (const c of campaigns.rows) {
      campaignTable += `
        <tr>
          <td>${c.id}</td>
          <td>${c.advertiser || ""}</td>
          <td>${c.name || ""}</td>
          <td>${
locations.rows.find(l =>
  relationships.rows.some(
    r =>
      String(r.campaign_id) === String(c.id) &&
      String(r.location_id) === String(l.id)
  )
)?.location || ""
}</td>

<td>${
locations.rows.find(l =>
  relationships.rows.some(
    r =>
      String(r.campaign_id) === String(c.id) &&
      String(r.location_id) === String(l.id)
  )
)?.name || ""
}</td>

<td>${
qrs.rows.find(q =>
  relationships.rows.some(
    r =>
      String(r.campaign_id) === String(c.id) &&
      String(r.qr_id) === String(q.id)
  )
)?.name || ""
}</td>
<td>${
  daysActive(
    relationships.rows
      .filter(r => String(r.campaign_id) === String(c.id))
      .map(r => r.created_at)
      .filter(Boolean)
      .sort()[0] || c.created_at,
    c.archived_at
  )
}</td>
     <td>
  <a href="/admin/edit-campaign/${c.id}">
    Edit
  </a>
</td>

<td>
  ${
    c.is_archived
      ? '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Archived</span>'
      : '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Active</span>'
  }
</td>



<td>
  <a href="/admin/archive-campaign/${c.id}"
     onclick="return confirm('Archive this campaign?')"
     style="color:red;">
     Archive
  </a>
</td>




        </tr>
      `;
    }
let archivedCampaignTable = "";

for (const c of archivedCampaigns.rows) {
  archivedCampaignTable += `
    <tr>
      <td>${c.id}</td>
      <td>${c.advertiser || ""}</td>
      <td>${c.name || ""}</td>

      <td>
        <a href="/admin/restore-campaign/${c.id}">
          Restore
        </a>
      </td>

    </tr>
  `;
}
    let scheduleTable = "";

for (const s of schedules.rows) {
  scheduleTable += `
    <tr>
      <td>${s.qr_name || ""}</td>
      <td>${s.advertiser || ""}</td>
      <td>${s.campaign_name || ""}</td>
      <td>${daysActive(s.created_at)}</td>
      <td>${dayLabels(s.days_of_week) || "Every Day"}</td>
      <td>${s.start_time || ""}</td>
      <td>${s.end_time || ""}</td>
      <td>${s.priority || ""}</td>
      <td>${s.is_active ? "Active" : "Inactive"}</td>
      <td><a href="/admin/deactivate-schedule/${s.id}">Archive</a></td>
    </tr>
  `;
}
    let assignmentTable = "";
    for (const a of assignments.rows) {
   assignmentTable += `
  <tr>
  
   <td>${a.market || ""}</td>
<td>${a.location_name || ""}</td>
<td>${a.qr_name || ""}</td>
<td>${a.advertiser || ""}</td>
<td>${a.campaign_name || ""}</td>
<td>${daysActive(a.started_at || a.assigned_at)}</td>
<td>${Number(a.assignment_days || 1)}</td>
<td>$${Number(a.allocated_cost || ((a.placement_cost || 0) / 365)).toFixed(2)}</td>
<td>
${a.is_active
? '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Active</span>'
: '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Inactive</span>'
}
</td>
    <td>
      <a href="/admin/archive-assignment/${a.id}"
         onclick="return confirm('Archive this assignment?')">
         Archive
      </a>
    </td>
  </tr>
`;
    }

    res.send(page("My Setup", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
 <h1>
  My Setup
  <a class="btn secondary"
     href="/help"
     style="margin-left:15px;font-size:14px;">
     Help
  </a>
</h1>

 
<div style="font-weight:bold;margin-bottom:15px;">
  👤 ${currentUser.email}
  &nbsp;|&nbsp;
  Role: ${currentUser.role}
</div>

<h3>Getting Started</h3>
<h3>Getting Started</h3>

<ol>
<li>Create a Location.</li>
<li>Create a QR Code.</li>
<li>Create a Campaign.</li>
<li>Assign the Campaign through Scheduling.</li>
<li>View performance in Reports.</li>
</ol>

<p>
<b>Tip:</b> Archived items are moved to Archive Center and can be restored at any time.
</p>

</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">

  <a class="btn" href="/admin/new-location">
    + New Location
  </a>

  <a class="btn" href="/admin/new-qr">
    + New QR
  </a>
<a class="btn secondary" href="/admin/import-qr">
  + Import Existing QR
</a>
  <a class="btn" href="/admin/new-campaign">
    + New Campaign
  </a>

  <a class="btn" href="/admin/assign">
    + Assign Campaign
  </a>

  <a class="btn" href="/admin/schedule">
    + Schedule Campaign
  </a>

 

</div>
        </div>
  
<div style="
background:#f7faf7;
border:1px solid #dbe7db;
padding:10px;
border-radius:8px;
margin-bottom:12px;
font-size:13px;
color:#4b5563;
">
<b>Days in Market:</b> Number of days a location, QR code, campaign, schedule, or assignment has been active since activation.
</div>

  

      </div>

      <div class="wrap">

<div class="card" style="margin-bottom:25px;padding:20px;">
  <h2>🚀 Launch Checklist</h2>

  <div class="note" style="margin-top:10px;">
    Follow these steps to launch and manage your campaigns.
    <div style="margin-top:18px;line-height:1.8;">
<div style="margin-top:15px;">
  ${hasLocations
    ? "✅ Locations Created"
    : "⚠ No Locations Yet"}
</div>
<br>

${hasQrs
  ? "✅ QR Codes Created"
  : "⚠ No QR Codes Yet"}
  </div>
<br>

${hasCampaigns
  ? "✅ Campaigns Created"
  : "⚠ No Campaigns Yet"}
  <br>
<br>

<div style="margin-top:10px;">
  ${hasAssignments
    ? "✅ Campaigns Assigned"
    : "⚠ No Campaign Assignments"}
</div>

<div style="margin-top:10px;">
  ${hasSchedules
    ? "✅ Active Schedules Running"
    : "⚠ No Active Schedules"}
</div>
  <div style="display:flex;flex-wrap:wrap;gap:15px;margin-top:20px;">

    <div class="card" style="width:240px;">
      <h3>Step 1</h3>
      <strong>Create Location</strong><br><br>

      Add a physical placement location such as:
      school, store, marina, event, or parking area.<br><br>

      <a class="btn" href="/admin/new-location">
        Create Location
      </a>
    </div>

    <div class="card" style="width:240px;">
      <h3>Step 2</h3>
      <strong>Create QR Code</strong><br><br>

      Create a QR code tied to a specific location.<br><br>

      <a class="btn" href="/admin/new-qr">
        Create QR
      </a>
    </div>

    <div class="card" style="width:240px;">
      <h3>Step 3</h3>
      <strong>Create Campaign</strong><br><br>

      Add offers, promotions, landing pages, or destinations.<br><br>

      <a class="btn" href="/admin/new-campaign">
        Create Campaign
      </a>
    </div>

    <div class="card" style="width:240px;">
      <h3>Step 4</h3>
      <strong>Assign Campaign</strong><br><br>

      Connect campaigns to QR codes.<br><br>

      <a class="btn" href="/admin/assign">
        Assign Campaign
      </a>
    </div>

    <div class="card" style="width:240px;">
      <h3>Step 5</h3>
      <strong>Schedule Campaigns</strong><br><br>

      Schedule promotions by day, time, or priority.<br><br>

      <a class="btn" href="/admin/schedule">
        Manage Schedules
      </a>
    </div>

    <div class="card" style="width:240px;">
      <h3>Step 6</h3>
      <strong>View Analytics</strong><br><br>

      Monitor scans, engagement, ROI, and performance.<br><br>

      <a class="btn" href="/dashboard">
        Open Dashboard
      </a>
    </div>

  </div>
</div>
        <div class="note">
          Review your locations, QR codes, campaigns, and assignments here.
        </div>

        <h2>Locations</h2>
        <table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Market</th>
            <th>QR Codes</th>
            <th>Campaigns</th>
           <th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
          
        
            <th>Edit</th>
            <th>Archive</th>
          </tr>
${locationTable || `<tr><td colspan="6">No locations yet.</td></tr>`}        </table>

        <h2>QR Codes</h2>
        <table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Advertiser</th>
            <th>Type</th>
            <th>Market</th>
            <th>Location</th>
            <th>Campaigns</th>
            <th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Annual Impressions</th>
<th>Annual Cost</th>
            <th>Open</th>
<th>Edit</th>
<th>Download</th>
<th>Archive</th>
          </tr>
          ${qrTable || `<tr><td colspan="8">No QR codes yet.</td></tr>`}
        </table>

        <h2>Campaigns</h2>
        <table>
<tr>
  <th>ID</th>
<th>Advertiser</th>
<th>Name</th>
<th>Market</th>
<th>Location</th>
<th>QR Code</th>
<th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Edit</th>
<th>Status</th>
<th>Archive</th>
</tr>
${campaignTable || `<tr><td colspan="10">No campaigns yet.</td></tr>`}
        </table>

    
<h2>Schedules</h2>

<table>
  <tr>
    <th>QR</th>
<th>Advertiser</th>
<th>Campaign</th>
<th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Day</th>
<th>Start</th>
<th>End</th>
<th>Priority</th>
<th>Status</th>
<th>Action</th>
  </tr>

  ${scheduleTable || `<tr><td colspan="8">No schedules yet.</td></tr>`}
</table>
        <h2>Active Campaign Assignments</h2>
        <table>
          <tr>
            <th>Market</th>
<th>Location</th>
<th>QR Code</th>
<th>Advertiser</th>
<th>Campaign</th>
<th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Assignment Days</th>
<th>Allocated Cost</th>
<th>Status</th>

<th>Archive</th>
          </tr>
          ${assignmentTable || `<tr><td colspan="3">No assignments yet.</td></tr>`}
        </table>

      </div>
    `));

  } catch (err) {
    res.send("MY SETUP ERROR: " + err.message);
  }
});
app.get("/reports", requireLogin, async (req, res) => {
  try {

    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const timeframe = req.query.timeframe || "30";
    const startDate = req.query.start_date || "";
const endDate = req.query.end_date || "";
const group = req.query.group || "campaign";
    let dateSql = "";
    let params = [];

    if (startDate && endDate) {
  dateSql = `AND e.created_at::date BETWEEN '${startDate}' AND '${endDate}'`;
} else if (timeframe !== "all") {
  dateSql = `AND e.created_at >= NOW() - INTERVAL '${Number(timeframe)} days'`;
}
let reportQuery = "";
    if (group === "campaign") {

  reportTitle = "Campaign Performance";

  reportQuery = isSuperAdmin
    ? `
      SELECT
        c.name AS label,
        c.advertiser,

        COUNT(*) FILTER (WHERE e.type='scan') AS scans,

        COUNT(*) FILTER (
          WHERE e.type IN ('offer','maps','waze')
        ) AS intent_actions
,
COUNT(*) FILTER (
  WHERE e.type IN ('purchase','conversion','lead','signup')
) AS conversions,

COALESCE(
  SUM(e.value) FILTER (
    WHERE e.type IN ('purchase','conversion','lead','signup')
  ),
  0
) AS conversion_value,
COALESCE((
  SELECT ROUND(
    SUM((s2.placement_cost / 365.0) *
      GREATEST(
        1,
        LEAST(
  COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE),
  CURRENT_DATE
)
-
GREATEST(
  DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
  COALESCE(
    NULLIF('${startDate}','')::date,
    DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
  )
)
+ 1
      )
    ),
    2
  )
  FROM qr_campaigns qc2
  JOIN qr_codes qr2 ON qr2.id = qc2.qr_id
  JOIN spaces s2 ON s2.id = qr2.space_id
  WHERE qc2.campaign_id = c.id
    AND COALESCE(qc2.is_active,true) = true
), 0) AS allocated_cost,
COUNT(*) FILTER (
  WHERE e.type IN ('purchase','conversion','lead','signup')
) AS conversions,

SUM(e.value) FILTER (
  WHERE e.type IN ('purchase','conversion','lead','signup')
) AS conversion_value
      FROM events e
      LEFT JOIN campaigns c
        ON c.id = e.campaign_id

      WHERE 1=1

      GROUP BY c.id, c.name, c.advertiser
      ORDER BY scans DESC
    `
    : `
      SELECT
        c.name AS label,
        c.advertiser,

        COUNT(*) FILTER (WHERE e.type='scan') AS scans,

        COUNT(*) FILTER (
          WHERE e.type IN ('offer','maps','waze')
        ) AS intent_actions
) AS intent_actions,
0 AS conversions,
0 AS conversion_value,
COALESCE((
  SELECT ROUND(
    SUM(
      (s2.placement_cost / 365.0) *
      GREATEST(
        1,
        LEAST(
  COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE),
  CURRENT_DATE
)
-
GREATEST(
  DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
  COALESCE(
    NULLIF('${startDate}','')::date,
    DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
  )
)
+ 1
      )
    ),
    2
  )
  FROM qr_campaigns qc2
  JOIN qr_codes qr2 ON qr2.id = qc2.qr_id
  JOIN spaces s2 ON s2.id = qr2.space_id
  WHERE qc2.campaign_id = c.id
    AND COALESCE(qc2.is_active,true) = true
    ),0) AS allocated_cost,
COALESCE((
  SELECT SUM(
    GREATEST(
      1,
      (
        LEAST(CURRENT_DATE, COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE))
        -
        GREATEST(
          DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
          COALESCE(NULLIF('${startDate}','')::date, DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)))
        )
        + 1
      )
    )
  )
  FROM qr_campaigns qc2
  WHERE qc2.campaign_id = c.id
  AND COALESCE(qc2.is_active,true) = true
),0) AS active_days,
COUNT(*) FILTER (
  WHERE e.type IN ('purchase','conversion','lead','signup')
) AS conversions,

SUM(e.value) FILTER (
  WHERE e.type IN ('purchase','conversion','lead','signup')
) AS conversion_value
      FROM events e
      LEFT JOIN campaigns c
        ON c.id = e.campaign_id

      WHERE c.user_id = $1
      ${dateSql}

      GROUP BY c.id, c.name, c.advertiser
      ORDER BY scans DESC
    `;
}
    

const reportRows = await q(
  isSuperAdmin
        ? `
          SELECT
            c.name AS campaign_name,
            c.advertiser,c.id AS campaign_id,

            COUNT(*) FILTER (WHERE e.type='scan') AS scans,

            COUNT(*) FILTER (
              WHERE e.type IN ('offer','maps','waze')
            ) AS intent_actions
            ,
0 AS conversions,
0 AS conversion_value,
COALESCE((
  SELECT SUM(
    GREATEST(
      1,
    LEAST(
  COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE),
  CURRENT_DATE
)
-
GREATEST(
  DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
  COALESCE(
    NULLIF('${startDate}','')::date,
    DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
  )
)
+ 1
    )
  )
  FROM qr_campaigns qc2
  WHERE qc2.campaign_id = c.id
  AND COALESCE(qc2.is_active,true) = true
),0) AS active_days,
0 AS allocated_cost
,
0 AS conversions,
0 AS conversion_value,
COALESCE((
  SELECT ROUND(
    SUM((s2.placement_cost / 365.0) *
      GREATEST(
        1,LEAST(
  COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE),
  CURRENT_DATE
)
-
GREATEST(
  DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
  COALESCE(
    NULLIF('${startDate}','')::date,
    DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
  )
)
+ 1
      )
    ),
    2
  )
  FROM qr_campaigns qc2
  JOIN qr_codes qr2 ON qr2.id = qc2.qr_id
  JOIN spaces s2 ON s2.id = qr2.space_id
  WHERE qc2.campaign_id = c.id
    AND COALESCE(qc2.is_active,true) = true
), 0) AS allocated_cost,
     FROM events e
LEFT JOIN campaigns c
  ON c.id = e.campaign_id

          WHERE 1=1
${dateSql}
          GROUP BY c.id, c.name, c.advertiser
          
          ORDER BY scans DESC
        `
        : `
          SELECT
            c.name AS campaign_name,
            c.advertiser,
CASE
  WHEN COALESCE(c.is_archived,false) THEN 'Archived'
  ELSE 'Active'
END AS status,
(
  SELECT COUNT(DISTINCT qc2.qr_id)
  FROM qr_campaigns qc2
  WHERE qc2.campaign_id = c.id
    AND COALESCE(qc2.is_active,true) = true
) AS qr_count,
            COUNT(e.id) FILTER (WHERE e.type='scan') AS scans,
COUNT(e.id) FILTER (
  WHERE e.type='offer'
) AS offers,

COUNT(e.id) FILTER (
  WHERE e.type='maps'
) AS maps,

COUNT(e.id) FILTER (
  WHERE e.type='waze'
) AS waze,
            COUNT(e.id) FILTER (
  WHERE e.type IN ('offer','maps','waze')
) AS intent_actions
              
,
0 AS conversions,
0 AS conversion_value,
COALESCE((
  SELECT ROUND(SUM((s2.placement_cost / 365.0) *
  GREATEST(
    1,
    (
      LEAST(
        CURRENT_DATE,
        COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE)
      )
      -
      GREATEST(
        DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
        COALESCE(
          NULLIF('${startDate}','')::date,
          DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
        )
      )
    ) + 1
  )
), 2)
  FROM qr_campaigns qc2
  JOIN qr_codes qr2 ON qr2.id = qc2.qr_id
  JOIN spaces s2 ON s2.id = qr2.space_id
  WHERE qc2.campaign_id = c.id
), 0) AS allocated_cost,
(
  SELECT MIN(
    GREATEST(
      1,
      CURRENT_DATE - DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)) + 1
    )
  )
  FROM qr_campaigns qc2
  WHERE qc2.campaign_id = c.id
) AS active_days
          FROM campaigns c
LEFT JOIN events e
  ON e.campaign_id = c.id
  ${dateSql}

WHERE c.user_id = $1

          GROUP BY c.id, c.name, c.advertiser
          ORDER BY scans DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    let reportTable = "";

    for (const r of reportRows.rows) {

      const scans = Number(r.scans || 0);
      const offers = Number(r.offers || 0);
const maps = Number(r.maps || 0);
const waze = Number(r.waze || 0);

const intent = offers + maps + waze;
  const estimatedCustomers = Math.round(intent * 0.08);
const customerValue = Number(r.conversion_value || 50);
const revenue = estimatedCustomers * customerValue;




  const placementCost = Number(r.allocated_cost || 0);    
const activeDays = Number(r.active_days || 0);

const roi =
  placementCost > 0
    ? (((revenue - placementCost)
        / placementCost) * 100).toFixed(1)
    : 0;
      const intentRate =
        scans > 0
          ? ((intent / scans) * 100).toFixed(1)
          : 0;

      reportTable += `
        <tr>
          <td>${r.advertiser || ""}</td>
          <td>${r.campaign_name || ""}</td>
        <td>
  ${r.status === "Archived"
    ? '<span style="background:#dc2626;color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Archived</span>'
    : '<span style="background:#16a34a;color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Active</span>'}
</td>
<td style="text-align:center;">${r.qr_count || 0}</td>
         <td style="text-align:center;">${scans}</td>
<td style="text-align:center;">${offers}</td>

<td style="text-align:center;">${maps}</td>

<td style="text-align:center;">${waze}</td>

<td style="text-align:center;">${intent}</td>
<td style="text-align:center;">${intentRate}%</td>
<td style="text-align:center;">${estimatedCustomers}</td>
<td style="text-align:center;">${money(customerValue)}</td>
   <td>${money(revenue)}</td>
<td>${activeDays}</td>

<td>${money(placementCost)}</td>
<td>${roi}%</td>
        </tr>
      `;
    }

    res.send(page("Reports", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Reports</h1>
      </div>

      <div class="wrap">

        <div style="display:flex;gap:10px;margin-bottom:20px;">

    

<a class="btn" href="/reports">
  Campaign Reports
</a>

<a class="btn secondary" href="/reports-qr">
  QR Reports
</a>

<a class="btn secondary" href="/reports-location">
  Location Reports
</a>
</div>    
<form method="GET" action="/reports" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
  <div>
    <label>Start Date</label><br>
    <input type="hidden" name="group" value="${group}">
    <input type="date" name="start_date" value="${startDate || ""}">
  </div>

  <div>
    <label>End Date</label><br>
    <input type="date" name="end_date" value="${endDate || ""}">
  </div>

  <button class="btn" type="submit">Apply Filter</button>
</form>
        </div>

        <div class="card">

          <h2>Campaign Performance</h2>

          <table>

            <tr>
              <th>Advertiser</th>
              <th>Campaign</th>
              <th>Status</th>
              <th style="text-align:center;">QR Count</th>
            <th style="text-align:center;">Scans</th>
<th style="text-align:center;">Offers</th>
<th style="text-align:center;">Maps</th>
<th style="text-align:center;">Waze</th>
<th style="text-align:center;">Total Intent</th>
<th style="text-align:center;">Intent Rate</th>
<th>Est. Customers</th>
<th>Customer Value</th>
<th>Est. Revenue</th>
              <th>Active Days</th>
              <th>Allocated Cost</th>
<th>ROI</th>
            </tr>

            ${reportTable || `
              <tr>
                <td colspan="7">
                  No report data yet.
                </td>
              </tr>
            `}

          </table>

        </div>

      </div>
    `));

  } catch (err) {
    res.send("REPORT ERROR: " + err.message);
  }
});
app.get("/track-conversion", async (req, res) => {
  try {

    const campaignId =
      Number(req.query.campaign_id || 0);

    const qrId =
      Number(req.query.qr_id || 0);

    const value =
      Number(req.query.value || 0);

    const type =
      req.query.type || "conversion";

    await q(
      `
      INSERT INTO events (
        campaign_id,
        qr_id,
        type,
        value,
        created_at
      )
      VALUES ($1,$2,$3,$4,NOW())
      `,
      [
        campaignId,
        qrId,
        type,
        value
      ]
    );

    res.send(`
      <h2>Conversion Tracked</h2>

      <p>
        Type: ${type}
      </p>

      <p>
        Value: $${value}
      </p>
    `);

  } catch (err) {
    res.send("TRACK CONVERSION ERROR: " + err.message);
  }
});
app.get("/reports-qr", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const timeframe = req.query.timeframe || "30";
const startDate = req.query.start_date || "";
const endDate = req.query.end_date || "";
    let dateSql = "";

if (startDate && endDate) {
  dateSql = `AND e.created_at::date BETWEEN '${startDate}' AND '${endDate}'`;
} else if (timeframe !== "all") {
  dateSql = `AND e.created_at >= NOW() - INTERVAL '${Number(timeframe)} days'`;
}

    const reportRows = await q(
      isSuperAdmin
        ? `
         SELECT
  c.advertiser,
  c.name AS campaign_name,
  c.id AS campaign_id,
  qr.name AS qr_name,
  (
  SELECT COUNT(DISTINCT qc2.campaign_id)
  FROM qr_campaigns qc2
  WHERE qc2.qr_id = qr.id
    AND COALESCE(qc2.is_active,true) = true
) AS campaign_count,
            COUNT(*) FILTER (WHERE e.type='scan') AS scans,
            COUNT(*) FILTER (WHERE e.type='offer') AS offers,
COUNT(*) FILTER (WHERE e.type='maps') AS maps,
COUNT(*) FILTER (WHERE e.type='waze') AS waze,
COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_actions


         FROM events e
JOIN qr_codes qr ON qr.id = e.qr_id

LEFT JOIN qr_campaigns qc
  ON qc.qr_id = qr.id
  AND COALESCE(qc.is_active,true) = true

LEFT JOIN campaigns c
  ON c.id = COALESCE(e.campaign_id, qc.campaign_id)

LEFT JOIN spaces s
  ON s.id = qr.space_id

WHERE 1=1
          ${dateSql}

 GROUP BY
  c.advertiser,
  c.name,
  c.id,
  qr.name,
  qc.id,
  qc.started_at,
  qc.assigned_at,
  qr.annual_cost AS placement_cost
  ORDER BY scans DESC
        `
        : `
          SELECT
  
  qr.name AS qr_name,
  COUNT(DISTINCT qc.campaign_id) AS campaign_count,
            COUNT(*) FILTER (WHERE e.type='scan') AS scans,
            COUNT(*) FILTER (WHERE e.type='offer') AS offers,
COUNT(*) FILTER (WHERE e.type='maps') AS maps,
COUNT(*) FILTER (WHERE e.type='waze') AS waze,
COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_actions,
COALESCE((
  SELECT ROUND(
    SUM((s2.placement_cost / 365.0) *
      GREATEST(
        1,
        LEAST(
          COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE),
          CURRENT_DATE
        )
        -
        GREATEST(
          DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP)),
          COALESCE(
            NULLIF('${startDate}','')::date,
            DATE(COALESCE(qc2.started_at, qc2.assigned_at, CURRENT_TIMESTAMP))
          )
        )
        + 1
      )
    ),
    2
  )
  FROM qr_campaigns qc2
  JOIN qr_codes qr2 ON qr2.id = qc2.qr_id
  JOIN spaces s2 ON s2.id = qr2.space_id
  WHERE qc2.qr_id = qr.id
    AND COALESCE(qc2.is_active,true) = true
), 0) AS allocated_cost

  
          FROM events e
          JOIN qr_codes qr ON qr.id = e.qr_id
          JOIN spaces s ON s.id = qr.space_id
   LEFT JOIN qr_campaigns qc
  ON qc.qr_id = qr.id
  AND COALESCE(qc.is_active,true) = true

LEFT JOIN campaigns c
  ON c.id = COALESCE(e.campaign_id, qc.campaign_id)
         
          WHERE s.user_id = $1
          ${dateSql}
GROUP BY
qr.id,
qr.name
          ORDER BY scans DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    let reportTable = "";

    for (const r of reportRows.rows) {
     const campaignCount = Number(r.campaign_count || 0);
      const scans = Number(r.scans || 0);
   const offers = Number(r.offers || 0);
const maps = Number(r.maps || 0);
const waze = Number(r.waze || 0);
const allocatedCost = Number(r.allocated_cost || 0);
const intent =
  offers + maps + waze;
      const estimatedCustomers = Math.round(intent * 0.08);
      const conversions = Number(r.conversions || 0);

const customerValue = Number(r.conversion_value || 50);
const revenue = estimatedCustomers * customerValue;
      

const roi =
  allocatedCost > 0
    ? (((revenue - allocatedCost) / allocatedCost) * 100).toFixed(1)
    : 0;
      const intentRate = scans > 0 ? ((intent / scans) * 100).toFixed(1) : 0;

      reportTable += `
        <tr>
          <td>${r.qr_name || ""}</td>
          <td style="text-align:center;">${r.campaign_count || 0}</td>
          <td style="text-align:center;">${scans}</td>
          <td style="text-align:center;">${offers}</td>

<td style="text-align:center;">${maps}</td>

<td style="text-align:center;">${waze}</td>

<td style="text-align:center;">${intent}</td>
          <td style="text-align:center;">${intentRate}%</td>
          <td style="text-align:center;">
  ${estimatedCustomers}
</td>

<td style="text-align:center;">
  ${money(customerValue)}
</td>
<td style="text-align:center;">${money(revenue)}</td>
<td style="text-align:center;">${money(allocatedCost)}</td>
<td style="text-align:center;">${roi}%</td>
        </tr>
      `;
    }

    res.send(page("QR Reports", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>QR Reports</h1>
      </div>

      <div class="wrap">
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        
         <a class="btn" href="/reports-qr">QR Reports</a>
          <a class="btn secondary" href="/reports">Campaign Reports</a>
          <a class="btn secondary" href="/reports-location">Location Reports</a>
        </div>
<form method="GET" action="/reports-qr" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
  <div>
    <label>Start Date</label><br>
    <input type="date" name="start_date" value="${startDate || ""}">
  </div>

  <div>
    <label>End Date</label><br>
    <input type="date" name="end_date" value="${endDate || ""}">
  </div>

  <button class="btn" type="submit">Apply Filter</button>
</form>
        <div class="card">
          <h2>QR Code Performance</h2>

          <table>
            <tr>
              <th>QR Code</th>
              <th>Campaign Count</th>
              <th style="text-align:center;">Scans</th>
              <th style="text-align:center;">Offers</th>
<th style="text-align:center;">Maps</th>
<th style="text-align:center;">Waze</th>
<th style="text-align:center;">Total Intent</th>
              <th style="text-align:center;">Intent Rate</th>
              <th>Est. Customers</th>
<th style="text-align:center;">Customer Value</th>
<th>Est. Revenue</th>
<th>Allocated Cost</th>
<th>ROI</th>
            </tr>

            ${reportTable || `
              <tr>
                <td colspan="4">No QR report data yet.</td>
              </tr>
            `}
          </table>
        </div>
      </div>
    `));

  } catch (err) {
    res.send("QR REPORT ERROR: " + err.message);
  }
});
app.get("/reports-location", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const timeframe = req.query.timeframe || "30";
const startDate = req.query.start_date || "";
const endDate = req.query.end_date || "";
    let dateSql = "";

    if (startDate && endDate) {
  dateSql = `AND e.created_at::date BETWEEN '${startDate}' AND '${endDate}'`;
} else {
  dateSql = `AND e.created_at >= NOW() - INTERVAL '30 days'`;
}

    const reportRows = await q(
      isSuperAdmin
        ? `
          SELECT
            s.name AS location_name,
            s.location,

            COUNT(*) FILTER (WHERE e.type='scan') AS scans,

           COUNT(*) FILTER (
  WHERE e.type='offer'
) AS offers,

COUNT(*) FILTER (
  WHERE e.type='maps'
) AS maps,

COUNT(*) FILTER (
  WHERE e.type='waze'
) AS waze,

           COALESCE(qr.annual_impressions, 0) AS impressions,
COALESCE(qr.annual_cost, 800) AS placement_cost

          FROM events e

          JOIN qr_codes qr
            ON qr.id = e.qr_id

          JOIN spaces s
            ON s.id = qr.space_id

          WHERE 1=1
          ${dateSql}

          GROUP BY
            s.name,
            s.location,
            qr.annual_impressions,
qr.annual_cost

          ORDER BY scans DESC
        `
        : `
          SELECT
            s.name AS location_name,
            s.location,

            COUNT(*) FILTER (WHERE e.type='scan') AS scans,

           COUNT(*) FILTER (
  WHERE e.type='offer'
) AS offers,

COUNT(*) FILTER (
  WHERE e.type='maps'
) AS maps,

COUNT(*) FILTER (
  WHERE e.type='waze'
) AS waze,

            COALESCE(qr.annual_impressions, 0) AS impressions,
COALESCE(qr.annual_cost, 800) AS placement_cost

          FROM events e

          JOIN qr_codes qr
            ON qr.id = e.qr_id

          JOIN spaces s
            ON s.id = qr.space_id

          WHERE s.user_id = $1
          ${dateSql}

          GROUP BY
            s.name,
            s.location,
            qr.annual_impressions,
qr.annual_cost

          ORDER BY scans DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    let reportTable = "";

    for (const r of reportRows.rows) {

      const scans = Number(r.scans || 0);
      const offers = Number(r.offers || 0);
const maps = Number(r.maps || 0);
const waze = Number(r.waze || 0);

const intent =
  offers + maps + waze;

      const intentRate =
        scans > 0
          ? ((intent / scans) * 100).toFixed(1)
          : 0;
const conversions = Number(r.conversions || 0);

const conversionValue =
  Number(r.conversion_value || 0);
      const customers =
        Math.round(intent * 0.1);

      const revenue =
  conversionValue;

      const cost =
        Number(r.placement_cost || 800);

      const roi =
        cost > 0
          ? (((revenue - cost) / cost) * 100).toFixed(1)
          : 0;

      const impressions =
        Number(r.impressions || 0);

      const cpm =
        impressions > 0
          ? ((cost / impressions) * 1000).toFixed(2)
          : 0;

      reportTable += `
        <tr>
          <td>${r.location_name || ""}</td>

          <td>${r.location || ""}</td>

          <td style="text-align:center;">
            ${impressions.toLocaleString()}
          </td>

          <td style="text-align:center;">
            ${scans}
          </td>

          <td style="text-align:center;">
  ${offers}
</td>

<td style="text-align:center;">
  ${maps}
</td>

<td style="text-align:center;">
  ${waze}
</td>

<td style="text-align:center;">
  ${intent}
</td>

          <td style="text-align:center;">
            ${intentRate}%
          </td>
<td style="text-align:center;">
  ${conversions}
</td>

<td style="text-align:center;">
  ${money(conversionValue)}
</td>
          <td style="text-align:center;">
            ${customers}
          </td>

          <td style="text-align:center;">
            ${money(revenue)}
          </td>

          <td style="text-align:center;">
            ${money(cost)}
          </td>

          <td style="text-align:center;">
            ${cpm}
          </td>

          <td style="text-align:center;">
            ${roi}%
          </td>
        </tr>
      `;
    }

    res.send(page("Location Reports", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Location Reports</h1>
      </div>

      <div class="wrap">

        

         

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
<a class="btn" href="/reports-location">
    Location Reports
  </a>
  <a class="btn secondary" href="/reports">
    Campaign Reports
  </a>

  <a class="btn secondary" href="/reports-qr">
    QR Reports
  </a>

  

</div>    

         

        </div>
<form method="GET" action="/reports-location" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
  <div>
    <label>Start Date</label><br>
    <input type="date" name="start_date" value="${startDate || ""}">
  </div>

  <div>
    <label>End Date</label><br>
    <input type="date" name="end_date" value="${endDate || ""}">
  </div>

  <button class="btn" type="submit">Apply Filter</button>
</form>
        <div class="card">

          <h2>Location Performance</h2>
<div style="overflow-x:auto;width:100%;">
  <table style="width:100%;min-width:1200px;">
          <table>
</div>
            <tr>
              <th>Location</th>
              <th>Market</th>
              <th>Impressions</th>
              <th>Scans</th>
              <th>Offers</th>
<th>Maps</th>
<th>Waze</th>
<th>Total Intent</th>
              <th>Intent Rate</th>
              <th>Conversions</th>
<th>Conversion Value</th>
              <th>Customers</th>
              <th>Revenue</th>
              <th>Placement Cost</th>
              <th>CPM</th>
              <th>ROI</th>
            </tr>

            ${reportTable || `
              <tr>
                <td colspan="14">
                  No location report data yet.
                </td>
              </tr>
            `}

          </table>

        </div>

      </div>
    `));

  } catch (err) {
    res.send("LOCATION REPORT ERROR: " + err.message);
  }
});
app.get("/admin/users", requireSuperAdmin, async (req, res) => {
  const users = await q(`
    SELECT id, email, role, created_at
    FROM users
    ORDER BY id
  `);

  res.send(page("Users", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>User Management</h1>
      <p class="subtitle">Super admin only</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/admin">Back to Admin</a>

      <h2>Create Customer Login</h2>

      <form method="POST" action="/admin/users">
        <label>Email</label>
        <input name="email" type="email" required />

        <label>Password</label>
        <input name="password" required />

        <label>Role</label>
        <select name="role">
          <option value="customer">Customer</option>
          <option value="super_admin">Super Admin</option>
        </select>

        <button class="btn" type="submit">Create User</button>
      </form>

      <h2>Existing Users</h2>

      <table>
        <tr>
          <th>ID</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
        </tr>

        ${users.rows.map(u => `
          <tr>
            <td>${u.id}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>${new Date(u.created_at).toLocaleString()}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `));
});
app.post("/admin/users", requireSuperAdmin, async (req, res) => {
  try {
    await q(`
      INSERT INTO users (email, password, role)
      VALUES ($1,$2,$3)
      ON CONFLICT (email)
      DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role
    `, [
      req.body.email,
      req.body.password,
      req.body.role || "customer"
    ]);

    res.send("User saved <br><a href='/admin/users'>Back to Users</a>");
  } catch (err) {
    res.send("USER CREATE ERROR: " + err.message);
  }
});
app.get("/admin", async (req, res) => {
 if (req.session.user && req.session.user.role !== "super_admin") {
  return res.redirect("/my-setup");
}
  const qrs = await q(`SELECT qr.*, s.name AS space_name FROM qr_codes qr LEFT JOIN spaces s ON s.id = qr.space_id ORDER BY qr.id`);
  const campaigns = await q(`
  SELECT
    c.*,
COUNT(e.id) AS total_events,
COUNT(*) FILTER (WHERE e.type = 'scan') AS scans
  FROM campaigns c
LEFT JOIN events e ON e.campaign_id = c.id
WHERE COALESCE(c.is_archived,false) = false
GROUP BY c.id
ORDER BY c.id
`);
  const stores = await q(`SELECT * FROM stores ORDER BY inventory_priority DESC`);
  res.send(page("Vivid Admin", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Admin Control Center</h1><p class="subtitle">Manage locations, QR codes, campaigns, stores, inventory, and schedules.</p></div>
  
    <div class="wrap"><a class="btn" href="/dashboard">Dashboard</a><a class="btn secondary" href="/admin/new-location">New Location</a><a class="btn secondary" href="/admin/new-qr">New QR</a><a class="btn secondary" href="/admin/import-qr">Import Existing QR</a><a class="btn secondary" href="/admin/new-campaign">New Campaign</a><a class="btn secondary" href="/admin/new-store">New Store</a><a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a><a class="btn secondary" href="/admin/assign">Assign Campaign</a>
      <a class="btn secondary"
   href="#"
   onclick="const p=document.getElementById('helpPanel'); if(p){p.style.display=p.style.display==='none'?'block':'none';} return false;">
   Help
</a><div id="helpPanel" style="display:none;background:#fff;padding:20px;margin:20px 0;border-radius:10px;">
  <div class="note">
<h3>Getting Started with Vivid Spots</h3>

<ol>
  <li>Create Locations</li>
  <li>Create QR Codes</li>
  <li>Create Campaigns</li>
  <li>Assign Campaigns to QR Codes</li>
  <li>Schedule Campaigns if multiple campaigns rotate on the same QR</li>
  <li>Run Reports and AI Insights</li>
</ol>

<br>

<h3>What Each Section Means</h3>

<p>
<strong>Locations</strong><br>
Physical places where QR codes are deployed such as schools, stores, events, parking areas, or mailers.
</p>

<p>
<strong>QR Codes</strong><br>
Trackable QR codes that can route visitors to campaigns and collect scan analytics without reprinting.
</p>

<p>
<strong>Campaigns</strong><br>
Advertiser offers, promotions, recruiting campaigns, school initiatives, or other destinations.
</p>

<p>
<strong>Assign Campaigns</strong><br>
Connect a campaign to a QR code so scans route to the correct destination.
</p>

<p>
<strong>Scheduling</strong><br>
Run different campaigns on the same QR by day, time, or priority.
</p>

<p>
<strong>Reports & AI Insights</strong><br>
Measure scans, engagement, conversions, ROI, and customer acquisition.
</p>

<br>

<h3>Estimated Customer Value Formula</h3>

<p>
<strong>Scans × Conversion Rate × Average Customer Value</strong>
</p>

<p>
Example:<br>
1,000 Scans × 10% Conversion × $35 Customer Value<br>
= <strong>$3,500 Estimated Revenue</strong>
</p>
</div>
</div><h2>QR Codes</h2><table><tr><th>ID</th><th>QR</th><th>Space</th><th>Routing URL</th><th>QR Image</th></tr>${qrs.rows.map(qr => `<tr><td>${qr.id}</td><td>${qr.name || ""}</td><td>${qr.space_name || ""}</td><td><a href="/r/${qr.id}" target="_blank">${BASE_URL}/r/${qr.id}</a></td><td><a href="/qr/${qr.id}.png" target="_blank">Download QR</a></td></tr>`).join("")}</table>
      <h2>Campaigns</h2><table><tr><th>ID</th><th>Advertiser</th><th>Campaign</th><th>URL</th><th>Avg Value</th><th>Conversion</th><th>QR Scans</th>
<th>Offer Clicks</th>
<th>CTR</th>
<th>Est. Conversions</th>
<th>Est. Revenue</th>
<th>Status</th>
<th>Archive</th></tr>${campaigns.rows.map(c => `<tr><td>${c.id}</td><td>${c.advertiser || ""}</td><td>${c.name || ""}</td><td>${c.campaign_url || ""}</td><td>${money(c.avg_customer_value)}</td><td>${c.conversion_rate || 10}%</td><td>${c.total_events || 0}</td>
<td>${c.scans || 0}</td>
<td>${((c.scans || 0) / Math.max(c.total_events || 1, 1) * 100).toFixed(1)}%</td>
<td>${Math.round((c.scans || 0) * ((c.conversion_rate || 10) / 100))}</td> 
<td>$${Math.round(Math.round((c.scans || 0) * ((c.conversion_rate || 10) / 100)) * Number(c.avg_value || 0))}</td>
</td>

<td>
  <span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">
    Active
  </span>
</td>

<td>
  <a href="/admin/archive-campaign/${c.id}"
   onclick="return confirm('Archive this campaign?')"
   style="color:red;">
   Archive
</a>
</td>
</tr>
`).join("")}</table>
      <h2>Stores / Inventory</h2><table><tr><th>Store</th><th>Address</th><th>Priority</th><th>Units</th><th>Days</th><th>Velocity</th><th>Note</th><th>Edit</th></tr>${stores.rows.map(s => `<tr><td>${s.name || ""}</td><td>${s.address || ""}</td><td>${s.inventory_priority || 0}</td><td>${s.inventory_units || 0}</td><td>${s.days_on_hand || 0}</td><td>${s.inventory_velocity || 0}</td><td>${s.inventory_note || ""}</td><td><a href="/admin/edit-store/${s.id}">Edit</a></td></tr>`).join("")}</table>
    </div>
    <script>
function toggleHelp() {
  const panel = document.getElementById('helpPanel');

  if (!panel) return;

  if (panel.style.display === 'none') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}
</script>
  `));
});
app.get("/admin/edit-location/:spaceId", requireLogin, async (req, res) => {
  const currentUser = req.session.user;
  const isSuperAdmin = currentUser.role === "super_admin";

  const result = await q(
    isSuperAdmin
      ? `SELECT * FROM spaces WHERE id = $1`
      : `SELECT * FROM spaces WHERE id = $1 AND user_id = $2`,
    isSuperAdmin
      ? [req.params.spaceId]
      : [req.params.spaceId, currentUser.id]
  );

  const s = result.rows[0];

  if (!s) {
    return res.send("Location not found or access denied");
  }

  res.send(page("Edit Location", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit Location</h1>
    </div>

    <div class="wrap">
      <form method="POST" action="/admin/edit-location/${s.id}">
        <label>Location Name</label>
        <input name="name" value="${s.name || ""}" />

        <label>Market / Address</label>
        <input name="location" value="${s.location || ""}" />

        <label>Annual Impressions</label>
        <input name="annual_impressions" value="${s.annual_impressions || 0}" />

        <label>Placement Cost</label>
        <input name="placement_cost" value="${s.placement_cost || 800}" />

        <button class="btn" type="submit">
          Save Location
        </button>
      </form>
    </div>
  `));
});
app.post("/admin/edit-location/:spaceId", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const result = await q(
      isSuperAdmin
        ? `
          UPDATE spaces
          SET
            name = $1,
            location = $2,
            annual_impressions = $3,
            placement_cost = $4
          WHERE id = $5
          RETURNING id
        `
        : `
          UPDATE spaces
          SET
            name = $1,
            location = $2,
            annual_impressions = $3,
            placement_cost = $4
          WHERE id = $5
          AND user_id = $6
          RETURNING id
        `,
      isSuperAdmin
        ? [
            req.body.name || "",
            req.body.location || "",
            Number(req.body.annual_impressions || 0),
            Number(req.body.placement_cost || 800),
            req.params.spaceId
          ]
        : [
            req.body.name || "",
            req.body.location || "",
            Number(req.body.annual_impressions || 0),
            Number(req.body.placement_cost || 800),
            req.params.spaceId,
            currentUser.id
          ]
    );

    if (!result.rows[0]) {
      return res.send("Location not found or access denied");
    }

    res.send(
      "Location updated <br><a href='/my-setup'>Back to My Setup</a>"
    );

  } catch (err) {
    res.send("EDIT LOCATION ERROR: " + err.message);
  }
});
app.get("/admin/new-location", async (req, res) => {
  res.send(page("Add Location", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add Location / Space</h1></div><div class="wrap"><form method="POST" action="/admin/new-location"><label>Name</label><input name="name" required /><label>Market</label><input name="location" placeholder="Naples, FL" /><label>Description</label><input name="description" /><button class="btn" type="submit">Create Location</button></form></div>`));
});
app.post("/admin/new-location", async (req, res) => {
  try {
    await q(`
      INSERT INTO spaces (
  user_id,
  name,
  location
)
      VALUES ($1,$2,$3)
    `, [
  req.session.user.id,
  req.body.name,
  req.body.location
]
      );

    res.send(successPage(
  "Location Created Successfully",
  "Your location has been saved.",
  "Create a QR code for this location.",
  [
    { label: "Create QR Code", href: "/admin/new-qr" },
    { label: "Back to My Setup", href: "/my-setup" }
  ]
));
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/admin/edit-qr/:qrId", requireLogin, async (req, res) => {
  const currentUser = req.session.user;
  const isSuperAdmin = currentUser.role === "super_admin";

  const qrResult = await q(
    isSuperAdmin
      ? `
        SELECT qr.*
        FROM qr_codes qr
        WHERE qr.id = $1
      `
      : `
        SELECT qr.*
        FROM qr_codes qr
        JOIN spaces s ON s.id = qr.space_id
        WHERE qr.id = $1
        AND s.user_id = $2
      `,
    isSuperAdmin
      ? [req.params.qrId]
      : [req.params.qrId, currentUser.id]
  );

  const qr = qrResult.rows[0];

  if (!qr) {
    return res.send("QR not found or access denied");
  }

  const spaces = await q(
    isSuperAdmin
      ? `
        SELECT *
        FROM spaces
        ORDER BY id
      `
      : `
        SELECT *
        FROM spaces
        WHERE user_id = $1
        ORDER BY id
      `,
    isSuperAdmin ? [] : [currentUser.id]
  );
const campaigns = await q(
  `
  SELECT id, name
  FROM campaigns
  WHERE user_id = $1
  AND COALESCE(is_archived,false) = false
  ORDER BY name
  `,
  [currentUser.id]
);
  res.send(page("Edit QR", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit QR Code</h1>
    </div>

    <div class="wrap">
      <form method="POST" action="/admin/edit-qr/${qr.id}">
        <label>QR Name</label>
        <input name="name" value="${qr.name || ""}" />

        <label>Location</label>
        <select name="space_id">
          ${spaces.rows.map(s => `
            <option value="${s.id}" ${Number(s.id) === Number(qr.space_id) ? "selected" : ""}>
              ${s.name || "Location"} - ${s.location || ""}
            </option>
          `).join("")}
        </select>
<label>Assign Existing Campaign</label>

<select name="campaign_id">
  <option value="">-- Select Campaign --</option>

  ${campaigns.rows.map(c => `
    <option value="${c.id}">
      ${c.name}
    </option>
  `).join("")}
</select>
        <button class="btn" type="submit">
          Save QR
        </button>
      </form>
    </div>
  `));
});
app.post("/admin/edit-qr/:qrId", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
const { name, space_id, campaign_id } = req.body;
    const result = await q(
      isSuperAdmin
        ? `
          UPDATE qr_codes
          SET
            name = $1,
            space_id = $2
          WHERE id = $3
          RETURNING id
        `
        : `
          UPDATE qr_codes
          SET
            name = $1,
            space_id = $2
          WHERE id = $3
          AND EXISTS (
            SELECT 1
            FROM spaces s
            WHERE s.id = $2
            AND s.user_id = $4
          )
          RETURNING id
        `,
      isSuperAdmin
        ? [
            req.body.name || "",
            Number(req.body.space_id),
            req.params.qrId
          ]
        : [
            req.body.name || "",
            Number(req.body.space_id),
            req.params.qrId,
            currentUser.id
          ]
    );

    if (!result.rows[0]) {
  return res.send("QR not found or access denied");
}

if (req.body.campaign_id) {
await q(
  `DELETE FROM qr_campaigns
   WHERE qr_id = $1
     AND campaign_id = $2`,
  [req.params.qrId, req.body.campaign_id]
);

await q(
  `INSERT INTO qr_campaigns (qr_id, campaign_id, is_active, assigned_at)
   VALUES ($1, $2, true, NOW())`,
  [req.params.qrId, req.body.campaign_id]
);
}

res.send(
  "QR updated <br><a href='/my-setup'>Back to My Setup</a>"
);

  } catch (err) {
    res.send("EDIT QR ERROR: " + err.message);
  }
});
app.get("/admin/import-qr", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const spaces = await q(
      isSuperAdmin
        ? `
          SELECT *
          FROM spaces
          ORDER BY name
        `
        : `
          SELECT *
          FROM spaces
          WHERE user_id = $1
          ORDER BY name
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    let locationOptions = "";

    for (const s of spaces.rows) {
      locationOptions += `
        <option value="${s.id}">
          ${s.name}
        </option>
      `;
    }

    res.send(page("Import QR", `
     <div class="topbar">
  <div class="brand">Vivid Spots</div>
  <h1>
    Create Tracking QR from Existing URL
    <a class="btn secondary"
       href="#"
       onclick="const p=document.getElementById('importHelpPanel'); if(p){p.style.display=p.style.display==='none'?'block':'none';} return false;"
       style="margin-left:15px;font-size:14px;">
       Help
    </a>
  </h1>
</div>

<div class="wrap">

  <div id="importHelpPanel" style="display:none;background:#fff;padding:20px;margin-bottom:20px;border-radius:10px;">
    <h3>How Import Existing QR Works</h3>

    <p>Already have a QR code in use? Enter the destination URL and Vivid will create a trackable version for analytics and reporting.</p>

    <ol>
      <li>Enter a QR Name.</li>
      <li>Select the Location.</li>
      <li>Enter the Existing Destination URL.</li>
      <li>Click Import Existing QR.</li>
      <li>Download and use the new Vivid-tracked QR going forward.</li>
    </ol>

    <p><strong>Important:</strong> Existing printed QR codes cannot be tracked unless they point to a Vivid tracking URL.</p>
  </div>

  <div class="card" style="max-width:700px;">
    <form method="POST" action="/admin/import-qr">

      <label>QR Name</label>
      <input name="name" required />

      <label>Location</label>
      <select name="space_id">
        ${locationOptions}
      </select>

      <label>Existing Destination URL</label>
      <input
        name="destination_url"
        placeholder="https://example.com"
        required
      />
<label>Annual QR Cost</label>
<input name="annual_cost" type="number" value="800" />

<label>Annual Impressions</label>
<input name="annual_impressions" type="number" value="146000" />
      <button class="btn" type="submit">Create Tracking QR</button>

    </form>
  </div>

</div>
    `));

  } catch (err) {
    res.send("IMPORT QR PAGE ERROR: " + err.message);
  }
});
app.get("/admin/new-qr", async (req, res) => {
  const isSuperAdmin =
  req.session.user.role === "super_admin";
  
  const spaces = await q(
  isSuperAdmin
    ? `
      SELECT *
      FROM spaces
      ORDER BY id
    `
    : `
      SELECT *
      FROM spaces
      WHERE user_id = $1
      ORDER BY id
    `,
  isSuperAdmin ? [] : [req.session.user.id]
);;
res.send(page("Add QR", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add QR Code</h1></div><div class="wrap"><form method="POST" action="/admin/new-qr"><label>Select Location</label><select name="space_id">${spaces.rows.map(s => `<option value="${s.id}">${s.name} (${s.location})</option>`).join("")}</select><label>QR Name</label><input name="name" placeholder="Car Line QR" /><label>Description</label><input name="description" /><label>Annual QR Cost ($)</label><input type="number" name="annual_cost" value="800" /><label>Annual Impressions</label><input type="number" name="annual_impressions" value="146000" /><button class="btn" type="submit">Create QR</button></form></div>`));
});
  app.post("/admin/import-qr", requireLogin, async (req, res) => {
  try {

    const result = await q(
      `
     INSERT INTO qr_codes (
  space_id,
  name,
  description,
  annual_cost,
  annual_impressions
)
VALUES ($1,$2,$3,$4,$5)
RETURNING * 
      `,
    [
  Number(req.body.space_id),
  req.body.name,
  req.body.destination_url,
  Number(req.body.annual_cost || 800),
  Number(req.body.annual_impressions || 146000)
]  
    );

    const qr = result.rows[0];

res.send(`
  <div style="max-width:720px;margin:40px auto;padding:28px;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.08);font-family:Arial,sans-serif;color:#003c2f;">
    <h2 style="margin-top:0;">✅ QR Imported Successfully</h2>

    <p>Your existing QR has been added to Vivid tracking.</p>

    <p>
      <strong>Tracking URL:</strong><br>
      ${process.env.BASE_URL || ""}/r/${qr.id}
    </p>

    <p>
      <strong>Next Recommended Step:</strong><br>
      Create a campaign for this QR code.
    </p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;">
      <a href="/admin/new-campaign" style="background:#2f855a;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Create Campaign</a>
      <a href="/my-setup" style="background:#eef5f0;color:#003c2f;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Back to My Setup</a>
    </div>
  </div>
`);
  } catch (err) {
    res.send("IMPORT QR ERROR: " + err.message);
  }
});
app.post("/admin/new-qr", async (req, res) => {
  try {
 const newQr = await q(`
  INSERT INTO qr_codes (
    space_id,
    name,
    description
  )
  VALUES ($1,$2,$3)
  RETURNING id
`, [
  Number(req.body.space_id),
  req.body.name || "",
  req.body.description || ""
]);

const qrId = newQr.rows[0].id;

res.send(successPage(
  "QR Code Created Successfully",
  "Your QR code has been created and is ready to track scans.",
  "Create a campaign for this QR code.",
  [
    { label: "Create Campaign", href: "/admin/new-campaign" },
    { label: "Download QR Code", href: "/qr/" + qrId + ".png", target: "_blank" },
{ label: "Preview QR Destination", href: "/r/" + qrId, target: "_blank" },
    { label: "Back to My Setup", href: "/my-setup" }
  ]
));
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/admin/archive-campaign/:campaignId", requireLogin, async (req, res) => {
  try {
    const result = await q(`
      UPDATE campaigns
      SET is_archived = true
      WHERE id = $1
      RETURNING *
    `, [req.params.campaignId]);

    if (result.rows.length === 0) {
      return res.send("ARCHIVE ERROR: Campaign not found");
    }

    res.redirect("/admin/archived-campaigns");
  } catch (err) {
    res.send("ARCHIVE ERROR: " + err.message);
  }
});
app.get("/admin/archive-location/:locationId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE spaces
      SET is_archived = true
      WHERE id = $1
    `, [req.params.locationId]);

    res.redirect("/my-setup");
  } catch (err) {
    res.send("ARCHIVE LOCATION ERROR: " + err.message);
  }
});
app.get("/admin/archive-qr/:qrId", requireLogin, async (req, res) => {
  try {

    const result = await q(`
      UPDATE qr_codes
      SET is_archived = true
      WHERE id = $1
      RETURNING *
    `, [req.params.qrId]);

    if (result.rows.length === 0) {
      return res.send("ARCHIVE ERROR: QR Code not found");
    }

    res.redirect("/my-setup");

  } catch (err) {
    res.send("ARCHIVE QR ERROR: " + err.message);
  }
});
app.get("/admin/archive-assignment/:assignmentId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE qr_campaigns
      SET is_active = false,
          ended_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.params.assignmentId]);

    res.redirect("/my-setup");

  } catch (err) {
    console.error("ARCHIVE ASSIGNMENT ERROR:", err);
    res.status(500).send("Archive assignment failed");
  }
});


app.get("/admin/archived-campaigns", requireLogin, async (req, res) => {
  try {
const campaigns = await q(`
SELECT *
FROM campaigns
WHERE COALESCE(is_archived,false) = true
AND user_id = $1
ORDER BY id DESC
`, [req.session.user.id]);

const archivedSchedules = await q(`
  SELECT
    cs.*,
    qr.name AS qr_name,
    c.name AS campaign_name
  FROM campaign_schedules cs
  LEFT JOIN qr_codes qr ON qr.id = cs.qr_id
  LEFT JOIN campaigns c ON c.id = cs.campaign_id
  WHERE cs.is_active = false
  ORDER BY cs.id DESC
`);
const archivedQrs = await q(
  `
  SELECT
    qr.*,
    s.name AS location_name
  FROM qr_codes qr
  LEFT JOIN spaces s ON s.id = qr.space_id
  WHERE COALESCE(qr.is_archived,false) = true
  AND s.user_id = $1
  ORDER BY qr.id DESC
  `,
  [req.session.user.id]
);
   const archivedLocations = await q(`
  SELECT *
  FROM spaces
  WHERE COALESCE(is_archived,false) = true
  ORDER BY id DESC
`); 
    res.send(page("Archive Center", `

<div class="topbar">
  <div class="brand">Vivid Spots</div>
  <h1>Archive Center</h1>
</div>

<div class="card">

  <div style="margin-bottom:20px;">
    <a class="btn secondary" href="/admin">← Back to Admin</a>
    <a class="btn secondary" href="/admin/ai-insights">AI Insights</a>
  </div>
<h2>Archived Campaigns</h2>
  <table class="table">
    <tr>
  <th>ID</th>
  <th>Name</th>
  <th>Advertiser</th>
  <th>Status</th>
  <th>Action</th>
</tr>

    ${campaigns.rows.map(c => `
      <tr>
        <td>${c.id}</td>
<td>${c.advertiser || ""}</td>
<td>${c.name || ""}</td>

<td>
  ${
    c.is_archived
      ? '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Archived</span>'
      : '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Active</span>'
  }
</td>

<td>
          <a class="btn secondary"
             href="/admin/restore-campaign/${c.id}">
             Restore
          </a>
        </td>
      </tr>
    `).join("")}

  </table>
<h2>Archived Schedules</h2>

<table class="table">
<tr>
  <th>QR Code</th>
  <th>Campaign</th>
  <th>Start</th>
  <th>End</th>
  <th>Status</th>
  <th>Action</th>
</tr>

${archivedSchedules.rows.map(s => `
<tr>
  <td>${s.qr_name || ""}</td>
  <td>${s.campaign_name || ""}</td>
  <td>${s.start_time || ""}</td>
  <td>${s.end_time || ""}</td>
  <td>
    <span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">
      Archived
    </span>
  </td>
  <td>
    <a class="btn" href="/admin/restore-schedule/${s.id}">
      Restore
    </a>
  </td>
</tr>
`).join("")}
</table>
<h2>Archived QR Codes</h2>

<table class="table">
<tr>
  <th>ID</th>
  <th>Name</th>
  <th>Location</th>
  <th>Status</th>
  <th>Action</th>
</tr>

${archivedQrs.rows.map(qr => `
<tr>
  <td>${qr.id}</td>
  <td>${qr.name || ""}</td>
  <td>${qr.location_name || ""}</td>
  <td>
    <span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">
      Archived
    </span>
  </td>
  <td>
    <a class="btn secondary" href="/admin/restore-qr/${qr.id}">
      Restore
    </a>
  </td>
</tr>
`).join("")}

</table>
<h2>Archived Locations</h2>

<table class="table">
<tr>
  <th>ID</th>
  <th>Name</th>
  <th>Market</th>
  <th>Impressions</th>
  <th>Placement Cost</th>
  <th>Status</th>
  <th>Action</th>
</tr>

${archivedLocations.rows.map(l => `
<tr>
  <td>${l.id}</td>
  <td>${l.name || ""}</td>
  <td>${l.location || ""}</td>
  <td>${l.annual_impressions || 0}</td>
  <td>${money(l.placement_cost || 0)}</td>
  <td>
    <span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">
      Archived
    </span>
  </td>
  <td>
    <a class="btn secondary" href="/admin/restore-location/${l.id}">
      Restore
    </a>
  </td>
</tr>
`).join("")}
</table>
</div>

`));


  } catch (err) {
    console.error("ARCHIVED CAMPAIGNS ERROR:", err);
    res.status(500).send(err.message);
  }
});
app.get("/admin/ai-insights", requireLogin, async (req, res) => {
  try {
const { startDate, endDate } = req.query;
    let where = [];
let params = [];
const currentUser = req.session.user;
const isSuperAdmin = currentUser.role === "super_admin";

if (!isSuperAdmin) {
  params.push(currentUser.id);
  where.push(`c.user_id = $${params.length}`);
}
if (startDate) {
  params.push(startDate);
  where.push(`e.created_at >= $${params.length}`);
}

if (endDate) {
  params.push(endDate);
  where.push(`e.created_at <= $${params.length}`);
}
if (!isSuperAdmin) {
  where.push(`c.user_id = $${params.length + 1}`);
  params.push(currentUser.id);
}
const whereSql = where.length
  ? `WHERE ${where.join(" AND ")}`
  : "";
    const summary = await q(`
  SELECT
    COUNT(*) AS total_events,
    COUNT(DISTINCT e.campaign_id) AS active_campaigns,
    COUNT(*) FILTER (WHERE e.type = 'scan') AS scans,
    COUNT(*) FILTER (WHERE e.type = 'offer') AS offer_clicks,
    COUNT(*) FILTER (WHERE e.type = 'maps') AS map_clicks
  FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
${whereSql}
`, params);
    const totalEvents = Number(summary.rows[0]?.total_events || 0);
const activeCampaigns = Number(summary.rows[0]?.active_campaigns || 0);
const scans = Number(summary.rows[0]?.scans || 0);
const offerClicks = Number(summary.rows[0]?.offer_clicks || 0);
const mapClicks = Number(summary.rows[0]?.map_clicks || 0);

const engagementRate =
  totalEvents > 0
    ? ((scans / totalEvents) * 100).toFixed(2) + "%"
    : "0.00%";
    const topCampaign = await q(`
      SELECT
        c.name,
        c.advertiser,
        COUNT(*) AS total_events
      FROM events e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      ${whereSql}
      GROUP BY c.name, c.advertiser
      ORDER BY total_events DESC
      LIMIT 1
    `, params);

    const topStore = await q(`
      SELECT
        st.name,
        COUNT(*) AS total_events
      FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
LEFT JOIN stores st ON st.id = e.store_id
${whereSql}
${whereSql ? "AND" : "WHERE"} st.name IS NOT NULL
GROUP BY st.name
      ORDER BY total_events DESC
      LIMIT 1
    `, params);

    const lowCampaign = await q(`
      SELECT
        c.name,
        COUNT(*) AS total_events
      FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
${whereSql}
${whereSql ? "AND" : "WHERE"} c.name IS NOT NULL
GROUP BY c.name
      ORDER BY total_events ASC
      LIMIT 1
    `, params);

    res.send(page("AI Insights", `

      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>AI Insights</h1>
      </div>
<form method="GET" style="margin-bottom:24px;display:flex;gap:12px;align-items:end;flex-wrap:wrap;">

  <div>
    <label>Start Date</label><br>
    <input type="date" name="startDate" value="${startDate || ""}">
  </div>

  <div>
    <label>End Date</label><br>
    <input type="date" name="endDate" value="${endDate || ""}">
  </div>

  <div>
    <button class="btn" type="submit">
      Apply Filter
    </button>
  </div>

</form>
      

<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin:20px 0;">

  <div class="card" style="min-height:90px;">
    <div class="label">Total Events</div>
    <div class="num">${totalEvents}</div>
  </div>

  <div class="card" style="min-height:90px;">
    <div class="label">Active Campaigns</div>
    <div class="num">${activeCampaigns}</div>
  </div>

  <div class="card" style="min-height:90px;">
    <div class="label">Scans</div>
    <div class="num">${scans}</div>
  </div>

  <div class="card" style="min-height:90px;">
    <div class="label">Offer Clicks</div>
    <div class="num">${offerClicks}</div>
  </div>

  <div class="card" style="min-height:90px;">
    <div class="label">Engagement Rate</div>
    <div class="num">${engagementRate}</div>
  </div>

</div>
  
  </div>
<div style="
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
  gap:20px;
  margin-top:12px;
">
</div>
<div style="
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
  gap:20px;
  margin-top:12px;
">
        <div class="card">
          <h3>🏆 Top Performing Campaign</h3>
          <p><strong>${topCampaign.rows[0]?.name || "N/A"}</strong></p>
          <p>${topCampaign.rows[0]?.advertiser || ""}</p>
          <p>Total Events: ${topCampaign.rows[0]?.total_events || 0}</p>
          <p>
  ${
    Number(topCampaign.rows[0]?.total_events || 0) > 100
      ? '🟢 Excellent Health'
      : Number(topCampaign.rows[0]?.total_events || 0) > 50
      ? '🔵 Healthy'
      : Number(topCampaign.rows[0]?.total_events || 0) > 10
      ? '🟡 Warning'
      : '🔴 Critical'
  }
</p>

 
        </div>

        <div class="card">
          <h3>🏫 Best Performing Store/School</h3>
          <p><strong>${topStore.rows[0]?.name || "N/A"}</strong></p>
          <p>Total Events: ${topStore.rows[0]?.total_events || 0}</p>
          <p>
  <span style="background:#dbeafe;color:#1d4ed8;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:bold;">
    ⭐ Top Location
  </span>
</p>
        </div>

        <div class="card">
          <h3>⚠ Campaign Needing Attention</h3>
          <p><strong>${lowCampaign.rows[0]?.name || "N/A"}</strong></p>
          <p>Lowest event activity detected.</p>
          <p>
  <span style="background:#fee2e2;color:#991b1b;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:bold;">
    🔴 Needs Attention
  </span>
</p>
        </div>

      </div>
    <div class="card" style="margin-top:12px;">  
 <h3>⚡ AI Recommendations</h3>

  ${
    Number(lowCampaign.rows[0]?.total_events || 0) < 10
      ? `
        <p>
          Campaign <strong>${lowCampaign.rows[0]?.name || "Unknown"}</strong>
          is underperforming.
        </p>

        <p>
          Recommendation: rotate creative, update CTA,
          or move placement location.
        </p>
      `
      : `
        <p>
          Campaign performance appears stable.
        </p>
      `
  }

</div>
    `));

  } catch (err) {
    console.error("AI INSIGHTS ERROR:", err);
    res.status(500).send(err.message);
  }
});
app.post("/admin/edit-campaign/:campaignId", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const result = await q(
      isSuperAdmin
        ? `
          UPDATE campaigns
          SET
            advertiser = $1,
            name = $2,
            campaign_url = $3,
            avg_customer_value = $4,
            conversion_rate = $5
          WHERE id = $6
          RETURNING id
        `
        : `
          UPDATE campaigns
          SET
            advertiser = $1,
            name = $2,
            campaign_url = $3,
            avg_customer_value = $4,
            conversion_rate = $5
          WHERE id = $6
          AND user_id = $7
          RETURNING id
        `,
      isSuperAdmin
        ? [
            req.body.advertiser || "",
            req.body.name || "",
            req.body.campaign_url || "",
            Number(req.body.avg_customer_value || 50),
            Number(req.body.conversion_rate || 10),
            req.params.campaignId
          ]
        : [
            req.body.advertiser || "",
            req.body.name || "",
            req.body.campaign_url || "",
            Number(req.body.avg_customer_value || 50),
            Number(req.body.conversion_rate || 10),
            req.params.campaignId,
            currentUser.id
          ]
    );

    if (!result.rows[0]) {
      return res.send("Campaign not found or access denied");
    }
if (!result.rows[0]) {
  return res.send("Campaign not found or access denied");
}

const qrId = req.body.qr_ids;

if (qrId) {



  await q(
    `
    INSERT INTO qr_campaigns (
      qr_id,
      campaign_id,
      is_active,
      assigned_at,
      started_at,
      ended_at
    )
    VALUES ($1, $2, true, NOW(), NOW(), NULL)
    `,
    [Number(qrId), Number(req.params.campaignId)]
  );
}

    res.send("Campaign updated <br><a href='/dashboard'>Back to Dashboard</a>");
  } catch (err) {
    res.send("EDIT CAMPAIGN ERROR: " + err.message);
  }
});
app.get("/admin/restore-campaign/:campaignId", requireLogin, async (req, res) => {
  try {

  await q(`
  UPDATE campaigns
  SET is_archived = false
  WHERE id = $1
`, [req.params.campaignId]);

    res.redirect("/my-setup");

  } catch (err) {
    res.send("RESTORE ERROR: " + err.message);
  }
});
app.get("/admin/restore-schedule/:scheduleId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE campaign_schedules
      SET is_active = true
      WHERE id = $1
    `, [req.params.scheduleId]);

    res.redirect("/admin/archived-campaigns");
  } catch (err) {
    res.send("RESTORE SCHEDULE ERROR: " + err.message);
  }
});
app.get("/admin/restore-qr/:qrId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE qr_codes
      SET is_archived = false
      WHERE id = $1
    `, [req.params.qrId]);

    res.redirect("/admin/archived-campaigns");
  } catch (err) {
    res.send("RESTORE QR ERROR: " + err.message);
  }
});
app.get("/admin/restore-location/:locationId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE spaces
      SET is_archived = false
      WHERE id = $1
    `, [req.params.locationId]);

    res.redirect("/admin/archived-campaigns");
  } catch (err) {
    res.send("RESTORE LOCATION ERROR: " + err.message);
  }
});
app.get("/admin/edit-campaign/:campaignId", requireLogin, async (req, res) => {
  const currentUser = req.session.user;
  const isSuperAdmin = currentUser.role === "super_admin";

  const result = await q(
    isSuperAdmin
      ? `SELECT * FROM campaigns WHERE id = $1`
      : `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`,
    isSuperAdmin
      ? [req.params.campaignId]
      : [req.params.campaignId, currentUser.id]
  );

  const c = result.rows[0];

  if (!c) {
    return res.send("Campaign not found or access denied");
  }
const qrs = await q(
`
SELECT qr.id, qr.name
FROM qr_codes qr
JOIN spaces s ON s.id = qr.space_id
WHERE s.user_id = $1
AND COALESCE(qr.is_archived,false) = false
AND COALESCE(s.is_archived,false) = false
ORDER BY qr.name
`,
[currentUser.id]
);

const assignedQrs = await q(
  `
  SELECT qr_id
  FROM qr_campaigns
  WHERE campaign_id = $1
  AND COALESCE(is_active,true) = true
  `,
  [req.params.campaignId]
);

const assignedQrIds = new Set(assignedQrs.rows.map(r => String(r.qr_id)));
  res.send(page("Edit Campaign", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit Campaign</h1>
      <p class="subtitle">${c.advertiser || ""} - ${c.name || ""}</p>
    </div>

    <div class="wrap">
      <form method="POST" action="/admin/edit-campaign/${c.id}">
        <label>Advertiser</label>
        <input name="advertiser" value="${c.advertiser || ""}" />

        <label>Campaign Name</label>
        <input name="name" value="${c.name || ""}" />

        <label>Campaign URL</label>
        <input name="campaign_url" value="${c.campaign_url || ""}" />

        <label>Avg Customer Value</label>
        <input name="avg_customer_value" value="${c.avg_customer_value || 50}" />
<div style="font-size:12px;color:#666;margin-top:4px;margin-bottom:10px;">
  Average customer value used to estimate campaign revenue.
</div>
        <label>Conversion Rate (%)</label>
        <input name="conversion_rate" value="${c.conversion_rate || 10}" />
<label>Assign to QR Codes</label>

<select name="qr_ids">
  <option value="">-- Select QR Code --</option>
  ${qrs.rows.map(qr => `
    <option value="${qr.id}" ${assignedQrIds.has(String(qr.id)) ? "selected" : ""}>
      ${qr.name}
    </option>
  `).join("")}
</select>
        <button class="btn" type="submit">Save Campaign</button>
      </form>
    </div>
  `));
});
app.get("/admin/new-campaign", async (req, res) => {
  const users = await q(`
  SELECT id, email
  FROM users
  WHERE role = 'customer'
  ORDER BY email
`);

  res.send(page("New Campaign", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Create Campaign</h1></div><div class="wrap"><form method="POST" action="/admin/new-campaign">
<div class="formgrid">
  
${req.session.user.role === "super_admin" ? `
  <div>
    
    <select name="user_id">
      ${users.rows.map(u => `
        <option value="${u.id}">
          ${u.email}
        </option>
      `).join("")}
    </select>
  </div>
` : `
  <input type="hidden" name="user_id" value="${req.session.user.id}">
`}
<div>
  <label>Advertiser</label>
  <input name="advertiser" value="Pepsi" />
</div><div><label>Campaign Name</label><input name="name" value="Low Inventory Store Push" /></div><div><label>Campaign URL</label><input name="campaign_url" value="https://www.pepsi.com" /></div><div><label>Avg Customer Value</label><input name="avg_customer_value" value="35" /></div><div><label>Conversion Rate (%)</label><input name="conversion_rate" value="10" /></div></div><label><input type="checkbox" name="is_deal_of_day" style="width:auto" /> Deal of the Day</label><br><br><button class="btn" type="submit">Create Campaign</button></form></div>`));
});

app.post("/admin/new-campaign", requireLogin, async (req, res) => {
  try {
const userId =
  req.session.user.role === "super_admin"
    ? Number(req.body.user_id)
    : req.session.user.id;
    await q(`
      INSERT INTO campaigns (
        name,
        advertiser,
        campaign_url,
        avg_customer_value,
        conversion_rate,
        is_deal_of_day,
        user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [
      req.body.name || "",
      req.body.advertiser || "",
      req.body.campaign_url || "",
      Number(req.body.avg_customer_value || 50),
      Number(req.body.conversion_rate || 10),
      req.body.is_deal_of_day === "on",
      userId
    ]);

    res.send(successPage(
  "Campaign Created Successfully",
  "Your campaign has been saved.",
  "Assign this campaign to a QR code.",
  [
    { label: "Assign Campaign", href: "/admin/assign" },
    { label: "Back to My Setup", href: "/my-setup" },
    { label: "Dashboard", href: "/dashboard" }
  ]
));

  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

app.get("/admin/new-store", async (req, res) => {
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  res.send(page("New Store", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add Store / Inventory Target</h1></div><div class="wrap"><form method="POST" action="/admin/new-store"><label>Store Name</label><input name="name" required /><label>Address / Market</label><input name="address" placeholder="Naples FL" /><label>Google Maps URL</label><input name="maps_url" /><label>Waze URL</label><input name="waze_url" /><label>Inventory Priority (0-100)</label><input name="inventory_priority" type="number" value="50" /><label>Units On Hand</label><input name="inventory_units" type="number" value="0" /><label>Days On Hand</label><input name="days_on_hand" type="number" value="0" /><label>Velocity</label><input name="inventory_velocity" type="number" value="0" /><label>Inventory Note</label><input name="inventory_note" /><label>Attach to Campaign</label><h3>Campaign Slot 1</h3>

<select name="campaign_id_1">
  ${campaigns.rows.map(c => `
    <option value="${c.id}">
      ${c.advertiser} - ${c.name}
    </option>
  `).join("")}
</select>

<input name="start_time_1" value="07:00" />
<input name="end_time_1" value="10:00" />

<hr>

<h3>Campaign Slot 2</h3>

<select name="campaign_id_2">
  ${campaigns.rows.map(c => `
    <option value="${c.id}">
      ${c.advertiser} - ${c.name}
    </option>
  `).join("")}
</select>

<input name="start_time_2" value="10:00" />
<input name="end_time_2" value="14:00" />

<hr>

<h3>Campaign Slot 3</h3>

<select name="campaign_id_3">
  ${campaigns.rows.map(c => `
    <option value="${c.id}">
      ${c.advertiser} - ${c.name}
    </option>
  `).join("")}
</select>

<input name="start_time_3" value="14:00" />
<input name="end_time_3" value="18:00" />${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select><button class="btn" type="submit">Create Store</button></form></div>`));
});
app.post("/admin/new-store", async (req, res) => {
  try {
    const store = await q(`INSERT INTO stores (name,address,maps_url,waze_url,inventory_priority,inventory_units,days_on_hand,inventory_velocity,inventory_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [req.body.name, req.body.address, req.body.maps_url, req.body.waze_url, Number(req.body.inventory_priority || 50), Number(req.body.inventory_units || 0), Number(req.body.days_on_hand || 0), Number(req.body.inventory_velocity || 0), req.body.inventory_note]);
    await q(`INSERT INTO campaign_stores (campaign_id,store_id,weight,is_active) VALUES ($1,$2,50,true)`, [Number(req.body.campaign_id), store.rows[0].id]);
    res.send("✅ Store created and attached <br><a href='/dashboard'>Dashboard</a>");
  } catch (err) { res.send("ERROR: " + err.message); }
});

app.get("/admin/edit-store/:storeId", async (req, res) => {
  const store = await q(`SELECT * FROM stores WHERE id=$1`, [req.params.storeId]);
  const s = store.rows[0];
  if (!s) return res.status(404).send("Store not found");
  res.send(page("Edit Store", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Edit Store / Inventory</h1><p class="subtitle">${s.name || ""}</p></div><div class="wrap"><a class="btn" href="/admin">Back</a><form method="POST" action="/admin/edit-store/${s.id}"><label>Store Name</label><input name="name" value="${s.name || ""}" /><label>Address / Market</label><input name="address" value="${s.address || ""}" /><label>Google Maps URL</label><input name="maps_url" value="${s.maps_url || ""}" /><label>Waze URL</label><input name="waze_url" value="${s.waze_url || ""}" /><label>Inventory Priority</label><input name="inventory_priority" type="number" value="${s.inventory_priority || 0}" /><label>Units On Hand</label><input name="inventory_units" type="number" value="${s.inventory_units || 0}" /><label>Days On Hand</label><input name="days_on_hand" type="number" value="${s.days_on_hand || 0}" /><label>Velocity</label><input name="inventory_velocity" type="number" value="${s.inventory_velocity || 0}" /><label>Inventory Note</label><input name="inventory_note" value="${s.inventory_note || ""}" /><button class="btn" type="submit">Save Store</button></form></div>`));
});
app.post("/admin/edit-store/:storeId", async (req, res) => {
  try {
    await q(`UPDATE stores SET name=$1,address=$2,maps_url=$3,waze_url=$4,inventory_priority=$5,inventory_units=$6,days_on_hand=$7,inventory_velocity=$8,inventory_note=$9 WHERE id=$10`, [req.body.name, req.body.address, req.body.maps_url, req.body.waze_url, Number(req.body.inventory_priority || 0), Number(req.body.inventory_units || 0), Number(req.body.days_on_hand || 0), Number(req.body.inventory_velocity || 0), req.body.inventory_note, req.params.storeId]);
    res.send("✅ Store updated <br><a href='/admin'>Back to Admin</a> | <a href='/dashboard'>Dashboard</a>");
  } catch (err) { res.send("ERROR: " + err.message); }
});
app.get("/admin/bulk-schedule", requireLogin, async (req, res) => {

  const qrs = await q(`
    SELECT *
    FROM qr_codes
    ORDER BY id
  `);

 const userId =
  req.session.user.role === "super_admin"
    ? null
    : req.session.user.id;

const campaigns = await q(
  `
  SELECT *
  FROM campaigns
  WHERE is_archived = false
  ${userId ? "AND user_id = $1" : ""}
  ORDER BY id
  `,
  userId ? [userId] : []
);

  res.send(page("Bulk Schedule", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Bulk Campaign Scheduler</h1>
      <p class="subtitle">
        Add multiple campaigns to one QR
      </p>
    </div>

    <div class="wrap">

      <form method="POST" action="/admin/bulk-schedule">

        <label>QR Code</label>

        <select name="qr_id">

          ${qrs.rows.map(qr => `
            <option value="${qr.id}">
              ${qr.id} - ${qr.name}
            </option>
          `).join("")}

        </select>

        <hr>

        <h3>Campaign Slot 1</h3>

        <select name="campaign_id_1">

          ${campaigns.rows.map(c => `
            <option value="${c.id}">
              ${c.advertiser} - ${c.name}
            </option>
          `).join("")}

        </select>

        <input name="start_time_1" value="07:00" />
        <input name="end_time_1" value="10:00" />

        <hr>

        <h3>Campaign Slot 2</h3>

        <select name="campaign_id_2">

          ${campaigns.rows.map(c => `
            <option value="${c.id}">
              ${c.advertiser} - ${c.name}
            </option>
          `).join("")}

        </select>

        <input name="start_time_2" value="10:00" />
        <input name="end_time_2" value="14:00" />

        <hr>

        <h3>Campaign Slot 3</h3>

        <select name="campaign_id_3">

          ${campaigns.rows.map(c => `
            <option value="${c.id}">
              ${c.advertiser} - ${c.name}
            </option>
          `).join("")}

        </select>

        <input name="start_time_3" value="14:00" />
        <input name="end_time_3" value="18:00" />

        <br><br>
<input type="hidden" name="days_of_week" id="days_of_week_hidden">
        <button class="btn" type="submit">
          Schedule Campaigns
        </button>

      </form>

    </div>
  `));

});
app.post("/admin/bulk-schedule", requireLogin, async (req, res) => {
  try {
    for (let i = 1; i <= 3; i++) {
      const campaignId = req.body[`campaign_id_${i}`];
      const startTime = req.body[`start_time_${i}`];
      const endTime = req.body[`end_time_${i}`];

      if (campaignId && startTime && endTime) {
        await q(`
          INSERT INTO campaign_schedules (
            qr_id,
            campaign_id,
            days_of_week,
            start_time,
            end_time,
            priority,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,$6,true)
        `, [
          Number(req.body.qr_id),
          Number(campaignId),
          0,
          startTime,
          endTime,
          110 - (i * 10)
        ]);
      }
    }

    res.send(
      "Bulk campaigns scheduled <br><a href='/admin/schedule'>View Schedule</a> | <a href='/r/" +
      req.body.qr_id +
      "'>Test QR</a>"
    );
  } catch (err) {
    res.send("BULK SCHEDULE ERROR: " + err.message);
  }
});
app.get("/admin/edit-schedule/:id", requireLogin, async (req, res) => {
  const schedule = await q(
    `SELECT * FROM campaign_schedules WHERE id = $1`,
    [req.params.id]
  );

  const campaigns = await q(
    `SELECT * FROM campaigns ORDER BY advertiser, name`
  );

  res.send(page("Edit Schedule", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit Schedule</h1>
    </div>

    <div class="wrap">
      <form method="POST">
        <label>Campaign</label>

        <select name="campaign_id">
          ${campaigns.rows.map(c => `
            <option value="${c.id}"
              ${c.id == schedule.rows[0].campaign_id ? "selected" : ""}>
              ${c.advertiser} - ${c.name}
            </option>
          `).join("")}
        </select>

        <label>Start Time</label>
        <input type="time"
          name="start_time"
          value="${schedule.rows[0].start_time || ""}" />

        <label>End Time</label>
        <input type="time"
          name="end_time"
          value="${schedule.rows[0].end_time || ""}" />

        <label>Priority</label>
        <input type="number"
          name="priority"
          value="${schedule.rows[0].priority || 100}" />

        <button type="submit">
          Save Changes
        </button>
      </form>
    </div>
  `));
});
app.post("/admin/edit-schedule/:id", requireLogin, async (req, res) => {
  const {
    campaign_id,
    start_time,
    end_time,
    priority
  } = req.body;
const currentSchedule = await q(
  `
  SELECT qr_id
  FROM campaign_schedules
  WHERE id = $1
  `,
  [req.params.id]
);

const qrId = currentSchedule.rows[0]?.qr_id;

const conflict = await q(
  `
  SELECT cs.*, c.name AS campaign_name
  FROM campaign_schedules cs
  LEFT JOIN campaigns c
    ON c.id = cs.campaign_id
  WHERE cs.qr_id = $1
    AND cs.id != $2
    AND cs.is_active = true
    AND $3::time < cs.end_time::time
    AND $4::time > cs.start_time::time
  `,
  [
    qrId,
    req.params.id,
    start_time,
    end_time
  ]
);

if (conflict.rows.length > 0) {
  const c = conflict.rows[0];

  return res.send(page("Schedule Conflict", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Schedule Conflict</h1>
    </div>

    <div class="wrap">
      <div class="card" style="max-width:700px;">
        <h2>This edit conflicts with another active schedule.</h2>

        <p>
          You tried:
          <br>
          <strong>${start_time} - ${end_time}</strong>
        </p>

        <p>
          Existing campaign:
          <br>
          <strong>${c.campaign_name || "Unnamed Campaign"}</strong>
        </p>

        <p>
          Existing time:
          <br>
          <strong>${c.start_time} - ${c.end_time}</strong>
        </p>

        <div class="note" style="margin:20px 0;">
          Choose a different time window, or deactivate/edit the existing schedule first.
        </div>

        <a class="btn" href="/admin/edit-schedule/${req.params.id}">
          Back to Edit
        </a>

        <a class="btn secondary" href="/admin/schedule">
          View Schedule
        </a>
      </div>
    </div>
  `));
}
  await q(
    `UPDATE campaign_schedules
     SET
       campaign_id = $1,
       start_time = $2,
       end_time = $3,
       priority = $4
     WHERE id = $5`,
    [
      campaign_id,
      start_time,
      end_time,
      priority,
      req.params.id
    ]
  );

  res.redirect("/admin/schedule");
});
app.get("/admin/deactivate-schedule/:scheduleId", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const result = await q(
      isSuperAdmin
        ? `
          UPDATE campaign_schedules
          SET is_active = false
          WHERE id = $1
          RETURNING id
        `
        : `
          UPDATE campaign_schedules cs
          SET is_active = false
          FROM qr_codes qr
          JOIN spaces s ON s.id = qr.space_id
          WHERE cs.id = $1
          AND qr.id = cs.qr_id
          AND s.user_id = $2
          RETURNING cs.id
        `,
      isSuperAdmin
        ? [req.params.scheduleId]
        : [req.params.scheduleId, currentUser.id]
    );

    if (!result.rows[0]) {
      return res.send(
  "Schedule not found or access denied. ID received: " +
  req.params.scheduleId +
  " User ID: " +
  currentUser.id +
  " Role: " +
  currentUser.role
);
    }

    res.redirect("/admin/schedule");

  } catch (err) {
    res.send("ARCHIVE SCHEDULE ERROR: " + err.message);
  }
});
app.get("/admin/schedule", async (req, res) => {
 const currentUser = req.session.user;
const isSuperAdmin = currentUser.role === "super_admin";
  const qrs = await q(
  isSuperAdmin
    ? `SELECT * FROM qr_codes ORDER BY id`
    : `
      SELECT qr.*
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE s.user_id = $1
      ORDER BY qr.id
    `,
  isSuperAdmin ? [] : [currentUser.id]
);

const campaigns = await q(
  isSuperAdmin
    ? `SELECT * FROM campaigns ORDER BY id`
    : `
      SELECT *
      FROM campaigns
      WHERE user_id = $1
      ORDER BY id
    `,
  isSuperAdmin ? [] : [currentUser.id]
);
 const schedules = await q(
  isSuperAdmin
    ? `
      SELECT
        cs.*,
        qr.name AS qr_name,
        c.name AS campaign_name,
        c.advertiser
      FROM campaign_schedules cs
      LEFT JOIN qr_codes qr ON qr.id = cs.qr_id
      LEFT JOIN campaigns c ON c.id = cs.campaign_id
      ORDER BY cs.id DESC
    `
    : `
      SELECT
        cs.*,
        qr.name AS qr_name,
        c.name AS campaign_name,
        c.advertiser
      FROM campaign_schedules cs
      LEFT JOIN qr_codes qr ON qr.id = cs.qr_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      LEFT JOIN campaigns c ON c.id = cs.campaign_id
      WHERE s.user_id = $1
      ORDER BY cs.id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);
 let activeScheduleHtml = "";

  new Date().toTimeString().slice(0, 5);
  const currentTime =
  new Date().toTimeString().slice(0, 8);
for (const s of schedules.rows) {

  activeScheduleHtml += `
    <tr>
      <td>${s.qr_name || ""}</td>
      <td>${s.campaign_name || ""}</td>
      <td>${s.start_time || ""}</td>
      <td>${s.end_time || ""}</td>
      <td>${s.is_active ? "Active" : "Inactive"}</td>
  <td>
  <form method="POST" action="/admin/archive-schedule/${s.id}" onsubmit="return confirm('Archive this schedule?')">
    <button type="submit" style="background:#6b7280;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">
      Archive
    </button>
  </form>
</td>
    </tr>
  `;
}
  res.send(page("Campaign Schedule", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Master QR Campaign Schedule</h1><p class="subtitle">Add multiple campaigns to one QR and rotate by day/time.</p></div><div class="wrap"><form id="scheduleForm" method="POST" action="/admin/schedule"><div class="formgrid"><div><label>Master QR</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select></div><div><label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select></div><div><div class="form-group">
  <label>Run Campaign On</label>

<div style="display:flex; flex-wrap:wrap; gap:12px 18px; margin-top:8px; align-items:center;">
  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" id="everydayToggle">
    Everyday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="0"> Sunday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="1"> Monday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="2"> Tuesday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="3"> Wednesday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="4"> Thursday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week-check" value="5"> Friday
  </label>

  <label style="display:flex; align-items:center; gap:6px;">
    <input type="checkbox" name="days_of_week_check" value="6"> Saturday
  </label>
</div>

</div></div><div><label>Start Time</label><input name="start_time" value="00:00" /></div><div><label>End Time</label><input name="end_time" value="23:59" /></div><div><label>Priority</label><input name="priority" type="number" value="100" /></div></div><button class="btn" type="submit">Add Campaign to Master QR</button></form><script>
const everydayToggle = document.getElementById("everydayToggle");
const dayCheckboxes = document.querySelectorAll('input[name="days_of_week_check"]');
if (everydayToggle) {
  everydayToggle.addEventListener("change", () => {
    dayCheckboxes.forEach(cb => cb.checked = everydayToggle.checked);
  });
}

dayCheckboxes.forEach(cb => {
  cb.addEventListener("change", () => {
    everydayToggle.checked = Array.from(dayCheckboxes).every(day => day.checked);
  });
});

function getSelectedDays() {
  return Array.from(dayCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value)
    .join(",");
}
const scheduleForm = document.getElementById("scheduleForm");

if (scheduleForm) {
  scheduleForm.addEventListener("submit", () => {
    const hidden = document.getElementById("days_of_week_hidden");

    if (hidden) {
      hidden.value = getSelectedDays();
    }
  });
}
</script><h2>Current Scheduled Campaigns</h2>
<div style="overflow-x:auto;padding-bottom:10px;">
<table style="min-width:1400px;width:auto;"><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th>
<th>Status</th>
<th>Action</th><tr>${schedules.rows.map(s => `<tr><td>${s.qr_name || s.qr_id}</td><td>${s.advertiser || ""}</td><td>${s.campaign_name || ""}</td><td>${dayLabels(s.days) || "Every Day"}</td><td>${s.start_time}</td><td>${s.end_time}</td><td>${s.priority}</td><td>
  
     
  ${
    s.is_active
      ? (
          currentTime >= s.start_time &&
          currentTime <= s.end_time
        )
          ? '<span style="color:#16a34a;font-weight:700;">ACTIVE NOW</span>'
          : 'Scheduled'
      : 'Inactive'
  }
</td> 
</td>
 
<td>
  <a href="/admin/edit-schedule/${s.id}">
    Edit
  </a>
&nbsp;|&nbsp;
  <a href="/admin/deactivate-schedule/${s.id}">
    ARCHIVE
  </a>
</td></tr>`).join("")}</table></div>`));
});


app.get("/admin/assign", requireLogin, async (req, res) => {
 const qrs = await q(
  req.session.user.role === "super_admin"
    ? `
      SELECT qr.*
      FROM qr_codes qr
      ORDER BY qr.id DESC
    `
    : `
      SELECT qr.*
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE s.user_id = $1
      ORDER BY qr.id DESC
    `,
  req.session.user.role === "super_admin" ? [] : [req.session.user.id]
);
  const campaigns = await q(
  req.session.user.role === "super_admin"
    ? `SELECT * FROM campaigns WHERE COALESCE(is_archived,false) = false ORDER BY id DESC`
    : `SELECT * FROM campaigns WHERE user_id = $1 AND COALESCE(is_archived,false) = false ORDER BY id DESC`,
  req.session.user.role === "super_admin" ? [] : [req.session.user.id]
);
  res.send(page("Assign Campaign", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Assign Campaign to QR</h1></div><div class="wrap"><form method="POST" action="/admin/assign"><label>QR Code</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select><label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select><button class="btn" type="submit">Assign Campaign</button></form></div>`));
});
app.post("/admin/assign", requireLogin, async (req, res) => {
  try {
  await q(`
  UPDATE qr_campaigns
  SET is_active = false,
      ended_at = CURRENT_TIMESTAMP
  WHERE qr_id = $1
    AND campaign_id = $2
`, [req.body.qr_id, req.body.campaign_id]);

    await q(`
      INSERT INTO qr_campaigns (
        qr_id,
        campaign_id,
        is_active,
        started_at
      )
      VALUES ($1,$2,true,CURRENT_TIMESTAMP)
    `, [
      Number(req.body.qr_id),
      Number(req.body.campaign_id)
    ]);

  res.send(successPage(
  "Campaign Assigned Successfully",
  "Your campaign has been connected to this QR code.",
  "Schedule when this campaign should run.",
  [
    { label: "Manage Schedules", href: "/admin/schedule" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Back to My Setup", href: "/my-setup" }
  ]
));
  } catch (err) {
    res.send("ASSIGN ERROR: " + err.message);
  }
});
app.post("/admin/schedule", requireLogin, async (req, res) => {
  try {
const selectedDays = Array.isArray(req.body.days_of_week_check)
  ? req.body.days_of_week_check.join(",")
  : (req.body.days_of_week_check || req.body.days_of_week || "");
    const overlap = await q(
  `
  SELECT *
  FROM campaign_schedules
  WHERE qr_id = $1
  AND is_active = true
  AND (
  days_of_week IS NULL
  OR days_of_week = ''
  OR $4 = ''
  OR EXISTS (
    SELECT 1
    FROM unnest(string_to_array(days_of_week, ',')) existing_day
    WHERE existing_day = ANY(string_to_array($4, ','))
  )
)
AND (
  ($2::time BETWEEN start_time::time AND end_time::time)
  OR
  ($3::time BETWEEN start_time::time AND end_time::time)
  OR
  (start_time::time BETWEEN $2::time AND $3::time)
)
  `,
 [
  Number(req.body.qr_id),
  req.body.start_time,
  req.body.end_time,
  selectedDays
]
);

if (overlap.rows.length > 0) {
  const conflict = overlap.rows[0];

  return res.send(page("Schedule Conflict", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Schedule Conflict</h1>
    </div>

    <div class="wrap">
      <div class="card" style="max-width:700px;">
        <h2>This QR already has a campaign scheduled during that time.</h2>

        <p>
          You tried to schedule:
          <br>
          <strong>${req.body.start_time} - ${req.body.end_time}</strong>
        </p>

        <p>
          Existing active schedule:
          <br>
          <strong>${conflict.start_time} - ${conflict.end_time}</strong>
        </p>

        <div class="note" style="margin:20px 0;">
          To fix this, choose a different time window or archive/edit the existing schedule first.
        </div>

        <a class="btn" href="/admin/schedule">
          Back to Scheduler
        </a>

        <a class="btn secondary" href="/my-setup">
          View My Setup
        </a>
      </div>
    </div>
  `));
}
  
    await q(`
      INSERT INTO campaign_schedules (
        qr_id,
        campaign_id,
        days_of_week,
        start_time,
        end_time,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,true)
    `, [
      Number(req.body.qr_id),
      Number(req.body.campaign_id),
      selectedDays,
      req.body.start_time || "00:00",
      req.body.end_time || "23:59",
      Number(req.body.priority || 50)
    ]);

   res.send(successPage(
  "Campaign Scheduled Successfully",
  "Your campaign schedule has been saved.",
  "You can test the QR code or run reports.",
  [
    { label: "Run Reports", href: "/reports-qr" },
    { label: "Test QR", href: "/r/" + req.body.qr_id, target: "_blank" },
    { label: "Back to My Setup", href: "/my-setup" },
    { label: "Back to Schedule", href: "/admin/schedule" }
  ]
));
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/qr-admin/:qrId", requireLogin, async (req, res) => {
  const qrId = req.params.qrId;

  const qr = await q(`
    SELECT qr.*, s.name AS space_name, s.location
    FROM qr_codes qr
    LEFT JOIN spaces s ON s.id = qr.space_id
    WHERE qr.id = $1
  `, [qrId]);

  const events = await q(`
    SELECT e.*, c.name AS campaign_name, c.advertiser
    FROM events e
    LEFT JOIN campaigns c ON c.id = e.campaign_id
    WHERE e.qr_id = $1
    ORDER BY e.created_at DESC
    LIMIT 100
  `, [qrId]);

  res.send(page("QR Detail", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>${qr.rows[0]?.name || "QR Detail"}</h1>
      <p class="subtitle">${qr.rows[0]?.space_name || ""} ${qr.rows[0]?.location || ""}</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/dashboard">Back to Dashboard</a>
      <a class="btn secondary" href="/r/${qrId}" target="_blank">Open QR</a>

      <h2>Recent QR Activity</h2>

      <table>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Advertiser</th>
          <th>Campaign</th>
        </tr>

        ${events.rows.map(e => `
          <tr>
          <td>
  ${new Date(e.created_at).toLocaleString("en-US", {
    timeZone: "America/New_York"
  })}
</td> 
            <td>${e.type}</td>
            <td>${e.advertiser || ""}</td>
            <td>${e.campaign_name || ""}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `));
});
app.get("/campaign-admin/:campaignId", requireLogin, async (req, res) => {
  const campaignId = req.params.campaignId;

  const campaign = await q(`
    SELECT *
    FROM campaigns
    WHERE id = $1
  `, [campaignId]);

  const events = await q(`
    SELECT e.*, qr.name AS qr_name, s.name AS location_name
    FROM events e
    LEFT JOIN qr_codes qr ON qr.id = e.qr_id
    LEFT JOIN spaces s ON s.id = qr.space_id
    WHERE e.campaign_id = $1
    ORDER BY e.created_at DESC
    LIMIT 100
  `, [campaignId]);

  res.send(page("Campaign Detail", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>${campaign.rows[0]?.name || "Campaign Detail"}</h1>
      <p class="subtitle">${campaign.rows[0]?.advertiser || ""}</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/dashboard">Back to Dashboard</a>

      <div class="note">
        <strong>Avg Customer Value:</strong> ${money(campaign.rows[0]?.avg_customer_value || 0)}<br>
        <strong>Conversion Rate:</strong> ${campaign.rows[0]?.conversion_rate || 10}%
      </div>

      <h2>Recent Campaign Activity</h2>

      <table>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>QR</th>
          <th>Location</th>
        </tr>

        ${events.rows.map(e => `
          <tr>
            new Date(e.created_at).toLocaleString("en-US", {
  timeZone: "America/New_York"
})
            <td>${e.type}</td>
            <td>${e.qr_name || ""}</td>
            <td>${e.location_name || ""}</td>
          </tr>
        `).join("")}
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
console.log("CSV EXPORT QUERY:", req.query);
  const startDate = req.query.startDate || req.query.start || req.query.from;
const endDate = req.query.endDate || req.query.end || req.query.to;
const campaignId = req.query.campaignId || req.query.campaign_id || req.query.campaign;
const qrId = req.query.qrId || req.query.qr_id || req.query.qr;

  let where = [];
  let params = [];

  if (startDate) {
    params.push(startDate);
    where.push(`e.created_at >= $${params.length}`);

  }

  if (endDate) {
    params.push(endDate);
    where.push(`e.created_at <= $${params.length}`);
  }

  if (campaignId) {
    params.push(campaignId);
    where.push(`e.campaign_id = $${params.length}`);
  }

  if (qrId) {
    params.push(qrId);
    where.push(`e.qr_id = $${params.length}`);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";
 
 try {
  const result = await q(`
    SELECT
      e.id,
      e.created_at,
      e.type,
      e.qr_id,
      qr.name AS qr_name,
      e.campaign_id,
      c.name AS campaign,
      c.advertiser,
      e.store_id,
      st.name AS store
    FROM events e
    LEFT JOIN qr_codes qr ON qr.id = e.qr_id
    LEFT JOIN campaigns c ON c.id = e.campaign_id
    LEFT JOIN stores st ON st.id = e.store_id
    ${whereSql}
    ORDER BY e.created_at DESC
  `, params);

  const header = "id,created_at,type,qr_id,qr_name,campaign_id,campaign,advertiser,store_id,store\n";
  const rows = result.rows.map(r =>
    [r.id,r.created_at,r.type,r.qr_id,r.qr_name,r.campaign_id,r.campaign,r.advertiser,r.store_id,r.store]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=vivid-events.csv");
  res.send(header + rows);

} catch (err) {
  console.error("CSV EXPORT ERROR:", err);
  res.status(500).send(err.message);
} 
});
app.get("/export/report.csv", async (req, res) => {
const startDate = req.query.start_date || req.query.startDate || req.query.start || req.query.from;
const endDate = req.query.end_date || req.query.endDate || req.query.end || req.query.to;
const locationId = req.query.location_id || "";
const campaignId = req.query.campaign_id || req.query.campaignId || req.query.campaign;
const qrId = req.query.qr_id || req.query.qrId || req.query.qr;
const currentUser = req.session.user;
const userId = currentUser.role === "super_admin" ? null : currentUser.id;
  let where = [];
  let params = [];

  if (startDate) {
  params.push(startDate);
  where.push(`e.created_at >= $${params.length}::date`);
}

if (endDate) {
  params.push(endDate);
  where.push(`e.created_at < ($${params.length}::date + interval '1 day')`);
}
if (locationId) {
  params.push(locationId);
  where.push(`(
    e.store_id::text = $${params.length}
    OR qr.space_id::text = $${params.length}
  )`);
}
  if (campaignId) {
    params.push(campaignId);
    where.push(`e.campaign_id = $${params.length}`);
  }

  if (qrId) {
    params.push(qrId);
    where.push(`e.qr_id = $${params.length}`);
  }
params.push(userId);
where.push(`($${params.length}::int IS NULL OR st.user_id = $${params.length}::int OR s.user_id = $${params.length}::int)`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const result = await q(`
      SELECT
        c.name AS campaign,
        c.advertiser AS advertiser,
        qr.name AS qr_name,
        COALESCE(st.name, s.name) AS store_name,
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE e.type = 'scan') AS scans,
        COUNT(*) FILTER (WHERE e.type = 'offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type = 'maps') AS map_clicks,
        MIN(e.created_at) AS first_event,
        MAX(e.created_at) AS last_event
      FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
LEFT JOIN stores st ON st.id = e.store_id
LEFT JOIN qr_codes qr ON qr.id = e.qr_id
LEFT JOIN spaces s ON s.id = qr.space_id
      ${whereSql}
      GROUP BY
  c.name,
  c.advertiser,
  qr.name,
  st.name,
  s.name
      ORDER BY total_events DESC
    `, params);

    const header = "campaign,advertiser,qr_name,store_name,total_events,scans,offer_clicks,map_clicks,estimated_impressions,engagement_rate,estimated_spend,cpm,cost_per_scan,estimated_conversions,cac,estimated_revenue,roi,first_event,last_event\n";

    const rows = result.rows.map(r => {
      const scans = Number(r.scans || 0);
      const total = Number(r.total_events || 0);
const firstDate = r.first_event ? new Date(r.first_event) : new Date();
const lastDate = r.last_event ? new Date(r.last_event) : firstDate;
const activeDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);

const dailyImpressions = 400;
const impressions = activeDays * dailyImpressions;

const annualPlacementCost = 800;
const estimatedSpend = ((annualPlacementCost / 365) * activeDays).toFixed(2);
const estimatedConversions = Math.round(scans * 0.01);
const estimatedRevenue = estimatedConversions * 500;

const engagementRate = impressions > 0 ? ((scans / impressions) * 100).toFixed(2) + "%" : "0.00%";
const cpm =
  impressions > 0
    ? ((estimatedSpend / impressions) * 1000).toFixed(2)
    : "0.00";
const costPerScan = scans > 0 ? (estimatedSpend / scans).toFixed(2) : "0.00";
const cac = estimatedConversions > 0 ? (estimatedSpend / estimatedConversions).toFixed(2) : "0.00";
const roi = estimatedSpend > 0 ? (((estimatedRevenue - estimatedSpend) / estimatedSpend) * 100).toFixed(2) + "%" : "0.00%";

      return [
        r.campaign,
        r.advertiser,
        r.qr_name,
        r.store_name,
        r.total_events,
        r.scans,
        r.offer_clicks,
        r.map_clicks,
        impressions,
engagementRate,
estimatedSpend,
cpm,
costPerScan,
estimatedConversions,
cac,
estimatedRevenue,
roi,
        new Date(r.first_event).toLocaleDateString(),
new Date(r.last_event).toLocaleDateString()
      ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    }).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=vivid-executive-report.csv");
    res.send(header + rows);

  } catch (err) {
    console.error("REPORT CSV ERROR:", err);
    res.status(500).send(err.message);
  }
});
app.get("/export/report.pdf", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const userId = currentUser.role === "super_admin" ? 0 : currentUser.id;

    const startDate =
      req.query.start_date ||
      req.query.startDate ||
      req.query.start ||
      req.query.from ||
      "2000-01-01";

    const endDate =
      req.query.end_date ||
      req.query.endDate ||
      req.query.end ||
      req.query.to ||
      new Date().toISOString().slice(0, 10);

    const summary = await q(`
      SELECT
        COUNT(*) FILTER (WHERE e.type = 'scan') AS scans,
        COUNT(*) FILTER (WHERE e.type = 'maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type = 'offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type = 'waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks
      FROM events e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.created_at::date BETWEEN $1::date AND $2::date
      AND ($3 = 0 OR c.user_id = $3)
    `, [startDate, endDate, userId]);

    const campaigns = await q(`
      SELECT
       c.advertiser,
c.name AS campaign_name,
qc.name AS qr_name,
s.name AS location_name,
        COUNT(*) FILTER (WHERE e.type = 'scan') AS scans,
        COUNT(*) FILTER (WHERE e.type = 'maps') AS maps_clicks,
        COUNT(*) FILTER (WHERE e.type = 'offer') AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type = 'waze') AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type IN ('offer','maps','waze')) AS intent_clicks,
        COALESCE(c.avg_customer_value, 50) AS avg_customer_value,
        COALESCE(c.conversion_rate, 10) AS conversion_rate
      FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
LEFT JOIN qr_codes qc ON qc.id = e.qr_id
LEFT JOIN spaces s ON s.id = qc.space_id
      WHERE e.created_at::date BETWEEN $1::date AND $2::date
      AND ($3 = 0 OR c.user_id = $3)
      GROUP BY
  c.id,
  c.name,
  c.advertiser,
  c.avg_customer_value,
  c.conversion_rate,
  qc.name,
  s.name
      ORDER BY intent_clicks DESC
      LIMIT 10
    `, [startDate, endDate, userId]);

    const s = summary.rows[0] || {};
    const scans = Number(s.scans || 0);
    const maps = Number(s.maps_clicks || 0);
    const offers = Number(s.offer_clicks || 0);
    const waze = Number(s.waze_clicks || 0);
    const intent = Number(s.intent_clicks || 0);

    const estimatedCustomers = Math.round(intent * 0.10);
    const estimatedRevenue = estimatedCustomers * 50;
    const intentRate = scans > 0 ? ((intent / scans) * 100).toFixed(1) : "0.0";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=vivid-executive-report.pdf"
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(22).text("Vivid Spots", { align: "center" });
    doc.fontSize(16).text("Executive Performance Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Date Range: ${startDate} to ${endDate}`, { align: "center" });

    doc.moveDown(2);
    doc.fontSize(16).text("Executive Summary");
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Total Scans: ${scans}`);
    doc.text(`Google Maps Clicks: ${maps}`);
    doc.text(`Offer Clicks: ${offers}`);
    doc.text(`Waze Clicks: ${waze}`);
    doc.text(`Intent Clicks: ${intent}`);
    doc.text(`Intent Rate: ${intentRate}%`);
    doc.text(`Estimated Customers: ${estimatedCustomers}`);
    doc.text(`Estimated Revenue: $${estimatedRevenue.toLocaleString()}`);

    doc.moveDown(2);
    doc.fontSize(16).text("Top Campaigns");
    doc.moveDown();

    if (campaigns.rows.length === 0) {
      doc.fontSize(11).text("No campaign activity found for this date range.");
    } else {
      campaigns.rows.forEach((c, i) => {
        const campaignIntent = Number(c.intent_clicks || 0);
        const conversionRate = Number(c.conversion_rate || 10);
        const avgValue = Number(c.avg_customer_value || 50);
        const customers = Math.round(campaignIntent * (conversionRate / 100));
        const revenue = customers * avgValue;

        doc.fontSize(12).text(`${i + 1}. ${c.advertiser || "Advertiser"} — ${c.campaign_name || "Campaign"}`);

doc.fontSize(10).text(`QR: ${c.qr_name || "-"} | Location: ${c.location_name || "-"}`);

doc.fontSize(10).text(
          `Scans: ${c.scans || 0} | Maps: ${c.maps_clicks || 0} | Offers: ${c.offer_clicks || 0} | Waze: ${c.waze_clicks || 0} | Customers: ${customers} | Revenue: $${revenue.toLocaleString()}`
        );
        doc.moveDown();
      });
    }

    doc.moveDown();
    doc.fontSize(9).text(
      "Vivid Spots helps advertisers measure physical-world engagement through QR routing, campaign analytics, and performance reporting.",
      { align: "center" }
    );

    doc.end();

  } catch (err) {
    console.error("PDF REPORT ERROR:", err);
    res.status(500).send("PDF REPORT ERROR: " + err.message);
  }
});
app.get("/analytics", async (req, res) => {
  const result = await q(`SELECT COUNT(*) FILTER (WHERE type='scan') AS scans, COUNT(*) FILTER (WHERE type='offer') AS offer_clicks, COUNT(*) FILTER (WHERE type='maps') AS maps_clicks, COUNT(*) FILTER (WHERE type='waze') AS waze_clicks, COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks FROM events`);
  res.json(result.rows[0]);
});
app.get("/admin/stores", requireLogin, async (req, res) => {

  const stores = await q(
    `
    SELECT *
    FROM stores
    ORDER BY created_at DESC
    `
  );

  let storeRows = "";

  for (const s of stores.rows) {

    storeRows += `
      <tr>
        <td>${s.brand || ""}</td>
        <td>${s.name || ""}</td>
        <td>${s.address || ""}</td>
        <td>${s.inventory_status || ""}</td>
        <td>
  <a href="/admin/edit-store/${s.id}">
    Edit
  </a>
</td>
      </tr>
    `;
  }

  res.send(page("Stores", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Store Inventory Routing</h1>
    </div>

    <div class="wrap">

      <div class="card">

        <h2>Add Store</h2>

        <form method="POST">

          <label>Brand</label>
          <input name="brand" />

          <label>Store Name</label>
          <input name="name" />

          <label>Address</label>
          <input name="address" />

          <label>Inventory Status</label>

          <select name="inventory_status">
            <option value="high">
              High Inventory
            </option>

            <option value="normal">
              Normal
            </option>

            <option value="low">
              Low Inventory
            </option>
          </select>

          <label>Google Maps URL</label>
          <input name="maps_url" />

          <label>Waze URL</label>
          <input name="waze_url" />

          <button type="submit">
            Add Store
          </button>

        </form>

      </div>

      <div class="card">

        <h2>Current Stores</h2>

        <table style="width:100%;">

          <tr>
            <th>Brand</th>
            <th>Store</th>
            <th>Address</th>
            <th>Inventory</th>
            <th>Edit</th>
          </tr>

          ${storeRows}

        </table>

      </div>

    </div>
  `));
});
app.post("/admin/stores", requireLogin, async (req, res) => {
  try {
    const {
      brand,
      name,
      address,
      inventory_status,
      maps_url,
      waze_url
    } = req.body;

    await q(
      `
      INSERT INTO stores (
        user_id,
        brand,
        name,
        address,
        inventory_status,
        maps_url,
        waze_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        req.session.user.id,
        brand,
        name,
        address,
        inventory_status,
        maps_url,
        waze_url
      ]
    );

    res.redirect("/admin/stores");
  } catch (err) {
    res.send("ADD STORE ERROR: " + err.message);
  }
});
    app.get("/admin/edit-store/:id", requireLogin, async (req, res) => {

  const store = await q(
    `
    SELECT *
    FROM stores
    WHERE id = $1
    `,
    [req.params.id]
  );

  const s = store.rows[0];

  res.send(page("Edit Store", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Edit Store</h1>
    </div>

    <div class="wrap">

      <div class="card">

        <form method="POST"
              action="/admin/edit-store/${s.id}">

          <label>Brand</label>
          <input
            name="brand"
            value="${s.brand || ""}" />

          <label>Store Name</label>
          <input
            name="name"
            value="${s.name || ""}" />

          <label>Address</label>
          <input
            name="address"
            value="${s.address || ""}" />

          <label>Inventory Status</label>

          <select name="inventory_status">

            <option value="high"
              ${s.inventory_status === "high" ? "selected" : ""}>
              High
            </option>

            <option value="normal"
              ${s.inventory_status === "normal" ? "selected" : ""}>
              Normal
            </option>

            <option value="low"
              ${s.inventory_status === "low" ? "selected" : ""}>
              Low
            </option>

          </select>

          <label>Google Maps URL</label>
          <input
            name="maps_url"
            value="${s.maps_url || ""}" />

          <label>Waze URL</label>
          <input
            name="waze_url"
            value="${s.waze_url || ""}" />

          <button type="submit">
            Save Store
          </button>

        </form>

      </div>

    </div>
  `));
});
app.get("/admin/assign-store", requireLogin, async (req, res) => {

  const campaigns = await q(`
    SELECT *
    FROM campaigns
    ORDER BY advertiser, name
  `);

  const stores = await q(`
    SELECT *
    FROM stores
    ORDER BY brand, name
  `);

  const assignments = await q(`
    SELECT
      cs.id,
      c.advertiser,
      c.name AS campaign_name,
      s.name AS store_name,
      s.inventory_status
    FROM campaign_stores cs
    LEFT JOIN campaigns c
      ON c.id = cs.campaign_id
    LEFT JOIN stores s
      ON s.id = cs.store_id
    ORDER BY cs.id DESC
  `);

  let rows = "";

  for (const a of assignments.rows) {

    rows += `
      <tr>
        <td>${a.advertiser || ""}</td>
        <td>${a.campaign_name || ""}</td>
        <td>${a.store_name || ""}</td>
        <td>${a.inventory_status || ""}</td>
      </tr>
    `;
  }

  res.send(page("Assign Store", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Campaign Store Routing</h1>
    </div>

    <div class="wrap">

      <div class="card">

        <h2>Assign Store to Campaign</h2>

        <form method="POST">

          <label>Campaign</label>

          <select name="campaign_id">

            ${campaigns.rows.map(c => `
              <option value="${c.id}">
                ${c.advertiser} - ${c.name}
              </option>
            `).join("")}

          </select>

          <label>Store</label>

          <select name="store_id">

            ${stores.rows.map(s => `
              <option value="${s.id}">
                ${s.brand || ""} - ${s.name}
              </option>
            `).join("")}

          </select>

          <button type="submit">
            Assign Store
          </button>

        </form>

      </div>

      <div class="card">

        <h2>Current Campaign Routing</h2>

        <table style="width:100%;">

          <tr>
            <th>Advertiser</th>
            <th>Campaign</th>
            <th>Store</th>
            <th>Inventory</th>
          </tr>

          ${rows}

        </table>

      </div>

    </div>
  `));

});
app.post("/admin/assign-store", requireLogin, async (req, res) => {
  const {
    campaign_id,
    store_id
  } = req.body;

  await q(
    `
    INSERT INTO campaign_stores (
      campaign_id,
      store_id
    )
    VALUES ($1,$2)
    `,
    [
      campaign_id,
      store_id
    ]
  );

  res.redirect("/admin/assign-store");
});
app.post("/admin/campaigns/:id/archive", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body.reason || "Archived by admin";

    await q(`
      UPDATE campaigns
      SET
        archived = true,
        archived_at = NOW(),
        archive_reason = $1
      WHERE id = $2
    `, [reason, id]);

    res.redirect("/admin");

  } catch (err) {
    console.error("ARCHIVE CAMPAIGN ERROR:", err);
    res.status(500).send(err.message);
  }
});
app.post("/admin/archive-schedule/:id", requireAdmin, async (req, res) => {
  try {
    await q(
      `UPDATE campaign_schedules
       SET is_active = false
       WHERE id=$1`,
      [Number(req.params.id)]
    );

    res.redirect("/admin/schedule");
  } catch (e) {
    res.status(500).send("Archive failed: " + e.message);
  }
});
app.get("/admin/reports", async (req, res) => {
  try {
    const currentUser = req.session.user;
const isSuperAdmin = currentUser.role === "super_admin";
    const userId = isSuperAdmin ? 0 : currentUser.id;
    const today = new Date().toISOString().slice(0, 10);

    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;
    const locationId = req.query.location_id || "";
    const qrId = req.query.qr_id || "";
    const campaignId = req.query.campaign_id || "";
    const status = (req.query.status || "all").toLowerCase();
const statusTarget = campaignId
  ? "campaign"
  : qrId
  ? "qr"
  : locationId
  ? "location"
  : "all";
    const report = await q(`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE type = 'scan')::int AS total_scans,
        COUNT(*) FILTER (WHERE type = 'maps')::int AS maps_clicks,
        COUNT(*) FILTER (WHERE type = 'offer')::int AS offer_clicks
      FROM events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
WHERE e.created_at::date BETWEEN $1::date AND $2::date
AND (
  $3::text = ''
  OR store_id::text = $3::text
  OR qr_id IN (
    SELECT id
    FROM qr_codes
    WHERE space_id::text = $3::text
  )
)

AND ($4 = '' OR qr_id::text = $4)
AND ($5 = '' OR campaign_id::text = $5)
AND ($6 = 0 OR c.user_id = $6)

`,[startDate, endDate, locationId, qrId, campaignId, userId]);
    const totals = report.rows[0] || {};

   const revenueReport = await q(`
  SELECT
    0::numeric(10,2) AS estimated_revenue,
    0::numeric(10,2) AS estimated_customers,
  COALESCE(SUM(c.campaign_cost), 0)::numeric(10,2) AS total_campaign_cost  
      FROM events e
LEFT JOIN campaigns c ON e.campaign_id = c.id
LEFT JOIN qr_codes qc ON e.qr_id = qc.id
LEFT JOIN spaces s ON e.store_id = s.id
WHERE e.type = 'scan'
  AND e.created_at::date BETWEEN $1::date AND $2::date
  AND (
    $3 = 'all'
    OR (
      $3 = 'active'
      AND COALESCE(c.is_archived,false) = false
      AND COALESCE(qc.is_archived,false) = false
      AND COALESCE(s.is_archived,false) = false
    )
    OR (
      $3 = 'archived'
      AND (
        COALESCE(c.is_archived,false) = true
        OR COALESCE(qc.is_archived,false) = true
        OR COALESCE(s.is_archived,false) = true
      )
    )
  )
    AND ($4 = 0 OR c.user_id = $4)
`, [startDate, endDate, status, userId]);

    const revenue = revenueReport.rows[0] || {};

    const estimatedRevenue = Number(revenue.estimated_revenue || 0);
    const estimatedCustomers = Number(revenue.estimated_customers || 0);
    const totalScans = Number(totals.total_scans || 0);
    const mapsClicks = Number(totals.maps_clicks || 0);
  
    const offerClicks = Number(totals.offer_clicks || 0);
const selectedDays =
  Math.max(
    1,
    Math.ceil(
      (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
    ) + 1
  );

const costBasis = await q(`
  SELECT
    COALESCE(SUM(placement_cost), 0)::numeric(10,2) AS annual_cost,
    COALESCE(SUM(annual_impressions), 0)::numeric(10,2) AS annual_impressions
  FROM spaces
  WHERE ($1 = '' OR id::text = $1)
`, [locationId]);

const annualCost = Number(costBasis.rows[0]?.annual_cost || 800);
const annualImpressions = Number(costBasis.rows[0]?.annual_impressions || 146000);

const proratedCost = Number(((annualCost / 365) * selectedDays).toFixed(2));
const proratedImpressions = Number(((annualImpressions / 365) * selectedDays).toFixed(0));
const costPerEngagement =
  totalScans > 0
    ? (proratedCost / totalScans).toFixed(2)
    : "0.00";
    const cac = estimatedCustomers > 0 ? (proratedCost / estimatedCustomers).toFixed(2) : "0.00";
const roi =
  proratedCost > 0
    ? (((estimatedRevenue - proratedCost) / proratedCost) * 100).toFixed(2)
    : "0.00";
    const cpm =
  proratedImpressions > 0
    ? ((proratedCost / proratedImpressions) * 1000).toFixed(2)
    : "0.00";
   
const locations = await q(
  `
  SELECT id, name
  FROM spaces
  WHERE ($1::int IS NULL OR user_id = $1::int)
  AND (
    $2::text = 'all'
    OR ($2::text = 'active' AND COALESCE(is_archived,false) = false)
    OR ($2::text = 'archived' AND COALESCE(is_archived,false) = true)
  )
  ORDER BY name ASC
  `,
  [userId, status]
);

const qrs = await q(
  `
  SELECT qc.id, qc.name
  FROM qr_codes qc
  JOIN spaces s ON s.id = qc.space_id
  WHERE ($1::int IS NULL OR s.user_id = $1::int)
    AND ($2::text = '' OR qc.space_id::text = $2::text)
    AND (
      $3::text = 'all'
      OR ($3::text = 'active' AND COALESCE(qc.is_archived,false) = false)
      OR ($3::text = 'archived' AND COALESCE(qc.is_archived,false) = true)
    )
  ORDER BY qc.name ASC
  `,
  [userId, locationId, status]
);
  
 
  

const campaigns = await q(
  `
  SELECT DISTINCT c.id, c.name
FROM campaigns c
WHERE ($1::int IS NULL OR c.user_id = $1::int)
  AND (
    $2::text = 'all'
    OR ($2::text = 'active' AND COALESCE(c.is_archived,false) = false)
    OR ($2::text = 'archived' AND COALESCE(c.is_archived,false) = true)
  )
ORDER BY c.name ASC
  `,
  [userId, status]
);
    const relationships = await q(
  `
  SELECT DISTINCT
    cs.campaign_id,
    cs.qr_id,
    s.id AS location_id
  FROM campaign_schedules cs
  JOIN qr_codes qc ON qc.id = cs.qr_id
  JOIN spaces s ON s.id = qc.space_id
  ${userId ? "WHERE s.user_id = $1" : ""}
  `,
  userId ? [userId] : []
);
    const detailRows = await q(`
  SELECT
    COALESCE(c.name, '') AS campaign_name,
    COALESCE(qc.name, '') AS qr_name,
    COALESCE(s.name, '') AS location_name,
COALESCE(qc.annual_cost, 800)::numeric(10,2) AS placement_cost,
COALESCE(qc.annual_impressions, 146000)::numeric(10,2) AS annual_impressions,
    COUNT(*) FILTER (WHERE e.type = 'scan')::int AS scans,
    COUNT(*) FILTER (WHERE e.type = 'maps')::int AS maps_clicks,
    COUNT(*) FILTER (WHERE e.type = 'offer')::int AS offer_clicks,

    COALESCE(SUM(
      CASE
        WHEN e.type = 'scan'
        THEN (c.conversion_rate / 100.0)
        ELSE 0
      END
    ), 0)::numeric(10,2) AS estimated_customers,

    COALESCE(SUM(
      CASE
        WHEN e.type = 'scan'
        THEN (c.conversion_rate / 100.0) * c.avg_customer_value
        ELSE 0
      END
    ), 0)::numeric(10,2) AS estimated_revenue

  FROM events e
  LEFT JOIN campaigns c ON e.campaign_id = c.id
  LEFT JOIN qr_codes qc ON e.qr_id = qc.id
  LEFT JOIN spaces s ON s.id = qc.space_id

  WHERE e.created_at::date BETWEEN $1::date AND $2::date
   AND (
  $3 = ''
  OR e.store_id::text = $3
  OR qc.space_id::text = $3
)
    AND ($4 = '' OR e.qr_id::text = $4)
    AND ($5 = '' OR e.campaign_id::text = $5)
AND ($7 = 0 OR c.user_id = $7)
AND (
  $6::text = 'all'
  OR ($6::text = 'active' AND COALESCE(c.is_archived,false) = false)
  OR ($6::text = 'archived' AND COALESCE(c.is_archived,false) = true)
)
  GROUP BY c.name, c.advertiser, qc.name, s.name, qc.annual_cost, qc.annual_impressions
  ORDER BY scans DESC
`, [startDate, endDate, locationId, qrId, campaignId, status, userId]);
    res.send(page("Reports", `
      <h1>Export Center</h1>

      <form method="GET" action="/admin/reports" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:20px;">
        <div>
          <label>Start Date</label><br>
          <input type="date" name="start_date" value="${startDate}">
        </div>

        <div>
          <label>End Date</label><br>
          <input type="date" name="end_date" value="${endDate}">
        </div>
<div>
  <label>Location</label><br>
  <select name="location_id" id="location_id">
  <option value="" ${locationId === "" ? "selected" : ""}>All Locations</option>
  ${locations.rows
    .filter(location => location.name)
    .map(location => `<option value="${location.id}" ${String(location.id) === String(locationId) ? "selected" : ""}>${location.name}</option>`)
    .join("")}
</select>
</div>
<div>
  <label>QR Code</label><br>
  <select name="qr_id" id="qr_id">
  <option value="" ${qrId === "" ? "selected" : ""}>All QR Codes</option>
  ${qrs.rows
    .filter(qr => qr.name)
    .map(qr => `<option value="${qr.id}" ${String(qr.id) === String(qrId) ? "selected" : ""}>${qr.name}</option>`)
    .join("")}
</select>
</div>
<div>
  <label>Campaign</label><br>
  <select name="campaign_id" id="campaign_id">
    <option value="" ${campaignId === "" ? "selected" : ""}>All Campaigns</option>
    ${campaigns.rows
      .filter(campaign => campaign.name)
      .map(campaign => `<option value="${campaign.id}" ${String(campaign.id) === String(campaignId) ? "selected" : ""}>${campaign.name}</option>`)
      .join("")}
  </select>
</div>
        <div>
          <label>Status</label><br>
          <select name="status">
            <option value="all" ${status === "all" ? "selected" : ""}>All</option>
            <option value="active" ${status === "active" ? "selected" : ""}>Active</option>
            <option value="archived" ${status === "archived" ? "selected" : ""}>Archived</option>
          </select>
        </div>

        <button type="submit">Run Report</button>

<button type="submit" formaction="/export/events.csv" formmethod="get">
  Export Raw Events CSV
</button>

<button type="submit" formaction="/export/report.csv" formmethod="get">
  Export Executive CSV
</button>
<button type="submit" formaction="/export/report.pdf" formmethod="get">
  Export Executive PDF
</button>
      </form>
<script>
document.addEventListener("DOMContentLoaded", () => {
  const campaign = document.getElementById("campaign_id");
  const qr = document.getElementById("qr_id");
  const location = document.getElementById("location_id");
  const relationships = ${JSON.stringify(relationships.rows)};

  if (!campaign || !qr || !location) return;

  const allCampaignOptions = Array.from(campaign.options).map(o => o.cloneNode(true));
  const allQrOptions = Array.from(qr.options).map(o => o.cloneNode(true));
  const allLocationOptions = Array.from(location.options).map(o => o.cloneNode(true));

  function rebuild(select, originalOptions, allowedValues) {
    const current = select.value;
    select.innerHTML = "";

    originalOptions.forEach(opt => {
      if (opt.value === "" || allowedValues.has(String(opt.value))) {
        select.appendChild(opt.cloneNode(true));
      }
    });

    if ([...select.options].some(o => o.value === current)) {
      select.value = current;
    } else {
      select.value = "";
    }
  }

  function applyFilters(changed) {
    const campaignId = campaign.value;
    const qrId = qr.value;
    const locationId = location.value;

    let matching = relationships;

    if (campaignId) {
      matching = matching.filter(r => String(r.campaign_id) === String(campaignId));
    }

    if (qrId) {
      matching = matching.filter(r => String(r.qr_id) === String(qrId));
    }

    if (locationId) {
      matching = matching.filter(r => String(r.location_id) === String(locationId));
    }

    const allowedCampaigns = new Set(matching.map(r => String(r.campaign_id)));
    const allowedQrs = new Set(matching.map(r => String(r.qr_id)));
    const allowedLocations = new Set(matching.map(r => String(r.location_id)));

    if (changed !== "campaign") rebuild(campaign, allCampaignOptions, allowedCampaigns);
    if (changed !== "qr") rebuild(qr, allQrOptions, allowedQrs);
    if (changed !== "location") rebuild(location, allLocationOptions, allowedLocations);
  }

  campaign.addEventListener("change", () => applyFilters("campaign"));
  qr.addEventListener("change", () => applyFilters("qr"));
  location.addEventListener("change", () => applyFilters("location"));
});
</script>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:24px;margin-bottom:24px;">

  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>Total Scans</h3>
    <p>${totalScans}</p>
  </div>

  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>Maps Clicks</h3>
    <p>${mapsClicks}</p>
  </div>
<div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
  <h3>Offer Clicks</h3>
  <p>${offerClicks}</p>
</div>
  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>Estimated Customers</h3>
    <p>${estimatedCustomers.toFixed(2)}</p>
  </div>

  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>Estimated Revenue</h3>
    <p>$${estimatedRevenue}</p>
  </div>
<div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
  <h3>ROI</h3>
  <p>${roi}%</p>
</div>
  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>Cost / Engagement</h3>
    <p>$${costPerEngagement}</p>
  </div>
<div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
  <h3>CPM</h3>
  <p>$${cpm}</p>
</div>
  <div style="padding:16px;border:1px solid #ddd;border-radius:10px;">
    <h3>CAC</h3>
    <p>$${cac}</p>
  </div>

</div>

<div style="margin-top:32px;">
  <h2>Detailed Results</h2>

  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:10px;border:1px solid #ddd;">Campaign</th>
          <th style="padding:10px;border:1px solid #ddd;">QR Code</th>
          <th style="padding:10px;border:1px solid #ddd;">Location</th>
          <th style="padding:10px;border:1px solid #ddd;">Scans</th>
          <th style="padding:10px;border:1px solid #ddd;">Maps</th>
          <th style="padding:10px;border:1px solid #ddd;">Offers</th>
          <th style="padding:10px;border:1px solid #ddd;">Customers</th>
          <th style="padding:10px;border:1px solid #ddd;">Revenue</th>
          <th style="padding:10px;border:1px solid #ddd;">CAC</th>
          <th style="padding:10px;border:1px solid #ddd;">ROI</th>
          <th style="padding:10px;border:1px solid #ddd;">CPM</th>
        </tr>
      </thead>

      <tbody>
${detailRows.rows.map(row => `
  <tr>
    <td style="padding:10px;border:1px solid #ddd;">${row.campaign_name}</td>
    <td style="padding:10px;border:1px solid #ddd;">${row.qr_name}</td>
    <td style="padding:10px;border:1px solid #ddd;">${row.location_name}</td>
    <td style="padding:10px;border:1px solid #ddd;">${row.scans}</td>
    <td style="padding:10px;border:1px solid #ddd;">${row.maps_clicks}</td>
    <td style="padding:10px;border:1px solid #ddd;">${row.offer_clicks}</td>
    <td style="padding:10px;border:1px solid #ddd;">${Number(row.estimated_customers).toFixed(2)}</td>
    <td style="padding:10px;border:1px solid #ddd;">$${Number(row.estimated_revenue).toFixed(2)}</td>
    <td style="padding:10px;border:1px solid #ddd;">
  ${
    Number(row.estimated_customers) > 0
      ? "$" + (
          (
            (Number(row.placement_cost) / 365) * selectedDays
          ) /
          Number(row.estimated_customers)
        ).toFixed(2)
      : "--"
  }
</td>
    <td style="padding:10px;border:1px solid #ddd;">
  ${
    Number(row.estimated_revenue) > 0
      ? (
          (
            (
              Number(row.estimated_revenue) -
              ((Number(row.placement_cost) / 365) * selectedDays)
            ) /
            ((Number(row.placement_cost) / 365) * selectedDays)
          ) * 100
        ).toFixed(2) + "%"
      : "--"
  }
</td>
   <td style="padding:10px;border:1px solid #ddd;">
  ${
    Number(row.annual_impressions) > 0
      ? "$" + (
          (
            (
              (Number(row.placement_cost) / 365) * selectedDays
            ) /
            (
              (Number(row.annual_impressions) / 365) * selectedDays
            )
          ) * 1000
        ).toFixed(2)
      : "--"
  }
</td>
  </tr>
`).join("")}
      </tbody>
    </table>
  </div>
</div>
      <h2>Report Details</h2>
      <p>Date range: ${startDate} to ${endDate}</p>
      <p>Status: ${status}</p>
      <p>Maps Clicks: ${totals.maps_clicks || 0}</p>
      <p>Offer Clicks: ${totals.offer_clicks || 0}</p>
    `));
  } catch (e) {
    res.status(500).send("REPORTS ERROR: " + e.message);
  }
});
app.get("/admin/reports", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;

    const scanReport = await q(`
      SELECT COUNT(*)::int AS total_scans
      FROM events
      WHERE type = 'scan'
        AND created_at::date BETWEEN $1::date AND $2::date
    `, [startDate, endDate]);

    const totalScans = Number(scanReport.rows[0]?.total_scans || 0);
const estimatedRevenue = (totalScans * 5).toFixed(2);
    res.send(page("Reports", `
      <h1>Reports</h1>

      <form method="GET" action="/admin/reports">
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
          <div>
            <label>Start Date</label><br>
            <input type="date" name="start_date" value="${startDate}">
          </div>

          <div>
            <label>End Date</label><br>
            <input type="date" name="end_date" value="${endDate}">
          </div>
<div>
  <label>Location</label><br>
  <select name="location_id">
  <option value="">All Locations</option>

  ${locations.rows.map(location => `
    <option value="${location.id}">
      ${location.name}
    </option>
  `).join("")}

</select>
</div>
          <button type="submit">Run Report</button>
        </div>
      </form>

      <div style="margin-top:30px;padding:20px;border:1px solid #ddd;border-radius:10px;">
        <h2>Reports Stable</h2>
        <p>Date range: ${startDate} to ${endDate}</p>
        <h2>Total Scans</h2>
        <p>${totalScans}</p>
      </div>
    `));
  } catch (e) {
    res.status(500).send("REPORTS ERROR: " + e.message);
  }
});
app.listen(port, () => {
  console.log("Server running on port " + port);
});
