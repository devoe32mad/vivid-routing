const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");

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
  if (d === 0) return "Every Day / Sunday";
  if (d === 1) return "Monday";
  if (d === 2) return "Tuesday";
  if (d === 3) return "Wednesday";
  if (d === 4) return "Thursday";
  if (d === 5) return "Friday";
  if (d === 6) return "Saturday";
  return String(n || "");
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
    h1{margin:8px 0 6px;font-size:34px}
    h2{margin-top:34px}
    .subtitle{color:#d7eadb;margin:0}
    .wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
    .btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0;cursor:pointer}
    .btn.secondary{background:#123d25}.btn.gold{background:#9a6a00}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 30px}
    .card{background:white;border-radius:18px;padding:22px;box-shadow:0 8px 22px rgba(0,0,0,.08)}
    .label{color:#65776b;font-size:13px;margin-bottom:8px}.num{font-size:30px;font-weight:bold}
    table{width:100%;background:white;border-collapse:collapse;border-radius:18px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.08);margin-bottom:30px}
    th,td{padding:13px;border-bottom:1px solid #e7eee7;text-align:left;vertical-align:top;font-size:14px}
    th{background:#eaf3e8}
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
<body>${body}</body>
</html>`;
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
  const userCount = await q(`
  SELECT COUNT(*) FROM users
`);

if (Number(userCount.rows[0].count) === 0) {

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
    campaign_cost INT DEFAULT 0,
    conversion_rate INT DEFAULT 10,
    is_deal_of_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

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
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS avg_customer_value INT DEFAULT 50`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_cost INT DEFAULT 0`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversion_rate INT DEFAULT 10`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await q(`ALTER TABLE qr_campaigns ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP`);
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
    s.placement_cost,
    COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP) AS started_at,
    qc.ended_at
  FROM qr_campaigns qc
  JOIN qr_codes qr ON qr.id = qc.qr_id
  JOIN spaces s ON s.id = qr.space_id
  WHERE qc.campaign_id = $1
`, [campaignId]);
  
  const schedules = await q(`
    SELECT s.placement_cost, cs.created_at AS started_at
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
    if (eDate >= sDate) total += (Number(a.placement_cost || 0) / 365) * daysBetween(sDate, eDate);
  }

  for (const a of schedules.rows) {
    let sDate = new Date(a.started_at || new Date());
    let eDate = new Date();
    if (hasDate) {
      if (sDate < rangeStart) sDate = rangeStart;
      if (eDate > rangeEnd) eDate = rangeEnd;
    }
    if (eDate >= sDate) total += (Number(a.placement_cost || 0) / 365) * daysBetween(sDate, eDate);
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
  const campaign = await activeCampaignForQr(qrId);
  if (!campaign) return res.status(404).send("No active campaign assigned to this QR.");
  await saveEvent({ qrId, campaignId: campaign.id, type: "scan" });
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
app.get("/login", (req, res) => {

  res.send(page("Login", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Login</h1>
      <p class="subtitle">
        Access your Vivid dashboard
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
      role: user.rows[0].role
    };

    res.redirect("/dashboard");

  } catch (err) {

    res.send("LOGIN ERROR: " + err.message);

  }

});
app.get("/dashboard", requireLogin, async (req, res) => {
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
        s.annual_impressions,
        s.placement_cost
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
        s.annual_impressions,
        s.placement_cost
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
    ? `SELECT * FROM campaigns WHERE is_archived = false ORDER BY id`
    : `SELECT * FROM campaigns WHERE is_archived = false AND user_id = $1 ORDER BY id`,
  isSuperAdmin ? [] : [currentUser.id]
);

const locationRows = await q(
  isSuperAdmin
    ? `
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
    `
    : `
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
      WHERE c.user_id = $1 ${dateSql}
      GROUP BY c.id, s.id
      ORDER BY intent_clicks DESC, scans DESC
    `,
  isSuperAdmin
    ? dateParams
    : [currentUser.id, ...dateParams]
);

    const storeRows = await q(`
      SELECT st.id AS store_id, st.name AS store_name, st.address,
        st.inventory_priority, st.inventory_units, st.days_on_hand, st.inventory_velocity, st.inventory_note,
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

const activeSchedules = await q(
  isSuperAdmin
    ? `
      SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM campaign_schedules cs
      JOIN qr_codes qr ON qr.id = cs.qr_id
      JOIN campaigns c ON c.id = cs.campaign_id
      WHERE cs.is_active = true
      ORDER BY cs.qr_id, cs.priority DESC
    `
    : `
      SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser
      FROM campaign_schedules cs
      JOIN qr_codes qr ON qr.id = cs.qr_id
      JOIN campaigns c ON c.id = cs.campaign_id
      WHERE cs.is_active = true
      AND c.user_id = $1
      ORDER BY cs.qr_id, cs.priority DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
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
    for (const row of activeSchedules.rows) activeScheduleTable += `<tr><td>${row.qr_name || row.qr_id}</td><td>${row.advertiser || ""}</td><td>${row.campaign_name || ""}</td><td>${dayLabel(row.day_of_week)}</td><td>${row.start_time}</td><td>${row.end_time}</td><td>${row.priority}</td><td>${row.is_active ? "Active" : "Inactive"}</td></tr>`;

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
</p><p style="color:white; font-weight:bold;">
  Logged in as: ${currentUser.email} | Role: ${currentUser.role} | User ID: ${currentUser.id}
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
<a class="btn" href="/admin/new-campaign">New Campaign</a>
<a class="btn" href="/admin/new-location">New Location</a>
<a class="btn" href="/admin/new-qr">New QR Code</a>
${isSuperAdmin ? `
  <a class="btn secondary" href="/admin">Admin</a>
  <a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a>
  <a class="btn secondary" href="/admin/assign">Assign Campaign</a>
  <a class="btn gold" href="/export/events.csv">Export CSV</a>
` : ""}
        <div class="note"><strong>Money View:</strong> Campaign ROI now uses allocated spot cost: annual placement cost / 365 × active days.</div>
        <div class="cards"><div class="card"><div class="label">Total Scans</div><div class="num">${total.scans || 0}</div></div><div class="card"><div class="label">Google Maps Clicks</div><div class="num">${total.maps_clicks || 0}</div></div><div class="card"><div class="label">Offer Clicks</div><div class="num">${total.offer_clicks || 0}</div></div><div class="card"><div class="label">Intent Rate</div><div class="num">${pct(totalIntentRate)}</div></div></div>
        <h2>Daily Trend Activity</h2><table><tr><th>Date</th><th>Scans</th><th>Intent Clicks</th></tr>${trendTable || `<tr><td colspan="3">No activity for selected range.</td></tr>`}</table>
        <h2>Active Campaign Schedules</h2><table><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th><th>Status</th></tr>${activeScheduleTable || `<tr><td colspan="8">No active schedules.</td></tr>`}</table>
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
          ORDER BY id DESC
        `
        : `
          SELECT *
          FROM spaces
          WHERE user_id = $1
          ORDER BY id DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    const qrs = await q(
      isSuperAdmin
        ? `
          SELECT qr.*, s.name AS location_name
          FROM qr_codes qr
          LEFT JOIN spaces s ON s.id = qr.space_id
          ORDER BY qr.id DESC
        `
        : `
          SELECT qr.*, s.name AS location_name
          FROM qr_codes qr
          JOIN spaces s ON s.id = qr.space_id
          WHERE s.user_id = $1
          ORDER BY qr.id DESC
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

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
      WHERE is_archived = true
      ORDER BY id DESC
    `
    : `
      SELECT *
      FROM campaigns
      WHERE is_archived = true
      AND user_id = $1
      ORDER BY id DESC
    `,
  isSuperAdmin ? [] : [currentUser.id]
);
    const assignments = await q(
      isSuperAdmin
        ? `
          SELECT qc.*, qr.name AS qr_name, c.name AS campaign_name
          FROM qr_campaigns qc
          JOIN qr_codes qr ON qr.id = qc.qr_id
          JOIN campaigns c ON c.id = qc.campaign_id
          ORDER BY qc.id DESC
        `
        : `
          SELECT qc.*, qr.name AS qr_name, c.name AS campaign_name
          FROM qr_campaigns qc
          JOIN qr_codes qr ON qr.id = qc.qr_id
          JOIN campaigns c ON c.id = qc.campaign_id
          WHERE c.user_id = $1
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
    let locationTable = "";
    for (const s of locations.rows) {
      locationTable += `
        <tr>
          <td>${s.id}</td>
          <td>${s.name || ""}</td>
          <td>${s.location || ""}</td>
          <td>${s.annual_impressions || 0}</td>
          <td>${money(s.placement_cost || 0)}</td>
          <td><a href="/admin/edit-location/${s.id}">Edit</a></td>
        </tr>
      `;
    }

    let qrTable = "";
    for (const qr of qrs.rows) {
      qrTable += `
        <tr>
          <td>${qr.id}</td>
          <td>${qr.name || ""}</td>
          <td>${qr.location_name || ""}</td>
          <td><a href="/r/${qr.id}" target="_blank">Open</a></td>
          <td>
  <a href="/admin/edit-qr/${qr.id}">
    Edit
  </a>
</td>
          <td><a href="/qr/${qr.id}.png" target="_blank">Download</a></td>
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
          <td>
          <td>
  <a href="/admin/archive-campaign/${c.id}">
    Archive
  </a>
</td>
            <a href="/admin/edit-campaign/${c.id}">
              Edit
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
      <td>${s.start_time || ""}</td>
      <td>${s.end_time || ""}</td>
      <td>${s.priority || ""}</td>
      <td>${s.is_active ? "Active" : "Inactive"}</td>
      <td><a href="/admin/deactivate-schedule/${s.id}">Deactivate</a></td>
    </tr>
  `;
}
    let assignmentTable = "";
    for (const a of assignments.rows) {
      assignmentTable += `
        <tr>
          <td>${a.qr_name || ""}</td>
          <td>${a.campaign_name || ""}</td>
          <td>${a.is_active ? "Active" : "Inactive"}</td>
        </tr>
      `;
    }

    res.send(page("My Setup", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>My Setup</h1>
        </div>
     <div class="note" style="margin:20px 0;line-height:1.7;padding:18px;">
  <strong>How To Use Vivid Spots</strong><br><br>

  1. Create a Location<br>
  2. Create a QR Code<br>
  3. Create a Campaign<br>
  4. Assign Campaigns to QR Codes<br>
  5. Schedule Rotations (optional)<br>
  6. Monitor ROI and performance from Dashboard<br><br>

  Recommended workflow:<br>
  Location → QR → Campaign → Assignment → Schedule → Analytics
</div>
  

      </div>

      <div class="wrap">
<div class="note" style="margin:20px 0;line-height:1.7;padding:18px;">
  <strong>How To Use Vivid Spots</strong><br><br>

  1. Create a Location<br>
  2. Create a QR Code<br>
  3. Create a Campaign<br>
  4. Assign Campaigns to QR Codes<br>
  5. Schedule Rotations (optional)<br>
  6. Monitor ROI and performance from Dashboard<br><br>

  Recommended workflow:<br>
  Location → QR → Campaign → Assignment → Schedule → Analytics
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
            <th>Impressions</th>
            <th>Placement Cost</th>
            <th>Edit</th>
          </tr>
          ${locationTable || `<tr><td colspan="5">No locations yet.</td></tr>`}
        </table>

        <h2>QR Codes</h2>
        <table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>Open</th>
            <th>Download</th>
            <th>Edit</th>
          </tr>
          ${qrTable || `<tr><td colspan="5">No QR codes yet.</td></tr>`}
        </table>

        <h2>Campaigns</h2>
        <table>
          <tr>
            <th>ID</th>
            <th>Advertiser</th>
            <th>Name</th>
            <th>Edit</th>
            <th>Archive</th>
          </tr>
          ${campaignTable || `<tr><td colspan="4">No campaigns yet.</td></tr>`}
        </table>
<h2>Archived Campaigns</h2>

<table>
  <tr>
    <th>ID</th>
    <th>Advertiser</th>
    <th>Name</th>
    <th>Restore</th>
  </tr>

  ${archivedCampaignTable || `
    <tr>
      <td colspan="4">
        No archived campaigns.
      </td>
    </tr>
  `}
</table>
<h2>Schedules</h2>

<table>
  <tr>
    <th>QR</th>
    <th>Advertiser</th>
    <th>Campaign</th>
    <th>Start</th>
    <th>End</th>
    <th>Priority</th>
    <th>Status</th>
    <th>Action</th>
  </tr>

  ${scheduleTable || `<tr><td colspan="8">No schedules yet.</td></tr>`}
</table>
        <h2>Assignments</h2>
        <table>
          <tr>
            <th>QR</th>
            <th>Campaign</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
          ${assignmentTable || `<tr><td colspan="3">No assignments yet.</td></tr>`}
        </table>

      </div>
    `));

  } catch (err) {
    res.send("MY SETUP ERROR: " + err.message);
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
  const qrs = await q(`SELECT qr.*, s.name AS space_name FROM qr_codes qr LEFT JOIN spaces s ON s.id = qr.space_id ORDER BY qr.id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  const stores = await q(`SELECT * FROM stores ORDER BY inventory_priority DESC`);
  res.send(page("Vivid Admin", `
    <div class="topbar"><div class="brand">Vivid Spots</div><h1>Admin Control Center</h1><p class="subtitle">Manage locations, QR codes, campaigns, stores, inventory, and schedules.</p></div>
    <div class="wrap"><a class="btn" href="/dashboard">Dashboard</a><a class="btn secondary" href="/admin/new-location">New Location</a><a class="btn secondary" href="/admin/new-qr">New QR</a><a class="btn secondary" href="/admin/new-campaign">New Campaign</a><a class="btn secondary" href="/admin/new-store">New Store</a><a class="btn secondary" href="/admin/schedule">Schedule Campaigns</a><a class="btn secondary" href="/admin/assign">Assign Campaign</a>
      <h2>QR Codes</h2><table><tr><th>ID</th><th>QR</th><th>Space</th><th>Routing URL</th><th>QR Image</th></tr>${qrs.rows.map(qr => `<tr><td>${qr.id}</td><td>${qr.name || ""}</td><td>${qr.space_name || ""}</td><td><a href="/r/${qr.id}" target="_blank">${BASE_URL}/r/${qr.id}</a></td><td><a href="/qr/${qr.id}.png" target="_blank">Download QR</a></td></tr>`).join("")}</table>
      <h2>Campaigns</h2><table><tr><th>ID</th><th>Advertiser</th><th>Campaign</th><th>URL</th><th>Avg Value</th><th>Conversion</th><th>Archive</th></tr>${campaigns.rows.map(c => `<tr><td>${c.id}</td><td>${c.advertiser || ""}</td><td>${c.name || ""}</td><td>${c.campaign_url || ""}</td><td>${money(c.avg_customer_value)}</td><td>${c.conversion_rate || 10}%</td><td><a href="/admin/archive-campaign/${c.id}">Archive</a></td></tr>`).join("")}</table>
      <h2>Stores / Inventory</h2><table><tr><th>Store</th><th>Address</th><th>Priority</th><th>Units</th><th>Days</th><th>Velocity</th><th>Note</th><th>Edit</th></tr>${stores.rows.map(s => `<tr><td>${s.name || ""}</td><td>${s.address || ""}</td><td>${s.inventory_priority || 0}</td><td>${s.inventory_units || 0}</td><td>${s.days_on_hand || 0}</td><td>${s.inventory_velocity || 0}</td><td>${s.inventory_note || ""}</td><td><a href="/admin/edit-store/${s.id}">Edit</a></td></tr>`).join("")}</table>
    </div>
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
  res.send(page("Add Location", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add Location / Space</h1></div><div class="wrap"><form method="POST" action="/admin/new-location"><label>Name</label><input name="name" required /><label>Market</label><input name="location" placeholder="Naples, FL" /><label>Description</label><input name="description" /><label>Annual Impressions</label><input name="annual_impressions" type="number" value="100000" /><label>Placement Cost</label><input name="placement_cost" type="number" value="800" /><button class="btn" type="submit">Create Location</button></form></div>`));
});
app.post("/admin/new-location", async (req, res) => {
  try {
    await q(`
      INSERT INTO spaces (
        user_id,
        name,
        location,
        annual_impressions,
        placement_cost
      )
      VALUES ($1,$2,$3,$4,$5)
    `, [
      req.session.user.id,
      req.body.name,
      req.body.location,
      Number(req.body.annual_impressions || 0),
      Number(req.body.placement_cost || 800)
    ]);

    res.send("Location created <br><a href='/admin/new-qr'>Create QR</a>");
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

    res.send(
      "QR updated <br><a href='/my-setup'>Back to My Setup</a>"
    );

  } catch (err) {
    res.send("EDIT QR ERROR: " + err.message);
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
  res.send(page("Add QR", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add QR Code</h1></div><div class="wrap"><form method="POST" action="/admin/new-qr"><label>Select Location</label><select name="space_id">${spaces.rows.map(s => `<option value="${s.id}">${s.name} (${s.location})</option>`).join("")}</select><label>QR Name</label><input name="name" placeholder="Car Line QR" /><label>Description</label><input name="description" /><button class="btn" type="submit">Create QR</button></form></div>`));
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

  res.send(
  "QR created<br><br>" +
  "<a href='/r/" + qrId + "'>Open QR URL</a><br>" +
  "<a href='/qr/" + qrId + ".png'>Download QR Code</a><br>" +
  "<a href='/admin/assign'>Assign Campaign</a>"
);
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get("/admin/archive-campaign/:campaignId", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE campaigns
      SET is_archived = true
      WHERE id = $1
    `, [req.params.campaignId]);

    res.send("Campaign archived <br><a href='/admin'>Back to Admin</a>");
  } catch (err) {
    res.send("ARCHIVE ERROR: " + err.message);
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

    res.send("Campaign updated <br><a href='/dashboard'>Back to Dashboard</a>");
  } catch (err) {
    res.send("EDIT CAMPAIGN ERROR: " + err.message);
  }
});
app.get("/admin/restore-campaign/:campaignId", requireLogin, async (req, res) => {
  try {

    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    await q(
      isSuperAdmin
        ? `
          UPDATE campaigns
          SET is_archived = false
          WHERE id = $1
        `
        : `
          UPDATE campaigns
          SET is_archived = false
          WHERE id = $1
          AND user_id = $2
        `,
      isSuperAdmin
        ? [req.params.campaignId]
        : [req.params.campaignId, currentUser.id]
    );

    res.redirect("/my-setup");

  } catch (err) {
    res.send("RESTORE ERROR: " + err.message);
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

        <label>Conversion Rate (%)</label>
        <input name="conversion_rate" value="${c.conversion_rate || 10}" />

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

  res.send(page("New Campaign", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Create Campaign</h1></div><div class="wrap"><form method="POST" action="/admin/new-campaign"><div class="formgrid"><div><label>Customer Account</label>
<select name="user_id">
  ${users.rows.map(u => `
    <option value="${u.id}">
      ${u.email}
    </option>
  `).join("")}
</select><label>Advertiser</label><input name="advertiser" value="Pepsi" /></div><div><label>Campaign Name</label><input name="name" value="Low Inventory Store Push" /></div><div><label>Campaign URL</label><input name="campaign_url" value="https://www.pepsi.com" /></div><div><label>Avg Customer Value</label><input name="avg_customer_value" value="35" /></div><div><label>Conversion Rate (%)</label><input name="conversion_rate" value="10" /></div></div><label><input type="checkbox" name="is_deal_of_day" style="width:auto" /> Deal of the Day</label><br><br><button class="btn" type="submit">Create Campaign</button></form></div>`));
});

app.post("/admin/new-campaign", async (req, res) => {
  try {

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
      Number(req.body.user_id)
    ]);

    res.send("✅ Campaign created <br><a href='/admin/assign'>Go Assign</a>");

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

  const campaigns = await q(`
SELECT *
FROM campaigns
WHERE is_archived = false
ORDER BY id
  `);

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
            day_of_week,
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
          FROM campaigns c
          WHERE cs.id = $1
          AND c.id = cs.campaign_id
          AND c.user_id = $2
          RETURNING cs.id
        `,
      isSuperAdmin
        ? [req.params.scheduleId]
        : [req.params.scheduleId, currentUser.id]
    );

    if (!result.rows[0]) {
      return res.send("Schedule not found or access denied");
    }

    res.redirect("/my-setup");
  } catch (err) {
    res.send("DEACTIVATE SCHEDULE ERROR: " + err.message);
  }
});
app.get("/admin/schedule", async (req, res) => {
  const qrs = await q(`SELECT * FROM qr_codes ORDER BY id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  const schedules = await q(`SELECT cs.*, qr.name AS qr_name, c.name AS campaign_name, c.advertiser FROM campaign_schedules cs LEFT JOIN qr_codes qr ON qr.id = cs.qr_id LEFT JOIN campaigns c ON c.id = cs.campaign_id ORDER BY cs.qr_id, cs.day_of_week, cs.start_time`);
  res.send(page("Campaign Schedule", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Master QR Campaign Schedule</h1><p class="subtitle">Add multiple campaigns to one QR and rotate by day/time.</p></div><div class="wrap"><a class="btn" href="/admin">Admin</a><a class="btn secondary" href="/dashboard">Dashboard</a><form method="POST" action="/admin/schedule"><div class="formgrid"><div><label>Master QR</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select></div><div><label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select></div><div><label>Day</label><select name="day_of_week"><option value="0">Every Day / Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></div><div><label>Start Time</label><input name="start_time" value="00:00" /></div><div><label>End Time</label><input name="end_time" value="23:59" /></div><div><label>Priority</label><input name="priority" type="number" value="100" /></div></div><button class="btn" type="submit">Add Campaign to Master QR</button></form><h2>Current Scheduled Campaigns</h2><table><tr><th>QR</th><th>Advertiser</th><th>Campaign</th><th>Day</th><th>Start</th><th>End</th><th>Priority</th><th>Status</th></tr>${schedules.rows.map(s => `<tr><td>${s.qr_name || s.qr_id}</td><td>${s.advertiser || ""}</td><td>${s.campaign_name || ""}</td><td>${dayLabel(s.day_of_week)}</td><td>${s.start_time}</td><td>${s.end_time}</td><td>${s.priority}</td><td>${s.is_active ? "Active" : "Inactive"}</td><td>
  <a href="/admin/deactivate-schedule/${s.id}">
    Deactivate
  </a>
</td></tr>`).join("")}</table></div>`));
});


app.get("/admin/assign", async (req, res) => {
  const qrs = await q(`SELECT * FROM qr_codes ORDER BY id`);
  const campaigns = await q(`SELECT * FROM campaigns ORDER BY id`);
  res.send(page("Assign Campaign", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Assign Campaign to QR</h1></div><div class="wrap"><form method="POST" action="/admin/assign"><label>QR Code</label><select name="qr_id">${qrs.rows.map(qr => `<option value="${qr.id}">${qr.id} - ${qr.name || "QR"}</option>`).join("")}</select><label>Campaign</label><select name="campaign_id">${campaigns.rows.map(c => `<option value="${c.id}">${c.advertiser || ""} - ${c.name || ""}</option>`).join("")}</select><button class="btn" type="submit">Assign Campaign</button></form></div>`));
});
app.post("/admin/assign", requireLogin, async (req, res) => {
  try {
    await q(`
      UPDATE qr_campaigns
      SET is_active = false,
          ended_at = CURRENT_TIMESTAMP
      WHERE qr_id = $1
    `, [req.body.qr_id]);

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

    res.send(
      "Campaign assigned <br><a href='/r/" +
      req.body.qr_id +
      "'>Test QR</a> | <a href='/dashboard'>Dashboard</a>"
    );
  } catch (err) {
    res.send("ASSIGN ERROR: " + err.message);
  }
});
app.post("/admin/schedule", requireLogin, async (req, res) => {
  try {
    await q(`
      INSERT INTO campaign_schedules (
        qr_id,
        campaign_id,
        day_of_week,
        start_time,
        end_time,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,true)
    `, [
      Number(req.body.qr_id),
      Number(req.body.campaign_id),
      Number(req.body.day_of_week || 0),
      req.body.start_time || "00:00",
      req.body.end_time || "23:59",
      Number(req.body.priority || 50)
    ]);

    res.send(
      "Campaign scheduled <br><a href='/admin/schedule'>Back to Schedule</a> | <a href='/r/" +
      req.body.qr_id +
      "'>Test QR</a>"
    );
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
            <td>${new Date(e.created_at).toLocaleString()}</td>
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
            <td>${new Date(e.created_at).toLocaleString()}</td>
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
  const result = await q(`SELECT e.id,e.created_at,e.type,e.qr_id,qr.name AS qr_name,e.campaign_id,c.name AS campaign,c.advertiser,e.store_id,st.name AS store FROM events e LEFT JOIN qr_codes qr ON qr.id=e.qr_id LEFT JOIN campaigns c ON c.id=e.campaign_id LEFT JOIN stores st ON st.id=e.store_id ORDER BY e.created_at DESC`);
  const header = "id,created_at,type,qr_id,qr_name,campaign_id,campaign,advertiser,store_id,store\n";
  const rows = result.rows.map(r => [r.id,r.created_at,r.type,r.qr_id,r.qr_name,r.campaign_id,r.campaign,r.advertiser,r.store_id,r.store].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=vivid-events.csv");
  res.send(header + rows);
});

app.get("/analytics", async (req, res) => {
  const result = await q(`SELECT COUNT(*) FILTER (WHERE type='scan') AS scans, COUNT(*) FILTER (WHERE type='offer') AS offer_clicks, COUNT(*) FILTER (WHERE type='maps') AS maps_clicks, COUNT(*) FILTER (WHERE type='waze') AS waze_clicks, COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks FROM events`);
  res.json(result.rows[0]);
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
