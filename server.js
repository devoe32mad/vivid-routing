const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const PDFDocument = require("pdfkit");
const crypto = require("crypto");
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
function dateLabel(d, fallback = "Not Set") {
  if (!d) return fallback;

  const date = new Date(d);

  if (isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString();
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
function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function inclusiveDays(start, end) {
  if (!start || !end) return 1;
  return Math.max(
    1,
    Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
  );
}

function overlapsDay(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
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
 Performance Insights </a>

 

 
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
function orgPage(title, body) {
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
    .subtitle{color:#d7eadb;margin:0}
    .wrap{padding:30px 40px;max-width:1250px;margin:0 auto}
    .btn{display:inline-block;background:#2f7d46;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:bold;margin:5px 8px 5px 0;border:0;cursor:pointer}
    .btn.secondary{background:#123d25}
    .card{background:white;border-radius:18px;padding:18px;box-shadow:0 8px 22px rgba(0,0,0,.08);margin:14px 0}
    input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #cfdacf;margin:6px 0 14px;font-size:15px;box-sizing:border-box}
    a{color:#176b3a;font-weight:bold}
 @media(max-width:1250px){
  .org-location-grid{
    grid-template-columns:repeat(4,minmax(0,1fr)) !important;
  }
}

@media(max-width:980px){
  .org-location-grid{
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
  }
}

@media(max-width:720px){
  .org-location-grid{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
  }
}

@media(max-width:480px){
  .org-location-grid{
    grid-template-columns:1fr !important;
  }
}
  </style>
</head>
<body>
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
function getOrgDateFilter(req) {
  const fromDate = String(req.query.from || "").trim();
  const toDate = String(req.query.to || "").trim();

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (
    (fromDate && !datePattern.test(fromDate)) ||
    (toDate && !datePattern.test(toDate))
  ) {
    return {
      error: "Invalid date range."
    };
  }

  if (
    fromDate &&
    toDate &&
    fromDate > toDate
  ) {
    return {
      error: "From date cannot be after To date."
    };
  }

  const queryString = new URLSearchParams();

  if (fromDate) {
    queryString.set("from", fromDate);
  }

  if (toDate) {
    queryString.set("to", toDate);
  }

  return {
    fromDate,
    toDate,
    queryString: queryString.toString()
  };
}
function orgDateFilterForm({
  action,
  fromDate,
  toDate
}) {
  return `
    <form
      method="GET"
      action="${action}"
      style="
        background:white;
        border-radius:14px;
        padding:14px 16px;
        box-shadow:0 5px 14px rgba(0,0,0,.07);
        display:flex;
        align-items:end;
        gap:12px;
        flex-wrap:wrap;
        margin:0 0 22px;
      "
    >
      <div style="min-width:165px;">
        <label style="
          display:block;
          font-size:11px;
          color:#65776b;
          margin-bottom:4px;
        ">
          From
        </label>

        <input
          type="date"
          name="from"
          value="${fromDate}"
          style="margin:0;"
        >
      </div>

      <div style="min-width:165px;">
        <label style="
          display:block;
          font-size:11px;
          color:#65776b;
          margin-bottom:4px;
        ">
          To
        </label>

        <input
          type="date"
          name="to"
          value="${toDate}"
          style="margin:0;"
        >
      </div>

      <button
        class="btn"
        type="submit"
        style="margin:0;"
      >
        Apply
      </button>

      ${
        fromDate || toDate
          ? `
            <a
              class="btn secondary"
              href="${action}"
              style="margin:0;"
            >
              Clear
            </a>
          `
          : ""
      }
    </form>
  `;
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
function requireOrgLogin(req, res, next) {
  if (!req.session.orgUser) {
    return res.redirect("/org-login");
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
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      name TEXT NOT NULL,
      organization_type TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      website TEXT,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
await q(`
  CREATE TABLE IF NOT EXISTS organization_users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'owner',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, user_id)
  )
`);
 await q(`
  CREATE TABLE IF NOT EXISTS location_users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    space_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'manager',
    can_manage_contracts BOOLEAN DEFAULT true,
    can_manage_pricing BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (space_id, user_id)
  )
`);
  await q(`
    CREATE TABLE IF NOT EXISTS advertisers (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      website TEXT,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      organization_id INTEGER,
      advertiser_id INTEGER,
      contract_name TEXT NOT NULL,
      contract_type TEXT,
      start_date DATE,
      end_date DATE,
      total_contract_value NUMERIC DEFAULT 0,
      billing_frequency TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS contract_items (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER,
      space_id INTEGER,
      qr_code_id INTEGER,
      campaign_id INTEGER,
      item_description TEXT,
      item_value NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS revenue_share_rules (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      organization_id INTEGER,
      advertiser_id INTEGER,
      contract_id INTEGER,
      revenue_type TEXT DEFAULT 'placement',
      vivid_percent NUMERIC DEFAULT 0,
      organization_percent NUMERIC DEFAULT 100,
      partner_percent NUMERIC DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await q(`
    ALTER TABLE spaces
    ADD COLUMN IF NOT EXISTS organization_id INTEGER
  `);

  await q(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS advertiser_id INTEGER
  `);
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
  ALTER TABLE qr_campaigns
  ADD COLUMN IF NOT EXISTS contract_days INT
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
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS conversion_url TEXT
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
  // Organizations: create one default organization for each customer
  await q(`
    INSERT INTO organizations (customer_id, name)
    SELECT
      c.id,
      COALESCE(NULLIF(c.name, ''), 'Default Organization')
    FROM customers c
    WHERE NOT EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.customer_id = c.id
    )
  `);
await q(`
  INSERT INTO organizations (customer_id, name)
  SELECT
    u.id,
    COALESCE(NULLIF(u.email, ''), 'Default Organization')
  FROM users u
  WHERE u.role = 'customer'
    AND NOT EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.customer_id = u.id
    )
`);
await q(`
  INSERT INTO organization_users (
    organization_id,
    user_id,
    role
  )
  SELECT
    o.id,
    o.customer_id,
    'owner'
  FROM organizations o
  WHERE o.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM organization_users ou
      WHERE ou.organization_id = o.id
        AND ou.user_id = o.customer_id
    )
`);
  await q(`
  UPDATE spaces s
  SET organization_id = o.id
  FROM organizations o
  WHERE
    s.organization_id IS NULL
    AND s.user_id = o.customer_id
`);
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
  ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT false
`);

await q(`
  UPDATE qr_codes
  SET is_imported = true
  WHERE description IS NOT NULL
  AND description LIKE 'http%'
`);
  await q(`
  ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT false
`);

await q(`
  UPDATE qr_codes
  SET is_imported = true
  WHERE description IS NOT NULL
  AND description LIKE 'http%'
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
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS start_date DATE
`);

await q(`
  ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS end_date DATE
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
    contract_days INT,
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
  )`);
await q(`
ALTER TABLE qr_campaigns
ADD COLUMN IF NOT EXISTS contract_days INT
`);
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
await q(`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0
`);
  await q(`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS vivid_click_id TEXT
`);

await q(`
  ALTER TABLE events
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP
`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS annual_impressions INT DEFAULT 146000`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS placement_cost INT DEFAULT 800`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS host_payout INT DEFAULT 300`);
  await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS live_date DATE`);
await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS end_date DATE`);
await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await q(`
  UPDATE spaces
  SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
      end_date = COALESCE(end_date, CURRENT_DATE)
  WHERE COALESCE(is_archived,false) = true
`);
await q(`ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS live_date DATE`);
await q(`ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS end_date DATE`);
  await q(`ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 800`);
  await q(`
  UPDATE qr_codes
  SET total_cost = COALESCE(total_cost, annual_cost, 800)
  WHERE total_cost IS NULL OR total_cost = 0
`);
await q(`ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await q(`
UPDATE qr_codes
SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
    end_date = COALESCE(end_date, CURRENT_DATE)
WHERE COALESCE(is_archived,false) = true
`);
await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS live_date DATE`);
await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date DATE`);
  await q(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
await q(`
  UPDATE campaigns
  SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
      end_date = COALESCE(end_date, CURRENT_DATE)
  WHERE COALESCE(is_archived,false) = true
`);
await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS live_date DATE`);
await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS end_date DATE`);
 await q(`ALTER TABLE campaign_schedules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`); 
  await q(`
  UPDATE campaign_schedules
  SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
      end_date = COALESCE(end_date, CURRENT_DATE)
  WHERE COALESCE(is_active,false) = false
`);
  await q(`UPDATE spaces SET live_date = created_at::date WHERE live_date IS NULL`);

await q(`UPDATE qr_codes SET live_date = created_at::date WHERE live_date IS NULL`);

await q(`UPDATE campaigns SET live_date = created_at::date WHERE live_date IS NULL`);

await q(`UPDATE campaign_schedules SET live_date = created_at::date WHERE live_date IS NULL`);
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
  ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS organization_id INT
`);
  await q(`
  UPDATE spaces s
  SET organization_id = o.id
  FROM organizations o
  WHERE s.organization_id IS NULL
    AND o.customer_id = s.user_id
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

function safeDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;

  return Math.max(1, daysBetween(startDate, endDate));
}

async function allocatedSpotCostForCampaign(campaignId, startDate, endDate) {
  const result = await q(`
    WITH assignment_windows AS (
      SELECT *
      FROM qr_campaigns qc
      WHERE qc.campaign_id = $1
    )
    SELECT
      COALESCE(SUM(
        (
          COALESCE(qr.total_cost, qr.annual_cost, s.placement_cost, 0)
          /
          GREATEST(
            1,
            (
              COALESCE(qr.end_date::date, CURRENT_DATE)
              -
              COALESCE(qr.live_date::date, CURRENT_DATE)
              + 1
            )
          )::numeric
        )
        *
        GREATEST(
          0,
          (
            LEAST(
              COALESCE(qr.end_date::date, CURRENT_DATE),
              COALESCE(NULLIF($3,'')::date, CURRENT_DATE),
              CURRENT_DATE,
              COALESCE(aw.ended_at::date, CURRENT_DATE)
            )
            -
            GREATEST(
              COALESCE(qr.live_date::date, CURRENT_DATE),
              COALESCE(DATE(aw.started_at), DATE(aw.assigned_at), CURRENT_DATE),
              COALESCE(NULLIF($2,'')::date, COALESCE(qr.live_date::date, CURRENT_DATE))
            )
            + 1
          )
        )
      ), 0) AS allocated_cost
    FROM assignment_windows aw
    JOIN qr_codes qr ON qr.id = aw.qr_id
    LEFT JOIN spaces s ON s.id = qr.space_id
  `, [campaignId, startDate, endDate]);

  return Number(result.rows[0]?.allocated_cost || 0);
}

async function allocatedSpotCostForQr(qrId, startDate, endDate) {
  const result = await q(`
    SELECT
      COALESCE(
        (
          COALESCE(qr.total_cost, qr.annual_cost, s.placement_cost, 0)
          /
          GREATEST(
            1,
            (
              COALESCE(qr.end_date::date, CURRENT_DATE)
              -
              COALESCE(qr.live_date::date, qr.created_at::date, CURRENT_DATE)
              + 1
            )
          )::numeric
        )
        *
        GREATEST(
          0,
          (
            LEAST(
              COALESCE(qr.end_date::date, $3::date),
              $3::date
            )
            -
            GREATEST(
              COALESCE(qr.live_date::date, qr.created_at::date, $2::date),
              $2::date
            )
            + 1
          )
        ),
        0
      ) AS allocated_cost
    FROM qr_codes qr
    LEFT JOIN spaces s ON s.id = qr.space_id
    WHERE qr.id = $1
  `, [qrId, startDate, endDate]);

  return Number(result.rows[0]?.allocated_cost || 0);
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

async function saveEvent({
  qrId,
  campaignId,
  storeId = null,
  type,
  value = 0,
  vividClickId = null
}) {
  const result = await q(
    `INSERT INTO events (
      qr_id,
      campaign_id,
      store_id,
      type,
      value,
      vivid_click_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      qrId,
      campaignId,
      storeId,
      type,
      Number(value || 0),
      vividClickId
    ]
  );

  return result.rows[0];
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
app.get("/platform-admin", requireLogin, requireSuperAdmin, async (req, res) => {
  res.send(page("Platform Admin", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Platform Admin</h1>
      <p class="subtitle">Super Admin control center for Vivid platform management.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Organizations</h2>
        <p>Create, manage, archive, and review organizations.</p>
        <a class="btn" href="/org-organizations">Open Organizations</a>
      </div>

      <div class="card">
        <h2>Users</h2>
        <p>Manage platform users and access.</p>
        <a class="btn secondary" href="#">Coming Soon</a>
      </div>

      <div class="card">
        <h2>Customers</h2>
        <p>Manage customers and accounts.</p>
        <a class="btn secondary" href="#">Coming Soon</a>
      </div>

    </div>
  `));
});
app.get("/db-test", async (req, res) => {
  const result = await q("SELECT NOW()");
  res.json(result.rows[0]);
});
app.get("/debug-clear-location-end-date/:locationId", requireLogin, requireSuperAdmin, async (req, res) => {
  try {
    const locationId = Number(req.params.locationId);

    await q(`
      UPDATE spaces
      SET
        end_date = NULL,
        archived_at = NULL
      WHERE id = $1
        AND COALESCE(is_archived, false) = false
    `, [locationId]);

    res.send("Active location end date cleared.");
  } catch (err) {
    res.status(500).send(
      "CLEAR LOCATION END DATE ERROR: " + err.message
    );
  }
});
app.get("/debug-my-spaces", requireLogin, async (req, res) => {
  try {
    const rows = await q(`
      SELECT
        id,
        name,
        location,
        user_id,
        organization_id,
        is_archived,
        created_at
      FROM spaces
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 20
    `, [req.session.user.id]);

    res.json(rows.rows);
  } catch (err) {
    res.status(500).send("DEBUG MY SPACES ERROR: " + err.message);
  }
});
app.get("/debug-orgs", requireLogin, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    const orgs = await q(`
      SELECT id, customer_id, name, is_active
      FROM organizations
      ORDER BY id
    `);
const orgUsers = await q(`
  SELECT *
  FROM organization_users
  ORDER BY id
`);
   const locationUsers = await q(`
  SELECT *
  FROM location_users
  ORDER BY id
`);
    const customers = await q(`
      SELECT id, name, email
      FROM customers
      ORDER BY id
    `);

    const users = await q(`
     SELECT *
FROM users
ORDER BY id
    `);
const spaces = await q(`
  SELECT id, name, user_id, organization_id
  FROM spaces
  ORDER BY id
`);
    res.json({
      sessionUser,
      organization_users: orgUsers.rows,
        location_users: locationUsers.rows,
      spaces: spaces.rows,
      organizations: orgs.rows,
      customers: customers.rows,
      users: users.rows
    });

  } catch (err) {
    res.status(500).send("DEBUG ORGS ERROR: " + err.message);
  }
});
app.get("/debug-cost-fields", requireLogin, async (req, res) => {
  const rows = await q(`
    SELECT
      qr.id,
      qr.name,
      qr.live_date,
      qr.end_date,
      qr.annual_cost,
      qr.total_cost,
      s.placement_cost
    FROM qr_codes qr
    LEFT JOIN spaces s ON s.id = qr.space_id
    ORDER BY qr.id
  `);

  res.json(rows.rows);
});
app.get("/debug-clean-duplicate-assignments", requireLogin, async (req, res) => {
  try {

    const result = await q(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY qr_id, campaign_id
            ORDER BY id DESC
          ) AS rn
        FROM qr_campaigns
        WHERE COALESCE(is_active,true)=true
      )
      UPDATE qr_campaigns qc
      SET is_active = false
      FROM ranked r
      WHERE qc.id = r.id
        AND r.rn > 1
      RETURNING
        qc.id,
        qc.qr_id,
        qc.campaign_id;
    `);

    res.json({
      deactivated: result.rowCount,
      rows: result.rows
    });

  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.get("/debug-preview-assignment-cleanup", requireLogin, async (req, res) => {
  try {
    const result = await q(`
      SELECT
        qc.*,
        ROW_NUMBER() OVER (
          PARTITION BY qr_id, campaign_id
          ORDER BY id DESC
        ) AS keep_rank
      FROM qr_campaigns qc
      WHERE COALESCE(is_active,true) = true
      ORDER BY qr_id, campaign_id, id DESC
    `);

    res.json({
      keep: result.rows.filter(r => Number(r.keep_rank) === 1),
      deactivate: result.rows.filter(r => Number(r.keep_rank) > 1)
    });

  } catch (err) {
    res.status(500).send("PREVIEW CLEANUP ERROR: " + err.message);
  }
});
app.get("/debug-duplicate-assignments", requireLogin, async (req, res) => {
  try {
    const result = await q(`
      SELECT
        qr_id,
        campaign_id,
        COUNT(*) AS active_rows
      FROM qr_campaigns
      WHERE COALESCE(is_active,true) = true
      GROUP BY qr_id, campaign_id
      HAVING COUNT(*) > 1
      ORDER BY active_rows DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.get(
  "/debug-fix-ccps-admin-membership",
  requireLogin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const userResult = await q(`
        SELECT id, email
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `, ["testtest@test.com"]);

      const user = userResult.rows[0];

      if (!user) {
        return res.status(404).send("CCPS test user not found.");
      }

      const ccpsResult = await q(`
        SELECT id, name
        FROM organizations
        WHERE id = 13
          AND name = 'CCPS'
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `);

      const ccps = ccpsResult.rows[0];

      if (!ccps) {
        return res.status(404).send("Active CCPS organization 13 not found.");
      }

      /*
        Keep CCPS membership active.
      */
      await q(`
        UPDATE organization_users
        SET is_active = true,
            role = 'owner'
        WHERE user_id = $1
          AND organization_id = $2
      `, [user.id, ccps.id]);

      /*
        Deactivate this test user's memberships in every other organization.
        No organization or Vivid operational data is deleted.
      */
      await q(`
        UPDATE organization_users
        SET is_active = false
        WHERE user_id = $1
          AND organization_id <> $2
      `, [user.id, ccps.id]);

      const memberships = await q(`
        SELECT
          ou.organization_id,
          o.name,
          ou.role,
          ou.is_active
        FROM organization_users ou
        JOIN organizations o
          ON o.id = ou.organization_id
        WHERE ou.user_id = $1
        ORDER BY ou.organization_id
      `, [user.id]);

      res.json({
        message: "CCPS district-admin membership corrected.",
        user: {
          id: user.id,
          email: user.email
        },
        active_organization: {
          id: ccps.id,
          name: ccps.name
        },
        memberships: memberships.rows
      });

    } catch (err) {
      res.status(500).send(
        "CCPS MEMBERSHIP FIX ERROR: " + err.message
      );
    }
  }
);
app.get("/debug-qr-math/:qrId", requireLogin, async (req, res) => {
  try {
    const qrId = Number(req.params.qrId);
    const start = req.query.start || req.query.start_date || "";
    const end = req.query.end || req.query.end_date || "";

    const qr = await q(`
      SELECT
        qr.id,
        qr.name,
        qr.live_date,
        qr.end_date,
        qr.total_cost,
        qr.annual_cost,
        s.name AS location_name,
        s.placement_cost
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE qr.id = $1
    `, [qrId]);

    const assignments = await q(`
      SELECT
        qc.id AS assignment_id,
        qc.qr_id,
        qc.campaign_id,
        c.name AS campaign_name,
        c.advertiser,
        qc.is_active,
        qc.assigned_at,
        qc.started_at,
        qc.ended_at,
        c.start_date AS campaign_start_date,
        c.end_date AS campaign_end_date
      FROM qr_campaigns qc
      LEFT JOIN campaigns c ON c.id = qc.campaign_id
      WHERE qc.qr_id = $1
      ORDER BY qc.id
    `, [qrId]);

    const events = await q(`
      SELECT
        e.type,
        e.campaign_id,
        c.name AS campaign_name,
        COUNT(*)::int AS count,
        COALESCE(SUM(e.value),0)::numeric(12,2) AS value
      FROM events e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.qr_id = $1
        AND ($2::text = '' OR e.created_at::date >= $2::date)
        AND ($3::text = '' OR e.created_at::date <= $3::date)
      GROUP BY e.type, e.campaign_id, c.name
      ORDER BY e.type, e.campaign_id
    `, [qrId, start, end]);

    const qrCost = await allocatedSpotCostForQr(qrId, start, end);

    const campaignCosts = [];
    for (const a of assignments.rows) {
      if (!a.campaign_id) continue;

      const cost = await allocatedSpotCostForCampaign(
        a.campaign_id,
        start,
        end
      );

      campaignCosts.push({
        campaign_id: a.campaign_id,
        campaign_name: a.campaign_name,
        advertiser: a.advertiser,
        allocated_campaign_cost: cost
      });
    }

    res.json({
      filter: { start, end },
      qr: qr.rows[0],
      qr_cost: qrCost,
      assignments: assignments.rows,
      events: events.rows,
      campaign_costs: campaignCosts
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
app.get("/debug-org-location-link/:orgId", requireLogin, async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);

    const organization = await q(`
      SELECT
        id,
        name,
        is_active
      FROM organizations
      WHERE id = $1
      LIMIT 1
    `, [orgId]);

    const spaces = await q(`
      SELECT
        id,
        name,
        location,
        user_id,
        organization_id,
        is_archived,
        live_date,
        end_date
      FROM spaces
      WHERE organization_id = $1
      ORDER BY id
    `, [orgId]);

    res.json({
      organization: organization.rows[0] || null,
      spaces: spaces.rows
    });

  } catch (err) {
    res.status(500).send(
      "DEBUG ORG LOCATION LINK ERROR: " + err.message
    );
  }
});
app.get("/debug-conversions", async (req, res) => {
  const result = await q(`
    SELECT id, qr_id, campaign_id, type, value, created_at
    FROM events
    WHERE type = 'conversion'
    ORDER BY id DESC
    LIMIT 20
  `);

  res.json(result.rows);
});
function addVividClickIdToUrl(destinationUrl, vividClickId) {
  if (!destinationUrl || !vividClickId) {
    return destinationUrl || "/";
  }

  const separator =
    destinationUrl.includes("?") ? "&" : "?";

  return `${destinationUrl}${separator}vivid_click_id=${encodeURIComponent(vividClickId)}`;
}
app.get("/debug-puma-assignments", requireLogin, async (req, res) => {
  const rows = await q(`
    SELECT
      qc.id,
      qc.qr_id,
      qr.name AS qr_name,
      qc.campaign_id,
      c.name AS campaign_name,
      qc.assigned_at,
      qc.started_at,
      qc.ended_at,
      qc.is_active,
      c.start_date,
      c.end_date
    FROM qr_campaigns qc
    JOIN qr_codes qr ON qr.id = qc.qr_id
    JOIN campaigns c ON c.id = qc.campaign_id
    WHERE qc.campaign_id = 46
    ORDER BY qc.qr_id, qc.id
  `);

  res.json(rows.rows);
});
app.get("/debug-qr-assignments/:qrId", requireLogin, async (req, res) => {
  try {
    const qrId = Number(req.params.qrId);

    const result = await q(`
      SELECT
        qc.id,
        qc.qr_id,
        qc.campaign_id,
        c.name AS campaign_name,
        c.advertiser,
        qc.is_active,
        qc.assigned_at,
        qc.started_at,
        qc.ended_at
      FROM qr_campaigns qc
      LEFT JOIN campaigns c ON c.id = qc.campaign_id
      WHERE qc.qr_id = $1
      ORDER BY qc.id
    `, [qrId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("DEBUG QR ASSIGNMENTS ERROR: " + err.message);
  }
});
app.get("/debug-users-spaces", requireLogin, async (req, res) => {
  const users = await q(`
SELECT id, email, role
FROM users
WHERE id IN (7,12)
`);
  const spaces = await q(`SELECT id, name, user_id FROM spaces ORDER BY id DESC`);
  const campaigns = await q(`SELECT id, name, user_id FROM campaigns ORDER BY id DESC`);

  res.json({
    loggedInUser: req.session.user,
    users: users.rows,
    spaces: spaces.rows,
    campaigns: campaigns.rows
  });
});
async function activeCampaignForQr(qrId) {
  const result = await q(`
    SELECT
      c.*,
      qc.campaign_id,
      qr.name AS qr_name,
      s.name AS space_name
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    JOIN qr_codes qr ON qr.id = qc.qr_id
    LEFT JOIN spaces s ON s.id = qr.space_id
    WHERE qc.qr_id = $1
      AND COALESCE(qc.is_active, true) = true
      AND COALESCE(c.is_archived, false) = false
      AND (
        c.start_date IS NULL
        OR c.start_date <= CURRENT_DATE
      )
      AND (
        c.end_date IS NULL
        OR c.end_date >= CURRENT_DATE
      )
    ORDER BY qc.id DESC
    LIMIT 1
  `, [qrId]);

  return result.rows[0] || null;
}
app.get("/r/:qrId", async (req, res) => {
  const qrId = Number(req.params.qrId);
  const vividClickId = crypto.randomUUID();
  const importedQr = await q(`
  SELECT *
FROM qr_codes
WHERE id = $1
AND is_imported = true
AND description IS NOT NULL
AND description LIKE 'http%'
`, [qrId]);

if (importedQr.rows[0]) {
  const campaign = await activeCampaignForQr(qrId);

  await saveEvent({
    qrId,
    campaignId: campaign?.id || campaign?.campaign_id || null,
    type: "scan",
    vividClickId
  });

  return res.redirect(
    addVividClickIdToUrl(importedQr.rows[0].description, vividClickId)
  );
}


  const campaign = await activeCampaignForQr(qrId);
  if (!campaign) return res.status(404).send("No active campaign assigned to this QR.");
  await saveEvent({
  qrId,
  campaignId: campaign.id,
  type: "scan",
  vividClickId
});
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
      <a class="choice-btn" href="/click/offer/${qrId}?vivid_click_id=${encodeURIComponent(vividClickId)}">View Offer</a>
  <a class="choice-btn dark" href="/click/maps/${qrId}?vivid_click_id=${encodeURIComponent(vividClickId)}">Find Store on Google Maps</a>
     <a class="choice-btn dark" href="/click/waze/${qrId}?vivid_click_id=${encodeURIComponent(vividClickId)}">Open in Waze</a>
      <p class="small">Vivid routes traffic based on campaign, performance, schedule, and inventory priority.</p>
    </div></div>
  `));
});
app.get("/conversion", async (req, res) => {
  try {
    const vividClickId = req.query.vivid_click_id || req.query.click_id;
    const pageUrl = req.query.page_url || "";
    let value = req.query.value !== undefined
  ? Number(req.query.value || 0)
  : null;

    if (!vividClickId) {
      return res.status(400).send("Missing vivid_click_id");
    }

    const scanResult = await q(`
      SELECT *
      FROM events
      WHERE vivid_click_id = $1
      AND type = 'scan'
      LIMIT 1
    `, [vividClickId]);

    const scan = scanResult.rows[0];

    if (!scan) {
      return res.status(400).send("Invalid vivid_click_id");
    }

    if (scan.converted_at) {
      return res.status(200).send("Conversion already tracked");
    }
const campaignValueResult = await q(
  `
  SELECT avg_customer_value, conversion_url
  FROM campaigns
  WHERE id = $1
  LIMIT 1
  `,
  [scan.campaign_id]
);

const campaign = campaignValueResult.rows[0];

if (!campaign) {
  return res.status(400).send("Campaign not found");
}

if (!campaign.conversion_url) {
  return res.status(400).send("Missing conversion URL");
}

if (!pageUrl) {
  return res.status(400).send("Missing page URL");
}

const expectedUrl = new URL(campaign.conversion_url);
const actualUrl = new URL(pageUrl);

const expectedPath = expectedUrl.pathname.replace(/\/$/, "");
const actualPath = actualUrl.pathname.replace(/\/$/, "");

if (
  expectedUrl.hostname !== actualUrl.hostname ||
  expectedPath !== actualPath
) {
  return res.status(200).send("Not conversion page");
}

value = Number(campaign.avg_customer_value || 0);
  

    await saveEvent({
      qrId: scan.qr_id,
      campaignId: scan.campaign_id,
      storeId: scan.store_id,
      type: "conversion",
      value,
      vividClickId
    });

    await q(`
      UPDATE events
      SET converted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [scan.id]);

    return res.status(200).send("Conversion tracked");
  } catch (err) {
    return res.status(500).send("CONVERSION TRACKING ERROR: " + err.message);
  }
});
app.get("/vivid-conversion.js", (req, res) => {
  res.type("application/javascript");

  res.send(`
(function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const clickId = params.get("vivid_click_id");

    if (!clickId) return;

fetch("${BASE_URL}/conversion?vivid_click_id=" 
  + encodeURIComponent(clickId) 
  + "&page_url=" 
  + encodeURIComponent(window.location.href), {
  method: "GET",
  mode: "no-cors"
});
  } catch (err) {
    console.error("Vivid conversion tracking error", err);
  }
})();
  `);
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
 if (type === "offer") {
  const vividClickId = req.query.vivid_click_id || req.query.click_id;
  return res.redirect(
    addVividClickIdToUrl(campaign.campaign_url || "/", vividClickId)
  );
}
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
<a href="/admin/conversion-tracking" style="text-decoration:none;color:inherit;">
  Conversion Tracking →
</a>
</h2>

<ul>
  <li>Track purchases, registrations, appointments, and form submissions.</li>
  <li>Automatically attribute conversions to the originating QR Code and Campaign.</li>
  <li>Calculate Customer Value, Revenue, and ROI.</li>
  <li>Install a single tracking code on your thank-you or confirmation page.</li>
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
app.get("/admin/conversion-tracking", requireLogin, async (req, res) => {
  res.send(page("Conversion Tracking", `
    <div class="card">

      <h1>Conversion Tracking</h1>

      <p>
        Create and manage conversion tracking for campaigns.
      </p>

      <h2>Install Conversion Tracking →</h2>
      <ul>
        <li>Copy the Vivid tracking code from Create Campaign or Edit Campaign.</li>
        <li>Paste the code before the closing &lt;/body&gt; tag on your thank-you or confirmation page.</li>
        <li>Only one installation is required per website.</li>
      </ul>

      <h2>Supported Conversion Types →</h2>
      <ul>
        <li>Purchases</li>
        <li>Registrations</li>
        <li>Appointments</li>
        <li>Reservations</li>
        <li>Form Submissions</li>
      </ul>

      <h2>Attribution →</h2>
      <ul>
        <li>Conversions are automatically attributed to the originating QR Code.</li>
        <li>Conversions are automatically attributed to the originating Campaign.</li>
        <li>No API integration is required.</li>
        <li>Only conversions originating from a valid Vivid QR scan are recorded.</li>
      </ul>

      <h2>Reporting →</h2>
      <ul>
       <li>View Conversions by QR Code.</li>
<li>View Revenue generated from conversions.</li>
<li>View Actual Customer Value.</li>
<li>Measure ROI using real conversion data.</li>
      </ul>

      <h2>Example Installation →</h2>

      <textarea readonly
        style="width:100%;height:70px;padding:10px;font-family:monospace;border-radius:6px;">
<script src="https://vivid-routing-production.up.railway.app/vivid-conversion.js"></script>
      </textarea>

      <p>
        Paste immediately before:
      </p>

      <pre style="background:#f8f8f8;padding:12px;border-radius:8px;">&lt;/body&gt;</pre>

      <h2>Notes →</h2>
      <ul>
        <li>Only valid Vivid QR scans are tracked.</li>
        <li>Only visitors originating from a Vivid QR scan are eligible for conversion tracking.</li>
        <li>Revenue is calculated using the Campaign's Actual Customer Value.</li>
        <li>ROI is updated automatically.</li>
        <li>No API setup is required.</li>
      </ul>

      <a class="btn" href="/help">Back to Help Center</a>

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
app.get("/org-login", (req, res) => {
  res.send(orgPage("Organization Login", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Organization Portal</h1>
      <p class="subtitle">Access contracts, users, pricing, and organization-level reporting.</p>
    </div>

    <div class="wrap">
      <form method="POST" action="/org-login">
        <label>Email</label>
        <input name="email" type="email" required />

        <label>Password</label>
        <input name="password" type="password" required />

        <button class="btn" type="submit">Login to Organization Portal</button>
      </form>
    </div>
  `));
});
app.post("/org-login", async (req, res) => {
  try {
    const result = await q(`
      SELECT
        u.id AS user_id,
        u.email,
        u.role AS platform_role,

        o.id AS organization_id,
        o.name AS organization_name,

        ou.role AS organization_role

      FROM users u

      JOIN organization_users ou
        ON ou.user_id = u.id
       AND COALESCE(ou.is_active, true) = true

      JOIN organizations o
        ON o.id = ou.organization_id
       AND COALESCE(o.is_active, true) = true

      WHERE LOWER(u.email) = LOWER($1)
        AND u.password = $2

      ORDER BY o.id
    `, [
      req.body.email,
      req.body.password
    ]);

    if (result.rows.length === 0) {
      return res.send(`
        Invalid Organization Portal login or no active organization access.
        <br><br>
        <a href="/org-login">Try Again</a>
      `);
    }

    /*
      A user should have one active organization for automatic login.

      We are intentionally not guessing when duplicate organization
      memberships exist.
    */
    if (result.rows.length > 1) {
      return res.status(409).send(`
        This user is connected to more than one active organization.
        The organization memberships must be corrected before login.
        <br><br>
        <a href="/org-login">Back to Organization Login</a>
      `);
    }

    const user = result.rows[0];

    req.session.orgUser = {
      id: user.user_id,
      email: user.email,

      organization_id: user.organization_id,
      organization_name: user.organization_name,
      organization_role: user.organization_role
    };

  /*
  Organization-level admins land on their
  Organization Executive Dashboard.
*/
if (
  ["owner", "organization_admin", "district_admin"].includes(
    String(user.organization_role || "").toLowerCase()
  )
) {
  return res.redirect(
    `/org-organization/${user.organization_id}`
  );
}

return res.status(403).send(
  "This Organization Portal role does not have a valid landing page yet."
);

  } catch (err) {
    console.error("ORG LOGIN ERROR:", err);

    return res.status(500).send(
      "ORG LOGIN ERROR: " + err.message
    );
  }
});
app.get("/org-dashboard", requireOrgLogin, (req, res) => {
  res.send(orgPage("Organization Dashboard", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Organization Dashboard</h1>
    </div>

    <div class="wrap">

     

      <div class="card">
        <h2>Locations</h2>
        <p>Manage organization locations.</p>
        <a class="btn" href="/org-locations">Open</a>
      </div>

      <div class="card">
        <h2>Users</h2>
        <p>District, principals, ADs, managers.</p>
        <a class="btn" href="/org-users">Open</a>
      </div>

      <div class="card">
        <h2>Contracts</h2>
        <p>Contract dates, pricing and renewals.</p>
        <a class="btn" href="/org-contracts">Open</a>
      </div>

    </div>
  `));
});
app.get("/org-organizations", requireLogin, requireSuperAdmin, async (req, res) => {
  try {

    const orgs = await q(`
      SELECT
        o.id,
        o.name,
        COALESCE(o.organization_type,'') AS organization_type,
        o.is_active,
        COUNT(DISTINCT s.id) AS location_count,
        COUNT(DISTINCT ou.user_id) AS user_count
      FROM organizations o
      LEFT JOIN spaces s
        ON s.organization_id = o.id
       AND COALESCE(s.is_archived,false)=false
      LEFT JOIN organization_users ou
        ON ou.organization_id = o.id
       AND ou.is_active = true
      GROUP BY
        o.id,
        o.name,
        o.organization_type,
        o.is_active
      ORDER BY o.name
    `);

    let rows = "";

    for (const org of orgs.rows) {

      rows += `
      <tr>
        <td>${org.name}</td>
        <td>${org.organization_type || "-"}</td>
        <td style="text-align:center">${org.location_count}</td>
        <td style="text-align:center">${org.user_count}</td>
        <td>${org.is_active ? "Active" : "Archived"}</td>
        <td>
          <a class="btn" href="/org-organization/${org.id}">
            Open
          </a>
        </td>
      </tr>`;
    }

    res.send(orgPage("Organizations", `
      <div class="topbar">
        <div class="brand">Vivid Organizations</div>
        <h1>Organizations</h1>
        <p class="subtitle">
          Manage organizations and drill into their operations.
        </p>
      </div>

      <div class="wrap">

        <table class="table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Type</th>
              <th>Locations</th>
              <th>Users</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>
    `));

  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});
app.get(
  "/org-organization/:id",
  async (req, res) => {
    try {
      const orgId = Number(req.params.id);
const dateFilter = getOrgDateFilter(req);

if (dateFilter.error) {
  return res.status(400).send(
    dateFilter.error
  );
}

const {
  fromDate,
  toDate,
  queryString: dateQueryString
} = dateFilter;
      const isSuperAdmin =
  req.session.user?.role === "super_admin";

const isOrganizationAdmin =
  req.session.orgUser &&
  Number(req.session.orgUser.organization_id) === orgId &&
  ["owner", "organization_admin", "district_admin"].includes(
    String(
      req.session.orgUser.organization_role || ""
    ).toLowerCase()
  );

if (!isSuperAdmin && !isOrganizationAdmin) {
  return res.status(403).send("Access denied");
}
      if (!Number.isInteger(orgId) || orgId <= 0) {
        return res.status(400).send("Valid organization is required.");
      }

      const orgResult = await q(`
        SELECT
          id,
          name,
          organization_type,
          is_active
        FROM organizations
        WHERE id = $1
        LIMIT 1
      `, [orgId]);

      const org = orgResult.rows[0];

      if (!org) {
        return res.status(404).send("Organization not found.");
      }

      /*
        Organization Portal management view.

        All operational data below comes directly from Vivid:
        spaces → qr_codes → qr_campaigns → campaigns → events

        No KPI values are stored in the Organization database.
      */
 const locationResult = await q(`
  WITH filtered_locations AS (
    SELECT
      s.id,
      s.name,
      s.location
    FROM spaces s
    WHERE s.organization_id = $1
  AND COALESCE(s.is_archived, false) = false

  AND (
        /*
          With no selected dates, show currently active locations.
        */
        (
          NULLIF($2, '') IS NULL
          AND NULLIF($3, '') IS NULL
        )

        OR

        /*
          With dates selected, include any location whose
          active period overlaps the requested range.
        */
        (
          (NULLIF($2, '') IS NULL
            OR s.end_date IS NULL
            OR s.end_date >= NULLIF($2, '')::date)

          AND

          (NULLIF($3, '') IS NULL
            OR COALESCE(s.live_date, s.created_at::date)
               <= NULLIF($3, '')::date)
        )
      )
  ),

  filtered_qrs AS (
    SELECT
      qr.id,
      qr.space_id,

      COALESCE(
        qr.total_cost,
        qr.annual_cost,
        0
      )::numeric AS placement_value,

      COALESCE(
        qr.annual_impressions,
        0
      )::numeric AS impressions

    FROM qr_codes qr

    JOIN filtered_locations fl
      ON fl.id = qr.space_id

    WHERE
      (
        /*
          With no selected dates, show currently active QRs.
        */
        (
          NULLIF($2, '') IS NULL
          AND NULLIF($3, '') IS NULL
          AND COALESCE(qr.is_archived, false) = false
          AND COALESCE(qr.is_active, true) = true
        )

        OR

        /*
          With dates selected, include any QR whose
          placement period overlaps the requested range.
        */
        (
          (NULLIF($2, '') IS NULL
            OR qr.end_date IS NULL
            OR qr.end_date >= NULLIF($2, '')::date)

          AND

          (NULLIF($3, '') IS NULL
            OR COALESCE(qr.live_date, qr.created_at::date)
               <= NULLIF($3, '')::date)
        )
      )
  ),

  qr_campaign_metrics AS (
    SELECT
      fq.id AS qr_id,

      COUNT(
        DISTINCT CASE
          WHEN
            /*
              Assignment/campaign overlaps the requested range.
            */
            (
              (
                NULLIF($2, '') IS NULL
                AND NULLIF($3, '') IS NULL
                AND COALESCE(qc.is_active, true) = true
                AND COALESCE(c.is_archived, false) = false
              )

              OR

              (
                (
                  NULLIF($2, '') IS NULL
                  OR COALESCE(
                       qc.ended_at::date,
                       c.end_date,
                       NULLIF($3, '')::date
                     ) >= NULLIF($2, '')::date
                )

                AND

                (
                  NULLIF($3, '') IS NULL
                  OR COALESCE(
                       qc.started_at::date,
                       qc.assigned_at::date,
                       c.start_date,
                       c.live_date,
                       c.created_at::date
                     ) <= NULLIF($3, '')::date
                )
              )
            )
          THEN c.id
        END
      )::int AS active_campaigns,

      COUNT(
        DISTINCT CASE
          WHEN
            NULLIF(TRIM(c.advertiser), '') IS NOT NULL

            AND

            (
              (
                NULLIF($2, '') IS NULL
                AND NULLIF($3, '') IS NULL
                AND COALESCE(qc.is_active, true) = true
                AND COALESCE(c.is_archived, false) = false
              )

              OR

              (
                (
                  NULLIF($2, '') IS NULL
                  OR COALESCE(
                       qc.ended_at::date,
                       c.end_date,
                       NULLIF($3, '')::date
                     ) >= NULLIF($2, '')::date
                )

                AND

                (
                  NULLIF($3, '') IS NULL
                  OR COALESCE(
                       qc.started_at::date,
                       qc.assigned_at::date,
                       c.start_date,
                       c.live_date,
                       c.created_at::date
                     ) <= NULLIF($3, '')::date
                )
              )
            )

          THEN LOWER(TRIM(c.advertiser))
        END
      )::int AS advertisers

    FROM filtered_qrs fq

    LEFT JOIN qr_campaigns qc
      ON qc.qr_id = fq.id

    LEFT JOIN campaigns c
      ON c.id = qc.campaign_id

    GROUP BY fq.id
  ),

  qr_event_metrics AS (
    SELECT
      fq.id AS qr_id,

      COUNT(e.id) FILTER (
        WHERE e.type = 'scan'
      )::int AS scans,

      COUNT(e.id) FILTER (
        WHERE e.type IN ('offer', 'maps', 'waze')
      )::int AS intent,

      COUNT(e.id) FILTER (
        WHERE e.type = 'conversion'
      )::int AS conversions,

      COALESCE(
        SUM(e.value) FILTER (
          WHERE e.type = 'conversion'
        ),
        0
      )::numeric AS conversion_value

    FROM filtered_qrs fq

    LEFT JOIN events e
      ON e.qr_id = fq.id

     AND (
       NULLIF($2, '') IS NULL
       OR e.created_at::date >= NULLIF($2, '')::date
     )

     AND (
       NULLIF($3, '') IS NULL
       OR e.created_at::date <= NULLIF($3, '')::date
     )

    GROUP BY fq.id
  ),

  qr_metrics AS (
    SELECT
      fq.id AS qr_id,
      fq.space_id,
      fq.placement_value,
      fq.impressions,

      COALESCE(qcm.active_campaigns, 0)::int
        AS active_campaigns,

      COALESCE(qcm.advertisers, 0)::int
        AS advertisers,

      COALESCE(qem.scans, 0)::int
        AS scans,

      COALESCE(qem.intent, 0)::int
        AS intent,

      COALESCE(qem.conversions, 0)::int
        AS conversions,

      COALESCE(qem.conversion_value, 0)::numeric
        AS conversion_value

    FROM filtered_qrs fq

    LEFT JOIN qr_campaign_metrics qcm
      ON qcm.qr_id = fq.id

    LEFT JOIN qr_event_metrics qem
      ON qem.qr_id = fq.id
  )

  SELECT
    fl.id,
    fl.name,
    fl.location,

    COUNT(DISTINCT qm.qr_id)::int
      AS qr_placements,

    COALESCE(
      SUM(qm.placement_value),
      0
    )::numeric AS placement_value,

    COALESCE(
      SUM(qm.impressions),
      0
    )::numeric AS impressions,

    COALESCE(
      SUM(qm.active_campaigns),
      0
    )::int AS active_campaigns,

    COALESCE(
      SUM(qm.scans),
      0
    )::int AS scans,

    COALESCE(
      SUM(qm.intent),
      0
    )::int AS intent,

    COALESCE(
      SUM(qm.conversions),
      0
    )::int AS conversions,

    COALESCE(
      SUM(qm.conversion_value),
      0
    )::numeric AS conversion_value

  FROM filtered_locations fl

  LEFT JOIN qr_metrics qm
    ON qm.space_id = fl.id

  GROUP BY
    fl.id,
    fl.name,
    fl.location

  ORDER BY fl.name
`, [
  orgId,
  fromDate,
  toDate
]);
      /*
        Count advertisers once across the entire organization.
        Advertisers are derived from Vivid Campaign records.
      */
const advertiserResult = await q(`
  SELECT
    COUNT(
      DISTINCT LOWER(TRIM(c.advertiser))
    )::int AS advertisers

  FROM spaces s

  JOIN qr_codes qr
    ON qr.space_id = s.id
   AND COALESCE(qr.is_archived, false) = false

  JOIN qr_campaigns qc
    ON qc.qr_id = qr.id

  JOIN campaigns c
    ON c.id = qc.campaign_id

  WHERE s.organization_id = $1
    AND COALESCE(s.is_archived, false) = false
    AND NULLIF(TRIM(c.advertiser), '') IS NOT NULL

    /*
      Location overlaps the selected range.
    */
    AND (
      NULLIF($2, '') IS NULL
      OR s.end_date IS NULL
      OR s.end_date >= NULLIF($2, '')::date
    )

    AND (
      NULLIF($3, '') IS NULL
      OR COALESCE(
           s.live_date,
           s.created_at::date
         ) <= NULLIF($3, '')::date
    )

    /*
      QR placement overlaps the selected range.
    */
    AND (
      NULLIF($2, '') IS NULL
      OR qr.end_date IS NULL
      OR qr.end_date >= NULLIF($2, '')::date
    )

    AND (
      NULLIF($3, '') IS NULL
      OR COALESCE(
           qr.live_date,
           qr.created_at::date
         ) <= NULLIF($3, '')::date
    )

    /*
      Campaign assignment overlaps the selected range.
    */
    AND (
      NULLIF($2, '') IS NULL
      OR COALESCE(
           qc.ended_at::date,
           c.end_date,
           NULLIF($3, '')::date
         ) >= NULLIF($2, '')::date
    )

    AND (
      NULLIF($3, '') IS NULL
      OR COALESCE(
           qc.started_at::date,
           qc.assigned_at::date,
           c.start_date,
           c.live_date,
           c.created_at::date
         ) <= NULLIF($3, '')::date
    )

    /*
      With no dates selected, preserve the current active-only view.
    */
    AND (
      (
        NULLIF($2, '') IS NULL
        AND NULLIF($3, '') IS NULL
        AND COALESCE(qr.is_active, true) = true
        AND COALESCE(qc.is_active, true) = true
        AND COALESCE(c.is_archived, false) = false
      )

      OR

      (
        NULLIF($2, '') IS NOT NULL
        OR NULLIF($3, '') IS NOT NULL
      )
    )
`, [
  orgId,
  fromDate,
  toDate
]);

      /*
        Contracts belong to the Organization management layer.
      */
      const contractResult = await q(`
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(status, 'active')) = 'active'
          )::int AS active_contracts,

          COUNT(*)::int AS total_contracts

        FROM contracts
        WHERE organization_id = $1
      `, [orgId]);

      const locations = locationResult.rows;

      const totals = locations.reduce(
        (summary, location) => {
          summary.qrPlacements += Number(location.qr_placements || 0);
          summary.placementValue += Number(location.placement_value || 0);
          summary.impressions += Number(location.impressions || 0);
          summary.activeCampaigns += Number(location.active_campaigns || 0);
          summary.scans += Number(location.scans || 0);
          summary.intent += Number(location.intent || 0);
          summary.conversions += Number(location.conversions || 0);
          summary.conversionValue += Number(location.conversion_value || 0);

          return summary;
        },
        {
          qrPlacements: 0,
          placementValue: 0,
          impressions: 0,
          activeCampaigns: 0,
          scans: 0,
          intent: 0,
          conversions: 0,
          conversionValue: 0
        }
      );

      const advertiserCount =
        Number(advertiserResult.rows[0]?.advertisers || 0);

      const activeContracts =
        Number(contractResult.rows[0]?.active_contracts || 0);

const locationCards = locations.map(location => `
  <a
    href="/org-location/${location.id}?organization_id=${org.id}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
      min-width:0;
    "
  >
    <div style="
    background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
      transition:transform .15s ease, box-shadow .15s ease;
    "
    onmouseover="
      this.style.transform='translateY(-2px)';
      this.style.boxShadow='0 7px 18px rgba(0,0,0,.11)';
    "
    onmouseout="
      this.style.transform='translateY(0)';
      this.style.boxShadow='0 4px 12px rgba(0,0,0,.07)';
    ">

      <div style="
        font-size:15px;
        line-height:1.2;
        font-weight:bold;
        min-height:36px;
        margin-bottom:3px;
      ">
        ${location.name || "Unnamed Location"}
      </div>

      <div style="
        color:#65776b;
        font-size:11px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        margin-bottom:10px;
      ">
        ${location.location || "Market not set"}
      </div>

  <div style="
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px 8px;
">

  <div>
    <div style="font-size:10px;color:#65776b;">
      QR Placements
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.qr_placements || 0).toLocaleString()}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Placement Value
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${money(location.placement_value)}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Campaigns
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.active_campaigns || 0).toLocaleString()}
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#65776b;">
      Scans
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${Number(location.scans || 0).toLocaleString()}
    </div>
  </div>

  <div style="grid-column:1/-1;">
    <div style="font-size:10px;color:#65776b;">
      Revenue Generated
    </div>

    <div style="font-size:16px;font-weight:bold;">
      ${money(location.conversion_value)}
    </div>
  </div>

</div>

      <div style="
        margin-top:10px;
        padding-top:8px;
        border-top:1px solid #e7eee7;
        font-size:11px;
        font-weight:bold;
        color:#176b3a;
      ">
        Open Location →
      </div>

    </div>
  </a>
`).join("");
      res.send(orgPage("Organization Executive Dashboard", `
        <div class="topbar">
          <div class="brand">Vivid Organizations</div>

          <h1>${org.name}</h1>

          <p class="subtitle">
            Organization Executive Dashboard
          </p>
        </div>

        <div class="wrap">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:18px;
            flex-wrap:wrap;
            margin-bottom:18px;
          ">
            <div>
              <h2 style="margin:0 0 5px;">
                Executive Overview
              </h2>

              <div style="color:#65776b;">
                Organization performance aggregated directly from Vivid.
              </div>
            </div>

           ${
  req.session.user?.role === "super_admin"
    ? `
      <a
        class="btn secondary"
        href="/org-organizations"
      >
        Back to Organizations
      </a>
    `
    : ""
}
          </div>
${orgDateFilterForm({
  action: `/org-organization/${org.id}`,
  fromDate,
  toDate
})}
          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(185px,1fr));
            gap:15px;
            margin:22px 0 34px;
          ">

            <a
              href="/org-locations?organization_id=${org.id}"
              style="text-decoration:none;color:inherit;"
            >
              <div class="card" style="margin:0;height:100%;">
                <div style="font-size:13px;color:#65776b;">
                  Locations
                </div>
                <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                  ${locations.length.toLocaleString()}
                </div>
              </div>
            </a>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                QR Placements
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.qrPlacements.toLocaleString()}
              </div>
            </div>

            <a
  href="/org-advertisers?organization_id=${org.id}"
  style="
    text-decoration:none;
    color:inherit;
    display:block;
  "
>
  <div class="card" style="margin:0;">
    <div style="font-size:13px;color:#65776b;">
      Advertisers
    </div>

    <div style="font-size:30px;font-weight:bold;margin-top:7px;">
      ${advertiserCount.toLocaleString()}
    </div>
  </div>
</a>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Active Contracts
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${activeContracts.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Placement Value
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${money(totals.placementValue)}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Annual Impressions
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.impressions.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Active Campaigns
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.activeCampaigns.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Scans
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.scans.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Intent
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.intent.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Conversions
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${totals.conversions.toLocaleString()}
              </div>
            </div>

            <div class="card" style="margin:0;">
              <div style="font-size:13px;color:#65776b;">
                Revenue Generated
              </div>
              <div style="font-size:30px;font-weight:bold;margin-top:7px;">
                ${money(totals.conversionValue)}
              </div>
            </div>

          </div>

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:end;
            gap:18px;
            flex-wrap:wrap;
            margin-bottom:15px;
          ">
            <div>
              <h2 style="margin:0 0 5px;">
                Locations
              </h2>

              <div style="color:#65776b;">
                Select a location to view its QR placements and performance.
              </div>
            </div>
          </div>

         <div
  class="org-location-grid"
  style="
   display:grid;
grid-template-columns:repeat(auto-fill,260px);
gap:18px;
justify-content:flex-start;
  "
>
            ${locationCards || `
              <div class="card" style="grid-column:1/-1;text-align:center;">
                <h3>No active locations</h3>
                <p>
                  No active Vivid locations are currently connected to this organization.
                </p>
              </div>
            `}
          </div>

        </div>
      `));

    } catch (err) {
      console.error("ORG EXECUTIVE DASHBOARD ERROR:", err);

      res.status(500).send(
        "ORG EXECUTIVE DASHBOARD ERROR: " + err.message
      );
    }
  }
);
app.get("/org-contracts", async (req, res) => {
  res.send(orgPage("Organization Contracts", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Contracts</h1>
      <p class="subtitle">Manage contract dates, pricing, renewals, and revenue sharing.</p>
    </div>

    <div class="wrap">
      <div class="card">
        <h2>Contracts</h2>
        <p>Organization contracts will live here.</p>

        <a class="btn secondary" href="/org-dashboard">Back to Organization Dashboard</a>
      </div>
    </div>
  `));
});
app.get(
  "/org-locations",
  async (req, res) => {
    try {
      let orgId = null;

      /*
        Organization users always use the organization stored
        in their Organization Portal session.
      */
      if (req.session.orgUser?.organization_id) {
        orgId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin may select an organization through the URL.
      */
      if (
        !orgId &&
        req.session.user?.role === "super_admin"
      ) {
        orgId = Number(
          req.query.organization_id
        );
      }

      if (!Number.isInteger(orgId) || orgId <= 0) {
        return res.redirect("/org-login");
      }

      const orgResult = await q(`
        SELECT
          id,
          name
        FROM organizations
        WHERE id = $1
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `, [orgId]);

      const org = orgResult.rows[0];

      if (!org) {
        return res.status(404).send("Organization not found.");
      }

      /*
        The Organization Portal does not create or duplicate locations.

        spaces, qr_codes and qr_campaigns are existing Vivid tables.
        organization_id is used only to determine which Vivid locations
        belong to this organization.
      */
      const locationsResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.live_date,
          s.end_date,

          COUNT(DISTINCT qr.id)::int AS qr_count,

          COUNT(
            DISTINCT CASE
              WHEN COALESCE(qc.is_active, true) = true
              THEN qc.campaign_id
            END
          )::int AS active_campaign_count

        FROM spaces s

        LEFT JOIN qr_codes qr
          ON qr.space_id = s.id
         AND COALESCE(qr.is_archived, false) = false

        LEFT JOIN qr_campaigns qc
          ON qc.qr_id = qr.id

        WHERE s.organization_id = $1
          AND COALESCE(s.is_archived, false) = false

        GROUP BY
          s.id,
          s.name,
          s.location,
          s.live_date,
          s.end_date

        ORDER BY
          s.name
      `, [orgId]);

      const locationRows = locationsResult.rows.map(location => `
        <tr>
          <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:left;">
            <strong>${location.name || "Unnamed Location"}</strong>
          </td>

          <td style="padding:14px;border-bottom:1px solid #e7eee7;">
            ${location.location || "-"}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:center;">
            ${location.qr_count}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:center;">
            ${location.active_campaign_count}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:center;">
            ${dateLabel(location.live_date)}
          </td>

          <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:center;">
            ${dateLabel(location.end_date, "Active")}
          </td>
     <td style="padding:14px;border-bottom:1px solid #e7eee7;text-align:center;">
  <a
    class="btn"
    href="/org-location/${location.id}?organization_id=${org.id}"
  >
    Open
  </a>
</td>
        </tr>
      `).join("");

      res.send(orgPage("Organization Locations", `
        <div class="topbar">
          <div class="brand">Vivid Organizations</div>

          <h1>${org.name} Locations</h1>

          <p class="subtitle">
            Locations, QR Codes and active campaigns pulled directly from Vivid.
          </p>
        </div>

        <div class="wrap">

          <div style="
            background:white;
            border-radius:18px;
            overflow:hidden;
            box-shadow:0 8px 22px rgba(0,0,0,.08);
            margin-bottom:24px;
          ">

            <table style="
              width:100%;
              border-collapse:collapse;
            ">

 <thead>
  <tr style="background:#eaf3e8;">
    <th style="padding:14px;text-align:left;">Location</th>
    <th style="padding:14px;">Market</th>
    <th style="padding:14px;">QR Codes</th>
    <th style="padding:14px;">Active Campaigns</th>
    <th style="padding:14px;">Live Date</th>
    <th style="padding:14px;">End Date</th>
    <th style="padding:14px;"></th>
  </tr>
</thead>

              <tbody>
                ${locationRows || `
                  <tr>
                    <td colspan="6" style="padding:30px;text-align:center;">
                      No active Vivid locations are connected to this organization.
                    </td>
                  </tr>
                `}
              </tbody>

            </table>
          </div>

          <a
            class="btn secondary"
            href="/org-organization/${org.id}"
          >
            Back to ${org.name} Dashboard
          </a>

        </div>
      `));

    } catch (err) {
      console.error("ORG LOCATIONS ERROR:", err);

      res.status(500).send(
        "ORG LOCATIONS ERROR: " + err.message
      );
    }
  }
);
app.get(
  "/org-location/:locationId",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use the organization
        stored in their login session.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin can select an organization through
        the URL while viewing organizations.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

   const locationId = Number(req.params.locationId);

const dateFilter = getOrgDateFilter(req);

if (dateFilter.error) {
  return res.status(400).send(
    dateFilter.error
  );
}

const {
  fromDate,
  toDate,
  queryString: dateQueryString
} = dateFilter;

if (
  !Number.isInteger(organizationId) ||
  organizationId <= 0 ||
  !Number.isInteger(locationId) ||
  locationId <= 0
) {
  return res.status(403).send("Access denied");
}

      /*
        Confirm the organization exists.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name
        FROM organizations
        WHERE id = $1
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `, [organizationId]);

      const organization = organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Read the location directly from Vivid.

        The organization_id relationship ensures that
        Organization users cannot open another
        organization's location.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          location
        FROM spaces
        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(is_archived, false) = false
        LIMIT 1
      `, [locationId, organizationId]);

      const location = locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Location not found for this organization."
        );
      }

      /*
        Read QR placement and performance data directly
        from existing Vivid tables.

        No Organization KPI data is stored separately.
      */
const qrResult = await q(`
  SELECT
    qr.id,
    qr.name,
    qr.description,
    qr.is_imported,
    qr.is_active,
    qr.live_date,
    qr.end_date,

    COALESCE(
      qr.total_cost,
      qr.annual_cost,
      0
    )::numeric AS placement_value,

    COALESCE(
      qr.annual_impressions,
      0
    )::numeric AS impressions,

    /*
      Campaigns connected to this QR during
      the selected reporting period.
    */
    (
      SELECT
        COUNT(DISTINCT qc.campaign_id)::int

      FROM qr_campaigns qc

      JOIN campaigns c
        ON c.id = qc.campaign_id
       AND COALESCE(c.is_archived, false) = false

      WHERE qc.qr_id = qr.id

        AND (
          /*
            No dates selected:
            preserve the current active-only view.
          */
          (
            NULLIF($2, '') IS NULL
            AND NULLIF($3, '') IS NULL
            AND COALESCE(qc.is_active, true) = true
          )

          OR

          /*
            Dates selected:
            assignment/campaign overlaps the range.
          */
          (
            (
              NULLIF($2, '') IS NULL
              OR COALESCE(
                   qc.ended_at::date,
                   c.end_date,
                   NULLIF($3, '')::date
                 ) >= NULLIF($2, '')::date
            )

            AND

            (
              NULLIF($3, '') IS NULL
              OR COALESCE(
                   qc.started_at::date,
                   qc.assigned_at::date,
                   c.start_date,
                   c.live_date,
                   c.created_at::date
                 ) <= NULLIF($3, '')::date
            )
          )
        )
    ) AS active_campaigns,

    /*
      Scans during the selected reporting period.
    */
    (
      SELECT COUNT(e.id)::int

      FROM events e

      WHERE e.qr_id = qr.id
        AND e.type = 'scan'

        AND (
          NULLIF($2, '') IS NULL
          OR e.created_at::date >= NULLIF($2, '')::date
        )

        AND (
          NULLIF($3, '') IS NULL
          OR e.created_at::date <= NULLIF($3, '')::date
        )
    ) AS scans,

    /*
      Intent during the selected reporting period.
    */
    (
      SELECT COUNT(e.id)::int

      FROM events e

      WHERE e.qr_id = qr.id
        AND e.type IN ('offer', 'maps', 'waze')

        AND (
          NULLIF($2, '') IS NULL
          OR e.created_at::date >= NULLIF($2, '')::date
        )

        AND (
          NULLIF($3, '') IS NULL
          OR e.created_at::date <= NULLIF($3, '')::date
        )
    ) AS intent,

    /*
      Conversions during the selected reporting period.
    */
    (
      SELECT COUNT(e.id)::int

      FROM events e

      WHERE e.qr_id = qr.id
        AND e.type = 'conversion'

        AND (
          NULLIF($2, '') IS NULL
          OR e.created_at::date >= NULLIF($2, '')::date
        )

        AND (
          NULLIF($3, '') IS NULL
          OR e.created_at::date <= NULLIF($3, '')::date
        )
    ) AS conversions,

    /*
      Revenue generated during the selected period.
    */
    (
      SELECT
        COALESCE(
          SUM(e.value),
          0
        )::numeric

      FROM events e

      WHERE e.qr_id = qr.id
        AND e.type = 'conversion'

        AND (
          NULLIF($2, '') IS NULL
          OR e.created_at::date >= NULLIF($2, '')::date
        )

        AND (
          NULLIF($3, '') IS NULL
          OR e.created_at::date <= NULLIF($3, '')::date
        )
    ) AS conversion_value

  FROM qr_codes qr

  WHERE qr.space_id = $1
    AND COALESCE(qr.is_archived, false) = false

    AND (
      /*
        No dates selected:
        preserve the current active-only view.
      */
      (
        NULLIF($2, '') IS NULL
        AND NULLIF($3, '') IS NULL
        AND COALESCE(qr.is_active, true) = true
      )

      OR

      /*
        Dates selected:
        QR placement overlaps the range.
      */
      (
        (
          NULLIF($2, '') IS NULL
          OR qr.end_date IS NULL
          OR qr.end_date >= NULLIF($2, '')::date
        )

        AND

        (
          NULLIF($3, '') IS NULL
          OR COALESCE(
               qr.live_date,
               qr.created_at::date
             ) <= NULLIF($3, '')::date
        )
      )
    )

  ORDER BY qr.name
`, [
  locationId,
  fromDate,
  toDate
]);

      const qrPlacements = qrResult.rows;

      /*
        Location totals are a live roll-up of Vivid QR data.
      */
      const totals = qrPlacements.reduce(
        (summary, qr) => {
          summary.placementValue += Number(
            qr.placement_value || 0
          );

          summary.impressions += Number(
            qr.impressions || 0
          );

          summary.activeCampaigns += Number(
            qr.active_campaigns || 0
          );

          summary.scans += Number(
            qr.scans || 0
          );

          summary.intent += Number(
            qr.intent || 0
          );

          summary.conversions += Number(
            qr.conversions || 0
          );

          summary.conversionValue += Number(
            qr.conversion_value || 0
          );

          return summary;
        },
        {
          placementValue: 0,
          impressions: 0,
          activeCampaigns: 0,
          scans: 0,
          intent: 0,
          conversions: 0,
          conversionValue: 0
        }
      );

const qrCards = qrPlacements.map(qr => `
  <a
    href="/org-qr/${qr.id}?organization_id=${organization.id}&location_id=${location.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
      min-width:0;
    "
  >
    <div style="
    background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
      transition:transform .15s ease, box-shadow .15s ease;
    "
    onmouseover="
      this.style.transform='translateY(-2px)';
      this.style.boxShadow='0 7px 18px rgba(0,0,0,.11)';
    "
    onmouseout="
      this.style.transform='translateY(0)';
      this.style.boxShadow='0 4px 12px rgba(0,0,0,.07)';
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
        margin-bottom:5px;
      ">

        <div style="
          font-size:15px;
          line-height:1.2;
          font-weight:bold;
        ">
          ${qr.name || "Unnamed QR Placement"}
        </div>

        <span style="
          background:${qr.is_active ? "#eaf3e8" : "#f3e8e8"};
          color:${qr.is_active ? "#176b3a" : "#8a1f1f"};
          padding:5px 8px;
          border-radius:999px;
          font-size:10px;
          white-space:nowrap;
        ">
          ${qr.is_active ? "Active" : "Inactive"}
        </span>

      </div>

      <div style="
        color:#65776b;
        font-size:11px;
        margin-bottom:12px;
      ">
        ${qr.is_imported ? "Imported QR" : "Vivid QR"}
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px 8px;
      ">

        <div>
          <div style="font-size:10px;color:#65776b;">
            Placement Value
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${money(qr.placement_value)}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Active Campaigns
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${Number(qr.active_campaigns || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Scans
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${Number(qr.scans || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#65776b;">
            Revenue Generated
          </div>
          <div style="font-size:16px;font-weight:bold;">
            ${money(qr.conversion_value)}
          </div>
        </div>

      </div>

      <div style="
        margin-top:12px;
        padding-top:9px;
        border-top:1px solid #e7eee7;
        font-size:11px;
        font-weight:bold;
        color:#176b3a;
      ">
        Open QR →
      </div>

    </div>
  </a>
`).join("");
      const backHref =
        req.session.user?.role === "super_admin"
          ? `/org-organization/${organization.id}`
          : `/org-organization/${organization.id}`;

      res.send(orgPage(
        "Organization Location",
        `
          <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${location.name}</h1>

            <p class="subtitle">
              ${location.location || "Location"} · ${organization.name}
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:18px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  Location Overview
                </h2>

                <div style="color:#65776b;">
                  Performance aggregated directly from Vivid QR placements.
                </div>
              </div>

              <a
                class="btn secondary"
                href="${backHref}"
              >
                Back to ${organization.name}
              </a>

            </div>
${orgDateFilterForm({
  action: `/org-location/${location.id}`,
  fromDate,
  toDate
})}
            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(165px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  QR Placements
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${qrPlacements.length.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Placement Value
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(totals.placementValue)}
                </div>
              </div>



              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.activeCampaigns.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.scans.toLocaleString()}
                </div>
              </div>

            

              

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(totals.conversionValue)}
                </div>
              </div>

            </div>

            <div style="margin-bottom:15px;">
              <h2 style="margin:0 0 5px;">
                QR Placements
              </h2>

              <div style="color:#65776b;">
                Each card represents an active Vivid QR placement at this location.
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(235px,1fr));
              gap:14px;
            ">

              ${qrCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No active QR placements</h3>

                  <p>
                    No active Vivid QR placements are currently connected to this location.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      ));

    } catch (err) {
      console.error("ORG LOCATION ERROR:", err);

      res.status(500).send(
        "ORG LOCATION ERROR: " + err.message
      );
    }
  }
);
app.get(
  "/org-qr/:qrId",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use their session organization.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin selects an organization through the URL.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

   const qrId = Number(req.params.qrId);

const dateFilter = getOrgDateFilter(req);

if (dateFilter.error) {
  return res.status(400).send(
    dateFilter.error
  );
}

const {
  fromDate,
  toDate,
  queryString: dateQueryString
} = dateFilter;

if (
  !Number.isInteger(organizationId) ||
  organizationId <= 0 ||
  !Number.isInteger(qrId) ||
  qrId <= 0
) {
  return res.status(403).send("Access denied");
}

      /*
        Confirm the QR belongs to a Vivid location connected
        to the organization being viewed.
      */
      const qrResult = await q(`
        SELECT
          qr.id,
          qr.name,
          qr.description,
          qr.is_imported,
          qr.is_active,
          qr.live_date,
          qr.end_date,
          qr.created_at,

          COALESCE(
            qr.total_cost,
            qr.annual_cost,
            0
          )::numeric AS placement_value,

          COALESCE(
            qr.annual_impressions,
            0
          )::numeric AS annual_impressions,

          s.id AS location_id,
          s.name AS location_name,
          s.location AS market,

          o.id AS organization_id,
          o.name AS organization_name

        FROM qr_codes qr

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        JOIN organizations o
          ON o.id = s.organization_id
         AND COALESCE(o.is_active, true) = true

        WHERE qr.id = $1
          AND o.id = $2
          AND COALESCE(qr.is_archived, false) = false

        LIMIT 1
      `, [qrId, organizationId]);

      const qr = qrResult.rows[0];

      if (!qr) {
        return res.status(404).send(
          "QR placement not found for this organization."
        );
      }

      /*
        Pull campaigns directly from Vivid.
      */
      const campaignResult = await q(`
        SELECT
          c.id,
          c.name,
          c.advertiser,
          c.start_date,
          c.end_date,
          c.campaign_url,
          c.avg_customer_value,

          qc.is_active,
          qc.assigned_at,
          qc.started_at,
          qc.ended_at

        FROM qr_campaigns qc

        JOIN campaigns c
          ON c.id = qc.campaign_id

        WHERE qc.qr_id = $1
          AND COALESCE(c.is_archived, false) = false

        ORDER BY
          COALESCE(qc.started_at, qc.assigned_at) DESC,
          qc.id DESC
      `, [qrId]);

      const campaigns = campaignResult.rows;

      const activeCampaigns = campaigns.filter(
        campaign => campaign.is_active !== false
      );

      /*
        Pull event totals directly from Vivid.
      */
      const eventResult = await q(`
        SELECT
          COUNT(*) FILTER (
            WHERE type = 'scan'
          )::int AS scans,

          COUNT(*) FILTER (
            WHERE type = 'offer'
          )::int AS offer_clicks,

          COUNT(*) FILTER (
            WHERE type = 'maps'
          )::int AS maps_clicks,

          COUNT(*) FILTER (
            WHERE type = 'waze'
          )::int AS waze_clicks,

          COUNT(*) FILTER (
            WHERE type IN ('offer', 'maps', 'waze')
          )::int AS intent,

          COUNT(*) FILTER (
            WHERE type = 'conversion'
          )::int AS conversions,

          COALESCE(
            SUM(value) FILTER (
              WHERE type = 'conversion'
            ),
            0
          )::numeric AS revenue_generated

        FROM events
        WHERE qr_id = $1
      `, [qrId]);

      const metrics = eventResult.rows[0] || {
        scans: 0,
        offer_clicks: 0,
        maps_clicks: 0,
        waze_clicks: 0,
        intent: 0,
        conversions: 0,
        revenue_generated: 0
      };

      /*
        Build active campaign and advertiser names from Vivid.
      */
      const advertiserNames = [
        ...new Set(
          activeCampaigns
            .map(campaign =>
              String(campaign.advertiser || "").trim()
            )
            .filter(Boolean)
        )
      ];

 const campaignCards = campaigns.map(campaign => `
  <a
    href="/org-campaign/${campaign.id}?organization_id=${organizationId}&qr_id=${qr.id}${dateQueryString ? `&${dateQueryString}` : ""}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
    "
  >
    <div style="
   background:white;
border-radius:14px;
padding:16px;
box-shadow:0 5px 14px rgba(0,0,0,.07);
box-sizing:border-box;
width:260px;
min-height:220px;
    ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:12px;
            margin-bottom:12px;
          ">

            <div>
              <div style="
                font-size:17px;
                font-weight:bold;
                line-height:1.25;
              ">
                ${campaign.name || "Unnamed Campaign"}
              </div>

              <div style="
                color:#65776b;
                font-size:12px;
                margin-top:3px;
              ">
                ${campaign.advertiser || "Advertiser not set"}
              </div>
            </div>

            <span style="
              background:${campaign.is_active !== false ? "#eaf3e8" : "#f3e8e8"};
              color:${campaign.is_active !== false ? "#176b3a" : "#8a1f1f"};
              padding:6px 9px;
              border-radius:999px;
              font-size:10px;
              font-weight:bold;
              white-space:nowrap;
            ">
              ${campaign.is_active !== false ? "Active" : "Inactive"}
            </span>

          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          ">

            <div>
              <div style="font-size:10px;color:#65776b;">
                Start Date
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${dateLabel(
                  campaign.start_date ||
                  campaign.started_at ||
                  campaign.assigned_at
                )}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                End Date
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${dateLabel(
                  campaign.end_date ||
                  campaign.ended_at,
                  "Active"
                )}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                Customer Value
              </div>
              <div style="font-size:13px;font-weight:bold;">
                ${money(campaign.avg_customer_value)}
              </div>
            </div>

        <div>
  <div style="font-size:10px;color:#65776b;">
    Campaign ID
  </div>
  <div style="font-size:13px;font-weight:bold;">
    ${campaign.id}
  </div>
</div>

</div>

<div style="
  margin-top:12px;
  padding-top:8px;
  border-top:1px solid #e7eee7;
  color:#176b3a;
  font-size:12px;
  font-weight:bold;
">
  Open Campaign →
</div>

</div>
</a>
`).join("");

      res.send(orgPage(
        "QR Placement Detail",
        `
          <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${qr.name || "QR Placement"}</h1>

            <p class="subtitle">
              ${qr.location_name} · ${qr.organization_name}
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:20px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  QR Placement Overview
                </h2>

                <div style="color:#65776b;">
                  Detailed performance pulled directly from Vivid.
                </div>
              </div>

              <a
                class="btn secondary"
                href="/org-location/${qr.location_id}?organization_id=${qr.organization_id}${dateQueryString ? `&${dateQueryString}` : ""}"
              >
                Back to ${qr.location_name}
              </a>

         </div>

${orgDateFilterForm({
  action: `/org-qr/${qr.id}`,
  fromDate,
  toDate
})}

<!-- Executive KPI cards -->

<div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Placement Value
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(qr.placement_value)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${activeCampaigns.length.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(metrics.revenue_generated)}
                </div>
              </div>

            </div>

            <!-- Placement information -->

            <h2 style="margin-bottom:14px;">
              Placement Information
            </h2>

            <div class="card" style="margin:0 0 30px;">

              <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
                gap:18px;
              ">

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Location
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.location_name}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Market
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.market || "-"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    QR Type
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.is_imported ? "Imported QR" : "Vivid QR"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Status
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${qr.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Live Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(qr.live_date)}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    End Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(qr.end_date, "Active")}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Advertiser
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${advertiserNames.join(", ") || "Not assigned"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Annual Impressions
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${Number(qr.annual_impressions || 0).toLocaleString()}
                  </div>
                </div>

              </div>

            </div>

            <!-- Performance -->

            <h2 style="margin-bottom:14px;">
              Performance Detail
            </h2>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Offer Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.offer_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Maps Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.maps_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Waze Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.waze_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Intent
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.intent || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Conversions
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.conversions || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${money(metrics.revenue_generated)}
                </div>
              </div>

            </div>

            <!-- Campaigns -->

            <div style="margin-bottom:14px;">
              <h2 style="margin:0 0 5px;">
                Campaigns
              </h2>

              <div style="color:#65776b;">
                Campaign relationships and dates pulled directly from Vivid.
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(270px,1fr));
              gap:14px;
            ">

              ${campaignCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No campaigns assigned</h3>

                  <p>
                    No Vivid campaigns are currently connected to this QR placement.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      ));

    } catch (err) {
      console.error("ORG QR ERROR:", err);

      res.status(500).send(
        "ORG QR ERROR: " + err.message
      );
    }
  }
);
app.get(
  "/org-campaign/:campaignId",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use their
        organization stored in the login session.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin selects an organization through
        the organization_id URL parameter.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

   const campaignId = Number(req.params.campaignId);
const requestedQrId = Number(req.query.qr_id);

const dateFilter = getOrgDateFilter(req);

if (dateFilter.error) {
  return res.status(400).send(
    dateFilter.error
  );
}

const {
  fromDate,
  toDate,
  queryString: dateQueryString
} = dateFilter;

if (
  !Number.isInteger(organizationId) ||
  organizationId <= 0 ||
  !Number.isInteger(campaignId) ||
  campaignId <= 0
) {
  return res.status(403).send("Access denied");
}

      /*
        Confirm the organization exists.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name
        FROM organizations
        WHERE id = $1
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `, [organizationId]);

      const organization = organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Confirm the Campaign is connected to at least
        one Vivid QR placement inside this organization.
      */
      const campaignResult = await q(`
        SELECT
          c.id,
          c.name,
          c.advertiser,
          c.campaign_url,
          c.conversion_url,
          c.avg_customer_value,
          c.campaign_cost,
          c.start_date,
          c.end_date,
          c.live_date,
          c.created_at,
          c.is_deal_of_day,
          c.is_archived,

          CASE
            WHEN COALESCE(c.is_archived, false) = true
              THEN 'Archived'

            WHEN c.start_date IS NOT NULL
             AND c.start_date > CURRENT_DATE
              THEN 'Scheduled'

            WHEN c.end_date IS NOT NULL
             AND c.end_date < CURRENT_DATE
              THEN 'Completed'

            ELSE 'Active'
          END AS campaign_status

        FROM campaigns c

        WHERE c.id = $1

          AND EXISTS (
            SELECT 1

            FROM qr_campaigns qc

            JOIN qr_codes qr
              ON qr.id = qc.qr_id
             AND COALESCE(qr.is_archived, false) = false

            JOIN spaces s
              ON s.id = qr.space_id
             AND COALESCE(s.is_archived, false) = false

            WHERE qc.campaign_id = c.id
              AND s.organization_id = $2
          )

        LIMIT 1
      `, [campaignId, organizationId]);

      const campaign = campaignResult.rows[0];

      if (!campaign) {
        return res.status(404).send(
          "Campaign not found for this organization."
        );
      }

      /*
        Campaign performance comes directly from Vivid
        events tied to the organization's QR placements.
      */
      const metricsResult = await q(`
        SELECT
          COUNT(e.id) FILTER (
            WHERE e.type = 'scan'
          )::int AS scans,

          COUNT(e.id) FILTER (
            WHERE e.type = 'offer'
          )::int AS offer_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type = 'maps'
          )::int AS maps_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type = 'waze'
          )::int AS waze_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type IN ('offer', 'maps', 'waze')
          )::int AS intent,

          COUNT(e.id) FILTER (
            WHERE e.type = 'conversion'
          )::int AS conversions,

          COALESCE(
            SUM(e.value) FILTER (
              WHERE e.type = 'conversion'
            ),
            0
          )::numeric AS revenue_generated

        FROM events e

        JOIN qr_codes qr
          ON qr.id = e.qr_id

        JOIN spaces s
          ON s.id = qr.space_id

        WHERE e.campaign_id = $1
  AND s.organization_id = $2

  AND (
    NULLIF($3, '') IS NULL
    OR e.created_at::date >= NULLIF($3, '')::date
  )

  AND (
    NULLIF($4, '') IS NULL
    OR e.created_at::date <= NULLIF($4, '')::date
  )
      `, [
  campaignId,
  organizationId,
  fromDate,
  toDate
]);

      const metrics = metricsResult.rows[0] || {
        scans: 0,
        offer_clicks: 0,
        maps_clicks: 0,
        waze_clicks: 0,
        intent: 0,
        conversions: 0,
        revenue_generated: 0
      };

      /*
        Pull every Organization QR placement connected
        to this Campaign.
      */
      const qrResult = await q(`
        SELECT
          qr.id,
          qr.name,
          qr.is_active,
          qr.is_imported,
          qr.live_date,
          qr.end_date,

          s.id AS location_id,
          s.name AS location_name,
          s.location AS market,

          COALESCE(
            qr.total_cost,
            qr.annual_cost,
            0
          )::numeric AS placement_value,

          COUNT(e.id) FILTER (
            WHERE e.type = 'scan'
          )::int AS scans,

          COALESCE(
            SUM(e.value) FILTER (
              WHERE e.type = 'conversion'
            ),
            0
          )::numeric AS revenue_generated,

          BOOL_OR(
            COALESCE(qc.is_active, true)
          ) AS assignment_active,

          MIN(
            COALESCE(qc.started_at, qc.assigned_at)
          ) AS assignment_start,

          MAX(qc.ended_at) AS assignment_end

        FROM qr_campaigns qc

        JOIN qr_codes qr
          ON qr.id = qc.qr_id
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        LEFT JOIN events e
  ON e.qr_id = qr.id
 AND e.campaign_id = qc.campaign_id

 AND (
   NULLIF($3, '') IS NULL
   OR e.created_at::date >= NULLIF($3, '')::date
 )

 AND (
   NULLIF($4, '') IS NULL
   OR e.created_at::date <= NULLIF($4, '')::date
 )

        WHERE qc.campaign_id = $1
          AND s.organization_id = $2

        GROUP BY
          qr.id,
          qr.name,
          qr.is_active,
          qr.is_imported,
          qr.live_date,
          qr.end_date,
          qr.total_cost,
          qr.annual_cost,
          s.id,
          s.name,
          s.location

        ORDER BY
          s.name,
          qr.name
      `, [
  campaignId,
  organizationId,
  fromDate,
  toDate
]);

      const qrPlacements = qrResult.rows;

      /*
        Use campaign_cost exactly as stored in Vivid.

        The Organization Portal does not recreate
        Vivid's allocation engine.
      */
      const campaignCost =
        Number(campaign.campaign_cost || 0);

      const revenueGenerated =
        Number(metrics.revenue_generated || 0);

      const conversions =
        Number(metrics.conversions || 0);

      const roi =
        campaignCost > 0
          ? (
              (
                revenueGenerated - campaignCost
              ) / campaignCost
            ) * 100
          : 0;

      const cac =
        conversions > 0
          ? campaignCost / conversions
          : 0;

      /*
        Validate the originating QR for the Back button.
      */
      const originatingQr =
        qrPlacements.find(
          qr => Number(qr.id) === requestedQrId
        ) || qrPlacements[0] || null;

      const backHref = originatingQr
  ? `/org-qr/${originatingQr.id}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}`
  : `/org-organization/${organizationId}${dateQueryString ? `?${dateQueryString}` : ""}`;

      const backLabel = originatingQr
        ? `Back to ${originatingQr.name}`
        : `Back to ${organization.name}`;

      const qrCards = qrPlacements.map(qr => `
        <a
          href="/org-qr/${qr.id}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
          style="
            text-decoration:none;
            color:inherit;
            display:block;
            min-width:0;
          "
        >
          <div style="
             background:white;
  border-radius:14px;
  padding:16px;
  box-shadow:0 5px 14px rgba(0,0,0,.07);
  box-sizing:border-box;
  width:260px;
  min-height:220px;
  height:100%;
            transition:transform .15s ease, box-shadow .15s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.11)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 14px rgba(0,0,0,.07)';
          ">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              gap:10px;
              margin-bottom:4px;
            ">

              <div style="
                font-size:16px;
                line-height:1.2;
                font-weight:bold;
              ">
                ${qr.name || "Unnamed QR Placement"}
              </div>

              <span style="
                background:${qr.assignment_active ? "#eaf3e8" : "#f3e8e8"};
                color:${qr.assignment_active ? "#176b3a" : "#8a1f1f"};
                padding:5px 8px;
                border-radius:999px;
                font-size:10px;
                font-weight:bold;
                white-space:nowrap;
              ">
                ${qr.assignment_active ? "Active" : "Inactive"}
              </span>

            </div>

            <div style="
              color:#65776b;
              font-size:11px;
              margin-bottom:12px;
            ">
              ${qr.location_name}
              ${qr.market ? ` · ${qr.market}` : ""}
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:10px 8px;
            ">

              <div>
                <div style="font-size:10px;color:#65776b;">
                  Placement Value
                </div>

                <div style="font-size:16px;font-weight:bold;">
                  ${money(qr.placement_value)}
                </div>
              </div>

              <div>
                <div style="font-size:10px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:16px;font-weight:bold;">
                  ${Number(qr.scans || 0).toLocaleString()}
                </div>
              </div>

              <div style="grid-column:1/-1;">
                <div style="font-size:10px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:16px;font-weight:bold;">
                  ${money(qr.revenue_generated)}
                </div>
              </div>

            </div>

            <div style="
              margin-top:12px;
              padding-top:9px;
              border-top:1px solid #e7eee7;
              color:#176b3a;
              font-size:12px;
              font-weight:bold;
            ">
              Open QR →
            </div>

          </div>
        </a>
      `).join("");

      res.send(orgPage(
        "Campaign Detail",
        `
          <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${campaign.name || "Campaign"}</h1>

            <p class="subtitle">
              ${campaign.advertiser || "Advertiser not set"}
              · ${organization.name}
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:20px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  Campaign Overview
                </h2>

                <div style="color:#65776b;">
                  Campaign performance pulled directly from Vivid.
                </div>
              </div>

              <a
                class="btn secondary"
                href="${backHref}"
              >
                ${backLabel}
              </a>

            </div>

${orgDateFilterForm({
  action: `/org-campaign/${campaign.id}`,
  fromDate,
  toDate
})}

<!-- Executive Overview -->


            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Campaign Cost
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(campaignCost)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(revenueGenerated)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  ROI
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${pct(roi)}
                </div>
              </div>

            </div>

            <!-- General Information -->

            <h2 style="margin-bottom:14px;">
              General Information
            </h2>

            <div class="card" style="margin:0 0 30px;">

              <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
                gap:18px;
              ">

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Advertiser
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${campaign.advertiser || "Not set"}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Status
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${campaign.campaign_status}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Start Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(
                      campaign.start_date ||
                      campaign.live_date ||
                      campaign.created_at
                    )}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    End Date
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${dateLabel(campaign.end_date, "Active")}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Average Customer Value
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${money(campaign.avg_customer_value)}
                  </div>
                </div>

                <div>
                  <div style="font-size:11px;color:#65776b;">
                    Deal of the Day
                  </div>

                  <div style="font-size:15px;font-weight:bold;margin-top:4px;">
                    ${campaign.is_deal_of_day ? "Yes" : "No"}
                  </div>
                </div>

                <div style="grid-column:1/-1;">
                  <div style="font-size:11px;color:#65776b;">
                    Destination URL
                  </div>

                  <div style="
                    font-size:14px;
                    font-weight:bold;
                    margin-top:4px;
                    overflow-wrap:anywhere;
                  ">
                    ${
                      campaign.campaign_url
                        ? `<a href="${campaign.campaign_url}" target="_blank">
                            ${campaign.campaign_url}
                           </a>`
                        : "Not set"
                    }
                  </div>
                </div>

              </div>

            </div>

            <!-- Performance Analytics -->

            <h2 style="margin-bottom:14px;">
              Performance Analytics
            </h2>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Offer Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.offer_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Maps Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.maps_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Waze Clicks
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.waze_clicks || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Intent
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.intent || 0).toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Conversions
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${conversions.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${money(revenueGenerated)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  ROI
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${pct(roi)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:11px;color:#65776b;">
                  CAC
                </div>

                <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                  ${money(cac)}
                </div>
              </div>

            </div>

            <!-- Related QR Placements -->

            <div style="margin-bottom:14px;">
              <h2 style="margin:0 0 5px;">
                QR Placements
              </h2>

              <div style="color:#65776b;">
                Organization QR placements connected to this campaign.
              </div>
            </div>

            <div style="
             display:grid;
grid-template-columns:repeat(auto-fill,260px);
gap:18px;
justify-content:flex-start;
            ">

              ${qrCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No QR placements</h3>

                  <p>
                    No active Organization QR placements are connected to this campaign.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      ));

    } catch (err) {
      console.error("ORG CAMPAIGN ERROR:", err);

      res.status(500).send(
        "ORG CAMPAIGN ERROR: " + err.message
      );
    }
  }
);
app.get(
  "/org-advertisers",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use the organization
        stored in their login session.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin may select an organization through
        the organization_id query parameter.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send("Access denied");
      }

      const organizationResult = await q(`
        SELECT
          id,
          name
        FROM organizations
        WHERE id = $1
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `, [organizationId]);

      const organization = organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Advertisers are derived directly from Vivid campaigns.

        Event metrics are aggregated separately so QR/campaign
        joins do not duplicate scan or revenue totals.
      */
      const advertiserResult = await q(`
        WITH organization_campaigns AS (
          SELECT DISTINCT
            c.id AS campaign_id,
            TRIM(c.advertiser) AS advertiser_name
          FROM campaigns c

          JOIN qr_campaigns qc
            ON qc.campaign_id = c.id

          JOIN qr_codes qr
            ON qr.id = qc.qr_id
           AND COALESCE(qr.is_archived, false) = false

          JOIN spaces s
            ON s.id = qr.space_id
           AND COALESCE(s.is_archived, false) = false

          WHERE s.organization_id = $1
            AND NULLIF(TRIM(c.advertiser), '') IS NOT NULL
            AND COALESCE(c.is_archived, false) = false
        ),

        advertiser_relationships AS (
          SELECT
            LOWER(TRIM(c.advertiser)) AS advertiser_key,
            TRIM(c.advertiser) AS advertiser_name,

            COUNT(DISTINCT s.id)::int AS locations,

            COUNT(DISTINCT qr.id)::int AS qr_placements,

            COUNT(
              DISTINCT CASE
                WHEN COALESCE(qc.is_active, true) = true
                THEN c.id
              END
            )::int AS active_campaigns

          FROM campaigns c

          JOIN qr_campaigns qc
            ON qc.campaign_id = c.id

          JOIN qr_codes qr
            ON qr.id = qc.qr_id
           AND COALESCE(qr.is_archived, false) = false

          JOIN spaces s
            ON s.id = qr.space_id
           AND COALESCE(s.is_archived, false) = false

          WHERE s.organization_id = $1
            AND NULLIF(TRIM(c.advertiser), '') IS NOT NULL
            AND COALESCE(c.is_archived, false) = false

          GROUP BY
            LOWER(TRIM(c.advertiser)),
            TRIM(c.advertiser)
        ),

        advertiser_events AS (
          SELECT
            LOWER(TRIM(c.advertiser)) AS advertiser_key,

       COUNT(e.id) FILTER (
  WHERE e.type = 'scan'
)::int AS scans,

COUNT(e.id) FILTER (
  WHERE e.type = 'conversion'
)::int AS conversions,

COALESCE(
  SUM(e.value) FILTER (
    WHERE e.type = 'conversion'
  ),
  0
)::numeric AS revenue_generated

          FROM campaigns c

          JOIN organization_campaigns oc
            ON oc.campaign_id = c.id

          LEFT JOIN events e
            ON e.campaign_id = c.id

          GROUP BY
            LOWER(TRIM(c.advertiser))
        )

        SELECT
          ar.advertiser_key,
          ar.advertiser_name,
          ar.locations,
          ar.qr_placements,
          ar.active_campaigns,

COALESCE(ae.scans, 0)::int
  AS scans,

COALESCE(ae.conversions, 0)::int
  AS conversions,

COALESCE(ae.revenue_generated, 0)::numeric
  AS revenue_generated
        FROM advertiser_relationships ar

        LEFT JOIN advertiser_events ae
          ON ae.advertiser_key = ar.advertiser_key

        ORDER BY
          ar.advertiser_name
      `, [organizationId]);

      const advertisers = advertiserResult.rows;

      const totals = advertisers.reduce(
        (summary, advertiser) => {
          summary.activeCampaigns += Number(
            advertiser.active_campaigns || 0
          );

          summary.qrPlacements += Number(
            advertiser.qr_placements || 0
          );

          summary.scans += Number(
            advertiser.scans || 0
          );
summary.conversions += Number(
  advertiser.conversions || 0
);
          summary.revenueGenerated += Number(
            advertiser.revenue_generated || 0
          );

          return summary;
        },
        {
          activeCampaigns: 0,
          qrPlacements: 0,
          scans: 0,
        conversions: 0,
        revenueGenerated: 0
        }
      );

      const advertiserCards = advertisers.map(advertiser => `
  <a
    href="/org-advertiser/${encodeURIComponent(advertiser.advertiser_key)}?organization_id=${organizationId}"
    style="
      text-decoration:none;
      color:inherit;
      display:block;
    "
  >
    <div style="
          background:white;
          border-radius:14px;
          padding:16px;
          box-shadow:0 5px 14px rgba(0,0,0,.07);
          box-sizing:border-box;
          width:260px;
          min-height:220px;
        ">

          <div style="
            font-size:16px;
            line-height:1.2;
            font-weight:bold;
            min-height:38px;
            margin-bottom:12px;
          ">
            ${advertiser.advertiser_name}
          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px 8px;
          ">

            <div>
              <div style="font-size:10px;color:#65776b;">
                Locations
              </div>

              <div style="font-size:16px;font-weight:bold;">
                ${Number(advertiser.locations || 0).toLocaleString()}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                QR Placements
              </div>

              <div style="font-size:16px;font-weight:bold;">
                ${Number(advertiser.qr_placements || 0).toLocaleString()}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                Active Campaigns
              </div>

              <div style="font-size:16px;font-weight:bold;">
                ${Number(advertiser.active_campaigns || 0).toLocaleString()}
              </div>
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                Scans
              </div>

              <div style="font-size:16px;font-weight:bold;">
                ${Number(advertiser.scans || 0).toLocaleString()}
              </div>
            </div>

            <div style="grid-column:1/-1;">
              <div style="font-size:10px;color:#65776b;">
                Revenue Generated
              </div>

              <div style="font-size:16px;font-weight:bold;">
                ${money(advertiser.revenue_generated)}
              </div>
            </div>

          </div>

          <div style="
            margin-top:13px;
            padding-top:9px;
            border-top:1px solid #e7eee7;
            color:#65776b;
            font-size:11px;
          ">
            Open Advertiser →
          </div>

        </div>
</a>
`).join("");

      res.send(orgPage(
        "Organization Advertisers",
        `
          <div class="topbar">
            <div class="brand">
              Vivid Organizations
            </div>

            <h1>${organization.name} Advertisers</h1>

            <p class="subtitle">
              Organization advertiser activity pulled directly from Vivid.
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:20px;
            ">

              <div>
                <h2 style="margin:0 0 5px;">
                  Advertiser Overview
                </h2>

                <div style="color:#65776b;">
                  Advertiser relationships and performance across ${organization.name}.
                </div>
              </div>

              <a
                class="btn secondary"
                href="/org-organization/${organization.id}"
              >
                Back to ${organization.name}
              </a>

            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Advertisers
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${advertisers.length.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.activeCampaigns.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  QR Placements
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.qrPlacements.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${totals.scans.toLocaleString()}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(totals.revenueGenerated)}
                </div>
              </div>

            </div>

            <div style="margin-bottom:14px;">
              <h2 style="margin:0 0 5px;">
                Advertisers
              </h2>

              <div style="color:#65776b;">
                Advertisers connected to Vivid campaigns inside this organization.
              </div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fill,260px);
              gap:18px;
              justify-content:flex-start;
            ">

              ${advertiserCards || `
                <div
                  class="card"
                  style="
                    grid-column:1/-1;
                    text-align:center;
                    margin:0;
                  "
                >
                  <h3>No advertisers found</h3>

                  <p>
                    No Vivid advertisers are currently connected to this organization.
                  </p>
                </div>
              `}

            </div>

          </div>
        `
      ));

    } catch (err) {
      console.error("ORG ADVERTISERS ERROR:", err);

      res.status(500).send(
        "ORG ADVERTISERS ERROR: " + err.message
      );
    }
  }
);
app.get("/org-users", async (req, res) => {
  res.send(orgPage("Organization Users", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Users</h1>
      <p class="subtitle">Manage organization users, hierarchy, and permissions.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Organization Users</h2>

        <p>
          This page will manage district, corporate, principals, ADs,
          GMs, facilities managers, finance users, and local managers.
        </p>

        <a class="btn secondary" href="/org-dashboard">
          Back to Organization Dashboard
        </a>

      </div>

    </div>
  `));
});
app.get("/org-pricing", async (req, res) => {
  res.send(orgPage("Organization Pricing", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Pricing</h1>
      <p class="subtitle">Manage local pricing, sponsorship rates, and placement values.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Pricing</h2>

        <p>
          This page will manage organization pricing by location, placement,
          contract type, and sponsorship opportunity.
        </p>

        <a class="btn secondary" href="/org-dashboard">
          Back to Organization Dashboard
        </a>

      </div>

    </div>
  `));
});
app.get("/org-revenue", async (req, res) => {
  res.send(orgPage("Organization Revenue", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Revenue</h1>
      <p class="subtitle">Manage revenue, revenue sharing, and financial performance.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Revenue</h2>

        <p>
          This page will manage organization revenue, revenue sharing,
          financial summaries, and payment tracking.
        </p>

        <a class="btn secondary" href="/org-dashboard">
          Back to Organization Dashboard
        </a>

      </div>

    </div>
  `));
});
app.get("/org-permissions", async (req, res) => {
  res.send(orgPage("Organization Permissions", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Permissions</h1>
      <p class="subtitle">Manage user roles, access levels, and organizational hierarchy.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Permissions</h2>

        <p>
          This page will manage organization permissions, role assignments,
          district, corporate, regional, location, and user access.
        </p>

        <a class="btn secondary" href="/org-dashboard">
          Back to Organization Dashboard
        </a>

      </div>

    </div>
  `));
});
app.get("/org-settings", async (req, res) => {
  res.send(orgPage("Organization Settings", `
    <div class="topbar">
      <div class="brand">Vivid Organizations</div>
      <h1>Settings</h1>
      <p class="subtitle">Manage organization preferences, defaults, notifications, and system configuration.</p>
    </div>

    <div class="wrap">

      <div class="card">
        <h2>Organization Settings</h2>

        <p>
          This page will manage organization defaults, notifications,
          branding, integrations, and organization-wide configuration.
        </p>

        <a class="btn secondary" href="/org-dashboard">
          Back to Organization Dashboard
        </a>

      </div>

    </div>
  `));
});
app.get(
  "/org-advertiser/:advertiserKey",
  async (req, res) => {
    try {
      let organizationId = null;

      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      const advertiserKey = String(
        req.params.advertiserKey || ""
      ).trim().toLowerCase();

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !advertiserKey
      ) {
        return res.status(403).send("Access denied");
      }

      const organizationResult = await q(`
        SELECT id, name
        FROM organizations
        WHERE id = $1
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `, [organizationId]);

      const organization = organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Confirm the advertiser exists inside this organization.
      */
      const advertiserResult = await q(`
        SELECT
          MIN(TRIM(c.advertiser)) AS advertiser_name,

          COUNT(DISTINCT s.id)::int AS locations,

          COUNT(DISTINCT qr.id)::int AS qr_placements,

          COUNT(
            DISTINCT CASE
              WHEN COALESCE(qc.is_active, true) = true
              THEN c.id
            END
          )::int AS active_campaigns

        FROM campaigns c

        JOIN qr_campaigns qc
          ON qc.campaign_id = c.id

        JOIN qr_codes qr
          ON qr.id = qc.qr_id
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2
          AND COALESCE(c.is_archived, false) = false
      `, [organizationId, advertiserKey]);

      const advertiser = advertiserResult.rows[0];

      if (!advertiser?.advertiser_name) {
        return res.status(404).send(
          "Advertiser not found for this organization."
        );
      }

      /*
        Full advertiser analytics from Vivid events.
      */
      const metricsResult = await q(`
        SELECT
          COUNT(e.id) FILTER (
            WHERE e.type = 'scan'
          )::int AS scans,

          COUNT(e.id) FILTER (
            WHERE e.type = 'offer'
          )::int AS offer_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type = 'maps'
          )::int AS maps_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type = 'waze'
          )::int AS waze_clicks,

          COUNT(e.id) FILTER (
            WHERE e.type IN ('offer', 'maps', 'waze')
          )::int AS intent,

          COUNT(e.id) FILTER (
            WHERE e.type = 'conversion'
          )::int AS conversions,

          COALESCE(
            SUM(e.value) FILTER (
              WHERE e.type = 'conversion'
            ),
            0
          )::numeric AS revenue_generated

        FROM events e

        JOIN campaigns c
          ON c.id = e.campaign_id

        JOIN qr_codes qr
          ON qr.id = e.qr_id

        JOIN spaces s
          ON s.id = qr.space_id

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2
      `, [organizationId, advertiserKey]);

      const metrics = metricsResult.rows[0] || {};

      /*
        Related locations.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,

          COUNT(DISTINCT qr.id)::int AS qr_placements,

          COUNT(DISTINCT c.id)::int AS campaigns

        FROM campaigns c

        JOIN qr_campaigns qc
          ON qc.campaign_id = c.id

        JOIN qr_codes qr
          ON qr.id = qc.qr_id
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2
          AND COALESCE(c.is_archived, false) = false

        GROUP BY
          s.id,
          s.name,
          s.location

        ORDER BY s.name
      `, [organizationId, advertiserKey]);

      /*
        Related campaigns.
      */
      const campaignResult = await q(`
        SELECT DISTINCT
          c.id,
          c.name,
          c.start_date,
          c.end_date,
          c.avg_customer_value,

          CASE
            WHEN COALESCE(c.is_archived, false) = true
              THEN 'Archived'
            WHEN c.start_date IS NOT NULL
             AND c.start_date > CURRENT_DATE
              THEN 'Scheduled'
            WHEN c.end_date IS NOT NULL
             AND c.end_date < CURRENT_DATE
              THEN 'Completed'
            ELSE 'Active'
          END AS status

        FROM campaigns c

        JOIN qr_campaigns qc
          ON qc.campaign_id = c.id

        JOIN qr_codes qr
          ON qr.id = qc.qr_id

        JOIN spaces s
          ON s.id = qr.space_id

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2
          AND COALESCE(c.is_archived, false) = false

        ORDER BY c.name
      `, [organizationId, advertiserKey]);

      /*
        Related QR placements.
      */
      const qrResult = await q(`
        SELECT DISTINCT
          qr.id,
          qr.name,
          qr.is_active,

          s.id AS location_id,
          s.name AS location_name,

          COALESCE(
            qr.total_cost,
            qr.annual_cost,
            0
          )::numeric AS placement_value

        FROM campaigns c

        JOIN qr_campaigns qc
          ON qc.campaign_id = c.id

        JOIN qr_codes qr
          ON qr.id = qc.qr_id
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2

        ORDER BY
          s.name,
          qr.name
      `, [organizationId, advertiserKey]);

      const locationCards = locationResult.rows.map(location => `
        <a
          href="/org-location/${location.id}?organization_id=${organizationId}"
          style="text-decoration:none;color:inherit;display:block;"
        >
          <div style="
            background:white;
            border-radius:14px;
            padding:16px;
            box-shadow:0 5px 14px rgba(0,0,0,.07);
            box-sizing:border-box;
            width:260px;
            min-height:220px;
          ">
            <div style="font-size:16px;font-weight:bold;">
              ${location.name}
            </div>

            <div style="font-size:11px;color:#65776b;margin:5px 0 18px;">
              ${location.location || "Market not set"}
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:10px;
            ">
              <div>
                <div style="font-size:10px;color:#65776b;">
                  QR Placements
                </div>
                <div style="font-size:16px;font-weight:bold;">
                  ${Number(location.qr_placements || 0)}
                </div>
              </div>

              <div>
                <div style="font-size:10px;color:#65776b;">
                  Campaigns
                </div>
                <div style="font-size:16px;font-weight:bold;">
                  ${Number(location.campaigns || 0)}
                </div>
              </div>
            </div>

            <div style="
              margin-top:15px;
              padding-top:9px;
              border-top:1px solid #e7eee7;
              color:#176b3a;
              font-size:11px;
              font-weight:bold;
            ">
              Open Location →
            </div>
          </div>
        </a>
      `).join("");

      const qrCards = qrResult.rows.map(qr => `
        <a
          href="/org-qr/${qr.id}?organization_id=${organizationId}"
          style="text-decoration:none;color:inherit;display:block;"
        >
          <div style="
            background:white;
            border-radius:14px;
            padding:16px;
            box-shadow:0 5px 14px rgba(0,0,0,.07);
            box-sizing:border-box;
            width:260px;
            min-height:220px;
          ">
            <div style="font-size:16px;font-weight:bold;">
              ${qr.name || "Unnamed QR Placement"}
            </div>

            <div style="font-size:11px;color:#65776b;margin:5px 0 18px;">
              ${qr.location_name}
            </div>

            <div>
              <div style="font-size:10px;color:#65776b;">
                Placement Value
              </div>
              <div style="font-size:16px;font-weight:bold;">
                ${money(qr.placement_value)}
              </div>
            </div>

            <div style="
              margin-top:15px;
              padding-top:9px;
              border-top:1px solid #e7eee7;
              color:#176b3a;
              font-size:11px;
              font-weight:bold;
            ">
              Open QR →
            </div>
          </div>
        </a>
      `).join("");

      const campaignCards = campaignResult.rows.map(campaign => `
        <a
          href="/org-campaign/${campaign.id}?organization_id=${organizationId}"
          style="text-decoration:none;color:inherit;display:block;"
        >
          <div style="
            background:white;
            border-radius:14px;
            padding:16px;
            box-shadow:0 5px 14px rgba(0,0,0,.07);
            box-sizing:border-box;
            width:260px;
            min-height:220px;
          ">
            <div style="font-size:16px;font-weight:bold;">
              ${campaign.name || "Unnamed Campaign"}
            </div>

            <div style="font-size:11px;color:#65776b;margin:5px 0 18px;">
              ${campaign.status}
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:10px;
            ">
              <div>
                <div style="font-size:10px;color:#65776b;">
                  Start Date
                </div>
                <div style="font-size:13px;font-weight:bold;">
                  ${dateLabel(campaign.start_date)}
                </div>
              </div>

              <div>
                <div style="font-size:10px;color:#65776b;">
                  End Date
                </div>
                <div style="font-size:13px;font-weight:bold;">
                  ${dateLabel(campaign.end_date, "Active")}
                </div>
              </div>
            </div>

            <div style="
              margin-top:15px;
              padding-top:9px;
              border-top:1px solid #e7eee7;
              color:#176b3a;
              font-size:11px;
              font-weight:bold;
            ">
              Open Campaign →
            </div>
          </div>
        </a>
      `).join("");

      res.send(orgPage(
        "Organization Advertiser",
        `
          <div class="topbar">
            <div class="brand">Vivid Organizations</div>

            <h1>${advertiser.advertiser_name}</h1>

            <p class="subtitle">
              ${organization.name} Advertiser Performance
            </p>
          </div>

          <div class="wrap">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:16px;
              flex-wrap:wrap;
              margin-bottom:20px;
            ">
              <div>
                <h2 style="margin:0 0 5px;">
                  Advertiser Overview
                </h2>

                <div style="color:#65776b;">
                  Organization-wide performance pulled directly from Vivid.
                </div>
              </div>

              <a
                class="btn secondary"
                href="/org-advertisers?organization_id=${organizationId}"
              >
                Back to Advertisers
              </a>
            </div>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(165px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">
              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">Locations</div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.locations || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">QR Placements</div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.qr_placements || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">Active Campaigns</div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.active_campaigns || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">Scans</div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">Conversions</div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.conversions || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Revenue Generated
                </div>
                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${money(metrics.revenue_generated)}
                </div>
              </div>
            </div>

            <h2>Performance Analytics</h2>

            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
              gap:12px;
              margin-bottom:30px;
            ">
              ${[
                ["Scans", metrics.scans],
                ["Offer Clicks", metrics.offer_clicks],
                ["Maps Clicks", metrics.maps_clicks],
                ["Waze Clicks", metrics.waze_clicks],
                ["Intent", metrics.intent],
                ["Conversions", metrics.conversions],
                ["Revenue Generated", money(metrics.revenue_generated)]
              ].map(([label, value]) => `
                <div class="card" style="margin:0;">
                  <div style="font-size:11px;color:#65776b;">
                    ${label}
                  </div>
                  <div style="font-size:24px;font-weight:bold;margin-top:6px;">
                    ${typeof value === "number"
                      ? value.toLocaleString()
                      : value || 0}
                  </div>
                </div>
              `).join("")}
            </div>

            <h2>Locations</h2>
            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fill,260px);
              gap:18px;
              margin-bottom:30px;
            ">
              ${locationCards}
            </div>

            <h2>QR Placements</h2>
            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fill,260px);
              gap:18px;
              margin-bottom:30px;
            ">
              ${qrCards}
            </div>

            <h2>Campaigns</h2>
            <div style="
              display:grid;
              grid-template-columns:repeat(auto-fill,260px);
              gap:18px;
            ">
              ${campaignCards}
            </div>

          </div>
        `
      ));

    } catch (err) {
      console.error("ORG ADVERTISER ERROR:", err);

      res.status(500).send(
        "ORG ADVERTISER ERROR: " + err.message
      );
    }
  }
);
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
      WHERE s.user_id = $1
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
const contractDays = Math.max(1, daysBetween(qr.live_date || qr.created_at, qr.end_date || new Date()));

const cost =
  (Number(qr.placement_cost || 800) / contractDays) *
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
      campaignTable += `<tr>
<td>${c.advertiser || ""} (user ${c.user_id})</td>
<td>${c.name || ""}</td>
<td>${c.is_deal_of_day ? "🔥 Deal" : "Standard"}</td>
<td>${scans}</td>
<td>${row.maps_clicks || 0}</td>
<td>${row.offer_clicks || 0}</td>
<td>${row.waze_clicks || 0}</td>
<td>${pct(intentRate)}</td>
<td>${customers}</td>
<td>${money(avgValue)}</td>
<td>${money(revenue)}</td>
<td>${money(cost)}</td>
<td>${money(cac)}</td>
<td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>

<td>
  <a class="btn" href="/admin/edit-campaign/${c.id}">
    Edit Campaign
  </a>
</td>
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
</div> <div class="note"><strong>Money View:</strong> Campaign ROI now uses allocated spot cost: QR cost / contract days × active days.</div>
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
      SELECT
        c.*,
        STRING_AGG(DISTINCT qr.name, ', ' ORDER BY qr.name) AS qr_name,
        STRING_AGG(DISTINCT s.location, ', ' ORDER BY s.location) AS market,
        STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) AS location_name,
        MIN(qc.assigned_at) AS first_assigned
      FROM campaigns c
      LEFT JOIN qr_campaigns qc
        ON qc.campaign_id = c.id
       AND COALESCE(qc.is_active,true) = true
      LEFT JOIN qr_codes qr ON qr.id = qc.qr_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE COALESCE(c.is_archived,false) = false
      GROUP BY c.id
      ORDER BY c.id DESC
    `
    : `
      SELECT
        c.*,
        STRING_AGG(DISTINCT qr.name, ', ' ORDER BY qr.name) AS qr_name,
        STRING_AGG(DISTINCT s.location, ', ' ORDER BY s.location) AS market,
        STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) AS location_name,
        MIN(qc.assigned_at) AS first_assigned
      FROM campaigns c
      LEFT JOIN qr_campaigns qc
        ON qc.campaign_id = c.id
       AND COALESCE(qc.is_active,true) = true
      LEFT JOIN qr_codes qr ON qr.id = qc.qr_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE COALESCE(c.is_archived,false) = false
        AND c.user_id = $1
      GROUP BY c.id
      ORDER BY c.id DESC
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
    qr.annual_cost / GREATEST(
  1,
  COALESCE(qr.end_date::date, CURRENT_DATE) - COALESCE(qr.live_date::date, DATE(COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP))) + 1
)
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
    qr.annual_cost / GREATEST(
  1,
  COALESCE(qr.end_date::date, CURRENT_DATE) - COALESCE(qr.live_date::date, DATE(COALESCE(qc.started_at, qc.assigned_at, CURRENT_TIMESTAMP))) + 1
)*
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
FROM (
    SELECT DISTINCT ON (qr_id, campaign_id)
        *
    FROM qr_campaigns
    WHERE COALESCE(is_active, true) = true
    ORDER BY qr_id, campaign_id, id DESC
) qc
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
[...new Set(
  relationships.rows
    .filter(r => String(r.location_id) === String(s.id))
    .map(r => {
      const campaign = campaigns.rows.find(
        c => String(c.id) === String(r.campaign_id)
      );
      return campaign ? campaign.name : "";
    })
    .filter(Boolean)
)].join(", ")
}</td>
<td>${dateLabel(s.live_date || s.created_at)}</td>
<td>${daysActive(s.created_at)}</td>


  <td>
  <a href="/admin/view-location/${s.id}">View</a>
  &nbsp;|&nbsp;
  <a href="/admin/edit-location/${s.id}">Edit</a>
  &nbsp;|&nbsp;
  <a href="/admin/archive-location/${s.id}">Archive</a>
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
[...new Set(
  relationships.rows
    .filter(r => String(r.qr_id) === String(qr.id))
    .map(r => {
      const campaign = campaigns.rows.find(c => String(c.id) === String(r.campaign_id));
      return campaign ? campaign.advertiser : "";
    })
    .filter(Boolean)
)].join(", ")
}</td>
<td>
${qr.is_imported ? "Imported" : "Native"}
</td>
<td>${qr.location || ""}</td>
          <td>${qr.location_name || ""}</td>
          <td>${
[...new Set(
  relationships.rows
    .filter(r => String(r.qr_id) === String(qr.id))
    .map(r => {
      const campaign = campaigns.rows.find(
        c => String(c.id) === String(r.campaign_id)
      );
      return campaign ? campaign.name : "";
    })
    .filter(Boolean)
)].join(", ")
}</td>
<td>${dateLabel(qr.live_date || qr.created_at)}</td>
          <td>${daysActive(qr.created_at)}</td>
          <td>${Number(qr.annual_impressions || 0).toLocaleString()}</td>
<td>${money(qr.annual_cost || 0)}</td>
<td>
  <a href="/r/${qr.id}" target="_blank">Open</a>
  &nbsp;|&nbsp;
  <a href="/admin/view-qr/${qr.id}">View</a>
  &nbsp;|&nbsp;
  <a href="/admin/edit-qr/${qr.id}">Edit</a>
  &nbsp;|&nbsp;
  <a href="/admin/archive-qr/${qr.id}"
     onclick="return confirm('Archive this QR code?')"
     style="color:red;">Archive</a>
</td>

<td>
  <a href="/qr/${qr.id}.png" target="_blank">Download</a>
</td>


</tr>
        
      `;
    }

    let campaignTable = "";
    for (const c of campaigns.rows) {
      const campaignRelationships = relationships.rows.filter(
  r => String(r.campaign_id) === String(c.id)
);

const campaignMarkets = [...new Set(
  campaignRelationships.map(r => {
    const loc = locations.rows.find(l => String(l.id) === String(r.location_id));
    return loc ? loc.location : "";
  }).filter(Boolean)
)].join(", ");

const campaignLocations = [...new Set(
  campaignRelationships.map(r => {
    const loc = locations.rows.find(l => String(l.id) === String(r.location_id));
    return loc ? loc.name : "";
  }).filter(Boolean)
)].join(", ");

const campaignQrs = [...new Set(
  campaignRelationships.map(r => {
    const qr = qrs.rows.find(q => String(q.qr_id || q.id) === String(r.qr_id));
    return qr ? (qr.qr_name || qr.name) : "";
  }).filter(Boolean)
)].join(", ");
      campaignTable += `
        <tr>
          <td>${c.id}</td>
          <td>${c.advertiser || ""}</td>
          <td>${c.name || ""}</td>
<td>${campaignMarkets}</td>

<td>${campaignLocations}</td>
<td>${campaignQrs}</td>
<td>${dateLabel(c.created_at)}</td>

<td>${dateLabel(
  relationships.rows
    .filter(r => String(r.campaign_id) === String(c.id))
    .map(r => r.created_at)
    .filter(Boolean)
    .sort()[0],
  "Not Assigned"
)}</td>
<td>${c.end_date ? dateLabel(c.end_date) : "No End Date"}</td>
<td>${
  daysActive(
    c.start_date || (
      relationships.rows
        .filter(r => String(r.campaign_id) === String(c.id))
        .map(r => r.created_at)
        .filter(Boolean)
        .sort()[0] || c.created_at
    ),
    c.end_date || c.archived_at
  )
}</td>

<td>
  <a href="/admin/view-campaign/${c.id}">View</a>
  &nbsp;|&nbsp;
  <a href="/admin/edit-campaign/${c.id}">Edit</a>
  &nbsp;|&nbsp;
  <a href="/admin/archive-campaign/${c.id}"
     onclick="return confirm('Archive this campaign?')"
     style="color:red;">
     Archive
  </a>
</td>

<td>
  ${
    c.is_archived
      ? '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Archived</span>'
      : '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Active</span>'
  }
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
      <td>
  <a href="/admin/view-schedule/${s.id}">View</a>
  &nbsp;|&nbsp;
  <a href="/admin/edit-schedule/${s.id}">Edit</a>
  &nbsp;|&nbsp;
  <a href="/admin/deactivate-schedule/${s.id}">Archive</a>
</td>
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
<td>${dateLabel(a.started_at || a.assigned_at)}</td>
<td>${Number(a.assignment_days || 1)}</td>
<td>$${Number(
  a.allocated_cost ||
  ((a.placement_cost || 0) / Math.max(1, Number(a.contract_days || 365)))
).toFixed(2)}</td>
<td>
${a.is_active
? '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Active</span>'
: '<span style="background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:bold;">Inactive</span>'
}
</td>
<td>
  <a href="/admin/archive-assignment/${a.id}">Archive</a>
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
<b>Days in Market:</b> Tracks the active duration of each Vivid asset. Locations, QR codes, campaigns, schedules, and assignments are measured based on their applicable start and end dates.
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
            <th>Live Date</th>
           <th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
          
        
            <th>Action</th>
          </tr>
${locationTable || `<tr><td colspan="6">No locations yet.</td></tr>`}        </table>

       <h2>QR Codes</h2>

<div style="overflow-x:auto;width:100%;">
<table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Advertiser</th>
            <th>Type</th>
            <th>Market</th>
            <th>Location</th>
            <th>Campaigns</th>
            <th>Live Date</th>
            <th>
  Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Annual Impressions</th>
<th>Contract Cost</th>
<th>Action</th>
<th>Download</th>
          </tr>
        ${qrTable || '<tr><td colspan="...">No QR Codes yet.</td></tr>'}
</table>
</div>

        <h2>Campaigns</h2>
        <table>
<tr>
  <th>ID</th>
<th>Advertiser</th>
<th>Name</th>
<th>Market</th>
<th>Location</th>
<th>QR Code</th>
<th>Created Date</th>
<th>First Assigned</th>
<th>End Date</th>
<th>
Days in Market
  <span title="Number of days this item has been active in market since activation." style="cursor:help;">ⓘ</span>
</th>
<th>Action</th>
<th>Status</th>

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
  Assigned On
  
</th>
<th>Assignment Days<span title="Number of days this campaign has been actively assigned to this QR code." style="cursor:help;">ⓘ</span></th>
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
app.get("/admin/view-location/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

const result = await q(`
  SELECT
    s.*,
    COUNT(qr.id) AS qr_count
  FROM spaces s
  LEFT JOIN qr_codes qr ON qr.space_id = s.id
  WHERE s.id = $1
  GROUP BY s.id
  LIMIT 1
`, [id]);

  const s = result.rows[0];
const qrList = await q(`
  SELECT id, name, is_archived
  FROM qr_codes
  WHERE space_id = $1
  ORDER BY name ASC
`, [id]);

const qrListHtml = qrList.rows.length
  ? qrList.rows.map(qr => `
      <li>
        <a href="/admin/view-qr/${qr.id}">${qr.name}</a>
        - ${qr.is_archived ? "Archived" : "Active"}
      </li>
    `).join("")
  : "<li>No QR Codes assigned</li>";
  if (!s) {
    return res.status(404).send("Location not found");
  }

  res.send(page("View Location", `
    <div class="wrap">
      <h1>View Location</h1>

      <div class="card">
        <p><b>Name:</b> ${s.name || ""}</p>
        <p><b>Market:</b> ${s.location || ""}</p>
        <p><b>Live Date:</b> ${s.live_date || "Not set"}</p>
        <p><b>QR Count:</b> ${s.qr_count || 0}</p>
<p><b>QR Codes Assigned:</b></p>
<ul>
  ${qrListHtml}
</ul>

        <p><b>Status:</b> ${s.is_archived ? "Archived" : "Active"}</p>

        <br>

        <a class="btn" href="/admin/edit-location/${s.id}">Edit Location</a>
        <a class="btn" href="/admin/setup">Back to My Setup</a>
      </div>
    </div>
  `));
});
app.get("/admin/view-qr/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

const result = await q(`
SELECT
  qr.*,
 COALESCE(s.name, '') AS display_location,
COALESCE(s.location, '') AS display_market
, COALESCE(c.advertiser, '') AS display_advertiser
FROM qr_codes qr
LEFT JOIN spaces s
  ON s.id = qr.space_id
  LEFT JOIN qr_campaigns qc
  ON qc.qr_id = qr.id

LEFT JOIN campaigns c
  ON c.id = qc.campaign_id
WHERE qr.id = $1
LIMIT 1
`, [id]);

  const qr = result.rows[0];
  const campaignList = await q(`
  SELECT
    c.id,
    c.name,
    c.advertiser,
    BOOL_OR(COALESCE(qc.is_active,true)) AS is_active
  FROM qr_campaigns qc
  JOIN campaigns c ON c.id = qc.campaign_id
  WHERE qc.qr_id = $1
  GROUP BY c.id, c.name, c.advertiser
  ORDER BY c.name ASC
`, [id]);

const campaignListHtml = campaignList.rows.length
  ? campaignList.rows.map(c => `
      <li>
        <a href="/admin/view-campaign/${c.id}">${c.advertiser} - ${c.name}</a>
        - ${c.is_active ? "Active" : "Archived"}
      </li>
    `).join("")
  : "<li>No campaigns assigned</li>";
console.log("VIEW QR DATA:", qr);
  if (!qr) {
    return res.status(404).send("QR Code not found");
  }

  res.send(page("View QR Code", `
    <div class="wrap">
      <h1>View QR Code</h1>

      <div class="card">
        <p><b>Name:</b> ${qr.name || ""}</p>
        <p><b>Advertiser:</b> ${qr.display_advertiser || "Not set"}</p>
        <p><b>Type:</b> ${qr.is_imported ? "Imported" : "Native"}</p>
        <p><b>Market:</b> ${qr.display_market || "Not set"}</p>
<p><b>Location:</b> ${qr.display_location || qr.space_name || "Not set"}</p>
        <p><b>Live Date:</b> ${qr.live_date || "Not set"}</p>
        <p><b>End Date:</b> ${qr.end_date ? dayLabel(qr.end_date) : "Not set"}</p>
<p><b>Contract Days:</b> ${
  qr.live_date && qr.end_date
    ? daysBetween(qr.live_date, qr.end_date)
    : "Not set"
}</p>
<p><b>Assigned Campaigns:</b> ${campaignList.rows.length}</p>
<ul>
  ${campaignListHtml}
</ul>
        <p><b>Annual Impressions:</b> ${qr.annual_impressions || 0}</p>
        <p><b>Annual Cost:</b> $${qr.annual_cost || 0}</p>
        <p><b>Status:</b> ${qr.is_archived ? "Archived" : "Active"}</p>

        <br>

        <a class="btn" href="/admin/edit-qr/${qr.id}">Edit QR Code</a>
        <a class="btn" href="/admin/setup">Back to My Setup</a>
      </div>
    </div>
  `));
});
app.get("/admin/view-campaign/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  const result = await q(
    `
    SELECT *
    FROM campaigns
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [id, req.session.user.id]
  );

  const c = result.rows[0];
const qrList = await q(`
  SELECT DISTINCT qr.id, qr.name, qc.is_active
  FROM qr_campaigns qc
  JOIN qr_codes qr ON qr.id = qc.qr_id
  WHERE qc.campaign_id = $1
  ORDER BY qr.name ASC
`, [id]);

const qrListHtml = qrList.rows.length
  ? qrList.rows.map(qr => `
      <li>
        <a href="/admin/view-qr/${qr.id}">${qr.name}</a>
        - ${qr.is_active ? "Active" : "Archived"}
      </li>
    `).join("")
  : "<li>No QR Codes assigned</li>";
  if (!c) {
    return res.status(404).send("Campaign not found");
  }

  res.send(page("View Campaign", `
    <div class="wrap">
      <h1>View Campaign</h1>

      <div class="card">
        <p><b>Advertiser:</b> ${c.advertiser || ""}</p>
        <p><b>Campaign Name:</b> ${c.name || ""}</p>
        <p><b>Campaign URL:</b> ${c.campaign_url || ""}</p>
        <p><b>Conversion Page URL:</b> ${c.conversion_url || "Not set"}</p>
        <p><b>Actual Customer Value:</b> $${c.avg_customer_value || 0}</p>
        <p><b>Start Date:</b> ${c.start_date || "Not set"}</p>
  <p><b>End Date:</b> ${c.end_date || "Not set"}</p>

<p><b>Contract Days:</b> ${
  c.start_date && c.end_date
    ? daysBetween(c.start_date, c.end_date)
    : "Not set"
}</p>
      <p><b>Assigned QR Codes:</b> ${qrList.rows.length}</p>
<ul>
  ${qrListHtml}
</ul>  
        <p><b>Status:</b> ${c.is_active === false ? "Archived" : "Active"}</p>

        <br>

        <a class="btn" href="/admin/edit-campaign/${c.id}">Edit Campaign</a>
        <a class="btn" href="/admin/setup">Back to My Setup</a>
      </div>
    </div>
  `));
});
app.get("/reports", requireLogin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;

    const reportRows = await buildExportReportRows(
      req,
      startDate,
      endDate,
      "",
      "",
      "",
      "all"
    );

    let reportTable = "";

    for (const r of reportRows) {
      reportTable += `
        <tr>
          <td>${r.advertiser || ""}</td>
          <td>${r.campaignName || ""}</td>
          <td>
            ${r.status === "Archived"
              ? '<span style="background:#dc2626;color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Archived</span>'
              : '<span style="background:#16a34a;color:white;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;">Active</span>'}
          </td>
          <td style="text-align:center;">${r.scans}</td>
          <td style="text-align:center;">${r.offerClicks}</td>
          <td style="text-align:center;">${r.mapClicks}</td>
          <td style="text-align:center;">${r.wazeClicks}</td>
          <td style="text-align:center;">${r.intent}</td>
          <td style="text-align:center;">${r.conversions}</td>
          <td>${money(r.revenue)}</td>
          <td>${money(r.allocatedCost)}</td>
          <td>${money(r.cac)}</td>
          <td class="${r.roi >= 0 ? "good" : "bad"}">${pct(r.roi)}</td>
        </tr>
      `;
    }

    res.send(page("Reports", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Reports</h1>
      </div>

      <div class="wrap">

        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
          <a class="btn" href="/reports">Campaign Reports</a>
          <a class="btn secondary" href="/reports-qr">QR Reports</a>
          <a class="btn secondary" href="/reports-location">Location Reports</a>
          <a class="btn gold" href="/admin/reports">Export Center</a>
        </div>

        <form method="GET" action="/reports" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
          <div>
            <label>Start Date</label><br>
            <input type="date" name="start_date" value="${startDate}">
          </div>

          <div>
            <label>End Date</label><br>
            <input type="date" name="end_date" value="${endDate}">
          </div>

          <button class="btn" type="submit">Apply Filter</button>
        </form>

        <div class="card">
          <h2>Campaign Performance</h2>

          <table>
            <tr>
              <th>Advertiser</th>
              <th>Campaign</th>
              <th>Status</th>
              <th>Scans</th>
              <th>Offers</th>
              <th>Maps</th>
              <th>Waze</th>
              <th>Total Intent</th>
              <th>Conversions</th>
              <th>Revenue</th>
              <th>Allocated Cost</th>
              <th>CAC</th>
              <th>ROI</th>
            </tr>

            ${reportTable || `
              <tr>
                <td colspan="13">No report data yet.</td>
              </tr>
            `}
          </table>
        </div>

      </div>
    `));

  } catch (err) {
    console.error("REPORT ERROR:", err);
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
    const today = new Date().toISOString().slice(0, 10);

    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;

    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const userId = isSuperAdmin ? null : currentUser.id;

    const qrResult = await q(`
      SELECT DISTINCT
        qr.id AS qr_id,
        qr.name AS qr_name
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      LEFT JOIN qr_campaigns qc ON qc.qr_id = qr.id
      LEFT JOIN campaigns c ON c.id = qc.campaign_id
      WHERE ($1::int IS NULL OR s.user_id = $1 OR c.user_id = $1)
      ORDER BY qr.name
    `, [userId]);

    let reportTable = "";

    for (const qr of qrResult.rows) {
      const metrics = await q(`
        SELECT
          COUNT(*) FILTER (WHERE e.type = 'scan')::int AS scans,
          COUNT(*) FILTER (WHERE e.type = 'offer')::int AS offer_clicks,
          COUNT(*) FILTER (WHERE e.type = 'maps')::int AS map_clicks,
          COUNT(*) FILTER (WHERE e.type = 'waze')::int AS waze_clicks,
          COUNT(*) FILTER (WHERE e.type = 'conversion')::int AS conversions,
          COALESCE(SUM(e.value) FILTER (WHERE e.type = 'conversion'), 0)::numeric(12,2) AS revenue
        FROM events e
        WHERE e.qr_id = $1
          AND e.created_at::date BETWEEN $2::date AND $3::date
      `, [qr.qr_id, startDate, endDate]);

      const campaignCountResult = await q(`
        SELECT COUNT(DISTINCT campaign_id)::int AS campaign_count
        FROM qr_campaigns
        WHERE qr_id = $1
          AND COALESCE(is_active,true) = true
      `, [qr.qr_id]);

      const m = metrics.rows[0] || {};

      const scans = Number(m.scans || 0);
      const offers = Number(m.offer_clicks || 0);
      const maps = Number(m.map_clicks || 0);
      const waze = Number(m.waze_clicks || 0);
      const intent = offers + maps + waze;
      const conversions = Number(m.conversions || 0);
      const revenue = Number(m.revenue || 0);

let allocatedCost = 0;

const assignedCampaigns = await q(`
  SELECT DISTINCT campaign_id
  FROM qr_campaigns
  WHERE qr_id = $1
    AND COALESCE(is_active,true) = true
`, [qr.qr_id]);

for (const ac of assignedCampaigns.rows) {
  allocatedCost += await allocatedSpotCostForCampaign(
    ac.campaign_id,
    startDate || today,
    endDate || today
  );
}

      const customerValue = conversions > 0 ? revenue / conversions : 0;
      const roi =
        allocatedCost > 0
          ? ((revenue - allocatedCost) / allocatedCost) * 100
          : 0;

      reportTable += `
        <tr>
          <td>${qr.qr_name || ""}</td>
          <td style="text-align:center;">${Number(campaignCountResult.rows[0]?.campaign_count || 0)}</td>
          <td style="text-align:center;">${scans}</td>
          <td style="text-align:center;">${offers}</td>
          <td style="text-align:center;">${maps}</td>
          <td style="text-align:center;">${waze}</td>
          <td style="text-align:center;">${intent}</td>
          <td style="text-align:center;">${conversions}</td>
          <td style="text-align:center;">${money(customerValue)}</td>
          <td style="text-align:center;">${money(revenue)}</td>
          <td style="text-align:center;">${money(allocatedCost)}</td>
          <td style="text-align:center;" class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
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
          <a class="btn gold" href="/admin/reports">Export Center</a>
        </div>

        <form method="GET" action="/reports-qr" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
          <div>
            <label>Start Date</label><br>
            <input type="date" name="start_date" value="${startDate}">
          </div>

          <div>
            <label>End Date</label><br>
            <input type="date" name="end_date" value="${endDate}">
          </div>

          <button class="btn" type="submit">Apply Filter</button>
        </form>

        <div class="card">
          <h2>QR Code Performance</h2>

          <table>
            <tr>
              <th>QR Code</th>
              <th>Campaign Count</th>
              <th>Scans</th>
              <th>Offers</th>
              <th>Maps</th>
              <th>Waze</th>
              <th>Total Intent</th>
              <th>Conversions</th>
              <th>Customer Value</th>
              <th>Revenue</th>
              <th>Allocated Cost</th>
              <th>ROI</th>
            </tr>

            ${reportTable || `
              <tr>
                <td colspan="12">No QR report data yet.</td>
              </tr>
            `}
          </table>
        </div>
      </div>
    `));

  } catch (err) {
    console.error("QR REPORT ERROR:", err);
    res.send("QR REPORT ERROR: " + err.message);
  }
});

app.get("/reports-campaign", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const startDate = req.query.start_date || "";
    const endDate = req.query.end_date || "";

    const userWhere = isSuperAdmin ? "" : "AND c.user_id = $1";
    const params = isSuperAdmin ? [] : [currentUser.id];

    const rows = await q(`
      SELECT
        c.id AS campaign_id,
        c.advertiser,
        c.name AS campaign_name,
        c.avg_customer_value,
        COALESCE(c.is_archived,false) AS is_archived,

        COUNT(DISTINCT qc.qr_id) AS qr_count,

        COUNT(e.id) FILTER (WHERE e.type='scan') AS scans,
        COUNT(e.id) FILTER (WHERE e.type='offer') AS offers,
        COUNT(e.id) FILTER (WHERE e.type='maps') AS maps,
        COUNT(e.id) FILTER (WHERE e.type='waze') AS waze,
        COUNT(e.id) FILTER (WHERE e.type IN ('offer','maps','waze')) AS total_intent,
        COUNT(e.id) FILTER (WHERE e.type='conversion') AS conversions,
        COALESCE(SUM(e.value) FILTER (WHERE e.type='conversion'),0) AS conversion_value,

        GREATEST(
          0,
          COALESCE(
            LEAST(COALESCE(c.end_date, CURRENT_DATE), COALESCE(NULLIF('${endDate}','')::date, CURRENT_DATE))
            -
            GREATEST(COALESCE(c.start_date, c.created_at::date), COALESCE(NULLIF('${startDate}','')::date, COALESCE(c.start_date, c.created_at::date)))
            + 1,
            0
          )
        ) AS active_days

      FROM campaigns c
      LEFT JOIN qr_campaigns qc
        ON qc.campaign_id = c.id
       AND COALESCE(qc.is_active,true) = true
      LEFT JOIN events e
        ON e.campaign_id = c.id
       ${startDate && endDate ? `AND e.created_at::date BETWEEN '${startDate}' AND '${endDate}'` : ""}

      WHERE 1=1
        ${userWhere}

      GROUP BY c.id
      ORDER BY c.id DESC
    `, params);

    let table = "";

    for (const r of rows.rows) {
      const scans = Number(r.scans || 0);
      const offers = Number(r.offers || 0);
      const maps = Number(r.maps || 0);
      const waze = Number(r.waze || 0);
      const totalIntent = Number(r.total_intent || 0);
      const conversions = Number(r.conversions || 0);
      const customerValue = Number(r.avg_customer_value || 0);
      const revenue = Number(r.conversion_value || 0);

      const allocatedCost = await allocatedSpotCostForCampaign(
        r.campaign_id,
        startDate,
        endDate
      );

      const roi = allocatedCost > 0
        ? (((revenue - allocatedCost) / allocatedCost) * 100).toFixed(1)
        : 0;

      table += `
        <tr>
          <td>${r.advertiser || ""}</td>
          <td>${r.campaign_name || ""}</td>
          <td>${r.is_archived ? '<span class="bad">Archived</span>' : '<span class="good">Active</span>'}</td>
          <td>${r.active_days || 0}</td>
          <td>${r.qr_count || 0}</td>
          <td>${scans}</td>
          <td>${offers}</td>
          <td>${maps}</td>
          <td>${waze}</td>
          <td>${totalIntent}</td>
          <td>${conversions}</td>
          <td>${money(customerValue)}</td>
          <td>${money(revenue)}</td>
          <td>${money(allocatedCost)}</td>
          <td>${roi}%</td>
        </tr>
      `;
    }

    res.send(page("Campaign Performance", `
      <div class="wrap">
        <form method="GET" action="/reports-campaign">
          <label>Start Date</label>
          <input type="date" name="start_date" value="${startDate}" />
          <label>End Date</label>
          <input type="date" name="end_date" value="${endDate}" />
          <button class="btn" type="submit">Apply Filter</button>
        </form>

        <div class="card">
          <h1>Campaign Performance</h1>
          <table>
            <tr>
              <th>Advertiser</th>
              <th>Campaign</th>
              <th>Status</th>
              <th>Active Days</th>
              <th>QR Count</th>
              <th>Scans</th>
              <th>Offers</th>
              <th>Maps</th>
              <th>Waze</th>
              <th>Total Intent</th>
              <th>Conversions</th>
              <th>Customer Value</th>
              <th>Revenue</th>
              <th>Allocated Cost</th>
              <th>ROI</th>
            </tr>
            ${table}
          </table>
        </div>
      </div>
    `));
  } catch (err) {
    res.send("CAMPAIGN REPORT ERROR: " + err.message);
  }
});
app.get("/reports-location", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const today = new Date().toISOString().slice(0, 10);
    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;

    const locations = await q(
      isSuperAdmin
        ? `
          SELECT id, name, location
          FROM spaces
          WHERE COALESCE(is_archived,false) = false
          ORDER BY name
        `
        : `
          SELECT id, name, location
          FROM spaces
          WHERE COALESCE(is_archived,false) = false
            AND user_id = $1
          ORDER BY name
        `,
      isSuperAdmin ? [] : [currentUser.id]
    );

    let table = "";

    for (const loc of locations.rows) {
      const metrics = await q(`
        SELECT
          COUNT(e.id) FILTER (WHERE e.type='scan') AS scans,
          COUNT(e.id) FILTER (WHERE e.type='offer') AS offers,
          COUNT(e.id) FILTER (WHERE e.type='maps') AS maps,
          COUNT(e.id) FILTER (WHERE e.type='waze') AS waze,
          COUNT(e.id) FILTER (WHERE e.type='conversion') AS conversions,
          COALESCE(SUM(e.value) FILTER (WHERE e.type='conversion'),0) AS revenue
        FROM qr_codes qr
        LEFT JOIN events e
          ON e.qr_id = qr.id
         AND e.created_at::date BETWEEN $2::date AND $3::date
        WHERE qr.space_id = $1
          AND COALESCE(qr.is_archived,false) = false
      `, [loc.id, startDate, endDate]);

      const qrs = await q(`
        SELECT id
        FROM qr_codes
        WHERE space_id = $1
          AND COALESCE(is_archived,false) = false
      `, [loc.id]);

      let allocatedCost = 0;

      for (const qr of qrs.rows) {
   allocatedCost += await allocatedSpotCostForQr(
  qr.id,
  startDate,
  endDate
);
      }

      const m = metrics.rows[0] || {};
      const scans = Number(m.scans || 0);
      const offers = Number(m.offers || 0);
      const maps = Number(m.maps || 0);
      const waze = Number(m.waze || 0);
      const intent = offers + maps + waze;
      const conversions = Number(m.conversions || 0);
      const revenue = Number(m.revenue || 0);

      const customerValue = conversions > 0 ? revenue / conversions : 0;
      const roi =
        allocatedCost > 0
          ? ((revenue - allocatedCost) / allocatedCost) * 100
          : 0;

      table += `
        <tr>
          <td>${loc.name || ""}</td>
          <td>${loc.location || ""}</td>
          <td>${scans}</td>
          <td>${offers}</td>
          <td>${maps}</td>
          <td>${waze}</td>
          <td>${intent}</td>
          <td>${conversions}</td>
          <td>${money(customerValue)}</td>
          <td>${money(revenue)}</td>
          <td>${money(allocatedCost)}</td>
          <td class="${roi >= 0 ? "good" : "bad"}">${pct(roi)}</td>
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
          <a class="btn secondary" href="/reports-qr">QR Reports</a>
          <a class="btn secondary" href="/reports">Campaign Reports</a>
          <a class="btn" href="/reports-location">Location Reports</a>
          <a class="btn gold" href="/admin/reports">Export Center</a>
        </div>

        <form method="GET" action="/reports-location" style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:18px 0;">
          <div>
            <label>Start Date</label><br>
            <input type="date" name="start_date" value="${startDate}">
          </div>

          <div>
            <label>End Date</label><br>
            <input type="date" name="end_date" value="${endDate}">
          </div>

          <button class="btn" type="submit">Apply Filter</button>
        </form>

        <div class="card">
          <h2>Location Performance</h2>

          <table>
            <tr>
              <th>Location</th>
              <th>Market</th>
              <th>Scans</th>
              <th>Offers</th>
              <th>Maps</th>
              <th>Waze</th>
              <th>Total Intent</th>
              <th>Conversions</th>
              <th>Customer Value</th>
              <th>Revenue</th>
              <th>Allocated Cost</th>
              <th>ROI</th>
            </tr>
            ${table || `<tr><td colspan="12">No location data yet.</td></tr>`}
          </table>
        </div>
      </div>
    `));

  } catch (err) {
    console.error("LOCATION REPORT ERROR:", err);
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

        <label>Estimated Impressions</label>
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
app.get("/admin/organizations", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";

    const orgs = await q(
      isSuperAdmin
        ? `
          SELECT
            o.*,
            COUNT(s.id) AS location_count
          FROM organizations o
          LEFT JOIN spaces s ON s.organization_id = o.id
          GROUP BY o.id
          ORDER BY o.name
        `
          : `
  SELECT
    o.*,
    COUNT(s.id) AS location_count
  FROM organization_users ou
  JOIN organizations o
    ON o.id = ou.organization_id
  LEFT JOIN spaces s
    ON s.organization_id = o.id
  WHERE ou.user_id = $1
    AND COALESCE(ou.is_active, true) = true
    AND COALESCE(o.is_active, true) = true
  GROUP BY o.id
  ORDER BY o.name
`,    
      isSuperAdmin ? [] : [currentUser.id]
    );

    let rows = "";

    for (const org of orgs.rows) {
      rows += `
        <tr>
          <td><a href="/admin/edit-organization/${org.id}">${org.name}</a></td>
          <td>${org.organization_type || ""}</td>
          <td>${org.location_count || 0}</td>
          <td>${org.is_active ? "Active" : "Archived"}</td>
          <td>
            <a href="/admin/edit-organization/${org.id}">Edit</a>
          </td>
        </tr>
      `;
    }

    res.send(page("Organizations", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Organizations</h1>
        <p class="subtitle">Manage the companies, hosts, districts, venues, and groups that own locations.</p>
      </div>

      <div class="wrap">
        <a class="btn" href="/admin/new-organization">+ New Organization</a>
        <a class="btn secondary" href="/my-setup">Back to My Setup</a>

        <table>
          <tr>
            <th>Organization</th>
            <th>Type</th>
            <th>Locations</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
          ${rows || `
            <tr>
              <td colspan="5">No organizations found.</td>
            </tr>
          `}
        </table>
      </div>
    `));

  } catch (err) {
    res.status(500).send("ORGANIZATIONS ERROR: " + err.message);
  }
});
app.get("/admin/new-organization", requireLogin, async (req, res) => {
  res.send(page("New Organization", `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>New Organization</h1>
      <p class="subtitle">Create the owner or host of locations.</p>
    </div>

    <div class="wrap">
      <form method="POST" action="/admin/new-organization">

        <label>Organization Name</label>
        <input name="name" required />

        <label>Type</label>
        <input name="organization_type" placeholder="School, District, Gym, Hotel, Retail, Venue, etc." />

        <label>Contact Name</label>
        <input name="contact_name" />

        <label>Contact Email</label>
        <input name="contact_email" type="email" />

        <label>Contact Phone</label>
        <input name="contact_phone" />

        <label>Website</label>
        <input name="website" />

        <label>Notes</label>
        <input name="notes" />

        <button class="btn" type="submit">Save Organization</button>
        <a class="btn secondary" href="/admin/organizations">Cancel</a>

      </form>
    </div>
  `));
});
app.post("/admin/new-organization", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const customerId = currentUser.id;
const existingOrg = await q(`
  SELECT id
  FROM organizations
  WHERE customer_id = $1
    AND LOWER(name) = LOWER($2)
    AND COALESCE(is_active,true) = true
  LIMIT 1
`, [
  currentUser.id,
  req.body.name
]);

if (existingOrg.rows[0]) {
  return res.redirect("/admin/organizations");
}
    const result = await q(`
      INSERT INTO organizations (
        customer_id,
        name,
        organization_type,
        contact_name,
        contact_email,
        contact_phone,
        website,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
RETURNING id
    `, [
      customerId,
      req.body.name,
      req.body.organization_type || "",
      req.body.contact_name || "",
      req.body.contact_email || "",
      req.body.contact_phone || "",
      req.body.website || "",
      req.body.notes || ""
    ]);
await q(`
  INSERT INTO organization_users (
    organization_id,
    user_id,
    role
  )
  VALUES ($1, $2, 'owner')
`, [
  result.rows[0].id,
  currentUser.id
]);
    res.redirect("/admin/organizations");

  } catch (err) {
    res.status(500).send("CREATE ORGANIZATION ERROR: " + err.message);
  }
});
app.get("/admin/edit-organization/:id", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const orgId = Number(req.params.id);

    const result = await q(
      isSuperAdmin
        ? `SELECT * FROM organizations WHERE id = $1`
        : `
          SELECT *
          FROM organizations
          WHERE id = $1
          AND customer_id = COALESCE($2::int, $3::int)
        `,
      isSuperAdmin ? [orgId] : [orgId, currentUser.customer_id, currentUser.id]
    );

    const org = result.rows[0];

    if (!org) {
      return res.status(404).send("Organization not found");
    }

    res.send(page("Edit Organization", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Edit Organization</h1>
        <p class="subtitle">${org.name}</p>
      </div>

      <div class="wrap">
        <form method="POST" action="/admin/edit-organization/${org.id}">

          <label>Organization Name</label>
          <input name="name" value="${org.name || ""}" required />

          <label>Type</label>
          <input name="organization_type" value="${org.organization_type || ""}" />

          <label>Contact Name</label>
          <input name="contact_name" value="${org.contact_name || ""}" />

          <label>Contact Email</label>
          <input name="contact_email" type="email" value="${org.contact_email || ""}" />

          <label>Contact Phone</label>
          <input name="contact_phone" value="${org.contact_phone || ""}" />

          <label>Website</label>
          <input name="website" value="${org.website || ""}" />

          <label>Notes</label>
          <input name="notes" value="${org.notes || ""}" />

          <label>Status</label>
          <select name="is_active">
            <option value="true" ${org.is_active ? "selected" : ""}>Active</option>
            <option value="false" ${!org.is_active ? "selected" : ""}>Archived</option>
          </select>

          <button class="btn" type="submit">Save Changes</button>
          <a class="btn secondary" href="/admin/organizations">Cancel</a>

        </form>
      </div>
    `));

  } catch (err) {
    res.status(500).send("EDIT ORGANIZATION ERROR: " + err.message);
  }
});
app.post("/admin/edit-organization/:id", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const orgId = Number(req.params.id);

    await q(
      isSuperAdmin
        ? `
          UPDATE organizations
          SET
            name = $1,
            organization_type = $2,
            contact_name = $3,
            contact_email = $4,
            contact_phone = $5,
            website = $6,
            notes = $7,
            is_active = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
        `
        : `
          UPDATE organizations
          SET
            name = $1,
            organization_type = $2,
            contact_name = $3,
            contact_email = $4,
            contact_phone = $5,
            website = $6,
            notes = $7,
            is_active = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
          AND customer_id = COALESCE($10::int, $11::int)
        `,
      isSuperAdmin
        ? [
            req.body.name,
            req.body.organization_type || "",
            req.body.contact_name || "",
            req.body.contact_email || "",
            req.body.contact_phone || "",
            req.body.website || "",
            req.body.notes || "",
            req.body.is_active === "true",
            orgId
          ]
        : [
            req.body.name,
            req.body.organization_type || "",
            req.body.contact_name || "",
            req.body.contact_email || "",
            req.body.contact_phone || "",
            req.body.website || "",
            req.body.notes || "",
            req.body.is_active === "true",
            orgId,
            currentUser.customer_id,
            currentUser.id
          ]
    );

    res.redirect("/admin/organizations");

  } catch (err) {
    res.status(500).send("UPDATE ORGANIZATION ERROR: " + err.message);
  }
});
app.get("/admin/new-location", requireLogin, async (req, res) => {
  try {
    const currentUser = req.session.user;

    const orgs = await q(`
      SELECT
        o.id,
        o.name
      FROM organization_users ou
      JOIN organizations o
        ON o.id = ou.organization_id
      WHERE ou.user_id = $1
        AND COALESCE(ou.is_active,true) = true
        AND COALESCE(o.is_active,true) = true
      ORDER BY o.name
    `, [currentUser.id]);

    let organizationField = "";

    if (orgs.rows.length === 1) {
      organizationField = `
        <input type="hidden" name="organization_id" value="${orgs.rows[0].id}" />
        <p><strong>Organization:</strong> ${orgs.rows[0].name}</p>
      `;
    } else {
      organizationField = `
        <label>Organization</label>
        <select name="organization_id" required>
          ${orgs.rows.map(o => `
            <option value="${o.id}">${o.name}</option>
          `).join("")}
        </select>
      `;
    }

    res.send(page("Add Location", `
      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Add Location / Space</h1>
      </div>

      <div class="wrap">
        <form method="POST" action="/admin/new-location">
          ${organizationField}

          <label>Name</label>
          <input name="name" required />

          <label>Market</label>
          <input name="location" placeholder="Naples, FL" />

          <label>Description</label>
          <input name="description" />

          <button class="btn" type="submit">Create Location</button>
        </form>
      </div>
    `));

  } catch (err) {
    res.send("NEW LOCATION FORM ERROR: " + err.message);
  }
});
app.post("/admin/new-location", requireLogin, async (req, res) => {
  console.log("NEW LOCATION POST", new Date().toISOString(), req.body);

  try {
    const currentUser = req.session.user;
    const organizationId = Number(req.body.organization_id);
const existingLocation = await q(`
  SELECT id
  FROM spaces
  WHERE user_id = $1
    AND organization_id = $2
    AND LOWER(name) = LOWER($3)
    AND COALESCE(is_archived,false) = false
  LIMIT 1
`, [
  currentUser.id,
  organizationId,
  req.body.name
]);

if (existingLocation.rows[0]) {
  return res.redirect(`/admin/new-qr?space_id=${existingLocation.rows[0].id}`);
}
    const allowedOrg = await q(`
      SELECT 1
      FROM organization_users
      WHERE organization_id = $1
        AND user_id = $2
        AND COALESCE(is_active,true) = true
      LIMIT 1
    `, [
      organizationId,
      currentUser.id
    ]);

    if (!allowedOrg.rows[0]) {
      return res.status(403).send("You do not have access to this organization.");
    }

    await q(`
      INSERT INTO spaces (
        user_id,
        organization_id,
        name,
        location
      )
      VALUES ($1,$2,$3,$4)
    `, [
      currentUser.id,
      organizationId,
      req.body.name,
      req.body.location
    ]);

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
       ${qr.is_imported ? `
  <label>Current Destination URL</label>
  <input value="${qr.description}" readonly />
` : ""} 
${qr.is_imported ? `
  <label>Current Destination URL</label>
  <input value="${qr.description}" readonly />
` : ""}
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
    Convert Existing QR to Vivid Tracking
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

      <label>Current QR Destination URL</label>
      <input
        name="destination_url"
        placeholder="https://example.com"
        required
      />
      <p style="font-size:14px;color:#40624f;margin-top:6px;">
  Paste the URL your current QR code redirects to. Vivid will create a tracking link that forwards visitors to this destination.
</p>
<label>Total QR Cost</label>
<input name="total_cost" type="number" value="800" />

<label>Live Date</label>
<input name="live_date" type="date" />

<label>End Date</label>
<input name="end_date" type="date" />
<div id="contractDays" style="margin-top:10px;font-weight:600;color:#40624f;">
  Contract Days: 0
</div>
<p style="font-size:14px;color:#40624f;margin-top:14px;">
  After creating your Vivid Tracking Link, update your existing QR code's destination URL to the Vivid Tracking URL provided on the next screen.
</p>
<label>Estimated Impressions</label>
<input name="annual_impressions" type="number" value="146000" />
      <button class="btn" type="submit">Create Vivid Tracking Link</button>
<script>
const liveDate = document.querySelector('[name="live_date"]');
const endDate = document.querySelector('[name="end_date"]');
const contractDays = document.getElementById('contractDays');

function updateContractDays() {
  if (!liveDate.value || !endDate.value) {
    contractDays.innerHTML = 'Contract Days: 0';
    return;
  }

  const start = new Date(liveDate.value);
  const end = new Date(endDate.value);
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
contractDays.innerHTML = 'Contract Days: ' + (diff > 0 ? diff : 0);
}

liveDate.addEventListener('change', updateContractDays);
endDate.addEventListener('change', updateContractDays);
</script>
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
WHERE COALESCE(is_archived, false) = false
ORDER BY id
`
: `
  SELECT *
  FROM spaces
  WHERE user_id = $1
    AND COALESCE(is_archived, false) = false
  ORDER BY id
`,
isSuperAdmin ? [] : [req.session.user.id]
);
res.send(page("Add QR", `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Add QR Code</h1></div><div class="wrap"><form method="POST" action="/admin/new-qr"><label>Select Location</label><select name="space_id">${spaces.rows.map(s => `<option value="${s.id}">${s.name} (${s.location})</option>`).join("")}</select><label>QR Name</label><input name="name" placeholder="Car Line QR" /><label>Description</label><input name="description" /><label>QR Cost ($)</label>
<input type="number" name="annual_cost" value="800" />

<label>Live Date</label>
<input type="date" name="live_date" />

<label>End Date</label>
<input type="date" name="end_date" />
<div id="contractDays" style="margin-top:10px;font-weight:600;color:#40624f;">
  Contract Days: 0
</div>
<p style="font-size:14px;color:#40624f;margin-top:6px;">
Contract Days will be calculated automatically from Live Date to End Date.
</p>

<label>Estimated Impressions</label><input type="number" name="annual_impressions" value="146000" /><button class="btn" type="submit">Create QR</button><script>
const liveDate = document.querySelector('[name="live_date"]');
const endDate = document.querySelector('[name="end_date"]');
const contractDays = document.getElementById('contractDays');

function updateContractDays() {
  if (!liveDate.value || !endDate.value) {
    contractDays.innerHTML = 'Contract Days: 0';
    return;
  }

  const start = new Date(liveDate.value);
  const end = new Date(endDate.value);
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  contractDays.innerHTML = 'Contract Days: ' + (diff > 0 ? diff : 0);
}

liveDate.addEventListener('change', updateContractDays);
endDate.addEventListener('change', updateContractDays);
</script></form></div>`));
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
  annual_impressions,
  is_imported
)
VALUES ($1,$2,$3,$4,$5,true)
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
    <h2 style="margin-top:0;">✅ Vivid Tracking Link Created</h2>

<p>Your Vivid tracking link has been created successfully.</p>

<p>
  <strong>Important:</strong> To enable Vivid tracking, update your existing QR code destination to the Vivid Tracking URL below.
</p>

<p>
  <strong>Vivid Tracking URL:</strong><br>
<input type="text" readonly value="${process.env.BASE_URL || "https://vivid-routing-production.up.railway.app"}/r/${qr.id}" style="width:100%;padding:12px;border:1px solid #cfd8d3;border-radius:8px;font-size:16px;">
</p>
<p style="font-size:14px;color:#2f855a;margin-top:8px;">
✓ Once your QR provider points to this URL, all scans will be tracked automatically.
</p>
<p>
  <strong>Current Destination URL:</strong><br>
  ${req.body.destination_url}
</p>

<p>
  <strong>Next Steps:</strong><br>
  1. Copy the Vivid Tracking URL above.<br>
  2. Log into your current QR code provider.<br>
  3. Replace the old destination URL with the Vivid Tracking URL.<br>
  4. Scan the original QR code to confirm tracking.
</p>

<p>Vivid will record each scan and automatically forward visitors to the final destination URL.</p>
<a href="${process.env.BASE_URL || "https://vivid-routing-production.up.railway.app"}/r/${qr.id}" target="_blank" style="background:#0b3d2e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">Test Tracking Link</a>
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
app.post("/admin/new-qr", requireLogin, async (req, res) => {
  try {
    const spaceId = Number(req.body.space_id);
    const qrName = req.body.name || "";
    const description = req.body.description || "";
    const liveDate = req.body.live_date || "";
    const endDate = req.body.end_date || "";

    const existing = await q(`
      SELECT id
      FROM qr_codes
      WHERE space_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        AND COALESCE(live_date::text, '') = COALESCE($3::text, '')
        AND COALESCE(end_date::text, '') = COALESCE($4::text, '')
      LIMIT 1
    `, [
      spaceId,
      qrName,
      liveDate || null,
      endDate || null
    ]);

    if (existing.rows[0]) {
      const qrId = existing.rows[0].id;

      return res.send(successPage(
        "QR Code Already Exists",
        "A QR code with the same location, name, live date, and end date already exists.",
        "Use the existing QR code or assign a campaign to it.",
        [
          { label: "Assign Campaign", href: "/admin/assign" },
          { label: "Download QR Code", href: "/qr/" + qrId + ".png", target: "_blank" },
          { label: "Preview QR Destination", href: "/r/" + qrId, target: "_blank" },
          { label: "Back to My Setup", href: "/my-setup" }
        ]
      ));
    }

    const newQr = await q(`
      INSERT INTO qr_codes (
        space_id,
        name,
        description,
        annual_cost,
        total_cost,
        live_date,
        end_date,
        annual_impressions
      )
      VALUES ($1,$2,$3,$4,$5,NULLIF($6, '')::date,NULLIF($7, '')::date,$8)
      RETURNING id
    `, [
      spaceId,
      qrName,
      description,
      Number(req.body.annual_cost || req.body.total_cost || 800),
      Number(req.body.total_cost || req.body.annual_cost || 800),
      liveDate,
      endDate,
      Number(req.body.annual_impressions || 146000)
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
      SET is_archived = true,
    archived_at = CURRENT_TIMESTAMP,
    end_date = CURRENT_DATE
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
      SET is_archived = true,
    archived_at = CURRENT_TIMESTAMP,
    end_date = CURRENT_DATE
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
      SET is_archived = true,
    archived_at = CURRENT_TIMESTAMP,
    end_date = CURRENT_DATE
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
  LEFT JOIN spaces s ON s.id = qr.space_id
  WHERE cs.is_active = false
    AND s.user_id = $1
  ORDER BY cs.id DESC
`, [req.session.user.id]);
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
    AND user_id = $1
  ORDER BY id DESC
`, [req.session.user.id]);
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
<th>Created</th>
<th>Archived</th>
<th>Days Active</th>
<th>Status</th>
<th>Action</th>
</tr>

    ${campaigns.rows.map(c => `
      <tr>
        <td>${c.id}</td>
   <td>${c.name || ""}</td>     
<td>${c.advertiser || ""}</td>
<td>${dateLabel(c.created_at)}</td>
<td>${dateLabel(c.archived_at, "Not Set")}</td>
<td>${daysActive(c.created_at, c.archived_at)}</td>
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
<th>Assigned</th>
<th>Archived</th>
<th>Days Active</th>
<th>Start</th>
<th>End</th>
<th>Status</th>
<th>Action</th>
</tr>

${archivedSchedules.rows.map(s => `
<tr>
  <td>${s.qr_name || ""}</td>
<td>${s.campaign_name || ""}</td>
<td>${dateLabel(s.created_at)}</td>
<td>${dateLabel(s.archived_at, "Not Set")}</td>
<td>${daysActive(s.created_at, s.archived_at)}</td>
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
<th>Live Date</th>
<th>Archived</th>
<th>Days Active</th>
<th>Status</th>
<th>Action</th>
</tr>

${archivedQrs.rows.map(qr => `
<tr>
  <td>${qr.id}</td>
<td>${qr.name || ""}</td>
<td>${qr.location_name || ""}</td>
<td>${dateLabel(qr.live_date)}</td>
<td>${dateLabel(qr.archived_at, "Not Set")}</td>
<td>${daysActive(qr.live_date, qr.archived_at)}</td>
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
<th>Live Date</th>
<th>Archived</th>
<th>Days Active</th>
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
<td>${dateLabel(l.live_date)}</td>
<td>${dateLabel(l.archived_at, "Not Set")}</td>
<td>${daysActive(l.live_date, l.archived_at)}</td>
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

    res.send(page("Performance Insights", `

      <div class="topbar">
        <div class="brand">Vivid Spots</div>
        <h1>Performance Insights</h1>
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
          <h3>📍 Top Performing Location</h3>
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
 conversion_url = $4,
 avg_customer_value = $5,
 conversion_rate = 8,
start_date = $6,
end_date = $7,
days = CASE
  WHEN $6::date IS NOT NULL AND $7::date IS NOT NULL
  THEN ($7::date - $6::date + 1)
  ELSE days
END
WHERE id = $8
RETURNING id
        `
        : `
 UPDATE campaigns
SET
  advertiser = $1,
  name = $2,
  campaign_url = $3,
  conversion_url = $4,
  avg_customer_value = $5,
  conversion_rate = 8,
  start_date = $6,
  end_date = $7
WHERE id = $8
AND user_id = $9
RETURNING id
        `,
      isSuperAdmin
        ?[
   req.body.advertiser || "",
req.body.name || "",
req.body.campaign_url || "",
 req.body.conversion_url || "",
Number(req.body.avg_customer_value || 50),
req.body.start_date || null,
 req.body.end_date || null,
req.params.campaignId
]
        : [
  req.body.advertiser || "",
req.body.name || "",
 req.body.campaign_url || "",
req.body.conversion_url || "",
Number(req.body.avg_customer_value || 50),
req.body.start_date || null,
 req.body.end_date || null,
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
      SET
        is_archived = false,
        archived_at = NULL,
        end_date = NULL
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
        <label>Conversion Page URL</label>
<input name="conversion_url" value="${c.conversion_url || ""}" placeholder="https://yourwebsite.com/thank-you" />

<div style="font-size:13px;color:#666;margin-top:4px;">
  Vivid records a conversion only when a visitor from a valid Vivid QR scan reaches this page.
</div>
        <div style="margin-top:15px;padding:12px;background:#f8f8f8;border-radius:8px;">

  <strong>Install Conversion Tracking</strong>

  <p style="margin-top:8px;font-size:14px;">
    Copy and paste this code on your thank-you page, confirmation page,
    checkout success page, or registration success page before the closing &lt;/body&gt; tag.
  </p>

  <textarea readonly
    style="width:100%;height:70px;padding:10px;font-family:monospace;border-radius:6px;">
<script src="https://vivid-routing-production.up.railway.app/vivid-conversion.js"></script>
  </textarea>

  <p style="margin-top:8px;font-size:13px;color:#666;">
    Vivid automatically attributes conversions back to the originating QR code and campaign.
    Only conversions from valid Vivid QR scans are recorded.
  </p>

</div>
<label>Start Date</label>
<input type="date" name="start_date" value="${c.start_date ? String(c.start_date).substring(0,10) : ""}" />

<label>End Date</label>
<input type="date" name="end_date" value="${c.end_date ? String(c.end_date).substring(0,10) : ""}" />
<div
  id="campaignDays"
  style="
    text-align:center;
    margin-top:15px;
    padding:10px;
  "
>
  <div style="font-size:13px;color:#666;">
    Contract Length
  </div>

 <div id="campaignDaysValue"
  style="font-size:28px;font-weight:700;color:#0b4f2f;">
  0 Days
</div>
</div>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const startInput = document.querySelector('input[name="start_date"]');
  const endInput = document.querySelector('input[name="end_date"]');
  const daysDisplay = document.getElementById('campaignDaysValue');

  function updateDays() {

    if (!startInput.value || !endInput.value) {
      daysDisplay.innerHTML = "0 Days";
      return;
    }

    const start = new Date(startInput.value);
    const end = new Date(endInput.value);

    const days =
      Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    daysDisplay.innerHTML = Math.max(days, 0) + " Days";
  }

  updateDays();

  startInput.addEventListener('change', updateDays);
  endInput.addEventListener('change', updateDays);
});
</script>
        <label>Revenue Per Conversion ($)</label>
        <input name="avg_customer_value" value="${c.avg_customer_value || 50}" />
<div style="font-size:12px;color:#666;margin-top:4px;margin-bottom:10px;">
  Average customer value used to estimate campaign revenue.
</div>
       
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
</div><div><label>Campaign Name</label><input name="name" value="Low Inventory Store Push" /></div><div><label>Campaign URL</label><input name="campaign_url" value="https://www.pepsi.com" /><label>Conversion Page URL</label>
<input name="conversion_url" placeholder="https://yourwebsite.com/thank-you" />

<div style="font-size:13px;color:#666;margin-top:4px;">
  Vivid records a conversion only when a visitor from a valid Vivid QR scan reaches this page.
</div></div><div>
  

<div style="margin-top:15px;padding:12px;background:#f8f8f8;border-radius:8px;">

  <strong>Install Conversion Tracking</strong>

  <p style="margin-top:8px;font-size:14px;">
Copy and paste this code on your thank-you page, confirmation page, checkout success page, or registration success page before the closing &lt;/body&gt; tag.
  </p>

  <textarea readonly
    style="width:100%;height:70px;padding:10px;font-family:monospace;border-radius:6px;">
<script src="https://vivid-routing-production.up.railway.app/vivid-conversion.js"></script>
  </textarea>

  <p style="margin-top:8px;font-size:13px;color:#666;">
    Vivid only records conversions that originate from a valid Vivid QR scan.
  </p>

</div>

</div>

<div><label>Actual Customer Value ($)</label><input name="avg_customer_value" value="35" /></div><div>
<label>Start Date</label>
<input type="date" name="start_date" />
</div>

<div>
  <label>End Date</label>
 <input type="date" name="end_date" />

  <div id="campaignDays"
    style="font-weight:600;color:#40624f;margin-top:10px;">
    Campaign Days: 0
  </div>
</div>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const startInput = document.querySelector('input[name="start_date"]');
  const endInput = document.querySelector('input[name="end_date"]');
  const daysDisplay = document.getElementById('campaignDays');

  function updateDays() {
    if (!startInput.value || !endInput.value) {
      daysDisplay.innerHTML = 'Campaign Days: 0';
      return;
    }

    const start = new Date(startInput.value);
    const end = new Date(endInput.value);

    const days =
      Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    daysDisplay.innerHTML =
      'Campaign Days: ' + Math.max(days, 0);
  }
updateDays();
  startInput.addEventListener('change', updateDays);
  endInput.addEventListener('change', updateDays);
});
</script>
</div><label><input type="checkbox" name="is_deal_of_day" style="width:auto" /> Deal of the Day</label><br><br><button class="btn" id="createCampaignBtn" type="submit">Create Campaign</button>

<script>
document.querySelector("form").addEventListener("submit", function () {
  const btn = document.getElementById("createCampaignBtn");
  btn.disabled = true;
  btn.innerText = "Creating...";
});
</script></form></div>`));
});

app.post("/admin/new-campaign", requireLogin, async (req, res) => {
  try {
    await q(`
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS conversion_url TEXT
    `);

    const userId =
      req.session.user.role === "super_admin"
        ? Number(req.body.user_id)
        : req.session.user.id;

    const name = req.body.name || "";
    const advertiser = req.body.advertiser || "";
    const startDate = req.body.start_date || null;
    const endDate = req.body.end_date || null;

const existing = await q(`
  SELECT id
  FROM campaigns
  WHERE user_id = $1
    AND LOWER(TRIM(name)) = LOWER(TRIM($2))
    AND LOWER(TRIM(advertiser)) = LOWER(TRIM($3))
    AND COALESCE(start_date::date, NULL) IS NOT DISTINCT FROM $4::date
    AND COALESCE(end_date::date, NULL) IS NOT DISTINCT FROM $5::date
  LIMIT 1
`, [
  userId,
  name,
  advertiser,
  startDate,
  endDate
]);

    if (existing.rows.length) {
      return res.send(successPage(
        "Campaign Already Exists",
        "A matching campaign already exists.",
        "Assign it to a QR code instead of creating another.",
        [
          { label: "Assign Campaign", href: "/admin/assign" },
          { label: "Back to My Setup", href: "/my-setup" },
          { label: "Dashboard", href: "/dashboard" }
        ]
      ));
    }

    await q(`
      INSERT INTO campaigns (
        name,
        advertiser,
        campaign_url,
        conversion_url,
        avg_customer_value,
        conversion_rate,
        is_deal_of_day,
        user_id,
        start_date,
        end_date
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      name,
      advertiser,
      req.body.campaign_url || "",
      req.body.conversion_url || "",
      Number(req.body.avg_customer_value || 50),
      8,
      req.body.is_deal_of_day === "on",
      userId,
      startDate,
      endDate
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
app.get("/admin/view-schedule/:id", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  const result = await q(`
    SELECT
      cs.*,
      c.name AS campaign_name,
      c.advertiser AS advertiser_name,
      qr.name AS qr_name
    FROM campaign_schedules cs
    LEFT JOIN campaigns c
      ON c.id = cs.campaign_id
    LEFT JOIN qr_codes qr
      ON qr.id = cs.qr_id
    WHERE cs.id = $1
    LIMIT 1
  `, [id]);

  const s = result.rows[0];

  if (!s) {
    return res.status(404).send("Schedule not found");
  }

  res.send(page("View Schedule", `
    <div class="wrap">
      <h1>View Schedule</h1>

      <div class="card">
        <p><b>QR Code:</b> ${s.qr_name || s.qr_id || "Not set"}</p>
        <p><b>Advertiser:</b> ${s.advertiser_name || "Not set"}</p>
        <p><b>Campaign:</b> ${s.campaign_name || s.campaign_id || "Not set"}</p>
       <p><b>Day:</b> ${dayLabels(s.days_of_week) || "Every Day"}</p>
        <p><b>Start:</b> ${s.start_time || "Not set"}</p>
        <p><b>End:</b> ${s.end_time || "Not set"}</p>
        <p><b>Priority:</b> ${s.priority || "Not set"}</p>
        <p><b>Status:</b> ${s.is_active ? "Active" : "Inactive"}</p>

        <br>

        <a class="btn" href="/admin/edit-schedule/${s.id}">Edit Schedule</a>
        <a class="btn" href="/admin/setup">Back to My Setup</a>
      </div>
    </div>
  `));
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
<a href="/admin/view-schedule/${s.id}">
  View
</a>
&nbsp;|&nbsp;
<a href="/admin/edit-schedule/${s.id}">
  Edit
</a>
&nbsp;|&nbsp;
<a href="/admin/deactivate-schedule/${s.id}">
  Archive
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
 await q(
  `
  UPDATE qr_campaigns
  SET
    is_active = true,
    started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
    assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
    ended_at = NULL
 WHERE id = (
  SELECT MIN(id)
  FROM qr_campaigns
  WHERE qr_id = $1
    AND campaign_id = $2
)
  `,
  [
    Number(req.body.qr_id),
    Number(req.body.campaign_id)
  ]
);

const existing = await q(
  `
  SELECT id
  FROM qr_campaigns
  WHERE qr_id = $1
    AND campaign_id = $2
  LIMIT 1
  `,
  [
    Number(req.body.qr_id),
    Number(req.body.campaign_id)
  ]
);

if (existing.rows.length === 0) {
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
    VALUES ($1,$2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL)
    `,
    [
      Number(req.body.qr_id),
      Number(req.body.campaign_id)
    ]
  );
}

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
app.get("/export/report.csv", requireLogin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const startDate =
      req.query.start_date ||
      req.query.startDate ||
      req.query.start ||
      req.query.from ||
      today;

    const endDate =
      req.query.end_date ||
      req.query.endDate ||
      req.query.end ||
      req.query.to ||
      today;

    const locationId = req.query.location_id || "";
    const qrId = req.query.qr_id || req.query.qrId || req.query.qr || "";
    const campaignId =
      req.query.campaign_id ||
      req.query.campaignId ||
      req.query.campaign ||
      "";

    const status = (req.query.status || "all").toLowerCase();

    const reportRows = await buildExportReportRows(
      req,
      startDate,
      endDate,
      locationId,
      qrId,
      campaignId,
      status
    );

    const header = [
      "Advertiser",
      "Campaign",
      "QR Codes",
      "Locations",
      "Status",
      "Scans",
      "Offer Clicks",
      "Map Clicks",
      "Waze Clicks",
      "Intent",
      "Conversions",
      "Revenue",
      "Allocated Cost",
      "CAC",
      "ROI %"
    ].join(",") + "\n";

    const rows = reportRows.map(r => [
      r.advertiser,
      r.campaignName,
      r.qrNames,
      r.locationNames,
      r.status,
      r.scans,
      r.offerClicks,
      r.mapClicks,
      r.wazeClicks,
      r.intent,
      r.conversions,
      r.revenue.toFixed(2),
      r.allocatedCost.toFixed(2),
      r.cac.toFixed(2),
      r.roi.toFixed(2)
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=vivid-executive-report.csv"
    );

    res.send(header + rows);

  } catch (err) {
    console.error("REPORT CSV ERROR:", err);
    res.status(500).send("REPORT CSV ERROR: " + err.message);
  }
});
app.get("/export/report.pdf", requireLogin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const startDate =
      req.query.start_date ||
      req.query.startDate ||
      req.query.start ||
      req.query.from ||
      today;

    const endDate =
      req.query.end_date ||
      req.query.endDate ||
      req.query.end ||
      req.query.to ||
      today;

    const locationId = req.query.location_id || "";
    const qrId = req.query.qr_id || req.query.qrId || req.query.qr || "";
    const campaignId =
      req.query.campaign_id ||
      req.query.campaignId ||
      req.query.campaign ||
      "";

    const status = (req.query.status || "all").toLowerCase();

    const reportRows = await buildExportReportRows(
      req,
      startDate,
      endDate,
      locationId,
      qrId,
      campaignId,
      status
    );

    const summary = reportRows.reduce((t, r) => {
      t.scans += r.scans;
      t.offerClicks += r.offerClicks;
      t.mapClicks += r.mapClicks;
      t.wazeClicks += r.wazeClicks;
      t.intent += r.intent;
      t.conversions += r.conversions;
      t.revenue += r.revenue;
      t.allocatedCost += r.allocatedCost;
      return t;
    }, {
      scans: 0,
      offerClicks: 0,
      mapClicks: 0,
      wazeClicks: 0,
      intent: 0,
      conversions: 0,
      revenue: 0,
      allocatedCost: 0
    });

    summary.cac =
      summary.conversions > 0
        ? summary.allocatedCost / summary.conversions
        : 0;

    summary.roi =
      summary.allocatedCost > 0
        ? ((summary.revenue - summary.allocatedCost) / summary.allocatedCost) * 100
        : 0;

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
    doc.text(`Scans: ${summary.scans}`);
    doc.text(`Offer Clicks: ${summary.offerClicks}`);
    doc.text(`Map Clicks: ${summary.mapClicks}`);
    doc.text(`Waze Clicks: ${summary.wazeClicks}`);
    doc.text(`Total Intent: ${summary.intent}`);
    doc.text(`Conversions: ${summary.conversions}`);
    doc.text(`Revenue: ${money(summary.revenue)}`);
    doc.text(`Allocated Cost: ${money(summary.allocatedCost)}`);
    doc.text(`CAC: ${money(summary.cac)}`);
    doc.text(`ROI: ${pct(summary.roi)}`);

    doc.moveDown(2);
    doc.fontSize(16).text("Campaign Results");
    doc.moveDown();

    if (reportRows.length === 0) {
      doc.fontSize(11).text("No campaign activity found for this date range.");
    } else {
      reportRows.forEach((r, i) => {
        doc.fontSize(11).text(`${i + 1}. ${r.advertiser || "Unknown Advertiser"} - ${r.campaignName || "Unnamed Campaign"}`);
        doc.fontSize(9).text(`QR Codes: ${r.qrNames || "N/A"}`);
        doc.text(`Locations: ${r.locationNames || "N/A"}`);
        doc.text(`Status: ${r.status}`);
        doc.text(`Scans: ${r.scans} | Offers: ${r.offerClicks} | Maps: ${r.mapClicks} | Waze: ${r.wazeClicks} | Intent: ${r.intent}`);
        doc.text(`Conversions: ${r.conversions} | Revenue: ${money(r.revenue)} | Allocated Cost: ${money(r.allocatedCost)} | CAC: ${money(r.cac)} | ROI: ${pct(r.roi)}`);
        doc.moveDown();
      });
    }

    doc.moveDown();
    doc.fontSize(9).text(
      "Vivid Spots helps advertisers measure physical-world engagement through QR routing, campaign analytics, conversion tracking, and performance reporting.",
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
async function buildExportReportRows(req, startDate, endDate, locationId, qrId, campaignId, status) {
  const currentUser = req.session.user;
  const isSuperAdmin = currentUser.role === "super_admin";
  const userId = isSuperAdmin ? null : currentUser.id;

  const campaignsResult = await q(`
    SELECT
      c.id AS campaign_id,
      c.name AS campaign_name,
      c.advertiser,
      COALESCE(c.is_archived,false) AS is_archived,
      STRING_AGG(DISTINCT qr.name, ', ') AS qr_names,
      STRING_AGG(DISTINCT s.name, ', ') AS location_names
    FROM campaigns c
    LEFT JOIN qr_campaigns qc
      ON qc.campaign_id = c.id
      AND COALESCE(qc.is_active,true) = true
    LEFT JOIN qr_codes qr
      ON qr.id = qc.qr_id
    LEFT JOIN spaces s
      ON s.id = qr.space_id
    WHERE ($1::int IS NULL OR c.user_id = $1 OR s.user_id = $1)
      AND ($2::text = '' OR c.id::text = $2::text)
      AND ($3::text = '' OR qr.id::text = $3::text)
      AND ($4::text = '' OR s.id::text = $4::text)
      AND (
        $5::text = 'all'
        OR ($5::text = 'active' AND COALESCE(c.is_archived,false) = false)
        OR ($5::text = 'archived' AND COALESCE(c.is_archived,false) = true)
      )
    GROUP BY c.id, c.name, c.advertiser, c.is_archived
    ORDER BY c.name ASC
  `, [userId, campaignId || "", qrId || "", locationId || "", status || "all"]);

  const reportRows = [];

  for (const c of campaignsResult.rows) {
    const metrics = await q(`
      SELECT
        COUNT(*) FILTER (WHERE e.type = 'scan')::int AS scans,
        COUNT(*) FILTER (WHERE e.type = 'offer')::int AS offer_clicks,
        COUNT(*) FILTER (WHERE e.type = 'maps')::int AS map_clicks,
        COUNT(*) FILTER (WHERE e.type = 'waze')::int AS waze_clicks,
        COUNT(*) FILTER (WHERE e.type = 'conversion')::int AS conversions,
        COALESCE(SUM(e.value) FILTER (WHERE e.type = 'conversion'), 0)::numeric(12,2) AS revenue
      FROM events e
      LEFT JOIN qr_codes qr ON qr.id = e.qr_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE e.campaign_id = $1
        AND e.created_at::date BETWEEN $2::date AND $3::date
        AND ($4::text = '' OR qr.space_id::text = $4::text)
        AND ($5::text = '' OR e.qr_id::text = $5::text)
    `, [c.campaign_id, startDate, endDate, locationId || "", qrId || ""]);

    const m = metrics.rows[0] || {};

    const scans = Number(m.scans || 0);
    const offerClicks = Number(m.offer_clicks || 0);
    const mapClicks = Number(m.map_clicks || 0);
    const wazeClicks = Number(m.waze_clicks || 0);
    const intent = offerClicks + mapClicks + wazeClicks;

    const conversions = Number(m.conversions || 0);
    const revenue = Number(m.revenue || 0);

    const allocatedCost = await allocatedSpotCostForCampaign(
      c.campaign_id,
      startDate,
      endDate
    );

    const cac = conversions > 0 ? allocatedCost / conversions : 0;
    const roi =
      allocatedCost > 0
        ? ((revenue - allocatedCost) / allocatedCost) * 100
        : 0;

    reportRows.push({
      campaignId: c.campaign_id,
      campaignName: c.campaign_name || "",
      advertiser: c.advertiser || "",
      qrNames: c.qr_names || "",
      locationNames: c.location_names || "",
      status: c.is_archived ? "Archived" : "Active",
      scans,
      offerClicks,
      mapClicks,
      wazeClicks,
      intent,
      conversions,
      revenue,
      allocatedCost,
      cac,
      roi
    });
  }

  return reportRows;
}
app.get("/admin/reports", requireLogin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;
    const locationId = req.query.location_id || "";
    const qrId = req.query.qr_id || "";
    const campaignId = req.query.campaign_id || "";
    const status = (req.query.status || "all").toLowerCase();

    const currentUser = req.session.user;
    const isSuperAdmin = currentUser.role === "super_admin";
    const userId = isSuperAdmin ? null : currentUser.id;

    const locations = await q(`
      SELECT DISTINCT s.id, s.name
      FROM spaces s
      WHERE ($1::int IS NULL OR s.user_id = $1)
      ORDER BY s.name
    `, [userId]);

    const qrs = await q(`
      SELECT DISTINCT qr.id, qr.name
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE ($1::int IS NULL OR s.user_id = $1)
      ORDER BY qr.name
    `, [userId]);

    const campaigns = await q(`
      SELECT DISTINCT c.id, c.name
      FROM campaigns c
      LEFT JOIN qr_campaigns qc ON qc.campaign_id = c.id
      LEFT JOIN qr_codes qr ON qr.id = qc.qr_id
      LEFT JOIN spaces s ON s.id = qr.space_id
      WHERE ($1::int IS NULL OR c.user_id = $1 OR s.user_id = $1)
      ORDER BY c.name
    `, [userId]);

    const reportRows = await buildExportReportRows(
      req,
      startDate,
      endDate,
      locationId,
      qrId,
      campaignId,
      status
    );

    const summary = reportRows.reduce((t, r) => {
      t.scans += r.scans;
      t.offerClicks += r.offerClicks;
      t.mapClicks += r.mapClicks;
      t.wazeClicks += r.wazeClicks;
      t.intent += r.intent;
      t.conversions += r.conversions;
      t.revenue += r.revenue;
      t.allocatedCost += r.allocatedCost;
      return t;
    }, {
      scans: 0,
      offerClicks: 0,
      mapClicks: 0,
      wazeClicks: 0,
      intent: 0,
      conversions: 0,
      revenue: 0,
      allocatedCost: 0
    });

    summary.cac = summary.conversions > 0 ? summary.allocatedCost / summary.conversions : 0;
    summary.roi = summary.allocatedCost > 0 ? ((summary.revenue - summary.allocatedCost) / summary.allocatedCost) * 100 : 0;

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
          <select name="location_id">
            <option value="">All Locations</option>
            ${locations.rows.map(l => `
              <option value="${l.id}" ${String(l.id) === String(locationId) ? "selected" : ""}>
                ${l.name}
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label>QR Code</label><br>
          <select name="qr_id">
            <option value="">All QR Codes</option>
            ${qrs.rows.map(qr => `
              <option value="${qr.id}" ${String(qr.id) === String(qrId) ? "selected" : ""}>
                ${qr.name}
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label>Campaign</label><br>
          <select name="campaign_id">
            <option value="">All Campaigns</option>
            ${campaigns.rows.map(c => `
              <option value="${c.id}" ${String(c.id) === String(campaignId) ? "selected" : ""}>
                ${c.name}
              </option>
            `).join("")}
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
        <button type="submit" formaction="/export/events.csv" formmethod="get">Export Raw Events CSV</button>
        <button type="submit" formaction="/export/report.csv" formmethod="get">Export Executive CSV</button>
        <button type="submit" formaction="/export/report.pdf" formmethod="get">Export Executive PDF</button>
      </form>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0;">
        <div class="card"><h3>Scans</h3><p>${summary.scans}</p></div>
        <div class="card"><h3>Total Intent</h3><p>${summary.intent}</p></div>
        <div class="card"><h3>Conversions</h3><p>${summary.conversions}</p></div>
        <div class="card"><h3>Revenue</h3><p>${money(summary.revenue)}</p></div>
        <div class="card"><h3>Allocated Cost</h3><p>${money(summary.allocatedCost)}</p></div>
        <div class="card"><h3>CAC</h3><p>${money(summary.cac)}</p></div>
        <div class="card"><h3>ROI</h3><p>${pct(summary.roi)}</p></div>
      </div>

      <h2>Detailed Results</h2>

      <table>
        <tr>
          <th>Advertiser</th>
          <th>Campaign</th>
          <th>QR Codes</th>
          <th>Locations</th>
          <th>Status</th>
          <th>Scans</th>
          <th>Offers</th>
          <th>Maps</th>
          <th>Waze</th>
          <th>Intent</th>
          <th>Conversions</th>
          <th>Revenue</th>
          <th>Allocated Cost</th>
          <th>CAC</th>
          <th>ROI</th>
        </tr>

        ${reportRows.map(r => `
          <tr>
            <td>${r.advertiser}</td>
            <td>${r.campaignName}</td>
            <td>${r.qrNames}</td>
            <td>${r.locationNames}</td>
            <td>${r.status}</td>
            <td>${r.scans}</td>
            <td>${r.offerClicks}</td>
            <td>${r.mapClicks}</td>
            <td>${r.wazeClicks}</td>
            <td>${r.intent}</td>
            <td>${r.conversions}</td>
            <td>${money(r.revenue)}</td>
            <td>${money(r.allocatedCost)}</td>
            <td>${money(r.cac)}</td>
            <td class="${r.roi >= 0 ? "good" : "bad"}">${pct(r.roi)}</td>
          </tr>
        `).join("")}
      </table>
    `));
  } catch (e) {
    console.error("REPORTS FULL ERROR:", e);
    res.status(500).send("REPORTS ERROR: " + e.message);
  }
});


app.listen(port, () => {
  console.log("Server running on port " + port);
});
