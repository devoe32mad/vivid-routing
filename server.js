const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "https://vivid-routing-production.up.railway.app";
/*
=========================================================
ORGANIZATION IMPORT MODULE
=========================================================
*/

const importUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
});
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
/* =========================================================
   ORGANIZATION PORTAL NAVIGATION
========================================================= */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function organizationNav({
  organizationId,
  organizationName,
  activePage = "",
  userName = ""
}) {
  const navItem = (
    label,
    href,
    key
  ) => `
    <a
      href="${href}"
      style="
        display:inline-block;
        padding:11px 15px;
        border-radius:10px;
        text-decoration:none;
        font-weight:bold;
        color:white;
        background:${
          activePage === key
            ? "#123d25"
            : "#2f7d46"
        };
        white-space:nowrap;
      "
    >
      ${label}
    </a>
  `;

  return `
    <div style="
      background:white;
      border-bottom:1px solid #dfe7df;
      box-shadow:0 4px 14px rgba(0,0,0,.06);
      padding:16px 40px;
      position:sticky;
      top:0;
      z-index:100;
    ">
      <div style="
        max-width:1250px;
        margin:0 auto;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:20px;
          flex-wrap:wrap;
        ">

          <div>
            <div style="
              font-size:20px;
              font-weight:bold;
              color:#073b22;
            ">
              ${organizationName}
            </div>

            <div style="
              font-size:12px;
              color:#65776b;
              margin-top:3px;
            ">
              Organization Portal
            </div>
          </div>

          ${
            userName
              ? `
                  <div style="
                    color:#315b4c;
                    font-size:14px;
                    font-weight:bold;
                  ">
                    ${userName}
                  </div>
                `
              : ""
          }

        </div>

        <div style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:14px;
        ">

          ${navItem(
            "Executive Dashboard",
            `/org-organization/${organizationId}`,
            "dashboard"
          )}

          ${navItem(
            "Locations",
            `/org-locations?organization_id=${organizationId}`,
            "locations"
          )}

          ${navItem(
            "Advertisers",
            `/org-advertisers?organization_id=${organizationId}`,
            "advertisers"
          )}

          ${navItem(
            "Advertising Inventory",
            `/org-marketplace?organization_id=${organizationId}`,
            "marketplace"
          )}

          ${navItem(
            "Advertising Requests",
            `/org-advertising-requests?organization_id=${organizationId}`,
            "requests"
          )}

        </div>

      </div>
    </div>
  `;
}
function statusBadge(status) {
  const s = String(status || "").toLowerCase();

  let background = "#E8F5E9";
  let color = "#166534";

  switch (s) {
    case "available":
      background = "#DCFCE7";
      color = "#166534";
      break;

    case "pending":
      background = "#FEF3C7";
      color = "#92400E";
      break;

    case "approved":
      background = "#DBEAFE";
      color = "#1E40AF";
      break;

    case "rejected":
      background = "#FEE2E2";
      color = "#991B1B";
      break;

    case "closed":
      background = "#E5E7EB";
      color = "#374151";
      break;
  }

  return `
    <span
      style="
        display:inline-block;
        padding:7px 14px;
        border-radius:999px;
        font-weight:bold;
        font-size:14px;
        background:${background};
        color:${color};
      "
    >
      ${status}
    </span>
  `;
}
function marketplacePage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <style>
    body{
      margin:0;
      font-family:Arial,sans-serif;
      background:#f4f7f1;
      color:#073b22;
    }

    .marketplace-topbar{
      background:linear-gradient(135deg,#123d25,#2f7d46);
      color:white;
      padding:30px 40px;
    }

    .marketplace-brand{
      font-size:13px;
      letter-spacing:2px;
      text-transform:uppercase;
      color:#d7eadb;
      font-weight:bold;
    }

    .marketplace-topbar h1{
      margin:4px 0 6px;
      font-size:34px;
    }

    .marketplace-subtitle{
      color:#d7eadb;
      margin:0;
      line-height:1.5;
    }

    .marketplace-wrap{
      padding:30px 40px;
      max-width:1250px;
      margin:0 auto;
    }

    .marketplace-btn{
      display:inline-block;
      background:#2f7d46;
      color:white;
      padding:12px 16px;
      border-radius:12px;
      text-decoration:none;
      font-weight:bold;
      margin:5px 8px 5px 0;
      border:0;
      cursor:pointer;
    }

    .marketplace-btn.secondary{
      background:#123d25;
    }

    .marketplace-card{
      background:white;
      border-radius:18px;
      padding:20px;
      box-shadow:0 8px 22px rgba(0,0,0,.08);
      box-sizing:border-box;
    }

    .marketplace-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(270px,1fr));
      gap:18px;
      margin:20px 0 32px;
    }

    .marketplace-label{
      color:#65776b;
      font-size:12px;
      margin-bottom:4px;
    }

    .marketplace-value{
      font-size:21px;
      font-weight:bold;
      margin-bottom:14px;
    }

    .marketplace-status{
      display:inline-block;
      padding:7px 11px;
      border-radius:999px;
      background:#eaf3e8;
      color:#176b3a;
      font-size:12px;
      font-weight:bold;
    }

    .marketplace-preview{
      display:inline-block;
      padding:7px 11px;
      border-radius:999px;
      background:#fff4d6;
      color:#7a4b00;
      font-size:12px;
      font-weight:bold;
      margin-bottom:12px;
    }

    .workflow-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
      gap:12px;
      margin-top:20px;
    }

    .workflow-step{
      background:#f7faf6;
      border:1px solid #e1ebe0;
      border-radius:14px;
      padding:16px;
      text-align:center;
      font-size:14px;
      font-weight:bold;
      min-height:54px;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    @media(max-width:800px){
      .marketplace-topbar,
      .marketplace-wrap{
        padding:22px;
      }

      .marketplace-topbar h1{
        font-size:28px;
      }

      .marketplace-grid,
      .workflow-grid{
        grid-template-columns:1fr;
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
function marketplacePage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <style>
    body {
      margin:0;
      font-family:Arial,sans-serif;
      background:#f4f7f1;
      color:#073b22;
    }

    .marketplace-topbar {
      background:linear-gradient(135deg,#123d25,#2f7d46);
      color:white;
      padding:30px 40px;
    }

    .marketplace-brand {
      font-size:13px;
      letter-spacing:2px;
      text-transform:uppercase;
      color:#d7eadb;
      font-weight:bold;
    }

    .marketplace-topbar h1 {
      margin:4px 0 6px;
      font-size:34px;
    }

    .marketplace-subtitle {
      color:#d7eadb;
      margin:0;
      line-height:1.5;
    }

    .marketplace-wrap {
      padding:30px 40px;
      max-width:1250px;
      margin:0 auto;
    }

    .marketplace-btn {
      display:inline-block;
      background:#2f7d46;
      color:white;
      padding:12px 16px;
      border-radius:12px;
      text-decoration:none;
      font-weight:bold;
      margin:5px 8px 5px 0;
      border:0;
      cursor:pointer;
    }

    .marketplace-btn.secondary {
      background:#123d25;
    }

    .marketplace-card {
      background:white;
      border-radius:18px;
      padding:20px;
      box-shadow:0 8px 22px rgba(0,0,0,.08);
      box-sizing:border-box;
    }

    .marketplace-grid {
      display:grid;
      grid-template-columns:repeat(
        auto-fit,
        minmax(270px,1fr)
      );
      gap:18px;
      margin:20px 0 32px;
    }

    .marketplace-label {
      color:#65776b;
      font-size:12px;
      margin-bottom:4px;
    }

    .marketplace-value {
      font-size:21px;
      font-weight:bold;
      margin-bottom:14px;
    }

    .marketplace-status {
      display:inline-block;
      padding:7px 11px;
      border-radius:999px;
      background:#eaf3e8;
      color:#176b3a;
      font-size:12px;
      font-weight:bold;
    }

    .marketplace-preview {
      display:inline-block;
      padding:7px 11px;
      border-radius:999px;
      background:#fff4d6;
      color:#7a4b00;
      font-size:12px;
      font-weight:bold;
      margin-bottom:12px;
    }

    .workflow-grid {
      display:grid;
      grid-template-columns:repeat(
        auto-fit,
        minmax(145px,1fr)
      );
      gap:12px;
      margin-top:20px;
    }

    .workflow-step {
      background:#f7faf6;
      border:1px solid #e1ebe0;
      border-radius:14px;
      padding:16px;
      text-align:center;
      font-size:14px;
      font-weight:bold;
      min-height:54px;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    @media(max-width:800px) {
      .marketplace-topbar,
      .marketplace-wrap {
        padding:22px;
      }

      .marketplace-topbar h1 {
        font-size:28px;
      }

      .marketplace-grid,
      .workflow-grid {
        grid-template-columns:1fr;
      }
    }
  </style>
</head>

<body>
  ${body}
</body>
</html>`;
}
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
/*
=========================================================
ORGANIZATION ROLES AND PERMISSIONS
=========================================================
*/

const ORGANIZATION_ROLE_PERMISSIONS = {
  owner: {
    view_dashboard: true,
    view_all_locations: true,
    manage_users: true,
    manage_permissions: true,
    manage_locations: true,
    manage_advertisers: true,
    manage_opportunities: true,
    manage_requests: true,
    approve_requests: true,
    view_analytics: true,
    export_reports: true,
    manage_settings: true
  },

  organization_admin: {
    view_dashboard: true,
    view_all_locations: true,
    manage_users: true,
    manage_permissions: true,
    manage_locations: true,
    manage_advertisers: true,
    manage_opportunities: true,
    manage_requests: true,
    approve_requests: true,
    view_analytics: true,
    export_reports: true,
    manage_settings: true
  },

  district_admin: {
    view_dashboard: true,
    view_all_locations: true,
    manage_users: true,
    manage_permissions: true,
    manage_locations: true,
    manage_advertisers: true,
    manage_opportunities: true,
    manage_requests: true,
    approve_requests: true,
    view_analytics: true,
    export_reports: true,
    manage_settings: true
  },

  location_manager: {
    view_dashboard: true,
    view_all_locations: false,
    manage_users: false,
    manage_permissions: false,
    manage_locations: false,
    manage_advertisers: true,
    manage_opportunities: true,
    manage_requests: true,
    approve_requests: true,
    view_analytics: true,
    export_reports: true,
    manage_settings: false
  },

  standard_user: {
    view_dashboard: true,
    view_all_locations: false,
    manage_users: false,
    manage_permissions: false,
    manage_locations: false,
    manage_advertisers: false,
    manage_opportunities: false,
    manage_requests: false,
    approve_requests: false,
    view_analytics: true,
    export_reports: true,
    manage_settings: false
  },

  read_only: {
    view_dashboard: true,
    view_all_locations: false,
    manage_users: false,
    manage_permissions: false,
    manage_locations: false,
    manage_advertisers: false,
    manage_opportunities: false,
    manage_requests: false,
    approve_requests: false,
    view_analytics: true,
    export_reports: false,
    manage_settings: false
  }
};

function getOrganizationRolePermissions(role) {
  const normalizedRole = String(
    role || "read_only"
  ).trim().toLowerCase();

  return (
    ORGANIZATION_ROLE_PERMISSIONS[normalizedRole] ||
    ORGANIZATION_ROLE_PERMISSIONS.read_only
  );
}

function organizationRoleHasPermission(
  role,
  permissionKey
) {
  const permissions =
    getOrganizationRolePermissions(role);

  return permissions[permissionKey] === true;
}
function requireOrganizationPermission(permissionKey) {
  return (req, res, next) => {

    if (!req.session.orgUser) {
      return res.redirect("/org-login");
    }

    const role =
      req.session.orgUser.organization_role;

    if (
      !organizationRoleHasPermission(
        role,
        permissionKey
      )
    ) {
      return res
        .status(403)
        .send("Access denied");
    }

    next();
  };
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
  /*
=========================================================
ORGANIZATION USER PERMISSIONS
=========================================================
*/

await q(`
CREATE TABLE IF NOT EXISTS organization_user_permissions (

    id SERIAL PRIMARY KEY,

    organization_user_id INTEGER NOT NULL
        REFERENCES organization_users(id)
        ON DELETE CASCADE,

    permission_key TEXT NOT NULL,

    is_allowed BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        organization_user_id,
        permission_key
    )

)
`);
  /*
=========================================================
ORGANIZATION USER NOTIFICATIONS
=========================================================
*/

await q(`
CREATE TABLE IF NOT EXISTS organization_user_notifications (

    id SERIAL PRIMARY KEY,

    organization_user_id INTEGER NOT NULL
        REFERENCES organization_users(id)
        ON DELETE CASCADE,

    notification_key TEXT NOT NULL,

    is_enabled BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        organization_user_id,
        notification_key
    )

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
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name TEXT
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

if (Number(campaignStores.rows[0].count) === 0) {
  await q(`
    INSERT INTO campaign_stores
    (
      campaign_id,
      store_id,
      weight,
      is_active
    )
    VALUES
      (1,1,70,true),
      (2,2,90,true)
  `);
}

/*
=========================================================
MARKETPLACE OPPORTUNITIES
=========================================================
*/

await q(`
CREATE TABLE IF NOT EXISTS organization_opportunities (

    id SERIAL PRIMARY KEY,

    organization_id INTEGER NOT NULL
      REFERENCES organizations(id),

    space_id INTEGER NOT NULL
      REFERENCES spaces(id),

    qr_id INTEGER
      REFERENCES qr_codes(id),

    title TEXT NOT NULL,

    description TEXT,

    category TEXT,

    annual_price NUMERIC(12,2)
      NOT NULL DEFAULT 0,

    status TEXT
      NOT NULL DEFAULT 'Available',

    display_order INTEGER
      NOT NULL DEFAULT 1,

    is_active BOOLEAN
      NOT NULL DEFAULT true,

    created_by INTEGER,

    created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP
)
`);
/*
=========================================================
FLEXIBLE SPONSORSHIP PRICING
Vivid Core remains authoritative for actual dates,
contract days, allocation and reporting.
=========================================================
*/

await q(`
  ALTER TABLE organization_opportunities
  ADD COLUMN IF NOT EXISTS price
    NUMERIC(12,2)
`);

await q(`
  ALTER TABLE organization_opportunities
  ADD COLUMN IF NOT EXISTS pricing_unit
    TEXT DEFAULT 'Per Year'
`);

await q(`
  ALTER TABLE organization_opportunities
  ADD COLUMN IF NOT EXISTS suggested_term_length
    INTEGER DEFAULT 12
`);

await q(`
  ALTER TABLE organization_opportunities
  ADD COLUMN IF NOT EXISTS suggested_term_unit
    TEXT DEFAULT 'Months'
`);
  await q(`
  UPDATE organization_opportunities
  SET
    price = COALESCE(
      price,
      annual_price,
      0
    ),

    pricing_unit = COALESCE(
      NULLIF(TRIM(pricing_unit), ''),
      'Per Year'
    ),

    suggested_term_length = COALESCE(
      suggested_term_length,
      12
    ),

    suggested_term_unit = COALESCE(
      NULLIF(TRIM(suggested_term_unit), ''),
      'Months'
    )
`);
await q(`
CREATE INDEX IF NOT EXISTS
idx_org_opportunities_org
ON organization_opportunities
(
    organization_id
)
`);

await q(`
CREATE INDEX IF NOT EXISTS
idx_org_opportunities_space
ON organization_opportunities
(
    space_id
)
`);

await q(`
CREATE INDEX IF NOT EXISTS
idx_org_opportunities_status
ON organization_opportunities
(
    status
)
`);
/*
=========================================================
ORGANIZATION ADVERTISING REQUESTS
Migration-safe request and advertiser setup foundation
=========================================================
*/

/*
Create the full table for a brand-new database.

If the table already exists, PostgreSQL leaves it intact.
The ALTER statements below then add every newer field
that may be missing from an existing production database.
*/

await q(`
  CREATE TABLE IF NOT EXISTS organization_advertising_requests (

    id SERIAL PRIMARY KEY,

    organization_id INTEGER NOT NULL
      REFERENCES organizations(id),

    location_id INTEGER NOT NULL
      REFERENCES spaces(id),

    opportunity_id INTEGER
      REFERENCES organization_opportunities(id),

    business_name TEXT NOT NULL,

    contact_name TEXT NOT NULL,

    email TEXT NOT NULL,

    phone TEXT NOT NULL,

    website TEXT,

    business_category TEXT,

    campaign_name TEXT,

    destination_url TEXT NOT NULL,

    campaign_notes TEXT,

    opportunity_name TEXT NOT NULL,

    opportunity_group TEXT,

    placement TEXT,

    opportunity_category TEXT,

    opportunity_description TEXT,

    price NUMERIC(12,2) NOT NULL DEFAULT 0,

    pricing_unit TEXT,

    suggested_term_length INTEGER,

    suggested_term_unit TEXT,

    status TEXT NOT NULL DEFAULT 'Pending',

    submitted_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
      NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

/*
=========================================================
UPGRADE EXISTING ADVERTISING REQUEST TABLE
=========================================================

These statements are safe to run on every deployment.
They preserve all existing requests and only add fields
that do not already exist.
*/

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS assigned_organization_user_id INTEGER
    REFERENCES organization_users(id)
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS internal_notes TEXT
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS approved_by_organization_user_id INTEGER
    REFERENCES organization_users(id)
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS setup_status TEXT
    NOT NULL DEFAULT 'Not Started'
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS setup_token TEXT
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS setup_started_at TIMESTAMP
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_advertiser_id INTEGER
    REFERENCES advertisers(id)
`);
await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_vivid_user_id INTEGER
    REFERENCES users(id)
`);
await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_contract_id INTEGER
    REFERENCES contracts(id)
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_campaign_id INTEGER
    REFERENCES campaigns(id)
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_qr_id INTEGER
    REFERENCES qr_codes(id)
`);

await q(`
  ALTER TABLE organization_advertising_requests
  ADD COLUMN IF NOT EXISTS created_schedule_id INTEGER
    REFERENCES campaign_schedules(id)
`);

/*
Normalize any legacy rows before indexes are created.
*/

await q(`
  UPDATE organization_advertising_requests

  SET setup_status = 'Not Started'

  WHERE setup_status IS NULL
     OR TRIM(setup_status) = ''
`);

/*
=========================================================
ADVERTISING REQUEST INDEXES
=========================================================
*/

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_organization

  ON organization_advertising_requests (
    organization_id
  )
`);

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_location

  ON organization_advertising_requests (
    location_id
  )
`);

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_opportunity

  ON organization_advertising_requests (
    opportunity_id
  )
`);

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_status

  ON organization_advertising_requests (
    status
  )
`);

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_setup_status

  ON organization_advertising_requests (
    setup_status
  )
`);

await q(`
  CREATE INDEX IF NOT EXISTS
  idx_advertising_requests_email

  ON organization_advertising_requests (
    LOWER(email)
  )
`);

await q(`
  CREATE UNIQUE INDEX IF NOT EXISTS
  idx_advertising_requests_setup_token_unique

  ON organization_advertising_requests (
    setup_token
  )

  WHERE setup_token IS NOT NULL
`);

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
// ============================================================
// ONE-TIME MARKETPLACE INVENTORY STATUS REPAIR
// Remove this route after it has been run successfully.
// ============================================================
app.get(
  "/debug-repair-opportunity-statuses",
  requireLogin,
  async (req, res) => {
    try {
      if (
        !req.session.user ||
        req.session.user.role !== "super_admin"
      ) {
        return res.status(403).json({
          error: "Super Admin access required"
        });
      }

      const organizationId =
        Number(req.query.organization_id);

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(400).json({
          error:
            "A valid organization_id is required"
        });
      }

      // Reset active opportunities based on their request history.
      //
      // Priority:
      // Approved request = Approved
      // Pending request  = Pending
      // Closed request   = Closed
      // Otherwise        = Available
      //
      // Rejected requests do not remove inventory.
      const repairResult = await q(
        `
        UPDATE organization_opportunities oo
        SET
          status = CASE
            WHEN EXISTS (
              SELECT 1
              FROM organization_advertising_requests ar
              WHERE ar.organization_id = oo.organization_id
                AND ar.opportunity_id = oo.id
                AND LOWER(
                  COALESCE(ar.status, '')
                ) = 'approved'
            )
              THEN 'Approved'

            WHEN EXISTS (
              SELECT 1
              FROM organization_advertising_requests ar
              WHERE ar.organization_id = oo.organization_id
                AND ar.opportunity_id = oo.id
                AND LOWER(
                  COALESCE(ar.status, '')
                ) = 'pending'
            )
              THEN 'Pending'

            WHEN EXISTS (
              SELECT 1
              FROM organization_advertising_requests ar
              WHERE ar.organization_id = oo.organization_id
                AND ar.opportunity_id = oo.id
                AND LOWER(
                  COALESCE(ar.status, '')
                ) = 'closed'
            )
              THEN 'Closed'

            ELSE 'Available'
          END,

          updated_at = CURRENT_TIMESTAMP

        WHERE oo.organization_id = $1
          AND COALESCE(oo.is_active, true) = true

        RETURNING
          oo.id,
          oo.title,
          oo.status,
          COALESCE(
            oo.annual_price,
            oo.price,
            0
          ) AS inventory_value
        `,
        [organizationId]
      );

      const summaryResult = await q(
        `
        SELECT
          COUNT(*)::int AS total_opportunities,

          COUNT(*) FILTER (
            WHERE LOWER(
              COALESCE(status, 'available')
            ) = 'available'
          )::int AS available_opportunities,

          COUNT(*) FILTER (
            WHERE LOWER(status) = 'pending'
          )::int AS pending_opportunities,

          COUNT(*) FILTER (
            WHERE LOWER(status) = 'approved'
          )::int AS approved_opportunities,

          COUNT(*) FILTER (
            WHERE LOWER(status) = 'closed'
          )::int AS closed_opportunities,

          COALESCE(
            SUM(
              COALESCE(annual_price, price, 0)
            ),
            0
          ) AS total_inventory_value,

          COALESCE(
            SUM(
              COALESCE(annual_price, price, 0)
            ) FILTER (
              WHERE LOWER(
                COALESCE(status, 'available')
              ) = 'available'
            ),
            0
          ) AS available_inventory_value,

          COALESCE(
            SUM(
              COALESCE(annual_price, price, 0)
            ) FILTER (
              WHERE LOWER(status) = 'pending'
            ),
            0
          ) AS pending_inventory_value,

          COALESCE(
            SUM(
              COALESCE(annual_price, price, 0)
            ) FILTER (
              WHERE LOWER(status) = 'approved'
            ),
            0
          ) AS approved_inventory_value,

          COALESCE(
            SUM(
              COALESCE(annual_price, price, 0)
            ) FILTER (
              WHERE LOWER(status) = 'closed'
            ),
            0
          ) AS closed_inventory_value

        FROM organization_opportunities
        WHERE organization_id = $1
          AND COALESCE(is_active, true) = true
        `,
        [organizationId]
      );

      return res.json({
        success: true,
        organization_id: organizationId,
        repaired_count: repairResult.rows.length,
        summary: summaryResult.rows[0],
        opportunities: repairResult.rows
      });
    } catch (err) {
      console.error(
        "OPPORTUNITY STATUS REPAIR ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        error:
          "OPPORTUNITY STATUS REPAIR ERROR",
        message: err.message
      });
    }
  }
);
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
app.get(
  "/debug-org-opportunities/:orgId",
  requireLogin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const organizationId = Number(req.params.orgId);

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(400).send(
          "Valid organization ID is required."
        );
      }

      const result = await q(`
        SELECT
          oo.id,
          oo.organization_id,
          o.name AS organization_name,

          oo.space_id,
          s.name AS location_name,

          oo.qr_id,
          qr.name AS qr_name,

          oo.title,
          oo.description,
          oo.category,

oo.annual_price,

oo.price,
oo.pricing_unit,
oo.suggested_term_length,
oo.suggested_term_unit,

oo.status,
          oo.display_order,
          oo.is_active,
          oo.created_at,
          oo.updated_at

        FROM organization_opportunities oo

        JOIN organizations o
          ON o.id = oo.organization_id

        JOIN spaces s
          ON s.id = oo.space_id

        LEFT JOIN qr_codes qr
          ON qr.id = oo.qr_id

        WHERE oo.organization_id = $1

        ORDER BY
          s.name,
          oo.display_order,
          oo.title
      `, [organizationId]);

      return res.json({
        organization_id: organizationId,
        opportunity_count: result.rows.length,
        opportunities: result.rows
      });

    } catch (err) {
      console.error(
        "DEBUG ORG OPPORTUNITIES ERROR:",
        err
      );

      return res.status(500).send(
        "DEBUG ORG OPPORTUNITIES ERROR: " +
        err.message
      );
    }
  }
);
app.get(
  "/debug-seed-ccps-opportunities",
  requireLogin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const organizationId = 13;
      const spaceId = 36;

      const locationResult = await q(`
        SELECT
          id,
          name,
          organization_id,
          is_archived
        FROM spaces
        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(is_archived, false) = false
        LIMIT 1
      `, [
        spaceId,
        organizationId
      ]);

      const location = locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active Barron Collier location was not found for CCPS."
        );
      }

      const result = await q(`
        INSERT INTO organization_opportunities (
          organization_id,
          space_id,
          title,
          description,
          category,
          annual_price,
          status,
          display_order,
          is_active
        )

        SELECT
          $1,
          $2,
          opportunity.title,
          opportunity.description,
          opportunity.category,
          opportunity.annual_price,
          'Available',
          opportunity.display_order,
          true

        FROM (
          VALUES
            (
              'Football Stadium Sponsorship',
              'Home football stadium sponsorship.',
              'Athletics',
              1500::numeric,
              1
            ),
            (
              'Gym Sponsorship',
              'Main gymnasium sponsorship.',
              'Athletics',
              1200::numeric,
              2
            ),
            (
              'Car Line Sponsorship',
              'Morning and afternoon student pickup.',
              'Campus',
              950::numeric,
              3
            )
        ) AS opportunity (
          title,
          description,
          category,
          annual_price,
          display_order
        )

        WHERE NOT EXISTS (
          SELECT 1
          FROM organization_opportunities existing
          WHERE existing.organization_id = $1
            AND existing.space_id = $2
            AND LOWER(TRIM(existing.title)) =
                LOWER(TRIM(opportunity.title))
        )

        RETURNING
          id,
          organization_id,
          space_id,
          title,
          annual_price,
          status,
          display_order
      `, [
        organizationId,
        spaceId
      ]);

      return res.json({
        message: "CCPS opportunities seeded.",
        location,
        inserted_count: result.rows.length,
        inserted: result.rows
      });

    } catch (err) {
      console.error(
        "SEED CCPS OPPORTUNITIES ERROR:",
        err
      );

      return res.status(500).send(
        "SEED CCPS OPPORTUNITIES ERROR: " +
        err.message
      );
    }
  }
);
/*
=========================================================
TEMPORARY ADVERTISING REQUEST TEST
Remove after the Organization Requests page is built.
=========================================================
*/

app.get(
  "/debug-advertising-requests",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const result = await q(`
        SELECT
          ar.id,
          ar.organization_id,
          o.name AS organization_name,

          ar.location_id,
          s.name AS location_name,

          ar.opportunity_id,
          ar.opportunity_name,
          ar.opportunity_group,
          ar.placement,

          ar.business_name,
          ar.contact_name,
          ar.email,
          ar.phone,
          ar.website,
          ar.business_category,

          ar.campaign_name,
          ar.destination_url,
          ar.campaign_notes,

          ar.price,
          ar.pricing_unit,
          ar.suggested_term_length,
          ar.suggested_term_unit,

          ar.status,
          ar.setup_status,
          ar.submitted_at

        FROM organization_advertising_requests ar

        JOIN organizations o
          ON o.id = ar.organization_id

        JOIN spaces s
          ON s.id = ar.location_id

        ORDER BY
          ar.submitted_at DESC,
          ar.id DESC

        LIMIT 25
      `);

      return res.json(result.rows);

    } catch (err) {
      console.error(
        "DEBUG ADVERTISING REQUESTS ERROR:",
        err
      );

      return res.status(500).send(
        "DEBUG ADVERTISING REQUESTS ERROR: " +
        err.message
      );
    }
  }
);
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
/*
=========================================================
DEBUG — ADVERTISING REQUEST ACCESS AND INVENTORY CONTEXT

Supports:
- Organization Portal users
- Super Admin users

Remove after testing.
=========================================================
*/

app.get(
  "/debug-org-advertising-requests",
  async (req, res) => {
    try {
      const orgSession =
        req.session.orgUser || null;

      const adminSession =
        req.session.user || null;

      let organizationId = null;
      let accessSource = null;

      /*
        Organization user context.
      */
      if (orgSession?.organization_id) {
        organizationId = Number(
          orgSession.organization_id
        );

        accessSource =
          "organization_session";
      }

      /*
        Super Admin context.
      */
      if (
        !organizationId &&
        adminSession?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );

        accessSource =
          "super_admin_query_parameter";
      }

      const validOrganizationId =
        Number.isInteger(organizationId) &&
        organizationId > 0;

      let organization = null;
      let locations = [];
      let opportunities = [];
      let requests = [];
      let opportunitySummary = null;
      let requestSummary = null;

      if (validOrganizationId) {
        const organizationResult = await q(`
          SELECT
            id,
            name,
            customer_id,
            is_active

          FROM organizations

          WHERE id = $1

          LIMIT 1
        `, [organizationId]);

        organization =
          organizationResult.rows[0] || null;

        const locationsResult = await q(`
          SELECT
            id,
            name,
            organization_id,
            is_archived

          FROM spaces

          WHERE organization_id = $1

          ORDER BY name
        `, [organizationId]);

        locations =
          locationsResult.rows;

        const opportunitiesResult = await q(`
          SELECT
            oo.id,
            oo.organization_id,
            oo.space_id,
            s.name AS location_name,
            oo.title,
            oo.status,
            oo.is_active,
            oo.price,
            oo.annual_price,
            oo.available_from,
            oo.available_until

          FROM organization_opportunities oo

          LEFT JOIN spaces s
            ON s.id = oo.space_id

          WHERE oo.organization_id = $1

          ORDER BY
            s.name,
            oo.title
        `, [organizationId]);

        opportunities =
          opportunitiesResult.rows;

        const requestsResult = await q(`
          SELECT
            r.id,
            r.organization_id,
            r.location_id,
            r.opportunity_id,
            r.business_name,
            r.status,
            r.price,
            r.submitted_at

          FROM organization_advertising_requests r

          WHERE r.organization_id = $1

          ORDER BY
            r.submitted_at DESC,
            r.id DESC

          LIMIT 25
        `, [organizationId]);

        requests =
          requestsResult.rows;

        const opportunitySummaryResult =
          await q(`
            SELECT
              COUNT(*) FILTER (
                WHERE COALESCE(
                  is_active,
                  true
                ) = true
              )::integer
                AS total_opportunities,

              COUNT(*) FILTER (
                WHERE COALESCE(
                  is_active,
                  true
                ) = true

                AND LOWER(
                  COALESCE(status, '')
                ) = 'available'
              )::integer
                AS available_opportunities,

              COALESCE(
                SUM(
                  COALESCE(
                    price,
                    annual_price,
                    0
                  )
                ) FILTER (
                  WHERE COALESCE(
                    is_active,
                    true
                  ) = true
                ),
                0
              ) AS total_inventory_value,

              COALESCE(
                SUM(
                  COALESCE(
                    price,
                    annual_price,
                    0
                  )
                ) FILTER (
                  WHERE COALESCE(
                    is_active,
                    true
                  ) = true

                  AND LOWER(
                    COALESCE(status, '')
                  ) = 'available'
                ),
                0
              ) AS available_inventory_value

            FROM organization_opportunities

            WHERE organization_id = $1
          `, [organizationId]);

        opportunitySummary =
          opportunitySummaryResult.rows[0] ||
          null;

        const requestSummaryResult =
          await q(`
            SELECT
              COUNT(*)::integer
                AS total_requests,

              COUNT(*) FILTER (
                WHERE LOWER(
                  COALESCE(status, '')
                ) = 'pending'
              )::integer
                AS pending_requests,

              COUNT(*) FILTER (
                WHERE LOWER(
                  COALESCE(status, '')
                ) = 'approved'
              )::integer
                AS approved_requests,

              COUNT(*) FILTER (
                WHERE LOWER(
                  COALESCE(status, '')
                ) = 'rejected'
              )::integer
                AS rejected_requests,

              COUNT(*) FILTER (
                WHERE LOWER(
                  COALESCE(status, '')
                ) = 'closed'
              )::integer
                AS closed_requests

            FROM organization_advertising_requests

            WHERE organization_id = $1
          `, [organizationId]);

        requestSummary =
          requestSummaryResult.rows[0] ||
          null;
      }

      return res.json({
        debug_route:
          "/debug-org-advertising-requests",

        access: {
          access_source: accessSource,
          resolved_organization_id:
            organizationId,
          valid_organization_id:
            validOrganizationId,

          query_organization_id:
            req.query.organization_id ||
            null
        },

        sessions: {
          organization_user: orgSession
            ? {
                id:
                  orgSession.id || null,
                user_id:
                  orgSession.user_id || null,
                organization_id:
                  orgSession.organization_id ||
                  null,
                role:
                  orgSession.role || null,
                email:
                  orgSession.email || null
              }
            : null,

          platform_user: adminSession
            ? {
                id:
                  adminSession.id || null,
                role:
                  adminSession.role || null,
                email:
                  adminSession.email || null
              }
            : null
        },

        organization,

        counts: {
          locations: locations.length,
          opportunities:
            opportunities.length,
          requests: requests.length
        },

        opportunity_summary:
          opportunitySummary,

        request_summary:
          requestSummary,

        locations,

        opportunities,

        recent_requests: requests
      });

    } catch (err) {
      console.error(
        "DEBUG ADVERTISING REQUESTS ERROR:",
        err
      );

      return res.status(500).json({
        error:
          "DEBUG ADVERTISING REQUESTS ERROR",
        message: err.message
      });
    }
  }
);
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
delete req.session.orgUser;
 req.session.user = {
  id: user.rows[0].id,
  name: user.rows[0].name,
  email: user.rows[0].email,
  role: user.rows[0].role,
  customer_id: user.rows[0].customer_id
};

/*
  Super Admin enters the platform control center.
  Customer users continue to enter Vivid Core.
*/
if (
  String(user.rows[0].role || "").toLowerCase() ===
  "super_admin"
) {
  return res.redirect("/platform-admin");
}

return res.redirect("/my-setup");

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
delete req.session.user;
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
const organizationRole = String(
  user.organization_role || ""
).toLowerCase();

/*
  Organization-wide roles land on the
  Organization Executive Dashboard.
*/
if (
  [
    "owner",
    "organization_admin",
    "district_admin"
  ].includes(organizationRole)
) {
  return res.redirect(
    `/org-organization/${user.organization_id}`
  );
}

/*
  Location-level roles land on one of their
  assigned locations.
*/
if (
  [
    "location_manager",
    "standard_user",
    "read_only"
  ].includes(organizationRole)
) {
  const locationResult = await q(
    `
      SELECT
        lu.space_id
      FROM location_users lu
      INNER JOIN spaces s
        ON s.id = lu.space_id
       AND s.organization_id = lu.organization_id
      WHERE lu.organization_id = $1
        AND lu.user_id = $2
        AND COALESCE(lu.is_active, true) = true
        AND COALESCE(s.is_archived, false) = false
      ORDER BY s.name ASC
      LIMIT 1
    `,
    [
      user.organization_id,
      user.user_id
    ]
  );

  const assignedLocation =
    locationResult.rows[0];

  if (!assignedLocation) {
    return res.status(403).send(`
      This user does not have an active location assignment.
      <br><br>
      Please contact your Organization Administrator.
      <br><br>
      <a href="/org-login">
        Back to Organization Login
      </a>
    `);
  }

  return res.redirect(
    `/org-location/${assignedLocation.space_id}`
  );
}

return res.status(403).send(
  "This Organization Portal role is not recognized."
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
  ${organizationNav({
    organizationId: org.id,
    organizationName: org.name,
    activePage: "dashboard",
    userName:
      req.session.orgUser?.name ||
      req.session.user?.name ||
      ""
  })}

  <div class="topbar">
    <div class="brand">Vivid Organizations</div>

    <h1>Executive Dashboard</h1>

    <p class="subtitle">
      Organization-wide performance and management overview
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
  Determine whether the campaign overlaps
  the selected reporting period.
*/
const campaignStartDate = campaign.start_date
  ? new Date(campaign.start_date).toISOString().slice(0, 10)
  : campaign.live_date
    ? new Date(campaign.live_date).toISOString().slice(0, 10)
    : campaign.created_at
      ? new Date(campaign.created_at).toISOString().slice(0, 10)
      : "";

const campaignEndDate = campaign.end_date
  ? new Date(campaign.end_date).toISOString().slice(0, 10)
  : "";

const campaignInSelectedRange =
  !(
    toDate &&
    campaignStartDate &&
    campaignStartDate > toDate
  ) &&
  !(
    fromDate &&
    campaignEndDate &&
    campaignEndDate < fromDate
  );
      /*
        Campaign performance comes directly from Vivid
        events tied to the organization's QR placements.
      */
      if (!campaignInSelectedRange) {
  const rangeBackHref =
    Number.isInteger(requestedQrId) &&
    requestedQrId > 0
      ? `/org-qr/${requestedQrId}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}`
      : `/org-organization/${organizationId}${dateQueryString ? `?${dateQueryString}` : ""}`;

  return res.send(orgPage(
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
            href="${rangeBackHref}"
          >
            Back
          </a>

        </div>

        ${orgDateFilterForm({
          action: `/org-campaign/${campaign.id}`,
          fromDate,
          toDate
        })}

        <div
          class="card"
          style="
            margin:0;
            text-align:center;
            padding:34px 24px;
          "
        >
          <h2 style="margin:0 0 10px;">
            No active campaign during this date range
          </h2>

          <p style="
            margin:0;
            color:#65776b;
          ">
            ${campaign.name || "This campaign"} was not active during the selected reporting period.
            Select another date range or clear the filter.
          </p>
        </div>

      </div>
    `
  ));
}
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
  ${
    campaign.advertiser
      ? `
        <a
          href="/org-advertiser/${encodeURIComponent(
            campaign.advertiser.trim().toLowerCase()
          )}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
          style="
            color:#176b3a;
            text-decoration:underline;
          "
        >
          ${campaign.advertiser}
        </a>
      `
      : "Not set"
  }
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
      /*
        Advertisers are derived directly from Vivid campaigns.

        Event metrics are aggregated separately so QR/campaign
        joins do not duplicate scan or revenue totals.
      */
   const advertiserResult = await q(`
  WITH filtered_relationships AS (
    SELECT DISTINCT
      LOWER(TRIM(c.advertiser)) AS advertiser_key,
      TRIM(c.advertiser) AS advertiser_name,

      c.id AS campaign_id,
      qr.id AS qr_id,
      s.id AS location_id

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

      /*
        No dates selected:
        preserve the current active-only view.
      */
      AND (
        (
          NULLIF($2, '') IS NULL
          AND NULLIF($3, '') IS NULL

          AND COALESCE(qr.is_active, true) = true
          AND COALESCE(qc.is_active, true) = true
        )

        OR

        /*
          Dates selected:
          location, QR, and campaign assignment
          must overlap the reporting period.
        */
        (
          (
            NULLIF($2, '') IS NULL
            OR s.end_date IS NULL
            OR s.end_date >= NULLIF($2, '')::date
          )

          AND

          (
            NULLIF($3, '') IS NULL
            OR COALESCE(
                 s.live_date,
                 s.created_at::date
               ) <= NULLIF($3, '')::date
          )

          AND

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

          AND

          (
            NULLIF($2, '') IS NULL
            OR COALESCE(
                 qc.ended_at::date,
                 c.end_date
               ) IS NULL
            OR COALESCE(
                 qc.ended_at::date,
                 c.end_date
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
  ),

  advertiser_relationships AS (
    SELECT
      advertiser_key,
      MAX(advertiser_name) AS advertiser_name,

      COUNT(DISTINCT location_id)::int
        AS locations,

      COUNT(DISTINCT qr_id)::int
        AS qr_placements,

      COUNT(DISTINCT campaign_id)::int
        AS active_campaigns

    FROM filtered_relationships

    GROUP BY advertiser_key
  ),

  advertiser_events AS (
    SELECT
      fr.advertiser_key,

      COUNT(DISTINCT e.id) FILTER (
        WHERE e.type = 'scan'
      )::int AS scans,

      COUNT(DISTINCT e.id) FILTER (
        WHERE e.type = 'conversion'
      )::int AS conversions,

      COALESCE(
        SUM(e.value) FILTER (
          WHERE e.type = 'conversion'
        ),
        0
      )::numeric AS revenue_generated

    FROM filtered_relationships fr

    LEFT JOIN events e
      ON e.campaign_id = fr.campaign_id
     AND e.qr_id = fr.qr_id

     AND (
       NULLIF($2, '') IS NULL
       OR e.created_at::date >= NULLIF($2, '')::date
     )

     AND (
       NULLIF($3, '') IS NULL
       OR e.created_at::date <= NULLIF($3, '')::date
     )

    GROUP BY fr.advertiser_key
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

    COALESCE(
      ae.revenue_generated,
      0
    )::numeric AS revenue_generated

  FROM advertiser_relationships ar

  LEFT JOIN advertiser_events ae
    ON ae.advertiser_key = ar.advertiser_key

  ORDER BY ar.advertiser_name
`, [
  organizationId,
  fromDate,
  toDate
]);


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
    href="/org-advertiser/${encodeURIComponent(advertiser.advertiser_key)}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
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
${orgDateFilterForm({
  action: `/org-advertisers?organization_id=${organization.id}`,
  fromDate,
  toDate
})}
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
                href="/org-organization/${organization.id}${dateQueryString ? `?${dateQueryString}` : ""}"
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
/*
=========================================================
ORGANIZATION USERS
=========================================================
*/
/*
=========================================================
ADD ORGANIZATION USER FORM
=========================================================
*/

app.get(
  "/org-users/new",
  requireOrganizationPermission("manage_users"),
  async (req, res) => {
    try {
      const organizationId = Number(
        req.session.orgUser.organization_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res
          .status(400)
          .send("Valid organization is required.");
      }

      const organizationResult = await q(
        `
          SELECT
            id,
            name
          FROM organizations
          WHERE id = $1
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `,
        [organizationId]
      );

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res
          .status(404)
          .send("Organization not found.");
      }

      const locationsResult = await q(
        `
          SELECT
            id,
            name,
            location
          FROM spaces
          WHERE organization_id = $1
            AND COALESCE(is_archived, false) = false
          ORDER BY name ASC
        `,
        [organizationId]
      );

      const locationOptions =
        locationsResult.rows
          .map((location) => {
            const locationDescription =
              location.location
                ? ` — ${escapeHtml(location.location)}`
                : "";

            return `
              <label style="
                display:flex;
                align-items:flex-start;
                gap:10px;
                padding:12px;
                margin:0;
                border:1px solid #DCE5DC;
                border-radius:10px;
                background:#FFFFFF;
                cursor:pointer;
              ">
                <input
                  type="checkbox"
                  name="location_ids"
                  value="${location.id}"
                  style="
                    width:auto;
                    margin-top:3px;
                  "
                />

                <span>
                  <strong>
                    ${escapeHtml(location.name)}
                  </strong>

                  <span style="
                    color:#64748B;
                    font-size:13px;
                  ">
                    ${locationDescription}
                  </span>
                </span>
              </label>
            `;
          })
          .join("");

      res.send(
        orgPage(
          `Add ${organization.name} User`,
          `
            <div class="topbar">
              <div class="brand">
                Vivid Organizations
              </div>

              <h1>Add User</h1>

              <p class="subtitle">
                Give a team member access to
                ${escapeHtml(organization.name)}.
              </p>
            </div>

            <div class="wrap">

              <div style="margin-bottom:20px;">
                <a
                  class="btn secondary"
                  href="/org-users"
                >
                  Back to Users
                </a>
              </div>

              <form
                method="POST"
                action="/org-users"
              >
                <div class="card">

                  <h2 style="margin-top:0;">
                    User Information
                  </h2>

                  <label for="name">
                    Full Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    maxlength="150"
                    required
                  />

                  <label for="email">
                    Email Address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    maxlength="255"
                    required
                  />

                  <label for="password">
                    Temporary Password
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    minlength="8"
                    required
                  />

                  <p style="
                    margin-top:-8px;
                    color:#64748B;
                    font-size:13px;
                  ">
                    The user can use this password for
                    their initial Organization Portal login.
                  </p>

                  <label for="role">
                    Role
                  </label>

                  <select
                    id="role"
                    name="role"
                    required
                    onchange="updateLocationVisibility()"
                  >
                    <option value="">
                      Select a role
                    </option>

                    <option value="organization_admin">
                      Organization Administrator
                    </option>

                    <option value="location_manager">
                      Location Manager
                    </option>

                    <option value="standard_user">
                      Standard User
                    </option>

                    <option value="read_only">
                      Read Only
                    </option>
                  </select>

                </div>

                <div
                  id="locationAssignmentCard"
                  class="card"
                  style="
                    margin-top:20px;
                    display:none;
                  "
                >
                  <h2 style="margin-top:0;">
                    Location Access
                  </h2>

                  <p style="
                    color:#64748B;
                    margin-bottom:18px;
                  ">
                    Select every location this user
                    should be able to access.
                  </p>

                  <div style="
                    display:grid;
                    grid-template-columns:
                      repeat(auto-fit, minmax(260px, 1fr));
                    gap:10px;
                  ">
                    ${
                      locationOptions ||
                      `
                        <p style="color:#64748B;">
                          No active locations are available.
                        </p>
                      `
                    }
                  </div>
                </div>

                <div style="
                  display:flex;
                  justify-content:flex-end;
                  gap:12px;
                  margin-top:20px;
                ">
                  <a
                    class="btn secondary"
                    href="/org-users"
                  >
                    Cancel
                  </a>

                  <button
                    class="btn"
                    type="submit"
                  >
                    Add User
                  </button>
                </div>

              </form>
            </div>

            <script>
              function updateLocationVisibility() {
                const role =
                  document.getElementById("role").value;

                const locationCard =
                  document.getElementById(
                    "locationAssignmentCard"
                  );

                const requiresLocations = [
                  "location_manager",
                  "standard_user",
                  "read_only"
                ].includes(role);

                locationCard.style.display =
                  requiresLocations
                    ? "block"
                    : "none";

                if (!requiresLocations) {
                  document
                    .querySelectorAll(
                      'input[name="location_ids"]'
                    )
                    .forEach((checkbox) => {
                      checkbox.checked = false;
                    });
                }
              }

              updateLocationVisibility();
            </script>
          `
        )
      );
    } catch (err) {
      console.error(
        "ADD ORGANIZATION USER FORM ERROR:",
        err
      );

      res.status(500).send(
        "ADD ORGANIZATION USER FORM ERROR: " +
          err.message
      );
    }
  }
);
/*
=========================================================
SAVE ORGANIZATION USER
=========================================================
*/

app.post(
  "/org-users",
  requireOrganizationPermission("manage_users"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const organizationId = Number(
        req.session.orgUser.organization_id
      );

      const name = String(
        req.body.name || ""
      ).trim();

      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      const password = String(
        req.body.password || ""
      );

      const role = String(
        req.body.role || ""
      )
        .trim()
        .toLowerCase();

      /*
        Express returns either:

        - one string when one checkbox is selected
        - an array when several are selected
        - undefined when none are selected

        Normalize all three possibilities into an array.
      */
      const submittedLocationIds =
        req.body.location_ids === undefined
          ? []
          : Array.isArray(req.body.location_ids)
            ? req.body.location_ids
            : [req.body.location_ids];

      const locationIds = [
        ...new Set(
          submittedLocationIds
            .map(value => Number(value))
            .filter(
              value =>
                Number.isInteger(value) &&
                value > 0
            )
        )
      ];

      /*
      =====================================================
      VALIDATION
      =====================================================
      */

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res
          .status(400)
          .send("Valid organization is required.");
      }

      if (!name) {
        return res
          .status(400)
          .send(`
            Full Name is required.
            <br><br>
            <a href="/org-users/new">Back to Add User</a>
          `);
      }

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res
          .status(400)
          .send(`
            A valid email address is required.
            <br><br>
            <a href="/org-users/new">Back to Add User</a>
          `);
      }

      const allowedRoles = [
        "organization_admin",
        "location_manager",
        "standard_user",
        "read_only"
      ];

      if (!allowedRoles.includes(role)) {
        return res
          .status(400)
          .send(`
            A valid organization role is required.
            <br><br>
            <a href="/org-users/new">Back to Add User</a>
          `);
      }

      const requiresLocations = [
        "location_manager",
        "standard_user",
        "read_only"
      ].includes(role);

      if (
        requiresLocations &&
        locationIds.length === 0
      ) {
        return res
          .status(400)
          .send(`
            Select at least one location for this role.
            <br><br>
            <a href="/org-users/new">Back to Add User</a>
          `);
      }

      /*
        The current Vivid login system compares passwords
        directly in SQL, so this route must use the same
        password format until password hashing is migrated
        across every login route together.
      */
      if (password.length < 8) {
        return res
          .status(400)
          .send(`
            Temporary Password must contain at least 8 characters.
            <br><br>
            <a href="/org-users/new">Back to Add User</a>
          `);
      }

      await client.query("BEGIN");

      /*
      =====================================================
      CONFIRM ORGANIZATION
      =====================================================
      */

      const organizationResult =
        await client.query(
          `
            SELECT
              id,
              name
            FROM organizations
            WHERE id = $1
              AND COALESCE(is_active, true) = true
            LIMIT 1
          `,
          [organizationId]
        );

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        await client.query("ROLLBACK");

        return res
          .status(404)
          .send("Organization not found.");
      }

      /*
      =====================================================
      VALIDATE LOCATION OWNERSHIP
      =====================================================

      Do not trust location IDs submitted by the browser.
      Every selected location must belong to this organization.
      */

      if (requiresLocations) {
        const validLocationsResult =
          await client.query(
            `
              SELECT id
              FROM spaces
              WHERE organization_id = $1
                AND id = ANY($2::int[])
                AND COALESCE(is_archived, false) = false
            `,
            [
              organizationId,
              locationIds
            ]
          );

        const validLocationIds =
          validLocationsResult.rows.map(
            row => Number(row.id)
          );

        if (
          validLocationIds.length !==
          locationIds.length
        ) {
          await client.query("ROLLBACK");

          return res
            .status(400)
            .send(`
              One or more selected locations are invalid.
              <br><br>
              <a href="/org-users/new">Back to Add User</a>
            `);
        }
      }

      /*
      =====================================================
      FIND OR CREATE GLOBAL USER
      =====================================================
      */

      const existingUserResult =
        await client.query(
          `
            SELECT
              id,
              name,
              email
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            FOR UPDATE
          `,
          [email]
        );

      let userId;
      let existingVividUser = false;

      if (existingUserResult.rows.length) {
        userId = Number(
          existingUserResult.rows[0].id
        );

        existingVividUser = true;
      } else {
        const newUserResult =
          await client.query(
            `
              INSERT INTO users (
                name,
                email,
                password,
                role
              )
              VALUES (
                $1,
                $2,
                $3,
                'organization_user'
              )
              RETURNING id
            `,
            [
              name,
              email,
              password
            ]
          );

        userId = Number(
          newUserResult.rows[0].id
        );
      }

      /*
      =====================================================
      PREVENT DUPLICATE ORGANIZATION MEMBERSHIP
      =====================================================
      */

      const existingMembershipResult =
        await client.query(
          `
            SELECT
              id,
              is_active
            FROM organization_users
            WHERE organization_id = $1
              AND user_id = $2
            LIMIT 1
            FOR UPDATE
          `,
          [
            organizationId,
            userId
          ]
        );

      if (existingMembershipResult.rows.length) {
        await client.query("ROLLBACK");

        const membership =
          existingMembershipResult.rows[0];

        const membershipMessage =
          membership.is_active
            ? `${escapeHtml(email)} already belongs to ${escapeHtml(
                organization.name
              )}.`
            : `${escapeHtml(email)} previously belonged to ${escapeHtml(
                organization.name
              )} and is currently inactive. Use Edit User to reactivate the account.`;

        return res
          .status(409)
          .send(`
            <div style="
              max-width:650px;
              margin:50px auto;
              padding:28px;
              font-family:Arial,sans-serif;
            ">
              <h2>User Already Connected</h2>

              <p>
                ${membershipMessage}
              </p>

              <a href="/org-users">
                Back to Users
              </a>
            </div>
          `);
      }

      /*
      =====================================================
      CREATE ORGANIZATION MEMBERSHIP
      =====================================================
      */

      const membershipResult =
        await client.query(
          `
            INSERT INTO organization_users (
              organization_id,
              user_id,
              role,
              is_active
            )
            VALUES (
              $1,
              $2,
              $3,
              true
            )
            RETURNING id
          `,
          [
            organizationId,
            userId,
            role
          ]
        );

      const organizationUserId =
        Number(
          membershipResult.rows[0].id
        );

      /*
      =====================================================
      CREATE LOCATION ACCESS
      =====================================================

      Organization Administrators receive organization-wide
      access through their role and do not require rows in
      location_users.
      */

      if (requiresLocations) {
        const locationRole =
          role === "location_manager"
            ? "manager"
            : role === "standard_user"
              ? "standard_user"
              : "read_only";

        const canManage =
          role === "location_manager";

        const canViewReports =
          role !== "read_only";

        for (const spaceId of locationIds) {
          await client.query(
            `
              INSERT INTO location_users (
                organization_id,
                space_id,
                user_id,
                role,
                can_manage_contracts,
                can_manage_pricing,
                can_view_reports,
                is_active
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                true
              )
            `,
            [
              organizationId,
              spaceId,
              userId,
              locationRole,
              canManage,
              canManage,
              canViewReports
            ]
          );
        }
      }

      /*
      =====================================================
      CREATE DEFAULT NOTIFICATION PREFERENCES
      =====================================================
      */

      const defaultNotifications = [
        "advertising_request_submitted",
        "advertising_request_approved",
        "contract_expiring",
        "campaign_started",
        "campaign_ended"
      ];

      for (
        const notificationKey
        of defaultNotifications
      ) {
        await client.query(
          `
            INSERT INTO organization_user_notifications (
              organization_user_id,
              notification_key,
              is_enabled
            )
            VALUES (
              $1,
              $2,
              true
            )
            ON CONFLICT (
              organization_user_id,
              notification_key
            )
            DO NOTHING
          `,
          [
            organizationUserId,
            notificationKey
          ]
        );
      }

      await client.query("COMMIT");

      /*
      =====================================================
      SUCCESS
      =====================================================
      */

      return res.send(
        orgPage(
          "Organization User Added",
          `
            <div class="topbar">
              <div class="brand">
                Vivid Organizations
              </div>

              <h1>User Added</h1>

              <p class="subtitle">
                Organization access was created successfully.
              </p>
            </div>

            <div class="wrap">
              <div
                class="card"
                style="
                  max-width:700px;
                  margin:30px auto;
                "
              >
                <h2 style="margin-top:0;">
                  ${escapeHtml(name)}
                </h2>

                <p>
                  <strong>Email:</strong>
                  ${escapeHtml(email)}
                </p>

                <p>
                  <strong>Organization:</strong>
                  ${escapeHtml(organization.name)}
                </p>

                <p>
                  <strong>Role:</strong>
                  ${escapeHtml(
                    role
                      .split("_")
                      .map(
                        word =>
                          word.charAt(0).toUpperCase() +
                          word.slice(1)
                      )
                      .join(" ")
                  )}
                </p>

                ${
                  existingVividUser
                    ? `
                      <div
                        style="
                          background:#EFF6FF;
                          border-left:5px solid #2563EB;
                          padding:16px;
                          border-radius:10px;
                          margin:20px 0;
                        "
                      >
                        <strong>
                          Existing Vivid account connected
                        </strong>

                        <p style="margin-bottom:0;">
                          This person already had a Vivid
                          account. Their existing password
                          was preserved, and access to
                          ${escapeHtml(organization.name)}
                          was added.
                        </p>
                      </div>
                    `
                    : `
                      <div
                        style="
                          background:#ECFDF5;
                          border-left:5px solid #16A34A;
                          padding:16px;
                          border-radius:10px;
                          margin:20px 0;
                        "
                      >
                        <strong>
                          New Vivid account created
                        </strong>

                        <p style="margin-bottom:0;">
                          Give the user the temporary
                          password entered on the form.
                        </p>
                      </div>
                    `
                }

                <div style="
                  display:flex;
                  gap:12px;
                  flex-wrap:wrap;
                  margin-top:24px;
                ">
                  <a
                    class="btn"
                    href="/org-users"
                  >
                    Back to Users
                  </a>

                  <a
                    class="btn secondary"
                    href="/org-users/new"
                  >
                    Add Another User
                  </a>
                </div>
              </div>
            </div>
          `
        )
      );
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error(
          "ORGANIZATION USER ROLLBACK ERROR:",
          rollbackErr
        );
      }

      console.error(
        "SAVE ORGANIZATION USER ERROR:",
        err
      );

      if (err.code === "23505") {
        return res
          .status(409)
          .send(`
            This user or location assignment already exists.
            <br><br>
            <a href="/org-users">Back to Users</a>
          `);
      }

      return res
        .status(500)
        .send(
          "SAVE ORGANIZATION USER ERROR: " +
            err.message
        );
    } finally {
      client.release();
    }
  }
);
app.get(
  "/org-users",
  requireOrganizationPermission("manage_users"),
  async (req, res) => {
    try {
      const organizationId = Number(
        req.session.orgUser.organization_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res
          .status(400)
          .send("Valid organization is required.");
      }

      const organizationResult = await q(
        `
          SELECT
            id,
            name
          FROM organizations
          WHERE id = $1
          LIMIT 1
        `,
        [organizationId]
      );

      if (!organizationResult.rows.length) {
        return res
          .status(404)
          .send("Organization not found.");
      }

      const organization =
        organizationResult.rows[0];

      const usersResult = await q(
        `
          SELECT
            ou.id AS organization_user_id,
            ou.user_id,
            ou.role,
            ou.is_active,
            u.name,
            u.email,
            COALESCE(
              STRING_AGG(
                DISTINCT s.name,
                ', '
                ORDER BY s.name
              ) FILTER (
                WHERE s.id IS NOT NULL
              ),
              ''
            ) AS location_names
          FROM organization_users ou
          INNER JOIN users u
            ON u.id = ou.user_id
          LEFT JOIN location_users lu
            ON lu.user_id = ou.user_id
            AND lu.organization_id = ou.organization_id
            AND lu.is_active = true
          LEFT JOIN spaces s
            ON s.id = lu.space_id
            AND s.organization_id = ou.organization_id
          WHERE ou.organization_id = $1
          GROUP BY
            ou.id,
            ou.user_id,
            ou.role,
            ou.is_active,
            u.name,
            u.email
          ORDER BY
            ou.is_active DESC,
            u.name ASC,
            u.email ASC
        `,
        [organizationId]
      );

      const roleLabels = {
        owner: "Organization Administrator",
        organization_admin:
          "Organization Administrator",
        district_admin:
          "Organization Administrator",
        location_manager: "Location Manager",
        standard_user: "Standard User",
        read_only: "Read Only"
      };

      const userRows = usersResult.rows
        .map((user) => {
          const normalizedRole = String(
            user.role || "read_only"
          ).toLowerCase();

          const roleLabel =
            roleLabels[normalizedRole] ||
            "Read Only";

          const hasAllLocations =
            organizationRoleHasPermission(
              normalizedRole,
              "view_all_locations"
            );

          const locations = hasAllLocations
            ? "All Locations"
            : user.location_names ||
              "No Locations Assigned";

          const status = user.is_active
            ? "Active"
            : "Inactive";

          const statusBackground = user.is_active
            ? "#DCFCE7"
            : "#E5E7EB";

          const statusColor = user.is_active
            ? "#166534"
            : "#4B5563";

          return `
            <tr>
              <td>
                <strong>
                  ${escapeHtml(
                    user.name || "Unnamed User"
                  )}
                </strong>
                <div style="
                  margin-top:4px;
                  color:#64748B;
                  font-size:13px;
                ">
                  ${escapeHtml(user.email || "")}
                </div>
              </td>

              <td>
                ${escapeHtml(roleLabel)}
              </td>

              <td>
                ${escapeHtml(locations)}
              </td>

              <td>
                <span style="
                  display:inline-block;
                  padding:6px 10px;
                  border-radius:999px;
                  background:${statusBackground};
                  color:${statusColor};
                  font-size:12px;
                  font-weight:700;
                ">
                  ${status}
                </span>
              </td>

              <td style="white-space:nowrap;">
                <a
                  class="btn secondary"
                  href="/org-user/${user.organization_user_id}/edit"
                  style="
                    padding:8px 12px;
                    margin:0;
                  "
                >
                  Edit
                </a>
              </td>
            </tr>
          `;
        })
        .join("");

      const emptyState = `
        <tr>
          <td
            colspan="5"
            style="
              text-align:center;
              padding:35px;
              color:#64748B;
            "
          >
            No organization users have been added.
          </td>
        </tr>
      `;

      res.send(
        orgPage(
          `${organization.name} Users`,
          `
            <div class="topbar">
              <div class="brand">
                Vivid Organizations
              </div>

              <h1>Users</h1>

              <p class="subtitle">
                Manage who can access
                ${escapeHtml(organization.name)}.
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
                <a
                  class="btn secondary"
                  href="/org-organization/${organizationId}"
                >
                  Back to ${escapeHtml(
                    organization.name
                  )}
                </a>

                <a
                  class="btn"
                  href="/org-users/new"
                >
                  Add User
                </a>
              </div>

              <div class="card">
                <div style="overflow-x:auto;">
                  <table style="
                    width:100%;
                    border-collapse:collapse;
                  ">
                    <thead>
                      <tr style="
                        text-align:left;
                        border-bottom:1px solid #DCE5DC;
                      ">
                        <th style="padding:14px 12px;">
                          User
                        </th>

                        <th style="padding:14px 12px;">
                          Role
                        </th>

                        <th style="padding:14px 12px;">
                          Locations
                        </th>

                        <th style="padding:14px 12px;">
                          Status
                        </th>

                        <th style="padding:14px 12px;">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      ${
                        userRows ||
                        emptyState
                      }
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          `
        )
      );
    } catch (err) {
      console.error(
        "ORGANIZATION USERS ERROR:",
        err
      );

      res.status(500).send(
        "ORGANIZATION USERS ERROR: " +
          err.message
      );
    }
  }
);
  /*
=========================================================
EDIT ORGANIZATION USER FORM
=========================================================
*/

app.get(
  "/org-user/:organizationUserId/edit",
  requireOrganizationPermission("manage_users"),
  async (req, res) => {
    try {
      const organizationId = Number(
        req.session.orgUser.organization_id
      );

      const organizationUserId = Number(
        req.params.organizationUserId
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(organizationUserId) ||
        organizationUserId <= 0
      ) {
        return res
          .status(400)
          .send("Valid organization and user are required.");
      }

      /*
      =====================================================
      LOAD ORGANIZATION
      =====================================================
      */

      const organizationResult = await q(
        `
          SELECT
            id,
            name
          FROM organizations
          WHERE id = $1
            AND COALESCE(is_active, true) = true
          LIMIT 1
        `,
        [organizationId]
      );

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res
          .status(404)
          .send("Organization not found.");
      }

      /*
      =====================================================
      LOAD ORGANIZATION USER
      =====================================================
      */

      const userResult = await q(
        `
          SELECT
            ou.id AS organization_user_id,
            ou.user_id,
            ou.role,
            ou.is_active,
            u.name,
            u.email
          FROM organization_users ou
          INNER JOIN users u
            ON u.id = ou.user_id
          WHERE ou.id = $1
            AND ou.organization_id = $2
          LIMIT 1
        `,
        [
          organizationUserId,
          organizationId
        ]
      );

      const user = userResult.rows[0];

      if (!user) {
        return res
          .status(404)
          .send("Organization user not found.");
      }

      const normalizedRole = String(
        user.role || "read_only"
      )
        .trim()
        .toLowerCase();

      const isOwner =
        normalizedRole === "owner";

      /*
      =====================================================
      LOAD LOCATIONS AND CURRENT ASSIGNMENTS
      =====================================================
      */

      const locationsResult = await q(
        `
          SELECT
            s.id,
            s.name,
            s.location,
            CASE
              WHEN lu.id IS NOT NULL THEN true
              ELSE false
            END AS is_assigned
          FROM spaces s
          LEFT JOIN location_users lu
            ON lu.space_id = s.id
            AND lu.organization_id = $1
            AND lu.user_id = $2
            AND COALESCE(lu.is_active, true) = true
          WHERE s.organization_id = $1
            AND COALESCE(s.is_archived, false) = false
          ORDER BY s.name ASC
        `,
        [
          organizationId,
          user.user_id
        ]
      );

      const locationOptions =
        locationsResult.rows
          .map((location) => {
            const locationDescription =
              location.location
                ? ` — ${escapeHtml(location.location)}`
                : "";

            return `
              <label style="
                display:flex;
                align-items:flex-start;
                gap:10px;
                padding:12px;
                margin:0;
                border:1px solid #DCE5DC;
                border-radius:10px;
                background:#FFFFFF;
                cursor:pointer;
              ">
                <input
                  type="checkbox"
                  name="location_ids"
                  value="${location.id}"
                  ${
                    location.is_assigned
                      ? "checked"
                      : ""
                  }
                  style="
                    width:auto;
                    margin-top:3px;
                  "
                />

                <span>
                  <strong>
                    ${escapeHtml(location.name)}
                  </strong>

                  <span style="
                    color:#64748B;
                    font-size:13px;
                  ">
                    ${locationDescription}
                  </span>
                </span>
              </label>
            `;
          })
          .join("");

      /*
      =====================================================
      ROLE OPTIONS
      =====================================================
      */

      const roleOption = (
        value,
        label
      ) => `
        <option
          value="${value}"
          ${
            normalizedRole === value
              ? "selected"
              : ""
          }
        >
          ${label}
        </option>
      `;

      const roleField = isOwner
        ? `
          <label>Role</label>

          <input
            type="text"
            value="Organization Owner"
            disabled
          />

          <input
            type="hidden"
            name="role"
            value="owner"
          />

          <p style="
            margin-top:-8px;
            color:#64748B;
            font-size:13px;
          ">
            The organization owner role cannot be changed.
          </p>
        `
        : `
          <label for="role">
            Role
          </label>

          <select
            id="role"
            name="role"
            required
            onchange="updateLocationVisibility()"
          >
            ${roleOption(
              "organization_admin",
              "Organization Administrator"
            )}

            ${roleOption(
              "location_manager",
              "Location Manager"
            )}

            ${roleOption(
              "standard_user",
              "Standard User"
            )}

            ${roleOption(
              "read_only",
              "Read Only"
            )}
          </select>
        `;

      /*
      =====================================================
      STATUS FIELD
      =====================================================
      */

      const statusField = isOwner
        ? `
          <label>Status</label>

          <input
            type="text"
            value="Active"
            disabled
          />

          <input
            type="hidden"
            name="is_active"
            value="true"
          />

          <p style="
            margin-top:-8px;
            color:#64748B;
            font-size:13px;
          ">
            The organization owner cannot be deactivated.
          </p>
        `
        : `
          <label for="is_active">
            Status
          </label>

          <select
            id="is_active"
            name="is_active"
            required
          >
            <option
              value="true"
              ${
                user.is_active
                  ? "selected"
                  : ""
              }
            >
              Active
            </option>

            <option
              value="false"
              ${
                !user.is_active
                  ? "selected"
                  : ""
              }
            >
              Inactive
            </option>
          </select>
        `;

      res.send(
        orgPage(
          `Edit ${user.name || "Organization User"}`,
          `
            <div class="topbar">
              <div class="brand">
                Vivid Organizations
              </div>

              <h1>Edit User</h1>

              <p class="subtitle">
                Update access for
                ${escapeHtml(
                  user.name || user.email
                )}.
              </p>
            </div>

            <div class="wrap">

              <div style="margin-bottom:20px;">
                <a
                  class="btn secondary"
                  href="/org-users"
                >
                  Back to Users
                </a>
              </div>

              <form
                method="POST"
                action="/org-user/${organizationUserId}/edit"
              >

                <div class="card">

                  <h2 style="margin-top:0;">
                    User Information
                  </h2>

                  <label for="name">
                    Full Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    maxlength="150"
                    value="${escapeHtml(user.name || "")}"
                    required
                  />

                  <label for="email">
                    Email Address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    maxlength="255"
                    value="${escapeHtml(user.email || "")}"
                    required
                  />

                  ${roleField}

                  ${statusField}

                </div>

                <div
                  id="locationAssignmentCard"
                  class="card"
                  style="
                    margin-top:20px;
                    display:none;
                  "
                >
                  <h2 style="margin-top:0;">
                    Location Access
                  </h2>

                  <p style="
                    color:#64748B;
                    margin-bottom:18px;
                  ">
                    Select every location this user
                    should be able to access.
                  </p>

                  <div style="
                    display:grid;
                    grid-template-columns:
                      repeat(auto-fit, minmax(260px, 1fr));
                    gap:10px;
                  ">
                    ${
                      locationOptions ||
                      `
                        <p style="color:#64748B;">
                          No active locations are available.
                        </p>
                      `
                    }
                  </div>
                </div>

                <div style="
                  display:flex;
                  justify-content:flex-end;
                  gap:12px;
                  margin-top:20px;
                ">
                  <a
                    class="btn secondary"
                    href="/org-users"
                  >
                    Cancel
                  </a>

                  <button
                    class="btn"
                    type="submit"
                  >
                    Save Changes
                  </button>
                </div>

              </form>
            </div>

            <script>
              function updateLocationVisibility() {
                const roleElement =
                  document.getElementById("role");

                const locationCard =
                  document.getElementById(
                    "locationAssignmentCard"
                  );

                if (!roleElement || !locationCard) {
                  return;
                }

                const requiresLocations = [
                  "location_manager",
                  "standard_user",
                  "read_only"
                ].includes(roleElement.value);

                locationCard.style.display =
                  requiresLocations
                    ? "block"
                    : "none";

                if (!requiresLocations) {
                  document
                    .querySelectorAll(
                      'input[name="location_ids"]'
                    )
                    .forEach((checkbox) => {
                      checkbox.checked = false;
                    });
                }
              }

              updateLocationVisibility();
            </script>
          `
        )
      );
    } catch (err) {
      console.error(
        "EDIT ORGANIZATION USER FORM ERROR:",
        err
      );

      return res
        .status(500)
        .send(
          "EDIT ORGANIZATION USER FORM ERROR: " +
            err.message
        );
    }
  }
);

/*
=========================================================
UPDATE ORGANIZATION USER
=========================================================
*/

app.post(
  "/org-user/:organizationUserId/edit",
  requireOrganizationPermission("manage_users"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const organizationId = Number(
        req.session.orgUser.organization_id
      );

      const organizationUserId = Number(
        req.params.organizationUserId
      );

      const name = String(
        req.body.name || ""
      ).trim();

      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      let role = String(
        req.body.role || ""
      )
        .trim()
        .toLowerCase();

      let isActive =
        String(req.body.is_active || "false")
          .trim()
          .toLowerCase() === "true";

      const submittedLocationIds =
        req.body.location_ids === undefined
          ? []
          : Array.isArray(req.body.location_ids)
            ? req.body.location_ids
            : [req.body.location_ids];

      const locationIds = [
        ...new Set(
          submittedLocationIds
            .map(value => Number(value))
            .filter(
              value =>
                Number.isInteger(value) &&
                value > 0
            )
        )
      ];

      /*
      =====================================================
      BASIC VALIDATION
      =====================================================
      */

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(organizationUserId) ||
        organizationUserId <= 0
      ) {
        return res
          .status(400)
          .send(
            "Valid organization and user are required."
          );
      }

      if (!name) {
        return res
          .status(400)
          .send(`
            Full Name is required.
            <br><br>
            <a href="/org-user/${organizationUserId}/edit">
              Back to Edit User
            </a>
          `);
      }

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res
          .status(400)
          .send(`
            A valid email address is required.
            <br><br>
            <a href="/org-user/${organizationUserId}/edit">
              Back to Edit User
            </a>
          `);
      }

      await client.query("BEGIN");

      /*
      =====================================================
      LOAD AND LOCK MEMBERSHIP
      =====================================================
      */

      const membershipResult =
        await client.query(
          `
            SELECT
              ou.id,
              ou.user_id,
              ou.role,
              ou.is_active
            FROM organization_users ou
            WHERE ou.id = $1
              AND ou.organization_id = $2
            LIMIT 1
            FOR UPDATE
          `,
          [
            organizationUserId,
            organizationId
          ]
        );

      const membership =
        membershipResult.rows[0];

      if (!membership) {
        await client.query("ROLLBACK");

        return res
          .status(404)
          .send("Organization user not found.");
      }

      const userId = Number(
        membership.user_id
      );

      const currentRole = String(
        membership.role || "read_only"
      )
        .trim()
        .toLowerCase();

      const isOwner =
        currentRole === "owner";

      /*
        Protect the organization owner from accidental
        role changes or deactivation.
      */

      if (isOwner) {
        role = "owner";
        isActive = true;
      }

      const allowedRoles = [
        "organization_admin",
        "location_manager",
        "standard_user",
        "read_only"
      ];

      if (
        !isOwner &&
        !allowedRoles.includes(role)
      ) {
        await client.query("ROLLBACK");

        return res
          .status(400)
          .send(`
            A valid organization role is required.
            <br><br>
            <a href="/org-user/${organizationUserId}/edit">
              Back to Edit User
            </a>
          `);
      }

      const requiresLocations =
        !isOwner &&
        [
          "location_manager",
          "standard_user",
          "read_only"
        ].includes(role);

      if (
        requiresLocations &&
        locationIds.length === 0
      ) {
        await client.query("ROLLBACK");

        return res
          .status(400)
          .send(`
            Select at least one location for this role.
            <br><br>
            <a href="/org-user/${organizationUserId}/edit">
              Back to Edit User
            </a>
          `);
      }

      /*
      =====================================================
      VALIDATE EMAIL UNIQUENESS
      =====================================================
      */

      const duplicateEmailResult =
        await client.query(
          `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
              AND id <> $2
            LIMIT 1
          `,
          [
            email,
            userId
          ]
        );

      if (duplicateEmailResult.rows.length) {
        await client.query("ROLLBACK");

        return res
          .status(409)
          .send(`
            Another Vivid user already uses this email address.
            <br><br>
            <a href="/org-user/${organizationUserId}/edit">
              Back to Edit User
            </a>
          `);
      }

      /*
      =====================================================
      VALIDATE LOCATION OWNERSHIP
      =====================================================
      */

      if (requiresLocations) {
        const validLocationsResult =
          await client.query(
            `
              SELECT id
              FROM spaces
              WHERE organization_id = $1
                AND id = ANY($2::int[])
                AND COALESCE(is_archived, false) = false
            `,
            [
              organizationId,
              locationIds
            ]
          );

        const validLocationIds =
          validLocationsResult.rows.map(
            row => Number(row.id)
          );

        if (
          validLocationIds.length !==
          locationIds.length
        ) {
          await client.query("ROLLBACK");

          return res
            .status(400)
            .send(`
              One or more selected locations are invalid.
              <br><br>
              <a href="/org-user/${organizationUserId}/edit">
                Back to Edit User
              </a>
            `);
        }
      }

      /*
      =====================================================
      UPDATE GLOBAL USER
      =====================================================
      */

      await client.query(
        `
          UPDATE users
          SET
            name = $1,
            email = $2
          WHERE id = $3
        `,
        [
          name,
          email,
          userId
        ]
      );

      /*
      =====================================================
      UPDATE ORGANIZATION MEMBERSHIP
      =====================================================
      */

      await client.query(
        `
          UPDATE organization_users
          SET
            role = $1,
            is_active = $2
          WHERE id = $3
            AND organization_id = $4
        `,
        [
          role,
          isActive,
          organizationUserId,
          organizationId
        ]
      );

      /*
      =====================================================
      REBUILD LOCATION ASSIGNMENTS
      =====================================================
      */

      await client.query(
        `
          DELETE FROM location_users
          WHERE organization_id = $1
            AND user_id = $2
        `,
        [
          organizationId,
          userId
        ]
      );

      if (requiresLocations) {
        const locationRole =
          role === "location_manager"
            ? "manager"
            : role === "standard_user"
              ? "standard_user"
              : "read_only";

        const canManage =
          role === "location_manager";

        const canViewReports =
          role !== "read_only";

        for (const spaceId of locationIds) {
          await client.query(
            `
              INSERT INTO location_users (
                organization_id,
                space_id,
                user_id,
                role,
                can_manage_contracts,
                can_manage_pricing,
                can_view_reports,
                is_active
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                true
              )
            `,
            [
              organizationId,
              spaceId,
              userId,
              locationRole,
              canManage,
              canManage,
              canViewReports
            ]
          );
        }
      }

      await client.query("COMMIT");

      return res.redirect("/org-users");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error(
          "UPDATE ORGANIZATION USER ROLLBACK ERROR:",
          rollbackErr
        );
      }

      console.error(
        "UPDATE ORGANIZATION USER ERROR:",
        err
      );

      if (err.code === "23505") {
        return res
          .status(409)
          .send(`
            This email address or location assignment
            already exists.
            <br><br>
            <a href="/org-users">
              Back to Users
            </a>
          `);
      }

      return res
        .status(500)
        .send(
          "UPDATE ORGANIZATION USER ERROR: " +
            err.message
        );
    } finally {
      client.release();
    }
  }
);
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
          contract type, and advertising opportunity.
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
        !advertiserKey
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
        Confirm this advertiser has at least one valid
        relationship during the selected reporting period.
      */
      const advertiserResult = await q(`
        WITH filtered_relationships AS (
          SELECT DISTINCT
            TRIM(c.advertiser) AS advertiser_name,
            c.id AS campaign_id,
            qr.id AS qr_id,
            s.id AS location_id

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

            AND (
              /*
                No dates selected:
                preserve the current active-only view.
              */
              (
                NULLIF($3, '') IS NULL
                AND NULLIF($4, '') IS NULL
                AND COALESCE(qr.is_active, true) = true
                AND COALESCE(qc.is_active, true) = true
              )

              OR

              /*
                Dates selected:
                location, QR, and campaign assignment
                must overlap the requested range.
              */
              (
                (
                  NULLIF($3, '') IS NULL
                  OR s.end_date IS NULL
                  OR s.end_date >= NULLIF($3, '')::date
                )

                AND

                (
                  NULLIF($4, '') IS NULL
                  OR COALESCE(
                       s.live_date,
                       s.created_at::date
                     ) <= NULLIF($4, '')::date
                )

                AND

                (
                  NULLIF($3, '') IS NULL
                  OR qr.end_date IS NULL
                  OR qr.end_date >= NULLIF($3, '')::date
                )

                AND

                (
                  NULLIF($4, '') IS NULL
                  OR COALESCE(
                       qr.live_date,
                       qr.created_at::date
                     ) <= NULLIF($4, '')::date
                )

                AND

                (
                  NULLIF($3, '') IS NULL
                  OR COALESCE(
                       qc.ended_at::date,
                       c.end_date
                     ) IS NULL
                  OR COALESCE(
                       qc.ended_at::date,
                       c.end_date
                     ) >= NULLIF($3, '')::date
                )

                AND

                (
                  NULLIF($4, '') IS NULL
                  OR COALESCE(
                       qc.started_at::date,
                       qc.assigned_at::date,
                       c.start_date,
                       c.live_date,
                       c.created_at::date
                     ) <= NULLIF($4, '')::date
                )
              )
            )
        )

        SELECT
          MIN(advertiser_name) AS advertiser_name,
          COUNT(DISTINCT location_id)::int AS locations,
          COUNT(DISTINCT qr_id)::int AS qr_placements,
          COUNT(DISTINCT campaign_id)::int AS active_campaigns

        FROM filtered_relationships
      `, [
        organizationId,
        advertiserKey,
        fromDate,
        toDate
      ]);

      const advertiser = advertiserResult.rows[0];

      /*
        The advertiser exists in Vivid but had no valid
        relationship during the selected reporting period.
      */
      if (!advertiser?.advertiser_name) {
        return res.send(orgPage(
          "Organization Advertiser",
          `
            <div class="topbar">
              <div class="brand">
                Vivid Organizations
              </div>

              <h1>
                ${advertiserKey
                  .split(" ")
                  .map(word =>
                    word.charAt(0).toUpperCase() +
                    word.slice(1)
                  )
                  .join(" ")}
              </h1>

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
                  href="/org-advertisers?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
                >
                  Back to Advertisers
                </a>
              </div>

              ${orgDateFilterForm({
                action: `/org-advertiser/${encodeURIComponent(advertiserKey)}`,
                fromDate,
                toDate
              })}

              <div
                class="card"
                style="
                  margin:0;
                  text-align:center;
                  padding:34px 24px;
                "
              >
                <h2 style="margin:0 0 10px;">
                  No active advertiser during this date range
                </h2>

                <p style="
                  margin:0;
                  color:#65776b;
                ">
                  This advertiser had no active location, QR placement,
                  or campaign relationship during the selected reporting period.
                  Select another date range or clear the filter.
                </p>
              </div>

            </div>
          `
        ));
      }

      /*
        Date-filtered advertiser event performance.
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
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2

          AND (
            NULLIF($3, '') IS NULL
            OR e.created_at::date >= NULLIF($3, '')::date
          )

          AND (
            NULLIF($4, '') IS NULL
            OR e.created_at::date <= NULLIF($4, '')::date
          )
      `, [
        organizationId,
        advertiserKey,
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
        Related locations active during the selected period.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,

          COUNT(DISTINCT qr.id)::int
            AS qr_placements,

          COUNT(DISTINCT c.id)::int
            AS campaigns

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

          AND (
            (
              NULLIF($3, '') IS NULL
              AND NULLIF($4, '') IS NULL
              AND COALESCE(qr.is_active, true) = true
              AND COALESCE(qc.is_active, true) = true
            )

            OR

            (
              (
                NULLIF($3, '') IS NULL
                OR s.end_date IS NULL
                OR s.end_date >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     s.live_date,
                     s.created_at::date
                   ) <= NULLIF($4, '')::date
              )

              AND

              (
                NULLIF($3, '') IS NULL
                OR qr.end_date IS NULL
                OR qr.end_date >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qr.live_date,
                     qr.created_at::date
                   ) <= NULLIF($4, '')::date
              )

              AND

              (
                NULLIF($3, '') IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qc.started_at::date,
                     qc.assigned_at::date,
                     c.start_date,
                     c.live_date,
                     c.created_at::date
                   ) <= NULLIF($4, '')::date
              )
            )
          )

        GROUP BY
          s.id,
          s.name,
          s.location

        ORDER BY s.name
      `, [
        organizationId,
        advertiserKey,
        fromDate,
        toDate
      ]);

      /*
        Related campaigns active during the selected period.
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
         AND COALESCE(qr.is_archived, false) = false

        JOIN spaces s
          ON s.id = qr.space_id
         AND COALESCE(s.is_archived, false) = false

        WHERE s.organization_id = $1
          AND LOWER(TRIM(c.advertiser)) = $2
          AND COALESCE(c.is_archived, false) = false

          AND (
            (
              NULLIF($3, '') IS NULL
              AND NULLIF($4, '') IS NULL
              AND COALESCE(qr.is_active, true) = true
              AND COALESCE(qc.is_active, true) = true
            )

            OR

            (
              (
                NULLIF($3, '') IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qc.started_at::date,
                     qc.assigned_at::date,
                     c.start_date,
                     c.live_date,
                     c.created_at::date
                   ) <= NULLIF($4, '')::date
              )

              AND

              (
                NULLIF($3, '') IS NULL
                OR qr.end_date IS NULL
                OR qr.end_date >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qr.live_date,
                     qr.created_at::date
                   ) <= NULLIF($4, '')::date
              )
            )
          )

        ORDER BY c.name
      `, [
        organizationId,
        advertiserKey,
        fromDate,
        toDate
      ]);

      /*
        Related QR placements active during the selected period.
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
          AND COALESCE(c.is_archived, false) = false

          AND (
            (
              NULLIF($3, '') IS NULL
              AND NULLIF($4, '') IS NULL
              AND COALESCE(qr.is_active, true) = true
              AND COALESCE(qc.is_active, true) = true
            )

            OR

            (
              (
                NULLIF($3, '') IS NULL
                OR qr.end_date IS NULL
                OR qr.end_date >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qr.live_date,
                     qr.created_at::date
                   ) <= NULLIF($4, '')::date
              )

              AND

              (
                NULLIF($3, '') IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) IS NULL
                OR COALESCE(
                     qc.ended_at::date,
                     c.end_date
                   ) >= NULLIF($3, '')::date
              )

              AND

              (
                NULLIF($4, '') IS NULL
                OR COALESCE(
                     qc.started_at::date,
                     qc.assigned_at::date,
                     c.start_date,
                     c.live_date,
                     c.created_at::date
                   ) <= NULLIF($4, '')::date
              )
            )
          )

        ORDER BY
          s.name,
          qr.name
      `, [
        organizationId,
        advertiserKey,
        fromDate,
        toDate
      ]);

      const locationCards = locationResult.rows.map(location => `
        <a
          href="/org-location/${location.id}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
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
            <div style="font-size:16px;font-weight:bold;">
              ${location.name}
            </div>

            <div style="
              font-size:11px;
              color:#65776b;
              margin:5px 0 18px;
            ">
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
          href="/org-qr/${qr.id}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
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
            <div style="font-size:16px;font-weight:bold;">
              ${qr.name || "Unnamed QR Placement"}
            </div>

            <div style="
              font-size:11px;
              color:#65776b;
              margin:5px 0 18px;
            ">
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
          href="/org-campaign/${campaign.id}?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
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
            <div style="font-size:16px;font-weight:bold;">
              ${campaign.name || "Unnamed Campaign"}
            </div>

            <div style="
              font-size:11px;
              color:#65776b;
              margin:5px 0 18px;
            ">
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
            <div class="brand">
              Vivid Organizations
            </div>

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
                href="/org-advertisers?organization_id=${organizationId}${dateQueryString ? `&${dateQueryString}` : ""}"
              >
                Back to Advertisers
              </a>
            </div>

            ${orgDateFilterForm({
              action: `/org-advertiser/${encodeURIComponent(advertiserKey)}`,
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
                  Locations
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.locations || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  QR Placements
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.qr_placements || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Active Campaigns
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(advertiser.active_campaigns || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Scans
                </div>

                <div style="font-size:27px;font-weight:bold;margin-top:6px;">
                  ${Number(metrics.scans || 0)}
                </div>
              </div>

              <div class="card" style="margin:0;">
                <div style="font-size:12px;color:#65776b;">
                  Conversions
                </div>

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
                    ${
                      typeof value === "number"
                        ? value.toLocaleString()
                        : value || 0
                    }
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
      console.error(
        "ORG ADVERTISER ERROR:",
        err
      );

      res.status(500).send(
        "ORG ADVERTISER ERROR: " +
        err.message
      );
    }
  }
);
/*
=========================================================
VIVID MARKETPLACE MODULE
Separate from Vivid Core and Organization analytics.
Version 1 presentation preview.
=========================================================
*/
/*
=========================================================
ORGANIZATION MARKETPLACE — ADVERTISING REQUESTS
=========================================================

GET:
  /org-advertising-requests

Purpose:
- Displays requests submitted through Advertise With Us
- Supports organization users and Super Admin
- Reads Marketplace request data only
- Does not create or modify Vivid Core records
=========================================================
*/

app.get(
  "/org-advertising-requests",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal access.
      */
      if (
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin access.
      */
      if (
        !organizationId &&
        req.session.user?.role ===
          "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Advertising Requests access denied."
        );
      }

      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const cleanSearch = String(
        req.query.search || ""
      )
        .trim()
        .slice(0, 200);

      const requestedStatus = String(
        req.query.status || "All"
      ).trim();

    const allowedStatuses = [
  "All",
  "Pending",
  "Approved",
  "Rejected",
  "Closed"
];

      const selectedStatus =
        allowedStatuses.includes(
          requestedStatus
        )
          ? requestedStatus
          : "All";

      const requestedLocationId = Number(
        req.query.location_id
      );

      const selectedLocationId =
        Number.isInteger(
          requestedLocationId
        ) &&
        requestedLocationId > 0
          ? requestedLocationId
          : null;

      /*
        Load organization.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name
        FROM organizations
        WHERE id = $1
          AND COALESCE(
            is_active,
            true
          ) = true
        LIMIT 1
      `, [organizationId]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Load organization locations for filter.
      */
      const locationsResult = await q(`
        SELECT
          id,
          name
        FROM spaces
        WHERE organization_id = $1
          AND COALESCE(
            is_archived,
            false
          ) = false
        ORDER BY name
      `, [organizationId]);

      const locations =
        locationsResult.rows;

      /*
        Build request query safely.
      */
      const queryValues = [
        organizationId
      ];

      const whereParts = [
  "r.organization_id = $1"
];

      if (selectedStatus !== "All") {
        queryValues.push(
          selectedStatus
        );

        whereParts.push(
  `r.status = $${queryValues.length}`
);
      }

      if (selectedLocationId) {
        queryValues.push(
          selectedLocationId
        );

        whereParts.push(
  `r.location_id = $${queryValues.length}`
);
          
      
      }

      if (cleanSearch) {
        queryValues.push(
          `%${cleanSearch}%`
        );

        const searchParameter =
          `$${queryValues.length}`;

     whereParts.push(`
  (
    r.business_name
      ILIKE ${searchParameter}

    OR r.contact_name
      ILIKE ${searchParameter}

    OR r.email
      ILIKE ${searchParameter}

    OR r.campaign_name
      ILIKE ${searchParameter}

    OR r.opportunity_name
      ILIKE ${searchParameter}

    OR s.name
      ILIKE ${searchParameter}
  )
`);
      }

const requestsResult = await q(
  `
    SELECT DISTINCT ON (
      r.organization_id,
      r.opportunity_id
    )
      r.id,

      r.organization_id,
      o.name AS organization_name,

      r.location_id,
      s.name AS location_name,

      r.opportunity_id,

      COALESCE(
        oo.title,
        r.opportunity_name
      ) AS opportunity_name,

      r.business_name,
      r.contact_name,
      r.email,
      r.phone,

      r.campaign_name,

      COALESCE(
        oo.annual_price,
        oo.price,
        r.price,
        0
      ) AS price,

      COALESCE(
        oo.pricing_unit,
        r.pricing_unit
      ) AS pricing_unit,

      COALESCE(
        oo.status,
        r.status
      ) AS status,

      r.setup_status,
      r.submitted_at

    FROM organization_advertising_requests r

    JOIN organizations o
      ON o.id = r.organization_id

    LEFT JOIN spaces s
      ON s.id = r.location_id
     AND s.organization_id =
         r.organization_id

    LEFT JOIN organization_opportunities oo
      ON oo.id = r.opportunity_id
     AND oo.organization_id =
         r.organization_id
     AND oo.space_id =
         r.location_id

    WHERE
      ${whereParts.join("\nAND ")}

    ORDER BY
      r.organization_id,
      r.opportunity_id,
      r.submitted_at DESC,
      r.id DESC
  `,
  queryValues
);
      const requests =
        requestsResult.rows;

      /*
        Summary metrics are organization-wide.
        They do not change with page filters.
      */
  /*
  ============================================================
  ADVERTISING INVENTORY SUMMARY
  ============================================================

  organization_opportunities is the single source of truth for:

  - opportunity counts
  - opportunity status
  - inventory value
  - revenue pipeline value

  organization_advertising_requests is used only for the
  individual request records shown below the dashboard.
*/
const opportunitySummaryResult = await q(
  `
    SELECT
      COUNT(*)::integer
        AS total_opportunities,

      COUNT(*) FILTER (
        WHERE LOWER(
          COALESCE(status, 'available')
        ) = 'available'
      )::integer
        AS available_count,

      COUNT(*) FILTER (
        WHERE LOWER(
          COALESCE(status, '')
        ) = 'pending'
      )::integer
        AS pending_count,

      COUNT(*) FILTER (
        WHERE LOWER(
          COALESCE(status, '')
        ) = 'approved'
      )::integer
        AS approved_count,

      COUNT(*) FILTER (
        WHERE LOWER(
          COALESCE(status, '')
        ) = 'rejected'
      )::integer
        AS rejected_count,

      COUNT(*) FILTER (
        WHERE LOWER(
          COALESCE(status, '')
        ) = 'closed'
      )::integer
        AS closed_count,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ),
        0
      )
        AS total_inventory_value,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ) FILTER (
          WHERE LOWER(
            COALESCE(status, 'available')
          ) = 'available'
        ),
        0
      )
        AS available_revenue,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ) FILTER (
          WHERE LOWER(
            COALESCE(status, '')
          ) = 'pending'
        ),
        0
      )
        AS pending_revenue,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ) FILTER (
          WHERE LOWER(
            COALESCE(status, '')
          ) = 'approved'
        ),
        0
      )
        AS approved_revenue,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ) FILTER (
          WHERE LOWER(
            COALESCE(status, '')
          ) = 'rejected'
        ),
        0
      )
        AS rejected_revenue,

      COALESCE(
        SUM(
          COALESCE(
            annual_price,
            price,
            0
          )
        ) FILTER (
          WHERE LOWER(
            COALESCE(status, '')
          ) = 'closed'
        ),
        0
      )
        AS closed_revenue

    FROM organization_opportunities

    WHERE organization_id = $1
      AND COALESCE(is_active, true) = true
  `,
  [organizationId]
);

const opportunitySummary =
  opportunitySummaryResult.rows[0] || {};
      
const requestsBaseParams = () => {
  const params =
    new URLSearchParams();

  if (
    req.session.user?.role ===
    "super_admin"
  ) {
    params.set(
      "organization_id",
      String(organizationId)
    );
  }

  if (cleanSearch) {
    params.set(
      "search",
      cleanSearch
    );
  }

  if (selectedLocationId) {
    params.set(
      "location_id",
      String(selectedLocationId)
    );
  }

  return params;
};

const requestStatusUrl = status => {
  const params =
    requestsBaseParams();

  if (status && status !== "All") {
    params.set(
      "status",
      status
    );
  }

  const queryString =
    params.toString();

  return `/org-advertising-requests${
    queryString
      ? `?${queryString}`
      : ""
  }`;
};

const marketplaceUrl = status => {
  const params =
    new URLSearchParams();

  params.set(
    "organization_id",
    String(organizationId)
  );

  if (selectedLocationId) {
    params.set(
      "location_id",
      String(selectedLocationId)
    );
  }

  if (status) {
    params.set(
      "status",
      status
    );
  }

  return `/org-marketplace?${params.toString()}`;
};

const cardSelected = status =>
  selectedStatus === status
    ? " dashboard-summary-selected"
    : "";
 const infoIcon = text => `
  <span
    class="info-tooltip"
    tabindex="0"
    aria-label="${escapeHtml(text)}"
  >
    <span
      class="info-tooltip-icon"
      aria-hidden="true"
    >
      i
    </span>

    <span
      class="info-tooltip-content"
      role="tooltip"
    >
      ${escapeHtml(text)}
    </span>
  </span>
`;
      const formatMoney = value =>
  "$" + Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
      const formatDate = value => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};
const statusStyle = status => {
  if (status === "Approved") {
    return `
      background:#dcfce7;
      color:#166534;
    `;
  }

  if (status === "Rejected") {
    return `
      background:#fee2e2;
      color:#991b1b;
    `;
  }

  if (status === "Closed") {
    return `
      background:#dbeafe;
      color:#1e40af;
    `;
  }

  return `
    background:#fef3c7;
    color:#92400e;
  `;
};
      const statusOptions =
        allowedStatuses
          .map(status => `
            <option
              value="${status}"
              ${
                selectedStatus === status
                  ? "selected"
                  : ""
              }
            >
              ${status}
            </option>
          `)
          .join("");

      const locationOptions = [
        `
          <option value="">
            All Locations
          </option>
        `,
        ...locations.map(location => `
          <option
            value="${location.id}"
            ${
              Number(
                selectedLocationId
              ) === Number(location.id)
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              location.name
            )}
          </option>
        `)
      ].join("");

      const requestCards =
        requests.length
          ? requests
              .map(request => {
                const investmentLabel =
                  request.pricing_unit
                    ? `${formatMoney(
                        request.price
                      )} / ${escapeHtml(
                        String(
                          request.pricing_unit
                        ).replace(
                          /^Per\s+/i,
                          ""
                        )
                      )}`
                    : formatMoney(
                        request.price
                      );

                return `
                  <article
                    class="marketplace-card"
                    style="
                      display:flex;
                      flex-direction:column;
                      min-height:390px;
                    "
                  >
                    <div style="
                      display:flex;
                      justify-content:
                        space-between;
                      align-items:flex-start;
                      gap:14px;
                      margin-bottom:20px;
                    ">

                      <div>
                        <div style="
                          color:#65776b;
                          font-size:12px;
                          font-weight:bold;
                          letter-spacing:.06em;
                          text-transform:
                            uppercase;
                          margin-bottom:7px;
                        ">
                          Business
                        </div>

                        <h2 style="
                          margin:0;
                          color:#24382c;
                          font-size:22px;
                        ">
                          ${escapeHtml(
                            request.business_name
                          )}
                        </h2>
                      </div>

                      <span style="
                        ${statusStyle(
                          request.status
                        )}
                        padding:7px 11px;
                        border-radius:999px;
                        font-size:12px;
                        font-weight:bold;
                        white-space:nowrap;
                      ">
                        ${escapeHtml(
                          request.status ||
                          "Pending"
                        )}
                      </span>

                    </div>

                    <div class="
                      marketplace-label
                    ">
                      Advertising Opportunity
                    </div>

                    <div class="
                      marketplace-value
                    ">
                      ${escapeHtml(
                        request.opportunity_name
                      )}
                    </div>

                    <div class="
                      marketplace-label
                    ">
                      Location
                    </div>

                    <div class="
                      marketplace-value
                    ">
                      ${escapeHtml(
                        request.location_name
                      )}
                    </div>

                    <div class="
                      marketplace-label
                    ">
                      Submitted
                    </div>

                    <div class="
                      marketplace-value
                    ">
                      ${formatDate(
                        request.submitted_at
                      )}
                    </div>

                    <div class="
                      marketplace-label
                    ">
                      Investment
                    </div>

                    <div class="
                      marketplace-value
                    ">
                      ${investmentLabel}
                    </div>

                    <div class="
                      marketplace-label
                    ">
                      Contact
                    </div>

                    <div class="
                      marketplace-value
                    ">
                      ${escapeHtml(
                        request.contact_name
                      )}

                      <div style="
                        color:#65776b;
                        font-size:13px;
                        margin-top:3px;
                        overflow-wrap:anywhere;
                      ">
                        ${escapeHtml(
                          request.email
                        )}
                      </div>
                    </div>

                    <div style="
                      margin-top:auto;
                      padding-top:18px;
                      border-top:
                        1px solid #e7eee7;
                    ">
                      <a
                        class="marketplace-btn"
                        href="/org-advertising-request/${request.id}?organization_id=${organizationId}"
                        style="
                          display:block;
                          margin:0;
                          text-align:center;
                        "
                      >
                        Open Request
                      </a>
                    </div>

                  </article>
                `;
              })
              .join("")
          : `
              <div
                class="marketplace-card"
                style="
                  grid-column:1 / -1;
                  text-align:center;
                  padding:44px 28px;
                "
              >
                <h2 style="
                  margin:0 0 10px;
                ">
                  No Advertising Requests
                </h2>

                <p style="
                  color:#65776b;
                  line-height:1.6;
                  margin:0;
                ">
                  No requests match the
                  selected filters.
                </p>
              </div>
            `;

      const filterQuery = new URLSearchParams();

      if (cleanSearch) {
        filterQuery.set(
          "search",
          cleanSearch
        );
      }

      if (selectedStatus !== "All") {
        filterQuery.set(
          "status",
          selectedStatus
        );
      }

      if (selectedLocationId) {
        filterQuery.set(
          "location_id",
          String(
            selectedLocationId
          )
        );
      }

      if (
        req.session.user?.role ===
          "super_admin"
      ) {
        filterQuery.set(
          "organization_id",
          String(organizationId)
        );
      }

      const clearFiltersUrl =
        `/org-advertising-requests${
          req.session.user?.role ===
          "super_admin"
            ? `?organization_id=${organizationId}`
            : ""
        }`;

      return res.send(
        marketplacePage(
          `${organization.name} Advertising Requests`,
          `
            <div class="
              marketplace-topbar
            ">
              <div class="
                marketplace-brand
              ">
                Vivid Organizations
              </div>

              <h1>
                Advertising Requests
              </h1>

              <p class="
                marketplace-subtitle
              ">
                Review and manage
                advertising requests
                submitted through
                ${escapeHtml(
                  organization.name
                )}'s public Advertise
                With Us page.
              </p>
            </div>

            <main class="
              marketplace-wrap
            ">

              <div style="
                display:flex;
                justify-content:
                  space-between;
                align-items:center;
                gap:16px;
                flex-wrap:wrap;
                margin-bottom:24px;
              ">

                <div>
                  <span class="
                    marketplace-preview
                  ">
                    Revenue Pipeline
                  </span>

                  <h2 style="
                    margin:8px 0 0;
                  ">
                    ${escapeHtml(
                      organization.name
                    )}
                  </h2>
                </div>

                <div style="
                  display:flex;
                  gap:10px;
                  flex-wrap:wrap;
                ">
                  <a
                    class="
                      marketplace-btn
                      secondary
                    "
                    href="/org-marketplace?organization_id=${organizationId}"
                  >
                    Advertising Opportunities
                  </a>

                  <a
                    class="
                      marketplace-btn
                      secondary
                    "
                    href="/org-organization/${organizationId}"
                  >
                    Back to Organization
                  </a>
                </div>

              </div>

              <section class="dashboard-summary-grid">

  <!-- TOTAL OPPORTUNITIES -->

  <a
    href="${marketplaceUrl("")}"
    class="
      marketplace-card
      dashboard-summary-card
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Total Opportunities
      </span>

      ${infoIcon(
        "The total number of active advertising opportunities created by the organization."
      )}
    </div>

    <div class="dashboard-summary-number">
      ${Number(
        opportunitySummary.total_opportunities ||
        0
      )}
    </div>
  </a>

  <!-- AVAILABLE -->

  <a
    href="${marketplaceUrl("Available")}"
    class="
      marketplace-card
      dashboard-summary-card
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Available
      </span>

      ${infoIcon(
        "Advertising opportunities that are currently active and available for an advertiser to request."
      )}
    </div>

    <div class="dashboard-summary-number">
      ${Number(
        opportunitySummary.available_count ||
        0
      )}
    </div>
  </a>

  <!-- PENDING REVIEW -->

  <a
    href="${marketplaceUrl("Pending")}"
    class="
      marketplace-card
      dashboard-summary-card
      ${cardSelected("Pending")}
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Pending Review
      </span>

     ${infoIcon(
  "Advertising opportunities currently reserved while an advertiser request is being reviewed."
)}
    </div>

    <div class="dashboard-summary-number">
      ${Number(
        opportunitySummary.pending_count||
        0
      )}
    </div>
  </a>

  <!-- APPROVED -->

  <a
    href="${marketplaceUrl("Approved")}"
    class="
      marketplace-card
      dashboard-summary-card
      ${cardSelected("Approved")}
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Approved
      </span>

${infoIcon(
  "Advertising opportunities approved for an advertiser and awaiting final activation."
)}
    </div>

    <div class="dashboard-summary-number">
      ${Number(
       opportunitySummary.approved_count  ||
        0
      )}
    </div>
  </a>

  <!-- REJECTED -->

  <a
    href="${marketplaceUrl("Rejected")}"
    class="
      marketplace-card
      dashboard-summary-card
      ${cardSelected("Rejected")}
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Rejected
      </span>

      ${infoIcon(
  "Advertising opportunities currently marked as rejected."
)}
        
    
    </div>

    <div class="dashboard-summary-number">
      ${Number(
        opportunitySummary.rejected_count||
        0
      )}
    </div>
  </a>

  <!-- CLOSED -->

  <a
    href="${marketplaceUrl("Closed")}"
    class="
      marketplace-card
      dashboard-summary-card
      ${cardSelected("Closed")}
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Closed
      </span>

      ${infoIcon(
  "Advertising opportunities that completed the sales and setup process."
)}
        
      
    </div>

    <div class="dashboard-summary-number">
      ${Number(
        opportunitySummary.closed_count ||
        0
      )}
    </div>
  </a>

  <!-- TOTAL INVENTORY VALUE -->

  <a
    href="${marketplaceUrl("")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Total Inventory Value
      </span>

      ${infoIcon(
        "The combined listed value of all active advertising opportunities."
      )}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.total_inventory_value
      )}
    </div>
  </a>

  <!-- AVAILABLE REVENUE -->

  <a
    href="${marketplaceUrl("Available")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Available Revenue
      </span>

      ${infoIcon(
        "The combined value of all advertising opportunities that are currently available to sell."
      )}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.available_revenue
      )}
    </div>
  </a>

  <!-- PENDING REVENUE -->

  <a
    href="${marketplaceUrl("Pending")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
      
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Pending Revenue
      </span>

    ${infoIcon(
  "Advertising opportunities currently reserved while an advertiser request is being reviewed."
)}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.pending_revenue
      )}
    </div>
  </a>

  <!-- APPROVED REVENUE -->

  <a
    href="${marketplaceUrl("Approved")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
      
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Approved Revenue
      </span>

      ${infoIcon(
  "Advertising opportunities approved for an advertiser and awaiting final activation."
)}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.approved_revenue
      )}
    </div>
  </a>

  <!-- REJECTED REVENUE -->

  <a
    href="${marketplaceUrl("Rejected")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
      
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Rejected Revenue
      </span>

      ${infoIcon(
  "Advertising opportunities currently marked as rejected."
)}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.rejected_revenue
      )}
    </div>
  </a>

  <!-- CLOSED REVENUE -->

  <a
    href="${marketplaceUrl("Closed")}"
    class="
      marketplace-card
      dashboard-summary-card
      dashboard-revenue-card
      
    "
  >
    <div class="
      marketplace-label
      summary-label
    ">
      <span>
        Closed Revenue
      </span>

      ${infoIcon(
  "Advertising opportunities that completed the sales and setup process."
)}
    </div>

    <div class="dashboard-summary-revenue">
      ${formatMoney(
        opportunitySummary.closed_revenue
      )}
    </div>
  </a>

</section>


              <section
                class="marketplace-card"
                style="margin-bottom:24px;"
              >

                <form
                  method="GET"
                  action="/org-advertising-requests"
                >

                  ${
                    req.session.user?.role ===
                    "super_admin"
                      ? `
                          <input
                            type="hidden"
                            name="organization_id"
                            value="${organizationId}"
                          >
                        `
                      : ""
                  }

                  <div style="
                    display:grid;
                    grid-template-columns:
                      minmax(240px,2fr)
                      minmax(170px,1fr)
                      minmax(220px,1fr)
                      auto;
                    gap:14px;
                    align-items:end;
                  ">

                    <div>
                      <label style="
                        display:block;
                        font-size:12px;
                        font-weight:bold;
                        color:#65776b;
                        margin-bottom:7px;
                      ">
                        Search
                      </label>

                      <input
                        type="search"
                        name="search"
                        value="${escapeHtml(
                          cleanSearch
                        )}"
                        placeholder="Business, contact, email or campaign"
                        style="
                          width:100%;
                          padding:12px 14px;
                          border:
                            1px solid #d7dfd8;
                          border-radius:10px;
                          font-size:15px;
                          background:white;
                          box-sizing:
                            border-box;
                        "
                      >
                    </div>

                    <div>
                      <label style="
                        display:block;
                        font-size:12px;
                        font-weight:bold;
                        color:#65776b;
                        margin-bottom:7px;
                      ">
                        Status
                      </label>

                      <select
                        name="status"
                        style="
                          width:100%;
                          padding:12px 14px;
                          border:
                            1px solid #d7dfd8;
                          border-radius:10px;
                          font-size:15px;
                          background:white;
                          box-sizing:
                            border-box;
                        "
                      >
                        ${statusOptions}
                      </select>
                    </div>

                    <div>
                      <label style="
                        display:block;
                        font-size:12px;
                        font-weight:bold;
                        color:#65776b;
                        margin-bottom:7px;
                      ">
                        Location
                      </label>

                      <select
                        name="location_id"
                        style="
                          width:100%;
                          padding:12px 14px;
                          border:
                            1px solid #d7dfd8;
                          border-radius:10px;
                          font-size:15px;
                          background:white;
                          box-sizing:
                            border-box;
                        "
                      >
                        ${locationOptions}
                      </select>
                    </div>

                    <div style="
                      display:flex;
                      gap:9px;
                    ">
                      <button
                        type="submit"
                        class="marketplace-btn"
                        style="
                          border:0;
                          cursor:pointer;
                          margin:0;
                        "
                      >
                        Apply
                      </button>

                      <a
                        href="${clearFiltersUrl}"
                        class="
                          marketplace-btn
                          secondary
                        "
                        style="margin:0;"
                      >
                        Clear
                      </a>
                    </div>

                  </div>

                </form>

              </section>

              <div style="
                display:flex;
                justify-content:
                  space-between;
                align-items:center;
                gap:12px;
                margin-bottom:16px;
              ">
                <h2 style="margin:0;">
                  Requests
                </h2>

                <div style="
                  color:#65776b;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${
                    requests.length === 1
                      ? "1 request"
                      : `${requests.length} requests`
                  }
                </div>
              </div>

              <section
                class="marketplace-grid"
                style="
                  margin:0;
                  align-items:stretch;
                "
              >
                ${requestCards}
              </section>

            </main>

            <style>
            .summary-label {
  display:flex;
  align-items:center;
  gap:7px;
}

.info-tooltip {
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  outline:none;
}

.info-tooltip-icon {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:17px;
  height:17px;
  border:1.5px solid #65776b;
  border-radius:50%;
  color:#65776b;
  font-size:11px;
  font-weight:bold;
  font-family:Arial, sans-serif;
  line-height:1;
  cursor:help;
  text-transform:none;
  letter-spacing:0;
}

.info-tooltip-content {
  position:absolute;
  left:50%;
  bottom:calc(100% + 10px);
  z-index:100;

  width:260px;
  padding:11px 13px;

  background:#24382c;
  color:white;

  border-radius:9px;
  box-shadow:
    0 8px 24px
    rgba(0,0,0,.18);

  font-size:13px;
  font-weight:normal;
  line-height:1.45;
  letter-spacing:0;
  text-transform:none;
  text-align:left;

  opacity:0;
  visibility:hidden;
  pointer-events:none;

  transform:
    translateX(-50%)
    translateY(4px);

  transition:
    opacity .15s ease,
    transform .15s ease,
    visibility .15s ease;
}

.info-tooltip-content::after {
  content:"";
  position:absolute;
  top:100%;
  left:50%;
  transform:translateX(-50%);

  border-width:6px;
  border-style:solid;
  border-color:
    #24382c
    transparent
    transparent
    transparent;
}

.info-tooltip:hover
.info-tooltip-content,
.info-tooltip:focus
.info-tooltip-content,
.info-tooltip:focus-within
.info-tooltip-content {
  opacity:1;
  visibility:visible;

  transform:
    translateX(-50%)
    translateY(0);
}

.info-tooltip:focus
.info-tooltip-icon {
  outline:2px solid #2f855a;
  outline-offset:2px;
}
.dashboard-summary-grid {
  display:grid;
  grid-template-columns:
    repeat(6, minmax(0, 1fr));
  gap:16px;
  margin-bottom:24px;
}

.dashboard-summary-card {
  display:block;
  min-width:0;
  min-height:138px;
  padding:22px;
  color:inherit;
  text-decoration:none;
  transition:
    transform .15s ease,
    box-shadow .15s ease,
    border-color .15s ease;
}

.dashboard-summary-card:hover {
  transform:translateY(-2px);
  box-shadow:
    0 12px 30px
    rgba(22, 63, 39, .13);
}

.dashboard-summary-card:focus {
  outline:
    3px solid
    rgba(47, 133, 90, .28);
  outline-offset:2px;
}

.dashboard-summary-selected {
  border:
    2px solid
    #2f855a !important;
  background:#f2faf4;
}

.dashboard-summary-number {
  margin-top:13px;
  color:#0b4a2d;
  font-size:34px;
  font-weight:800;
  line-height:1;
}

.dashboard-summary-revenue {
  margin-top:13px;
  color:#0b4a2d;
  font-size:27px;
  font-weight:800;
  line-height:1.1;
}

.dashboard-revenue-card {
  background:#f9fcfa;
}
              @media (
                max-width:900px
              ) {
                form > div {
                  grid-template-columns:
                    1fr !important;
                }
              }
            </style>
          `
        )
      );

    } catch (err) {
      console.error(
        "ORGANIZATION ADVERTISING REQUESTS ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load Advertising Requests: " +
        err.message
      );
    }
  }
);
/*
=========================================================
ORGANIZATION ADVERTISING REQUEST DETAIL

Single request review page.

Sources of truth:

organization_advertising_requests
- advertiser submission
- contact information
- campaign information
- submission date
- request workflow information

organization_opportunities
- opportunity identity
- current inventory status
- current inventory price

Supports:
- Organization Portal users
- Super Admin users
=========================================================
*/

app.get(
  "/org-advertising-request/:requestId",
  async (req, res) => {
    try {
      const requestId = Number(
        req.params.requestId
      );

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).send(
          "A valid advertising request is required."
        );
      }

      let organizationId = null;

      /*
        Organization Portal access.
      */
      if (
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin access.
      */
      if (
        !organizationId &&
        req.session.user?.role ===
          "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Advertising Request access denied."
        );
      }

      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const formatMoney = value =>
        "$" +
        Number(value || 0).toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }
        );

      const formatDate = value => {
        if (!value) {
          return "—";
        }

        const date = new Date(value);

        if (
          Number.isNaN(date.getTime())
        ) {
          return "—";
        }

        return date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric"
          }
        );
      };

      /*
        One query supplies the complete detail page.

        Request fields come from r.
        Current opportunity fields come from oo.
      */
      const detailResult = await q(
        `
          SELECT
            r.id AS request_id,
            r.organization_id,
            r.location_id,
            r.opportunity_id,

            o.name AS organization_name,
            s.name AS location_name,

            COALESCE(
              oo.title,
              r.opportunity_name
            ) AS opportunity_name,

            COALESCE(
              oo.description,
              r.opportunity_description
            ) AS opportunity_description,

            COALESCE(
              oo.category,
              r.opportunity_category
            ) AS opportunity_category,

            COALESCE(
              oo.status,
              r.status
            ) AS opportunity_status,

            r.status AS request_status,

            COALESCE(
              oo.annual_price,
              oo.price,
              r.price,
              0
            ) AS price,

            COALESCE(
              oo.pricing_unit,
              r.pricing_unit
            ) AS pricing_unit,

            r.business_name,
            r.contact_name,
            r.email,
            r.phone,
            r.website,
            r.business_category,

            r.campaign_name,
            r.destination_url,
            r.campaign_notes,

            r.setup_status,
            r.internal_notes,
            r.rejection_reason,

            r.submitted_at,
            r.approved_at,
            r.rejected_at,
            r.setup_started_at,
            r.setup_completed_at

          FROM organization_advertising_requests r

          JOIN organizations o
            ON o.id = r.organization_id

          LEFT JOIN spaces s
            ON s.id = r.location_id
           AND s.organization_id =
               r.organization_id

          LEFT JOIN organization_opportunities oo
            ON oo.id = r.opportunity_id
           AND oo.organization_id =
               r.organization_id
           AND oo.space_id =
               r.location_id

          WHERE r.id = $1
            AND r.organization_id = $2

          LIMIT 1
        `,
        [
          requestId,
          organizationId
        ]
      );

      const request =
        detailResult.rows[0];

      if (!request) {
        return res.status(404).send(
          "Advertising request not found."
        );
      }

      const pricingUnit =
        String(
          request.pricing_unit || ""
        )
          .replace(/^Per\s+/i, "")
          .trim();

      const investmentLabel =
        pricingUnit
          ? `${formatMoney(
              request.price
            )} / ${escapeHtml(
              pricingUnit
            )}`
          : formatMoney(
              request.price
            );

      const status =
        request.opportunity_status ||
        request.request_status ||
        "Pending";

      const backUrl =
        `/org-advertising-requests${
          req.session.user?.role ===
          "super_admin"
            ? `?organization_id=${organizationId}`
            : ""
        }`;

      return res.send(
        marketplacePage(
          `${request.business_name} Advertising Request`,
          `
            <div class="marketplace-topbar">

              <div class="marketplace-brand">
                Vivid Organizations
              </div>

              <h1>
                Advertising Request
              </h1>

              <p class="marketplace-subtitle">
                Review the advertiser submission and
                selected advertising opportunity.
              </p>

            </div>

            <main class="marketplace-wrap">

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:16px;
                flex-wrap:wrap;
                margin-bottom:24px;
              ">

                <div>
                  <span class="marketplace-preview">
                    ${escapeHtml(status)}
                  </span>

                  <h2 style="
                    margin:8px 0 0;
                    font-size:30px;
                  ">
                    ${escapeHtml(
                      request.business_name
                    )}
                  </h2>
                </div>

                <a
                  class="
                    marketplace-btn
                    secondary
                  "
                  href="${backUrl}"
                >
                  Back to Advertising Requests
                </a>

              </div>

              <section
                class="marketplace-grid"
                style="
                  grid-template-columns:
                    repeat(
                      auto-fit,
                      minmax(300px,1fr)
                    );
                "
              >

                <article class="marketplace-card">

                  <h2 style="margin-top:0;">
                    Advertising Opportunity
                  </h2>

                  <div class="marketplace-label">
                    Opportunity
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.opportunity_name
                    )}
                  </div>

                  <div class="marketplace-label">
                    Organization
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.organization_name
                    )}
                  </div>

                  <div class="marketplace-label">
                    Location
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.location_name ||
                      "Not assigned"
                    )}
                  </div>

                  <div class="marketplace-label">
                    Investment
                  </div>

                  <div class="marketplace-value">
                    ${investmentLabel}
                  </div>

                  <div class="marketplace-label">
                    Current Opportunity Status
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(status)}
                  </div>

                  ${
                    request.opportunity_description
                      ? `
                          <div class="marketplace-label">
                            Description
                          </div>

                          <div style="
                            line-height:1.6;
                            color:#52645a;
                          ">
                            ${escapeHtml(
                              request.opportunity_description
                            )}
                          </div>
                        `
                      : ""
                  }

                </article>

                <article class="marketplace-card">

                  <h2 style="margin-top:0;">
                    Business Information
                  </h2>

                  <div class="marketplace-label">
                    Business
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.business_name
                    )}
                  </div>

                  <div class="marketplace-label">
                    Contact
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.contact_name
                    )}
                  </div>

                  <div class="marketplace-label">
                    Email
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.email
                    )}
                  </div>

                  <div class="marketplace-label">
                    Phone
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.phone
                    )}
                  </div>

                  ${
                    request.website
                      ? `
                          <div class="marketplace-label">
                            Website
                          </div>

                          <div class="marketplace-value">
                            ${escapeHtml(
                              request.website
                            )}
                          </div>
                        `
                      : ""
                  }

                  ${
                    request.business_category
                      ? `
                          <div class="marketplace-label">
                            Business Category
                          </div>

                          <div class="marketplace-value">
                            ${escapeHtml(
                              request.business_category
                            )}
                          </div>
                        `
                      : ""
                  }

                </article>

                <article class="marketplace-card">

                  <h2 style="margin-top:0;">
                    Campaign Information
                  </h2>

                  <div class="marketplace-label">
                    Campaign
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.campaign_name ||
                      "Not provided"
                    )}
                  </div>

                  <div class="marketplace-label">
                    Destination URL
                  </div>

                  <div style="
                    overflow-wrap:anywhere;
                    line-height:1.5;
                    margin-bottom:18px;
                  ">
                    ${escapeHtml(
                      request.destination_url ||
                      "Not provided"
                    )}
                  </div>

                  <div class="marketplace-label">
                    Campaign Notes
                  </div>

                  <div style="
                    line-height:1.6;
                    color:#52645a;
                  ">
                    ${escapeHtml(
                      request.campaign_notes ||
                      "No campaign notes provided."
                    )}
                  </div>

                </article>

                <article class="marketplace-card">

                  <h2 style="margin-top:0;">
                    Request Workflow
                  </h2>

                  <div class="marketplace-label">
                    Request ID
                  </div>

                  <div class="marketplace-value">
                    ${request.request_id}
                  </div>

                  <div class="marketplace-label">
                    Request Status
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.request_status
                    )}
                  </div>

                  <div class="marketplace-label">
                    Setup Status
                  </div>

                  <div class="marketplace-value">
                    ${escapeHtml(
                      request.setup_status ||
                      "Not Started"
                    )}
                  </div>

                  <div class="marketplace-label">
                    Submitted
                  </div>

                  <div class="marketplace-value">
                    ${formatDate(
                      request.submitted_at
                    )}
                  </div>

                  ${
                    request.approved_at
                      ? `
                          <div class="marketplace-label">
                            Approved
                          </div>

                          <div class="marketplace-value">
                            ${formatDate(
                              request.approved_at
                            )}
                          </div>
                        `
                      : ""
                  }

                  ${
                    request.rejected_at
                      ? `
                          <div class="marketplace-label">
                            Rejected
                          </div>

                          <div class="marketplace-value">
                            ${formatDate(
                              request.rejected_at
                            )}
                          </div>
                        `
                      : ""
                  }

                </article>

                            </section>

              ${
                request.request_status === "Pending"
                  ? `
                    <section
                      class="marketplace-card"
                      style="
                        margin-top:22px;
                        border-left:6px solid #2f7d46;
                      "
                    >
                      <h2 style="margin-top:0;">
                        Review Decision
                      </h2>

                      <p style="
                        color:#52645a;
                        line-height:1.6;
                      ">
                        Approving this request will create or connect
                        the advertiser's Vivid Core account and generate
                        a secure setup link.
                      </p>

                      <div style="
                        display:flex;
                        gap:12px;
                        flex-wrap:wrap;
                        margin-top:18px;
                      ">
                        <form
                          method="POST"
                          action="/org-advertising-request/${request.request_id}/approve"
                          style="margin:0;"
                        >
                          <input
                            type="hidden"
                            name="organization_id"
                            value="${organizationId}"
                          >

                          <button
                            type="submit"
                            class="marketplace-btn"
                            onclick="return confirm('Approve this advertising request and create the advertiser Vivid account?')"
                          >
                            Approve Request
                          </button>
                        </form>

                        <form
                          method="POST"
                          action="/org-advertising-request/${request.request_id}/reject"
                          style="margin:0;"
                        >
                          <input
                            type="hidden"
                            name="organization_id"
                            value="${organizationId}"
                          >

                          <button
                            type="submit"
                            class="marketplace-btn secondary"
                            onclick="return confirm('Reject this advertising request?')"
                          >
                            Reject Request
                          </button>
                        </form>
                      </div>
                    </section>
                  `
                  : `
                    <section
                      class="marketplace-card"
                      style="
                        margin-top:22px;
                        border-left:6px solid #2f7d46;
                      "
                    >
                      <h2 style="margin-top:0;">
                        Request Decision
                      </h2>

                      <p style="
                        margin-bottom:0;
                        color:#52645a;
                      ">
                        This request is currently
                        <strong>
                          ${escapeHtml(request.request_status)}
                        </strong>.
                      </p>
                    </section>
                  `
              }

            </main>

        
          `
        )
      );

    } catch (err) {
      console.error(
        "ORGANIZATION ADVERTISING REQUEST DETAIL ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load Advertising Request: " +
        err.message
      );
    }
  }
);
app.get(
  "/org-marketplace",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal user access.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin access.
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
        return res.status(403).send(
          "Marketplace access denied."
        );
      }

      /*
        Marketplace only reads the existing organization.
        It does not modify Organization analytics.
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

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Organization not found."
        );
      }

      /*
        Marketplace reads existing location names only.
        No Marketplace data is written in this preview.
      */
      const locationsResult = await q(`
        SELECT
          id,
          name,
          location
        FROM spaces
        WHERE organization_id = $1
          AND COALESCE(is_archived, false) = false
        ORDER BY name
      `, [organizationId]);

const locations = locationsResult.rows;

/*
  Status filter sent from the Advertising Requests
  dashboard summary cards.
*/
const requestedStatus = String(
  req.query.status || "All"
).trim();

const allowedStatuses = [
  "All",
  "Available",
  "Pending",
  "Approved",
  "Rejected",
  "Closed"
];

const selectedStatus =
  allowedStatuses.includes(requestedStatus)
    ? requestedStatus
    : "All";

const requestedLocationId = Number(
  req.query.location_id
);

const selectedLocationId =
  Number.isInteger(requestedLocationId) &&
  requestedLocationId > 0 &&
  locations.some(
    location =>
      Number(location.id) ===
      requestedLocationId
  )
    ? requestedLocationId
    : Number(locations[0]?.id);

const selectedLocation =
  locations.find(
    location =>
      Number(location.id) ===
      Number(selectedLocationId)
  );

const selectedLocationName =
  selectedLocation?.name ||
  "No active location";

const locationOptions = locations
  .map(location => `
    <option
      value="${location.id}"
      ${
        Number(location.id) ===
        Number(selectedLocationId)
          ? "selected"
          : ""
      }
    >
      ${location.name}
    </option>
  `)
  .join("");

let opportunities = [];

if (
  Number.isInteger(selectedLocationId) &&
  selectedLocationId > 0
) {
  const opportunityParams = [
  organizationId,
  selectedLocationId
];

let opportunityStatusCondition = "";

if (selectedStatus !== "All") {
  opportunityParams.push(selectedStatus);

  opportunityStatusCondition = `
    AND oo.status = $${opportunityParams.length}
  `;
}

const opportunityResult = await q(`
  SELECT
    oo.id,
    oo.organization_id,
    oo.space_id,
    oo.qr_id,

    oo.title,
    oo.description,
    oo.category,

    oo.annual_price,
    oo.price,
    oo.pricing_unit,
    oo.suggested_term_length,
    oo.suggested_term_unit,

    oo.status,
    oo.display_order,
    oo.is_active,

    s.name AS location_name,
    qr.name AS qr_name

  FROM organization_opportunities oo

  JOIN spaces s
    ON s.id = oo.space_id
   AND s.organization_id = oo.organization_id

  LEFT JOIN qr_codes qr
    ON qr.id = oo.qr_id

  WHERE oo.organization_id = $1
    AND oo.space_id = $2
    AND COALESCE(oo.is_active, true) = true
    AND COALESCE(s.is_archived, false) = false

    ${opportunityStatusCondition}

  ORDER BY
    oo.display_order,
    oo.title
`, opportunityParams);



  opportunities = opportunityResult.rows;
}
    const opportunityCards =
  opportunities.length === 0
    ? `
      <div class="marketplace-card">
        <h3 style="margin-top:0;">
          No Opportunities
        </h3>

        <p style="
          color:#65776b;
          line-height:1.55;
          margin-bottom:0;
        ">
          ${
  selectedStatus === "All"
    ? `No advertising opportunities have been created for this location yet.`
    : `No ${selectedStatus.toLowerCase()} sponsorship opportunities were found for this location.`
}
        </p>
      </div>
    `
    : opportunities.map(opportunity => `
      <div class="marketplace-card">

        <div class="marketplace-label">
          Location
        </div>

        <div class="marketplace-value">
          ${opportunity.location_name}
        </div>

        <div class="marketplace-label">
          Advertising Opportunity
        </div>

        <div class="marketplace-value">
          ${opportunity.title}
        </div>

        <div class="marketplace-label">
          Category
        </div>

        <div class="marketplace-value">
          ${opportunity.category || "Not Set"}
        </div>

<div class="marketplace-label">
  Investment
</div>

<div class="marketplace-value">
  ${money(
    opportunity.price ??
    opportunity.annual_price
  )}
</div>

<div class="marketplace-label">
  Pricing
</div>

<div class="marketplace-value">
  ${opportunity.pricing_unit || "Custom"}
</div>

<div class="marketplace-label">
  Suggested Term
</div>

<div class="marketplace-value">
  ${
    Number(
      opportunity.suggested_term_length || 0
    ) > 0
      ? `${Number(
          opportunity.suggested_term_length
        )} ${
          opportunity.suggested_term_unit ||
          "Days"
        }`
      : "Custom"
  }
</div>
  <span class="marketplace-status">
  ${opportunity.status}
</span>

<div style="
  margin-top:18px;
  padding-top:14px;
  border-top:1px solid #e7eee7;
  display:flex;
  justify-content:flex-end;
">

  <a
    class="marketplace-btn"
    href="/org-opportunity/edit/${opportunity.id}?organization_id=${organizationId}"
    style="
      margin:0;
      padding:8px 14px;
      font-size:13px;
    "
  >
    Edit Opportunity
  </a>

</div>

</div>
`).join("");
      res.send(
        marketplacePage(
          `${organization.name} Advertise With Us`,
          `
            <div class="marketplace-topbar">

          <div class="marketplace-brand">
  Vivid Organizations
</div>

            <h1>
  Advertising Inventory
</h1>

            <p class="marketplace-subtitle">
  Create and manage sponsorship opportunities
  available across ${organization.name} locations.
</p>

            </div>

            <div class="marketplace-wrap">

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:16px;
                flex-wrap:wrap;
                margin-bottom:24px;
              ">

                <div>
             <span class="marketplace-preview">
  Internal Management
</span>

                  <h2 style="margin:0 0 6px;">
  Advertising Inventory
</h2>

           <div style="
  color:#65776b;
  line-height:1.5;
">
  Manage sponsorship opportunities available
  throughout your organization.
</div>
                </div>

            <div style="
  display:flex;
  gap:10px;
  flex-wrap:wrap;
">

  <a
    class="marketplace-btn"
    href="/org-advertising-requests?organization_id=${organizationId}"
  >
    Advertising Requests
  </a>

  <a
    class="marketplace-btn secondary"
    href="/org-organization/${organization.id}"
  >
    Back to ${organization.name}
  </a>

</div>

              <div class="marketplace-card" style="margin-bottom:24px;">

                <div style="
                  display:flex;
                  justify-content:space-between;
                  align-items:end;
                  gap:18px;
                  flex-wrap:wrap;
                  margin-bottom:24px;
                ">

                  <div style="
                    flex:1;
                    min-width:300px;
                    max-width:520px;
                  ">

                    <div style="
                      font-size:12px;
                      color:#65776b;
                      font-weight:bold;
                      margin-bottom:6px;
                    ">
                      Select School 
                    </div>

                  <form
  method="GET"
  action="/org-marketplace"
  style="margin:0;"
>
  <input
    type="hidden"
    name="organization_id"
    value="${organizationId}"
  >

  ${
    selectedStatus !== "All"
      ? `
          <input
            type="hidden"
            name="status"
            value="${selectedStatus}"
          >
        `
      : ""
  }

  <select
    name="location_id"
    onchange="this.form.submit()"
    style="
      width:100%;
      padding:12px 14px;
      border:1px solid #d7dfd8;
      border-radius:10px;
      font-size:15px;
      background:white;
      box-sizing:border-box;
      margin:0;
    "
  >
    ${locationOptions}
  </select>
</form>

                  </div>

                  <a
                    class="marketplace-btn"
                href="/org-opportunity/new?organization_id=${organization.id}&space_id=${selectedLocationId}"
                  >
                    + Add Sponsorship
                  </a>
<a
  class="marketplace-btn secondary"
  href="/org-opportunity-builder?organization_id=${organizationId}&location_id=${selectedLocationId}"
>
  Bulk Create
</a>
<a
  class="marketplace-btn secondary"
  href="/org-import-opportunities?organization_id=${organizationId}&location_id=${selectedLocationId}"
>
  Download Bulk Template
</a>
                </div>

                <h2 style="margin:0 0 6px;">
  ${
    selectedStatus === "All"
      ? "All Sponsorships"
      : `${selectedStatus} Sponsorships`
  }
</h2>

<div style="
  color:#65776b;
  margin-bottom:18px;
">
  ${selectedLocationName}
</div>
      

                <div class="marketplace-grid" style="margin:0;">
                  ${opportunityCards}
                </div>

              </div>
               

              <div class="marketplace-card">

                <h2 style="margin:0 0 7px;">
                  Public Advertiser Experience
                </h2>

                <p style="
                  color:#65776b;
                  line-height:1.55;
                  margin-top:0;
                ">
                  ${organization.name} will be able to place
                  an Advertise With Us button on its website.
                  Prospective advertisers complete a guided
                  onboarding process and submit their
                  selection for approval.
                </p>

                <div class="workflow-grid">

                  <div class="workflow-step">
                    Advertise With Us
                  </div>

                  <div class="workflow-step">
                    Choose Location
                  </div>

                  <div class="workflow-step">
                    Choose Opportunity
                  </div>

                  <div class="workflow-step">
                    Company Information
                  </div>

                  <div class="workflow-step">
                    Campaign Information
                  </div>

                  <div class="workflow-step">
                    Location Approval
                  </div>

                  <div class="workflow-step">
                    Added to Vivid
                  </div>

                </div>

              </div>

            </div>
          `
        )
      );

    } catch (err) {
      console.error(
        "MARKETPLACE PREVIEW ERROR:",
        err
      );

      res.status(500).send(
        "MARKETPLACE PREVIEW ERROR: " +
        err.message
      );
    }
  }
);
app.get(
  "/org-opportunities/bulk-template",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use their
        authenticated organization.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin uses the organization selected
        in the URL.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      const locationId = Number(
        req.query.location_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Template access denied."
        );
      }

      if (
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "Valid location is required."
        );
      }

      /*
        Reload the authoritative location from Vivid.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.organization_id,
          o.name AS organization_name

        FROM spaces s

        JOIN organizations o
          ON o.id = s.organization_id

        WHERE s.id = $1
          AND s.organization_id = $2
          AND COALESCE(
            s.is_archived,
            false
          ) = false
          AND COALESCE(
            o.is_active,
            true
          ) = true

        LIMIT 1
      `, [
        locationId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      const workbook =
        new ExcelJS.Workbook();
const validationSheet =
  workbook.addWorksheet("Validation Lists");

const pricingUnits = [
  "Per Day",
  "Per Week",
  "Per Month",
  "Per Quarter",
  "Per Year",
  "Per Campaign",
  "Per Event",
  "Custom"
];

const termUnits = [
  "Days",
  "Weeks",
  "Months",
  "Quarters",
  "Years",
  "Campaigns",
  "Events",
  "Issues",
  "Custom"
];

const availabilityOptions = [
  "Available",
  "Reserved",
  "Unavailable"
];

pricingUnits.forEach((value, index) => {
  validationSheet.getCell(index + 1, 1).value =
    value;
});

termUnits.forEach((value, index) => {
  validationSheet.getCell(index + 1, 2).value =
    value;
});

availabilityOptions.forEach((value, index) => {
  validationSheet.getCell(index + 1, 3).value =
    value;
});

/*
  Named ranges allow Excel dropdown validation
  to reference values stored on another worksheet.
*/
workbook.definedNames.add(
  "'Validation Lists'!$A$1:$A$8",
  "VividPricingUnits"
);

workbook.definedNames.add(
  "'Validation Lists'!$B$1:$B$9",
  "VividTermUnits"
);

workbook.definedNames.add(
  "'Validation Lists'!$C$1:$C$3",
  "VividAvailability"
);

/*
  Keep this sheet hidden from normal users.
  Use hidden—not veryHidden—until testing is complete.
*/
validationSheet.state = "hidden";
      workbook.creator = "Vivid";
      workbook.company = "Vivid";
      workbook.created = new Date();

      /*
        First worksheet is intentionally the import sheet
        because the upload reader uses worksheet 1.
      */
 const worksheet =
  workbook.addWorksheet(
    "Advertising Opportunities"
  );

      worksheet.columns = [
        {
          header: "Location ID",
          key: "location_id",
          width: 14
        },
        {
          header: "Location Name",
          key: "location_name",
          width: 34
        },
        {
          header: "Advertising Opportunity",
          key: "title",
          width: 34
        },
        {
          header: "Category",
          key: "category",
          width: 20
        },
        {
          header: "Description",
          key: "description",
          width: 44
        },
        {
          header: "Price",
          key: "price",
          width: 14
        },
        {
          header: "Pricing Unit",
          key: "pricing_unit",
          width: 20
        },
        {
          header: "Suggested Term Length",
          key: "term_length",
          width: 24
        },
        {
          header: "Suggested Term Unit",
          key: "term_unit",
          width: 23
        },
        {
          header: "Availability",
          key: "availability",
          width: 18
        },
        {
          header: "Display Order",
          key: "display_order",
          width: 16
        }
      ];

      /*
        Format the header row.
      */
      const headerRow =
        worksheet.getRow(1);

      headerRow.height = 28;
      headerRow.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF"
        }
      };

      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF176B3A"
        }
      };

      headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true
      };

      /*
        Create 100 ready-to-use rows.

        Location ID and Location Name are populated
        and locked by Vivid.

        All opportunity fields remain editable.
      */
      for (
        let rowNumber = 2;
        rowNumber <= 101;
        rowNumber += 1
      ) {
        const row =
          worksheet.getRow(rowNumber);

        row.getCell(1).value =
          location.id;

        row.getCell(2).value =
          location.name;

        /*
          Locked system-controlled cells.
        */
        row.getCell(1).protection = {
          locked: true
        };

        row.getCell(2).protection = {
          locked: true
        };

        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFE7ECE8"
          }
        };

        row.getCell(2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFE7ECE8"
          }
        };

        /*
          Editable opportunity fields: columns C through K.
        */
        for (
          let columnNumber = 3;
          columnNumber <= 11;
          columnNumber += 1
        ) {
          row.getCell(
            columnNumber
          ).protection = {
            locked: false
          };
        }
/*
  Helpful defaults.
  These are editable.
*/
row.getCell(7).value = "Per Year";
row.getCell(8).value = 12;
row.getCell(9).value = "Months";
row.getCell(10).value = "Available";

/*
  Organization chooses display order.
*/
row.getCell(11).value = null;
        /*
          Helpful defaults.
        */
     

        /*
          Pricing Unit dropdown.
        */
row.getCell(7).dataValidation = {
  type: "list",
  allowBlank: false,
  formulae: [
    "=VividPricingUnits"
  ],
  showErrorMessage: true,
  errorStyle: "error",
  errorTitle: "Invalid Pricing Unit",
  error:
    "Select a pricing unit from the dropdown."
};

row.getCell(9).dataValidation = {
  type: "list",
  allowBlank: false,
  formulae: [
    "=VividTermUnits"
  ],
  showErrorMessage: true,
  errorStyle: "error",
  errorTitle: "Invalid Term Unit",
  error:
    "Select a suggested term unit from the dropdown."
};

row.getCell(10).dataValidation = {
  type: "list",
  allowBlank: false,
  formulae: [
    "=VividAvailability"
  ],
  showErrorMessage: true,
  errorStyle: "error",
  errorTitle: "Invalid Availability",
  error:
    "Select an availability value from the dropdown."
};

        /*
          Availability dropdown.
        */
        row.getCell(10).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [
            '"Available,Reserved,Unavailable"'
          ],
          showErrorMessage: true,
          errorTitle: "Invalid Availability",
          error:
            "Select an availability value from the dropdown."
        };

        /*
          Price must be zero or greater.
        */
        row.getCell(6).dataValidation = {
          type: "decimal",
          operator: "greaterThanOrEqual",
          formulae: [0],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: "Invalid Price",
          error:
            "Price must be zero or greater."
        };

        /*
          Term length must be a positive whole number.
        */
        row.getCell(8).dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          formulae: [1],
          allowBlank: false,
          showErrorMessage: true,
          errorTitle: "Invalid Term Length",
          error:
            "Suggested Term Length must be 1 or greater."
        };

        /*
          Display order must be a positive whole number.
        */
        row.getCell(11).dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          formulae: [1],
          allowBlank: false,
          showErrorMessage: true,
          errorTitle: "Invalid Display Order",
          error:
            "Display Order must be 1 or greater."
        };
      }

      worksheet.views = [
        {
          state: "frozen",
          ySplit: 1
        }
      ];

      worksheet.autoFilter = {
        from: "A1",
        to: "K101"
      };

   /*
  Protect the worksheet.

  Locked cells cannot be edited.
  Unlocked opportunity cells remain editable.
*/

/*
await worksheet.protect(
  "vivid-import",
  {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    deleteRows: false,
    sort: true,
    autoFilter: true
  }
);
*/

/*
  Add a separate instruction worksheet.
*/
      const instructions =
        workbook.addWorksheet(
          "Instructions"
        );

      instructions.columns = [
        {
          key: "instruction",
          width: 110
        }
      ];

      instructions.addRow([
        "Vivid Advertising Opportunity Import Instructions"
      ]);

      instructions.addRow([
        ""
      ]);

      instructions.addRow([
        `Organization: ${location.organization_name}`
      ]);

      instructions.addRow([
        `Locked Location: ${location.name} — Location ID ${location.id}`
      ]);

      instructions.addRow([
        ""
      ]);

      instructions.addRow([
        "Do not change Location ID or Location Name. These fields are locked and mapped directly to Vivid."
      ]);

      instructions.addRow([
        "Complete only the editable Advertising Opportunity, Category, Description, Price, Pricing Unit, Suggested Term, Availability, and Display Order fields."
      ]);

      instructions.addRow([
        "Leave unused rows blank. Vivid will validate every completed row before importing anything."
      ]);

      instructions.getRow(1).font = {
        bold: true,
        size: 16
      };

      const safeOrganizationName =
        String(
          location.organization_name ||
          "organization"
        )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const safeLocationName =
        String(
          location.name ||
          "location"
        )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const filename =
        `${safeOrganizationName}-${safeLocationName}-advertising-opportunities.xlsx`;

      const buffer =
        await workbook.xlsx.writeBuffer();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      return res.send(
        Buffer.from(buffer)
      );

    } catch (err) {
      console.error(
        "EXCEL TEMPLATE ERROR:",
        err
      );

      return res.status(500).send(
        "EXCEL TEMPLATE ERROR: " +
        err.message
      );
    }
  }
);
 

app.get(
  "/org-import-opportunities",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Super Admin uses the organization explicitly
        selected in the URL.
      */
      if (
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      /*
        Organization Portal users use their
        authenticated organization.
      */
      if (
        !organizationId &&
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      const locationId = Number(
        req.query.location_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Import access denied."
        );
      }

      if (
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "Valid location is required."
        );
      }

      /*
        Reload the organization and location from Vivid.
        Do not trust names submitted through the URL.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.organization_id,

          o.name AS organization_name

        FROM spaces s

        JOIN organizations o
          ON o.id = s.organization_id

        WHERE s.id = $1
          AND s.organization_id = $2
          AND COALESCE(
            s.is_archived,
            false
          ) = false
          AND COALESCE(
            o.is_active,
            true
          ) = true

        LIMIT 1
      `, [
        locationId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      return res.send(
        marketplacePage(
          `Import Opportunities - ${location.name}`,
          `
            <div class="marketplace-topbar">

              <div class="marketplace-brand">
                Vivid Organizations
              </div>

              <h1>
                Import Advertising Opportunities
              </h1>

              <p class="marketplace-subtitle">
                Add multiple opportunities to
                ${location.name}'s advertising inventory.
              </p>

            </div>

            <div class="marketplace-wrap">

              <div
                class="marketplace-card"
                style="
                  max-width:900px;
                  margin:0 auto 22px;
                "
              >

                <div style="
                  font-size:12px;
                  color:#65776b;
                  font-weight:bold;
                  margin-bottom:7px;
                ">
                  ORGANIZATION
                </div>

                <div style="
                  font-size:20px;
                  font-weight:bold;
                  margin-bottom:20px;
                ">
                  ${location.organization_name}
                </div>

                <div style="
                  font-size:12px;
                  color:#65776b;
                  font-weight:bold;
                  margin-bottom:7px;
                ">
                  LOCKED LOCATION
                </div>

                <div style="
                  background:#f5f7f6;
                  border:1px solid #d7dfd8;
                  border-radius:12px;
                  padding:15px 17px;
                  margin-bottom:12px;
                ">

                  <div style="
                    font-size:17px;
                    font-weight:bold;
                  ">
                    ${location.name}
                  </div>

                  <div style="
                    color:#65776b;
                    font-size:13px;
                    margin-top:4px;
                  ">
                    Location ID: ${location.id}
                    ${
                      location.location
                        ? ` · ${location.location}`
                        : ""
                    }
                  </div>

                </div>

                <div style="
                  color:#65776b;
                  line-height:1.55;
                  font-size:14px;
                ">
                  This import is permanently mapped to the
                  location shown above. Location ID and
                  Location Name cannot be changed. Complete
                  only the editable advertising-opportunity
                  fields in the template.
                </div>

              </div>

              <div
                class="marketplace-card"
                style="
                  max-width:900px;
                  margin:0 auto 22px;
                "
              >

                <h2 style="
                  margin:0 0 8px;
                  font-size:22px;
                ">
                  Import Process
                </h2>

                <p style="
                  color:#65776b;
                  line-height:1.55;
                  margin:0 0 20px;
                ">
                  Vivid will validate every row before any
                  opportunity is added to Advertising Inventory.
                </p>

                <div class="workflow-grid">

                  <div class="workflow-step">
                    1. Download Template
                  </div>

                  <div class="workflow-step">
                    2. Complete Opportunities
                  </div>

                  <div class="workflow-step">
                    3. Upload File
                  </div>

                  <div class="workflow-step">
                    4. Validate
                  </div>

                  <div class="workflow-step">
                    5. Preview
                  </div>

                  <div class="workflow-step">
                    6. Confirm Import
                  </div>

                </div>

                <div style="
                  display:flex;
                  gap:12px;
                  flex-wrap:wrap;
                  margin-top:24px;
                ">

                  <a
                    class="marketplace-btn"
                    href="/org-opportunities/bulk-template?organization_id=${organizationId}&location_id=${location.id}"
                  >
                    Download Import Template
                  </a>

                 <form
  method="POST"
  action="/org-import-upload"
  enctype="multipart/form-data"
  style="
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
    margin:5px 8px 5px 0;
  "
>
  <input
    type="hidden"
    name="organization_id"
    value="${organizationId}"
  >

  <input
    type="hidden"
    name="location_id"
    value="${location.id}"
  >

  <input
    type="file"
    name="template_file"
    accept=".xlsx"
    required
    style="
      width:auto;
      max-width:310px;
      margin:0;
      background:white;
    "
  >

  <button
    class="marketplace-btn secondary"
    type="submit"
    style="margin:0;"
  >
    Upload Completed Template
  </button>
</form>

                  <a
                    class="marketplace-btn secondary"
                    href="/org-marketplace?organization_id=${organizationId}&location_id=${location.id}"
                  >
                    Back to Advertising Inventory
                  </a>

                </div>

              </div>

            </div>
          `
        )
      );

    } catch (err) {
      console.error(
        "IMPORT OPPORTUNITIES PAGE ERROR:",
        err
      );

      return res.status(500).send(
        "IMPORT OPPORTUNITIES PAGE ERROR: " +
        err.message
      );
    }
  }
);
app.post(
  "/org-import-upload",
  importUpload.single("template_file"),
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Super Admin uses the organization submitted
        by the organization-controlled import page.
      */
      if (
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.body.organization_id
        );
      }

      /*
        Organization Portal users always use their
        authenticated organization.
      */
      if (
        !organizationId &&
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      const locationId = Number(
        req.body.location_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Import access denied."
        );
      }

      if (
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "Valid location is required."
        );
      }

      if (!req.file) {
        return res.status(400).send(
          "Please select an Excel workbook."
        );
      }

      const originalName = String(
        req.file.originalname || ""
      );

      if (
        !originalName
          .toLowerCase()
          .endsWith(".xlsx")
      ) {
        return res.status(400).send(
          "Only .xlsx Excel workbooks are supported."
        );
      }

      /*
        Reload the authoritative organization and
        location from Vivid Core.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.organization_id,
          o.name AS organization_name

        FROM spaces s

        JOIN organizations o
          ON o.id = s.organization_id

        WHERE s.id = $1
          AND s.organization_id = $2
          AND COALESCE(
            s.is_archived,
            false
          ) = false
          AND COALESCE(
            o.is_active,
            true
          ) = true

        LIMIT 1
      `, [
        locationId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      /*
        Read the workbook from memory.
        Nothing is saved to disk or the database.
      */
      const workbook =
        new ExcelJS.Workbook();

      await workbook.xlsx.load(
        req.file.buffer
      );

      const worksheet =
        workbook.worksheets[0];

      if (!worksheet) {
        return res.status(400).send(
          "The workbook does not contain a worksheet."
        );
      }

      /*
        Count rows containing at least one value.
        Row 1 is treated as the column-header row.
      */
let dataRowCount = 0;

worksheet.eachRow(
  { includeEmpty: false },
  (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    /*
      A row is only considered an opportunity
      when Advertising Opportunity (column C)
      contains a value.
    */
    const opportunityTitle = String(
      row.getCell(3).value ?? ""
    ).trim();

    if (opportunityTitle) {
      dataRowCount += 1;
    }
  }
);

      return res.send(
        marketplacePage(
          `Workbook Read - ${location.name}`,
          `
            <div class="marketplace-topbar">

              <div class="marketplace-brand">
                Vivid Organizations
              </div>

              <h1>
                Workbook Read Successfully
              </h1>

              <p class="marketplace-subtitle">
                Vivid opened the workbook without
                importing or changing any records.
              </p>

            </div>

            <div class="marketplace-wrap">

              <div
                class="marketplace-card"
                style="
                  max-width:820px;
                  margin:0 auto;
                "
              >

                <h2 style="margin:0 0 20px;">
                  Upload Summary
                </h2>

                <div class="marketplace-label">
                  Organization
                </div>

                <div class="marketplace-value">
                  ${location.organization_name}
                </div>

                <div class="marketplace-label">
                  Locked Location
                </div>

                <div class="marketplace-value">
                  ${location.name}
                </div>

                <div class="marketplace-label">
                  Workbook
                </div>

                <div class="marketplace-value">
                  ${originalName}
                </div>

                <div class="marketplace-label">
                  First Worksheet
                </div>

                <div class="marketplace-value">
                  ${worksheet.name}
                </div>

                <div class="marketplace-label">
                  Worksheets Found
                </div>

                <div class="marketplace-value">
                  ${workbook.worksheets.length}
                </div>

                <div class="marketplace-label">
                  Opportunity Rows Found
                </div>

                <div class="marketplace-value">
                  ${dataRowCount}
                </div>

                <div style="
                  background:#f5f7f6;
                  border:1px solid #d7dfd8;
                  border-radius:12px;
                  padding:16px;
                  color:#65776b;
                  line-height:1.55;
                  margin:8px 0 22px;
                ">
                  This was a read-only test. No validation,
                  preview records, sponsorship opportunities,
                  QR placements, campaigns, or schedules were
                  created.
                </div>

                <a
                  class="marketplace-btn"
                  href="/org-import-opportunities?organization_id=${organizationId}&location_id=${location.id}"
                >
                  Back to Import
                </a>

                <a
                  class="marketplace-btn secondary"
                  href="/org-marketplace?organization_id=${organizationId}&location_id=${location.id}"
                >
                  Back to Advertising Inventory
                </a>

              </div>

            </div>
          `
        )
      );

    } catch (err) {
      console.error(
        "IMPORT WORKBOOK READ ERROR:",
        err
      );

      return res.status(500).send(
        "IMPORT WORKBOOK READ ERROR: " +
        err.message
      );
    }
  }
);
/*
=========================================================
ORGANIZATION OPPORTUNITY BUILDER
Vivid-native bulk creation workflow.
No database writes in this first version.
=========================================================
*/

app.get(
  "/org-opportunity-builder",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Super Admin uses the organization selected
        in the query string.
      */
      if (
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      /*
        Organization users always use the organization
        stored in their authenticated session.
      */
      if (
        !organizationId &&
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      const locationId = Number(
        req.query.location_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).send(
          "Opportunity Builder access denied."
        );
      }

      if (
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "Valid location is required."
        );
      }

      /*
        Reload the authoritative organization and
        location directly from Vivid.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.organization_id,
          o.name AS organization_name

        FROM spaces s

        JOIN organizations o
          ON o.id = s.organization_id

        WHERE s.id = $1
          AND s.organization_id = $2
          AND COALESCE(
            s.is_archived,
            false
          ) = false
          AND COALESCE(
            o.is_active,
            true
          ) = true

        LIMIT 1
      `, [
        locationId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      return res.send(
        marketplacePage(
          `Opportunity Builder - ${location.name}`,
          `
            <div class="marketplace-topbar">

              <div class="marketplace-brand">
                Vivid Organizations
              </div>

              <h1>
                Opportunity Builder
              </h1>

              <p class="marketplace-subtitle">
                Create multiple advertising opportunities
                for ${location.name}.
              </p>

            </div>

            <div class="marketplace-wrap">

              <div
                class="marketplace-card"
                style="
                  max-width:1100px;
                  margin:0 auto 22px;
                "
              >

                <div style="
                  font-size:12px;
                  color:#65776b;
                  font-weight:bold;
                  margin-bottom:7px;
                ">
                  ORGANIZATION
                </div>

                <div style="
                  font-size:19px;
                  font-weight:bold;
                  margin-bottom:18px;
                ">
                  ${location.organization_name}
                </div>

                <div style="
                  font-size:12px;
                  color:#65776b;
                  font-weight:bold;
                  margin-bottom:7px;
                ">
                  LOCKED LOCATION
                </div>

                <div style="
                  background:#f5f7f6;
                  border:1px solid #d7dfd8;
                  border-radius:12px;
                  padding:15px 17px;
                ">

                  <div style="
                    font-size:17px;
                    font-weight:bold;
                  ">
                    ${location.name}
                  </div>

                  <div style="
                    color:#65776b;
                    font-size:13px;
                    margin-top:4px;
                  ">
                    Location ID: ${location.id}
                    ${
                      location.location
                        ? ` · ${location.location}`
                        : ""
                    }
                  </div>

                </div>

              </div>

              <div
                id="opportunity-groups"
                style="
                  max-width:1100px;
                  margin:0 auto;
                "
              ></div>

              <div style="
                max-width:1100px;
                margin:20px auto 0;
                display:flex;
                gap:12px;
                flex-wrap:wrap;
              ">

                <button
                  type="button"
                  class="marketplace-btn"
                  id="add-opportunity-group"
                >
                  + Add Opportunity Group
                </button>

              <button
  type="button"
  class="marketplace-btn"
  id="create-builder-opportunities"
>
  Create Opportunities
</button>

                <a
                  class="marketplace-btn secondary"
                  href="/org-marketplace?organization_id=${organizationId}&location_id=${location.id}"
                >
                  Back to Advertising Inventory
                </a>

              </div>

            </div>

            <script>
              (() => {
                const groupsContainer =
                  document.getElementById(
                    "opportunity-groups"
                  );

                const addGroupButton =
                  document.getElementById(
                    "add-opportunity-group"
                  );
const createOpportunitiesButton =
  document.getElementById(
    "create-builder-opportunities"
  );
                let groupCounter = 0;

                const pricingUnits = [
                  "Per Day",
                  "Per Week",
                  "Per Month",
                  "Per Quarter",
                  "Per Year",
                  "Per Campaign",
                  "Per Event",
                  "Custom"
                ];

                const termUnits = [
                  "Days",
                  "Weeks",
                  "Months",
                  "Quarters",
                  "Years",
                  "Campaigns",
                  "Events",
                  "Issues",
                  "Custom"
                ];

                const statuses = [
                  "Available",
                  "Reserved",
                  "Unavailable"
                ];

                function buildOptions(
                  values,
                  selectedValue
                ) {
                  return values
                    .map(value => {
                      const selected =
                        value === selectedValue
                          ? "selected"
                          : "";

                      return \`
                        <option
                          value="\${value}"
                          \${selected}
                        >
                          \${value}
                        </option>
                      \`;
                    })
                    .join("");
                }

       function createOpportunityRow(
  groupId,
  rowNumber,
  defaults
) {
  const row =
    document.createElement("div");

  row.className =
    "builder-opportunity-row";

  row.dataset.groupId =
    String(groupId);

 row.style.cssText = \`
  display:grid;
grid-template-columns:
  135px    /* Area / Venue */
  205px    /* Placement */
  95px     /* Category */
  70px     /* Price */
  100px    /* Pricing Unit */
  50px     /* Term */
  90px     /* Term Unit */
  95px     /* Availability */
  40px     /* Order */
  110px;   /* Remove */

gap:6px;

align-items:end;

padding:14px 0;
  border-top:1px solid #e3e9e4;
\`;

  row.innerHTML = \`
    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:6px;
      ">
        Area / Venue
      </label>

      <input
        type="text"
        class="builder-group-name"
        value="\${defaults.groupName}"
        readonly
        style="
          margin:0;
          background:#f2f5f2;
          color:#4d5d53;
        "
      >
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:6px;
      ">
        Placement
      </label>

      <input
        type="text"
        class="builder-title"
        placeholder="Example: Home Side"
        style="margin:0;"
      >
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:6px;
      ">
        Category
      </label>

      <input
        type="text"
        class="builder-category"
        value="\${defaults.category}"
        readonly
        style="
          margin:0;
          background:#f2f5f2;
          color:#4d5d53;
        "
      >
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Price
      </label>

      <input
        type="number"
        class="builder-price"
        min="0"
        step="0.01"
        value="\${defaults.price}"
        style="margin:0;"
      >
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Pricing Unit
      </label>

      <select
        class="builder-pricing-unit"
        style="margin:0;"
      >
        \${buildOptions(
          pricingUnits,
          defaults.pricingUnit
        )}
      </select>
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Term
      </label>

      <input
        type="number"
        class="builder-term-length"
        min="1"
        step="1"
        value="\${defaults.termLength}"
        style="margin:0;"
      >
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Term Unit
      </label>

      <select
        class="builder-term-unit"
        style="margin:0;"
      >
        \${buildOptions(
          termUnits,
          defaults.termUnit
        )}
      </select>
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Availability
      </label>

      <select
        class="builder-status"
        style="margin:0;"
      >
        \${buildOptions(
          statuses,
          defaults.status
        )}
      </select>
    </div>

    <div>
      <label style="
        display:block;
        font-size:12px;
        font-weight:bold;
        margin-bottom:4px;
      ">
        Order#
      </label>

      <input
        type="number"
        class="builder-order"
        min="1"
        step="1"
        value="\${rowNumber}"
        style="margin:0;"
      >
    </div>

    <button
      type="button"
      class="marketplace-btn secondary remove-opportunity-row"
   style="
 margin-left:8px;
width:92px;
min-width:92px;
padding:10px 8px;
white-space:nowrap;
"
    >
      Remove
    </button>
  \`;

  row
    .querySelector(
      ".remove-opportunity-row"
    )
    .addEventListener(
      "click",
      () => {
        row.remove();
      }
    );

  return row;
}         
             

                function addGroup() {
                  groupCounter += 1;

                  const groupId =
                    groupCounter;

                  const group =
                    document.createElement("div");

                  group.className =
                    "marketplace-card";

                  group.style.cssText = \`
                    margin:0 0 22px;
                  \`;

                  group.innerHTML = \`
                    <div style="
                      display:flex;
                      justify-content:space-between;
                      gap:16px;
                      align-items:flex-start;
                      flex-wrap:wrap;
                      margin-bottom:20px;
                    ">

                      <div>
                        <h2 style="
                          margin:0 0 6px;
                          font-size:22px;
                        ">
                          Opportunity Group
                        </h2>

                        <div style="
                          color:#65776b;
                          font-size:14px;
                        ">
                          Define an area such as a football
                          stadium, lobby, pool or terminal.
                        </div>
                      </div>

                      <button
                        type="button"
                        class="marketplace-btn secondary delete-group"
                      >
                        Delete Group
                      </button>

                    </div>

                    <div style="
                      display:grid;
                      grid-template-columns:
                        repeat(4,minmax(0,1fr));
                      gap:16px;
                      margin-bottom:18px;
                    ">

                      <div>
                        <label style="
                          display:block;
                          font-weight:bold;
                          margin-bottom:7px;
                        ">
                          Area / Venue
                        </label>

                        <input
                          type="text"
                          class="group-name"
                          placeholder="Example: Football Stadium"
                          style="margin:0;"
                        >
                      </div>

                      <div>
                        <label style="
                          display:block;
                          font-weight:bold;
                          margin-bottom:7px;
                        ">
                          Category
                        </label>

                        <input
                          type="text"
                          class="group-category"
                          placeholder="Example: Athletics"
                          style="margin:0;"
                        >
                      </div>

                      <div>
                        <label style="
                          display:block;
                          font-weight:bold;
                          margin-bottom:7px;
                        ">
                          Default Placement Price
                        </label>

                        <input
                          type="number"
                          class="group-price"
                          min="0"
                          step="0.01"
                          value="0"
                          style="margin:0;"
                        >
                      </div>

                      <div>
                        <label style="
                          display:block;
                          font-weight:bold;
                          margin-bottom:7px;
                        ">
                          Number of Opportunities
                        </label>

                        <input
                          type="number"
                          class="group-count"
                          min="1"
                          max="100"
                          step="1"
                          value="1"
                          style="margin:0;"
                        >
                      </div>

                    </div>

                    <div style="
                      display:flex;
                      gap:10px;
                      flex-wrap:wrap;
                      margin-bottom:18px;
                    ">

                      <button
                        type="button"
                        class="marketplace-btn generate-group-rows"
                      >
                        Generate Opportunities
                      </button>

                      <button
                        type="button"
                        class="marketplace-btn secondary add-group-row"
                      >
                        + Add Placement
                      </button>

                    </div>

                    <div
                      class="group-rows"
                    ></div>
                  \`;

                  const rowsContainer =
                    group.querySelector(
                      ".group-rows"
                    );

             function getDefaults() {
  return {
    groupName:
      group.querySelector(
        ".group-name"
      ).value.trim(),

    category:
      group.querySelector(
        ".group-category"
      ).value.trim(),

    price:
      group.querySelector(
        ".group-price"
      ).value || "0",

    pricingUnit:
      "Per Year",

    termLength:
      12,

    termUnit:
      "Months",

    status:
      "Available"
  };
}

                  group
                    .querySelector(
                      ".generate-group-rows"
                    )
                    .addEventListener(
                      "click",
                      () => {
                        const requestedCount =
                          Number(
                            group.querySelector(
                              ".group-count"
                            ).value
                          );
const groupName =
  group.querySelector(
    ".group-name"
  ).value.trim();

if (!groupName) {
  alert(
    "Enter the Area / Venue before generating placements."
  );

  group.querySelector(
    ".group-name"
  ).focus();

  return;
}
                        if (
                          !Number.isInteger(
                            requestedCount
                          ) ||
                          requestedCount < 1 ||
                          requestedCount > 100
                        ) {
                          alert(
                            "Enter a number of opportunities between 1 and 100."
                          );

                          return;
                        }

                        rowsContainer.innerHTML =
                          "";

                        const defaults =
                          getDefaults();

                        for (
                          let rowNumber = 1;
                          rowNumber <= requestedCount;
                          rowNumber += 1
                        ) {
                          rowsContainer.appendChild(
                            createOpportunityRow(
                              groupId,
                              rowNumber,
                              defaults
                            )
                          );
                        }
                      }
                    );

                  group
                    .querySelector(
                      ".add-group-row"
                    )
                    .addEventListener(
                      "click",
                      () => {
const groupName =
  group.querySelector(
    ".group-name"
  ).value.trim();

if (!groupName) {
  alert(
    "Enter the Area / Venue before adding a placement."
  );

  group.querySelector(
    ".group-name"
  ).focus();

  return;
}
                        const currentCount =
                          rowsContainer.querySelectorAll(
                            ".builder-opportunity-row"
                          ).length;

                        rowsContainer.appendChild(
                          createOpportunityRow(
                            groupId,
                            currentCount + 1,
                            getDefaults()
                          )
                        );
                      }
                    );

                  group
                    .querySelector(
                      ".delete-group"
                    )
                    .addEventListener(
                      "click",
                      () => {
                        const groupName =
                          group.querySelector(
                            ".group-name"
                          ).value.trim() ||
                          "this opportunity group";

                        const confirmed =
                          window.confirm(
                            \`Delete \${groupName} and all of its unsaved opportunities?\`
                          );

                        if (confirmed) {
                          group.remove();
                        }
                      }
                    );

                  groupsContainer.appendChild(
                    group
                  );
                }
function collectBuilderData() {
  const groupElements =
    groupsContainer.querySelectorAll(
      ".marketplace-card"
    );

  const groups = [];
  const errors = [];

  groupElements.forEach(
    (group, groupIndex) => {
      const groupName =
        group.querySelector(
          ".group-name"
        )?.value.trim() || "";

      const category =
        group.querySelector(
          ".group-category"
        )?.value.trim() || "";

      const rowElements =
        group.querySelectorAll(
          ".builder-opportunity-row"
        );

      if (!groupName && rowElements.length === 0) {
        return;
      }

      if (!groupName) {
        errors.push(
          \`Group \${groupIndex + 1}: Area / Venue is required.\`
        );

        return;
      }

      if (rowElements.length === 0) {
        errors.push(
          \`\${groupName}: Generate at least one placement.\`
        );

        return;
      }

      const placements = [];

      rowElements.forEach(
        (row, rowIndex) => {
          const placement =
            row.querySelector(
              ".builder-title"
            )?.value.trim() || "";

          const price = Number(
            row.querySelector(
              ".builder-price"
            )?.value
          );

          const pricingUnit =
            row.querySelector(
              ".builder-pricing-unit"
            )?.value || "";

          const termLength = Number(
            row.querySelector(
              ".builder-term-length"
            )?.value
          );

          const termUnit =
            row.querySelector(
              ".builder-term-unit"
            )?.value || "";

          const status =
            row.querySelector(
              ".builder-status"
            )?.value || "";

          const displayOrder = Number(
            row.querySelector(
              ".builder-order"
            )?.value
          );

          const rowLabel =
            \`\${groupName}, placement \${rowIndex + 1}\`;

          if (!placement) {
            errors.push(
              \`\${rowLabel}: Placement is required.\`
            );
          }

          if (
            !Number.isFinite(price) ||
            price < 0
          ) {
            errors.push(
              \`\${rowLabel}: Price must be zero or greater.\`
            );
          }

          if (
            !Number.isInteger(termLength) ||
            termLength < 1
          ) {
            errors.push(
              \`\${rowLabel}: Term must be a whole number of 1 or greater.\`
            );
          }

          if (
            !Number.isInteger(displayOrder) ||
            displayOrder < 1
          ) {
            errors.push(
              \`\${rowLabel}: Order must be a whole number of 1 or greater.\`
            );
          }

          placements.push({
            placement,
            price,
            pricingUnit,
            termLength,
            termUnit,
            status,
            displayOrder
          });
        }
      );

      groups.push({
        groupName,
        category,
        placements
      });
    }
  );

  if (groups.length === 0) {
    errors.push(
      "Create at least one opportunity group."
    );
  }

  return {
    groups,
    errors
  };
}

createOpportunitiesButton.addEventListener(
  "click",
  async () => {
    const result =
      collectBuilderData();

    if (result.errors.length > 0) {
      alert(
        "Please correct the following:\\n\\n" +
        result.errors.join("\\n")
      );

      return;
    }

    const opportunityCount =
      result.groups.reduce(
        (total, group) =>
          total + group.placements.length,
        0
      );

    const confirmed =
      window.confirm(
        \`Create \${opportunityCount} advertising opportunities for ${location.name}?\`
      );

    if (!confirmed) {
      return;
    }

    createOpportunitiesButton.disabled =
      true;

    createOpportunitiesButton.textContent =
      "Creating Opportunities...";

    try {
      const formData =
        new URLSearchParams();

      formData.set(
        "organization_id",
        "${organizationId}"
      );

      formData.set(
        "location_id",
        "${location.id}"
      );

      formData.set(
        "builder_payload",
        JSON.stringify(result.groups)
      );

      const response = await fetch(
        "/org-opportunity-builder/save",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8"
          },

          body: formData.toString()
        }
      );

      const responseText =
        await response.text();

      if (!response.ok) {
        throw new Error(
          responseText ||
          "Unable to create opportunities."
        );
      }

      window.location.href =
        responseText;

    } catch (err) {
      alert(
        "CREATE OPPORTUNITIES ERROR: " +
        err.message
      );

      createOpportunitiesButton.disabled =
        false;

      createOpportunitiesButton.textContent =
        "Create Opportunities";
    }
  }
);
                addGroupButton.addEventListener(
                  "click",
                  addGroup
                );

                /*
                  Open the builder with one blank group.
                */
                addGroup();
              })();
            </script>
          `
        )
      );

    } catch (err) {
      console.error(
        "OPPORTUNITY BUILDER PAGE ERROR:",
        err
      );

      return res.status(500).send(
        "OPPORTUNITY BUILDER PAGE ERROR: " +
        err.message
      );
    }
  }
);
app.post(
  "/org-opportunity-builder/save",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization users are always restricted
        to their authenticated organization.
      */
      if (
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin may submit the organization
        selected in the Builder.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.body.organization_id
        );
      }

      const locationId = Number(
        req.body.location_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "Valid organization and location are required."
        );
      }

      /*
        Confirm the location still belongs to the
        selected organization.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          organization_id

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        locationId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      let groups;

      try {
        groups = JSON.parse(
          String(
            req.body.builder_payload || ""
          )
        );
      } catch (parseErr) {
        return res.status(400).send(
          "Invalid Opportunity Builder submission."
        );
      }

      if (
        !Array.isArray(groups) ||
        groups.length === 0
      ) {
        return res.status(400).send(
          "At least one opportunity group is required."
        );
      }

      const allowedPricingUnits = [
        "Per Day",
        "Per Week",
        "Per Month",
        "Per Quarter",
        "Per Year",
        "Per Campaign",
        "Per Event",
        "Custom"
      ];

      const allowedTermUnits = [
        "Days",
        "Weeks",
        "Months",
        "Quarters",
        "Years",
        "Campaigns",
        "Events",
        "Issues",
        "Custom"
      ];

      const allowedStatuses = [
        "Available",
        "Reserved",
        "Unavailable"
      ];

      const records = [];
      const submittedTitles =
        new Set();

      for (const group of groups) {
        const opportunityGroup =
          String(
            group?.groupName || ""
          ).trim();

        const category =
          String(
            group?.category || ""
          ).trim();

        if (!opportunityGroup) {
          return res.status(400).send(
            "Every opportunity group requires an Area / Venue."
          );
        }

        if (
          !Array.isArray(group?.placements) ||
          group.placements.length === 0
        ) {
          return res.status(400).send(
            `${opportunityGroup} requires at least one placement.`
          );
        }

        for (
          const submittedPlacement
          of group.placements
        ) {
          const placement =
            String(
              submittedPlacement?.placement ||
              ""
            ).trim();

          const price = Number(
            submittedPlacement?.price
          );

          const pricingUnit =
            String(
              submittedPlacement?.pricingUnit ||
              ""
            ).trim();

          const termLength = Number(
            submittedPlacement?.termLength
          );

          const termUnit =
            String(
              submittedPlacement?.termUnit ||
              ""
            ).trim();

          const status =
            String(
              submittedPlacement?.status ||
              ""
            ).trim();

          const displayOrder = Number(
            submittedPlacement?.displayOrder
          );

          if (!placement) {
            return res.status(400).send(
              `${opportunityGroup} contains a placement without a name.`
            );
          }

          if (
            !Number.isFinite(price) ||
            price < 0
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid price.`
            );
          }

          if (
            !allowedPricingUnits.includes(
              pricingUnit
            )
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid pricing unit.`
            );
          }

          if (
            !Number.isInteger(termLength) ||
            termLength < 1
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid term.`
            );
          }

          if (
            !allowedTermUnits.includes(
              termUnit
            )
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid term unit.`
            );
          }

          if (
            !allowedStatuses.includes(status)
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid availability.`
            );
          }

          if (
            !Number.isInteger(displayOrder) ||
            displayOrder < 1
          ) {
            return res.status(400).send(
              `${opportunityGroup} — ${placement} has an invalid display order.`
            );
          }

          const title =
            `${opportunityGroup} — ${placement}`;

          const normalizedTitle =
            title.toLowerCase();

          if (
            submittedTitles.has(
              normalizedTitle
            )
          ) {
            return res.status(409).send(
              `Duplicate opportunity in this submission: ${title}`
            );
          }

          submittedTitles.add(
            normalizedTitle
          );

          records.push({
            opportunityGroup,
            placement,
            title,
            category,
            price,
            pricingUnit,
            termLength,
            termUnit,
            status,
            displayOrder
          });
        }
      }

      if (records.length === 0) {
        return res.status(400).send(
          "No completed opportunities were submitted."
        );
      }

      /*
        Check the existing Marketplace inventory
        before inserting anything.
      */
      const existingResult = await q(`
        SELECT title

        FROM organization_opportunities

        WHERE organization_id = $1
          AND space_id = $2
          AND COALESCE(
            is_active,
            true
          ) = true
      `, [
        organizationId,
        locationId
      ]);

      const existingTitles =
        new Set(
          existingResult.rows.map(row =>
            String(
              row.title || ""
            )
              .trim()
              .toLowerCase()
          )
        );

      const duplicateRecord =
        records.find(record =>
          existingTitles.has(
            record.title.toLowerCase()
          )
        );

      if (duplicateRecord) {
        return res.status(409).send(
          `An active opportunity already exists: ${duplicateRecord.title}`
        );
      }

      const createdBy =
        req.session.orgUser?.id ||
        req.session.user?.id ||
        null;

      /*
        Build one parameterized multi-row INSERT.
        PostgreSQL executes this as one statement:
        either all rows insert or none do.
      */
      const values = [];
      const placeholders =
        records.map(
          (record, recordIndex) => {
            const offset =
              recordIndex * 16;

            values.push(
              organizationId,
              locationId,
              null,
              record.opportunityGroup,
              record.placement,
              record.title,
              null,
              record.category || null,
              record.price,
              record.price,
              record.pricingUnit,
              record.termLength,
              record.termUnit,
              record.status,
              record.displayOrder,
              createdBy
            );

            return `(
              $${offset + 1},
              $${offset + 2},
              $${offset + 3},
              $${offset + 4},
              $${offset + 5},
              $${offset + 6},
              $${offset + 7},
              $${offset + 8},
              $${offset + 9},
              $${offset + 10},
              $${offset + 11},
              $${offset + 12},
              $${offset + 13},
              $${offset + 14},
              $${offset + 15},
              true,
              $${offset + 16},
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )`;
          }
        );

      await q(`
        INSERT INTO organization_opportunities (
          organization_id,
          space_id,
          qr_id,
          opportunity_group,
          placement,
          title,
          description,
          category,
          annual_price,
          price,
          pricing_unit,
          suggested_term_length,
          suggested_term_unit,
          status,
          display_order,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES
          ${placeholders.join(",")}
      `, values);

      return res.send(
        `/org-marketplace?organization_id=${organizationId}&location_id=${locationId}&builder_created=${records.length}`
      );

    } catch (err) {
      console.error(
        "SAVE OPPORTUNITY BUILDER ERROR:",
        err
      );

      return res.status(500).send(
        "SAVE OPPORTUNITY BUILDER ERROR: " +
        err.message
      );
    }
  }
);
app.get(
  "/org-opportunity/new",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal user access.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin access.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      const spaceId = Number(
        req.query.space_id
      );

      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(spaceId) ||
        spaceId <= 0
      ) {
        return res.status(400).send(
          "Valid organization and location are required."
        );
      }

      /*
        Confirm that the selected location belongs
        to the selected organization.
      */
      const locationResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,
          s.organization_id,
          o.name AS organization_name

        FROM spaces s

        JOIN organizations o
          ON o.id = s.organization_id

        WHERE s.id = $1
          AND s.organization_id = $2
          AND COALESCE(
            s.is_archived,
            false
          ) = false
          AND COALESCE(
            o.is_active,
            true
          ) = true

        LIMIT 1
      `, [
        spaceId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      /*
        Existing QR placements are optional.
        The opportunity may be created before
        a physical QR placement exists.
      */
      const qrResult = await q(`
        SELECT
          qr.id,
          qr.name

        FROM qr_codes qr

        WHERE qr.space_id = $1
          AND COALESCE(
            qr.is_archived,
            false
          ) = false

        ORDER BY qr.name
      `, [spaceId]);

      const qrOptions = qrResult.rows
        .map(qr => `
          <option value="${qr.id}">
            ${qr.name}
          </option>
        `)
        .join("");

      return res.send(
        marketplacePage(
          `Add Sponsorship - ${location.name}`,
          `
           <div class="marketplace-topbar">

  <div class="marketplace-brand">
    Vivid Organizations
  </div>

  <h1>
    Add Sponsorship
  </h1>

  <p class="marketplace-subtitle">
    Add a advertising opportunity to
    ${location.name}'s inventory.
  </p>

</div>

            <div class="marketplace-wrap">

              <div
                class="marketplace-card"
                style="
                  max-width:760px;
                  margin:0 auto;
                "
              >

             <div style="margin-bottom:24px;">

  <h2 style="
    margin:0 0 7px;
    font-size:22px;
  ">
    Sponsorship Details
  </h2>

  <div style="
    color:#65776b;
    line-height:1.5;
    font-size:14px;
  ">
    Enter the opportunity details businesses will see
    when viewing this location's available sponsorships.
  </div>

</div>

           <form
  method="POST"
  action="/org-opportunity/new"
>

  <input
    type="hidden"
    name="organization_id"
    value="${organizationId}"
  >

  <input
    type="hidden"
    name="space_id"
    value="${spaceId}"
  >

  <div style="margin-bottom:26px;">

    <div style="
      font-size:13px;
      font-weight:bold;
      color:#4d5d53;
      margin-bottom:8px;
    ">
      Location
    </div>

    <div style="
      background:#f5f7f6;
      border:1px solid #d7dfd8;
      border-radius:10px;
      padding:14px 16px;
      font-size:15px;
      color:#2b3b31;
    ">
      📍 ${location.name}
    </div>

  </div>

  <div style="
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:20px;
  ">

    <div>
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Advertising Opportunity
      </label>

      <input
        type="text"
        name="title"
        required
        placeholder="Example: Football Stadium Sponsorship"
        style="margin:0;"
      >
    </div>

    <div>
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Category
      </label>

      <input
        type="text"
        name="category"
        placeholder="Example: Athletics"
        style="margin:0;"
      >
    </div>

    <div style="grid-column:1 / -1;">
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Description
      </label>

      <textarea
        name="description"
        rows="6"
        placeholder="Describe the advertising opportunity."
        style="
          width:100%;
          padding:11px;
          border-radius:10px;
          border:1px solid #cfdacf;
          margin:0;
          font-size:15px;
          box-sizing:border-box;
          font-family:Arial,sans-serif;
          resize:vertical;
        "
      ></textarea>
    </div>

 <div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Investment
  </label>

  <input
    type="number"
    name="price"
    min="0"
    step="0.01"
    placeholder="Example: 1500.00"
    required
    style="margin:0;"
  >
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Pricing Unit
  </label>

<select
  name="pricing_unit"
  style="margin:0;"
>
  <option value="Per Day">Per Day</option>
  <option value="Per Week">Per Week</option>
  <option value="Per Month">Per Month</option>
  <option value="Per Quarter">Per Quarter</option>
  <option value="Per Year" selected>Per Year</option>
  <option value="Per Campaign">Per Campaign</option>
  <option value="Per Event">Per Event</option>
  <option value="Custom">Custom</option>
</select>
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Suggested Term Length
  </label>

  <input
    type="number"
    name="suggested_term_length"
    min="1"
    step="1"
   value="12"
    required
    style="margin:0;"
  >
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Suggested Term Unit
  </label>

<select
  name="suggested_term_unit"
  style="margin:0;"
>
  <option value="Days">Days</option>
  <option value="Weeks">Weeks</option>
  <option value="Months" selected>Months</option>
  <option value="Quarters">Quarters</option>
  <option value="Years">Years</option>
  <option value="Campaigns">Campaigns</option>
  <option value="Events">Events</option>
  <option value="Issues">Issues</option>
  <option value="Custom">Custom</option>
</select>
</div>

    <div>
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Existing QR Placement
      </label>

      <select
        name="qr_id"
        style="margin:0;"
      >
        <option value="">
          None — create or connect later
        </option>

        ${qrOptions}
      </select>
    </div>

    <div>
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Status
      </label>

      <select
        name="status"
        style="margin:0;"
      >
        <option value="Available">
          Available
        </option>

        <option value="Reserved">
          Reserved
        </option>

        <option value="Unavailable">
          Unavailable
        </option>
      </select>
    </div>

    <div>
      <label style="
        display:block;
        font-weight:bold;
        margin-bottom:7px;
      ">
        Display Order
      </label>

<input
    type="number"
    name="display_order"
    min="1"
    step="1"
    value="1"
    required
    style="
        margin:0;
        width:52px;
        min-width:52px;
        max-width:52px;
        text-align:center;
"
:center;
"
      >
    </div>

  </div>

  <div style="
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    margin-top:24px;
  ">

    <button
      class="marketplace-btn"
      type="submit"
    >
      Save Sponsorship
    </button>

    <a
      class="marketplace-btn secondary"
      href="/org-marketplace?organization_id=${organizationId}&location_id=${spaceId}"
    >
      Cancel
    </a>

  </div>

</form>

              </div>

            </div>
          `
        )
      );

    } catch (err) {
      console.error(
        "NEW ORG OPPORTUNITY PAGE ERROR:",
        err
      );

      return res.status(500).send(
        "NEW ORG OPPORTUNITY PAGE ERROR: " +
        err.message
      );
    }
  }
);
app.post(
  "/org-opportunity/new",
  async (req, res) => {
    try {
      let organizationId = null;

      /*
        Organization Portal users use the organization
        stored in their authenticated session.
      */
      if (req.session.orgUser?.organization_id) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      /*
        Super Admin uses the organization submitted
        by the protected form.
      */
      if (
        !organizationId &&
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.body.organization_id
        );
      }

      const spaceId = Number(
        req.body.space_id
      );

      const title = String(
        req.body.title || ""
      ).trim();

      const category = String(
        req.body.category || ""
      ).trim();

      const description = String(
        req.body.description || ""
      ).trim();

      const price = Number(
        req.body.price
      );

      const pricingUnit = String(
        req.body.pricing_unit || ""
      ).trim();

      const suggestedTermLength = Number(
        req.body.suggested_term_length
      );

      const suggestedTermUnit = String(
        req.body.suggested_term_unit || ""
      ).trim();

      const status = String(
        req.body.status || "Available"
      ).trim();

      const displayOrder = Number(
        req.body.display_order || 1
      );

      const qrId =
        String(req.body.qr_id || "").trim() === ""
          ? null
          : Number(req.body.qr_id);

      /*
        Validate organization and location IDs.
      */
      if (
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(spaceId) ||
        spaceId <= 0
      ) {
        return res.status(400).send(
          "Valid organization and location are required."
        );
      }

      if (!title) {
        return res.status(400).send(
          "Advertising Opportunity is required."
        );
      }

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).send(
          "Investment must be a valid amount."
        );
      }

      const allowedPricingUnits = [
        "Per Day",
        "Per Week",
        "Per Month",
        "Per Quarter",
        "Per Year",
        "Per Campaign",
        "Per Event",
        "Custom"
      ];

      if (
        !allowedPricingUnits.includes(
          pricingUnit
        )
      ) {
        return res.status(400).send(
          "Invalid pricing unit."
        );
      }

      if (
        !Number.isInteger(
          suggestedTermLength
        ) ||
        suggestedTermLength < 1
      ) {
        return res.status(400).send(
          "Suggested Term Length must be a whole number of 1 or greater."
        );
      }

      const allowedTermUnits = [
        "Days",
        "Weeks",
        "Months",
        "Quarters",
        "Years",
        "Campaigns",
        "Events",
        "Issues",
        "Custom"
      ];

      if (
        !allowedTermUnits.includes(
          suggestedTermUnit
        )
      ) {
        return res.status(400).send(
          "Invalid suggested term unit."
        );
      }

      if (
        !Number.isInteger(displayOrder) ||
        displayOrder < 1
      ) {
        return res.status(400).send(
          "Display Order must be a whole number of 1 or greater."
        );
      }

      const allowedStatuses = [
        "Available",
        "Reserved",
        "Unavailable"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).send(
          "Invalid sponsorship status."
        );
      }

      if (
        qrId !== null &&
        (
          !Number.isInteger(qrId) ||
          qrId <= 0
        )
      ) {
        return res.status(400).send(
          "Invalid QR placement."
        );
      }

      /*
        Confirm that the active Vivid location belongs
        to the selected organization.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          organization_id

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        spaceId,
        organizationId
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Active organization location not found."
        );
      }

      /*
        When a QR placement is selected, confirm that
        it belongs to this exact Vivid location.
      */
      if (qrId !== null) {
        const qrResult = await q(`
          SELECT
            id,
            name,
            space_id

          FROM qr_codes

          WHERE id = $1
            AND space_id = $2
            AND COALESCE(
              is_archived,
              false
            ) = false

          LIMIT 1
        `, [
          qrId,
          spaceId
        ]);

        if (!qrResult.rows[0]) {
          return res.status(400).send(
            "The selected QR placement does not belong to this location."
          );
        }
      }

      /*
        Prevent duplicate active opportunity names
        within the same location.
      */
      const duplicateResult = await q(`
        SELECT id

        FROM organization_opportunities

        WHERE organization_id = $1
          AND space_id = $2
          AND LOWER(TRIM(title)) =
              LOWER(TRIM($3))
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [
        organizationId,
        spaceId,
        title
      ]);

      if (duplicateResult.rows[0]) {
        return res.status(409).send(`
          An active advertising opportunity with this
          name already exists at ${location.name}.
          <br><br>

          <a href="/org-marketplace?organization_id=${organizationId}&location_id=${spaceId}">
            Back to Advertising Inventory
          </a>
        `);
      }

      const createdBy =
        req.session.orgUser?.id ||
        req.session.user?.id ||
        null;

      /*
        annual_price temporarily mirrors price so that
        older code remains compatible during conversion.
      */
      await q(`
        INSERT INTO organization_opportunities (
          organization_id,
          space_id,
          qr_id,
          title,
          description,
          category,

          price,
          annual_price,
          pricing_unit,
          suggested_term_length,
          suggested_term_unit,

          status,
          display_order,
          is_active,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,

          $7,
          $7,
          $8,
          $9,
          $10,

          $11,
          $12,
          true,
          $13,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `, [
        organizationId,          // $1
        spaceId,                 // $2
        qrId,                    // $3
        title,                   // $4
        description || null,     // $5
        category || null,        // $6

        price,                   // $7
        pricingUnit,             // $8
        suggestedTermLength,     // $9
        suggestedTermUnit,       // $10

        status,                  // $11
        displayOrder,            // $12
        createdBy                // $13
      ]);

      return res.redirect(
        `/org-marketplace?organization_id=${organizationId}&location_id=${spaceId}`
      );

    } catch (err) {
      console.error(
        "CREATE ORG OPPORTUNITY ERROR:",
        err
      );

      return res.status(500).send(
        "CREATE ORG OPPORTUNITY ERROR: " +
        err.message
      );
    }
  }
);
app.get(
  "/org-opportunity/edit/:opportunityId",
  async (req, res) => {
    try {
      const opportunityId = Number(
        req.params.opportunityId
      );

      let organizationId = null;

      /*
        Super Admin uses the explicitly selected
        organization from the URL.
      */
      if (
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.query.organization_id
        );
      }

      /*
        Organization Portal users use their
        authenticated organization.
      */
      if (
        !organizationId &&
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      if (
        !Number.isInteger(opportunityId) ||
        opportunityId <= 0 ||
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(400).send(
          "Valid opportunity and organization are required."
        );
      }

      /*
        Load the opportunity and verify that it belongs
        to this organization and an active Vivid location.
      */
      const opportunityResult = await q(`

SELECT
  oo.id,
  oo.organization_id,
  oo.space_id,
  oo.qr_id,

  oo.title,
  oo.description,
  oo.category,

  oo.annual_price,
  oo.price,
  oo.pricing_unit,
  oo.suggested_term_length,
  oo.suggested_term_unit,

  oo.status,
  oo.display_order,
  oo.is_active,

  s.name AS location_name,
  s.location AS market,

  o.name AS organization_name
        FROM organization_opportunities oo

        JOIN spaces s
          ON s.id = oo.space_id
         AND s.organization_id = oo.organization_id

        JOIN organizations o
          ON o.id = oo.organization_id

        WHERE oo.id = $1
          AND oo.organization_id = $2
          AND COALESCE(oo.is_active, true) = true
          AND COALESCE(s.is_archived, false) = false
          AND COALESCE(o.is_active, true) = true

        LIMIT 1
      `, [
        opportunityId,
        organizationId
      ]);

      const opportunity =
        opportunityResult.rows[0];

      if (!opportunity) {
        return res.status(404).send(
          "Active advertising opportunity not found."
        );
      }

      /*
        Load optional QR placements belonging only
        to this opportunity's Vivid location.
      */
      const qrResult = await q(`
        SELECT
          id,
          name

        FROM qr_codes

        WHERE space_id = $1
          AND COALESCE(is_archived, false) = false

        ORDER BY name
      `, [opportunity.space_id]);

      const qrOptions = qrResult.rows
        .map(qr => `
          <option
            value="${qr.id}"
            ${
              Number(qr.id) ===
              Number(opportunity.qr_id)
                ? "selected"
                : ""
            }
          >
            ${qr.name}
          </option>
        `)
        .join("");

      return res.send(
        marketplacePage(
          `Edit Opportunity - ${opportunity.location_name}`
          `
            <div class="marketplace-topbar">

              <div class="marketplace-brand">
                Vivid Organizations
              </div>

              <h1>
                Edit Opportunity
              </h1>

              <p class="marketplace-subtitle">
                Update this advertising opportunity in
                ${opportunity.location_name}'s inventory.
              </p>

            </div>

            <div class="marketplace-wrap">

              <div
                class="marketplace-card"
                style="
                  max-width:760px;
                  margin:0 auto;
                "
              >

                <div style="margin-bottom:24px;">

                  <h2 style="
                    margin:0 0 7px;
                    font-size:22px;
                  ">
                    Sponsorship Details
                  </h2>

                  <div style="
                    color:#65776b;
                    line-height:1.5;
                    font-size:14px;
                  ">
                    Edit the opportunity details businesses
                    will see for this location.
                  </div>

                </div>

                <form
                  method="POST"
                  action="/org-opportunity/edit/${opportunity.id}"
                >

                  <input
                    type="hidden"
                    name="organization_id"
                    value="${organizationId}"
                  >

                  <input
                    type="hidden"
                    name="space_id"
                    value="${opportunity.space_id}"
                  >

                  <div style="margin-bottom:26px;">

                    <div style="
                      font-size:13px;
                      font-weight:bold;
                      color:#4d5d53;
                      margin-bottom:8px;
                    ">
                      Location
                    </div>

                    <div style="
                      background:#f5f7f6;
                      border:1px solid #d7dfd8;
                      border-radius:10px;
                      padding:14px 16px;
                      font-size:15px;
                      color:#2b3b31;
                    ">
                      📍 ${opportunity.location_name}
                    </div>

                  </div>

                  <div style="
                    display:grid;
                    grid-template-columns:
                      repeat(2,minmax(0,1fr));
                    gap:20px;
                  ">

                    <div>
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Advertising Opportunity
                      </label>

                      <input
                        type="text"
                        name="title"
                        value="${opportunity.title || ""}"
                        required
                        style="margin:0;"
                      >
                    </div>

                    <div>
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Category
                      </label>

                      <input
                        type="text"
                        name="category"
                        value="${opportunity.category || ""}"
                        placeholder="Example: Athletics"
                        style="margin:0;"
                      >
                    </div>

                    <div style="grid-column:1 / -1;">
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Description
                      </label>

                      <textarea
                        name="description"
                        rows="6"
                        placeholder="Describe the advertising opportunity."
                        style="
                          width:100%;
                          padding:11px;
                          border-radius:10px;
                          border:1px solid #cfdacf;
                          margin:0;
                          font-size:15px;
                          box-sizing:border-box;
                          font-family:Arial,sans-serif;
                          resize:vertical;
                        "
                      >${opportunity.description || ""}</textarea>
                    </div>

                    <div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Investment
  </label>

  <input
    type="number"
    name="price"
    min="0"
    step="0.01"
    value="${Number(
      opportunity.price ??
      opportunity.annual_price ??
      0
    ).toFixed(2)}"
    required
    style="margin:0;"
  >
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Pricing Unit
  </label>

  <select
    name="pricing_unit"
    style="margin:0;"
  >
    ${[
      "Per Day",
      "Per Week",
      "Per Month",
      "Per Quarter",
      "Per Year",
      "Per Campaign",
      "Per Event",
      "Custom"
    ].map(unit => `
      <option
        value="${unit}"
        ${
          String(
            opportunity.pricing_unit ||
            "Per Year"
          ) === unit
            ? "selected"
            : ""
        }
      >
        ${unit}
      </option>
    `).join("")}
  </select>
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Suggested Term Length
  </label>

  <input
    type="number"
    name="suggested_term_length"
    min="1"
    step="1"
    value="${Number(
      opportunity.suggested_term_length || 12
    )}"
    required
    style="margin:0;"
  >
</div>

<div>
  <label style="
    display:block;
    font-weight:bold;
    margin-bottom:7px;
  ">
    Suggested Term Unit
  </label>

  <select
    name="suggested_term_unit"
    style="margin:0;"
  >
    ${[
      "Days",
      "Weeks",
      "Months",
      "Quarters",
      "Years",
      "Campaigns",
      "Events",
      "Issues",
      "Custom"
    ].map(unit => `
      <option
        value="${unit}"
        ${
          String(
            opportunity.suggested_term_unit ||
            "Months"
          ) === unit
            ? "selected"
            : ""
        }
      >
        ${unit}
      </option>
    `).join("")}
  </select>
</div>

                    <div>
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Existing QR Placement
                      </label>

                      <select
                        name="qr_id"
                        style="margin:0;"
                      >
                        <option
                          value=""
                          ${
                            !opportunity.qr_id
                              ? "selected"
                              : ""
                          }
                        >
                          None — create or connect later
                        </option>

                        ${qrOptions}
                      </select>
                    </div>

                    <div>
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Availability
                      </label>

                      <select
                        name="status"
                        style="margin:0;"
                      >
                        <option
                          value="Available"
                          ${
                            opportunity.status === "Available"
                              ? "selected"
                              : ""
                          }
                        >
                          Available
                        </option>

                        <option
                          value="Reserved"
                          ${
                            opportunity.status === "Reserved"
                              ? "selected"
                              : ""
                          }
                        >
                          Reserved
                        </option>

                        <option
                          value="Unavailable"
                          ${
                            opportunity.status === "Unavailable"
                              ? "selected"
                              : ""
                          }
                        >
                          Unavailable
                        </option>
                      </select>
                    </div>

                    <div>
                      <label style="
                        display:block;
                        font-weight:bold;
                        margin-bottom:7px;
                      ">
                        Display Order
                      </label>

                      <input
                        type="number"
                        name="display_order"
                        min="1"
                        step="1"
                        value="${Number(
                          opportunity.display_order || 1
                        )}"
                        required
                        style="margin:0;"
                      >
                    </div>

                  </div>

                  <div style="
                    display:flex;
                    gap:12px;
                    flex-wrap:wrap;
                    margin-top:24px;
                  ">

                    <button
                      class="marketplace-btn"
                      type="submit"
                    >
                      Save Changes
                    </button>

                    <a
                      class="marketplace-btn secondary"
                      href="/org-marketplace?organization_id=${organizationId}&location_id=${opportunity.space_id}"
                    >
                      Cancel
                    </a>

                  </div>

                </form>

              </div>

            </div>
          `
        )
      );

    } catch (err) {
      console.error(
        "EDIT ORG OPPORTUNITY PAGE ERROR:",
        err
      );

      return res.status(500).send(
        "EDIT ORG OPPORTUNITY PAGE ERROR: " +
        err.message
      );
    }
  }
);
app.post(
  "/org-opportunity/edit/:opportunityId",
  async (req, res) => {
    try {
      const opportunityId = Number(
        req.params.opportunityId
      );

      let organizationId = null;

      /*
        Super Admin uses the organization submitted
        by the protected form.
      */
      if (
        req.session.user?.role === "super_admin"
      ) {
        organizationId = Number(
          req.body.organization_id
        );
      }

      /*
        Organization Portal users use their
        authenticated organization.
      */
      if (
        !organizationId &&
        req.session.orgUser?.organization_id
      ) {
        organizationId = Number(
          req.session.orgUser.organization_id
        );
      }

      const spaceId = Number(
        req.body.space_id
      );

      const title = String(
        req.body.title || ""
      ).trim();

      const category = String(
        req.body.category || ""
      ).trim();

      const description = String(
        req.body.description || ""
      ).trim();

      const price = Number(
  req.body.price
);

const pricingUnit = String(
  req.body.pricing_unit || ""
).trim();

const suggestedTermLength = Number(
  req.body.suggested_term_length
);

const suggestedTermUnit = String(
  req.body.suggested_term_unit || ""
).trim();

      const status = String(
        req.body.status || "Available"
      ).trim();

      const displayOrder = Number(
        req.body.display_order || 1
      );

      const qrId =
        String(req.body.qr_id || "").trim() === ""
          ? null
          : Number(req.body.qr_id);

      if (
        !Number.isInteger(opportunityId) ||
        opportunityId <= 0 ||
        !Number.isInteger(organizationId) ||
        organizationId <= 0 ||
        !Number.isInteger(spaceId) ||
        spaceId <= 0
      ) {
        return res.status(400).send(
          "Valid opportunity, organization, and location are required."
        );
      }

      if (!title) {
        return res.status(400).send(
          "Advertising Opportunity is required."
        );
      }

      if (
  !Number.isFinite(price) ||
  price < 0
) {
  return res.status(400).send(
    "Investment must be a valid amount."
  );
}

const allowedPricingUnits = [
  "Per Day",
  "Per Week",
  "Per Month",
  "Per Quarter",
  "Per Year",
  "Per Campaign",
  "Per Event",
  "Custom"
];

if (!allowedPricingUnits.includes(pricingUnit)) {
  return res.status(400).send(
    "Invalid pricing unit."
  );
}

if (
  !Number.isInteger(suggestedTermLength) ||
  suggestedTermLength < 1
) {
  return res.status(400).send(
    "Suggested Term Length must be a whole number of 1 or greater."
  );
}

const allowedTermUnits = [
  "Days",
  "Weeks",
  "Months",
  "Quarters",
  "Years",
  "Campaigns",
  "Events",
  "Issues",
  "Custom"
];

if (!allowedTermUnits.includes(suggestedTermUnit)) {
  return res.status(400).send(
    "Invalid suggested term unit."
  );
}

      if (
        !Number.isInteger(displayOrder) ||
        displayOrder < 1
      ) {
        return res.status(400).send(
          "Display Order must be a whole number of 1 or greater."
        );
      }

      const allowedStatuses = [
        "Available",
        "Reserved",
        "Unavailable"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).send(
          "Invalid sponsorship availability."
        );
      }

      if (
        qrId !== null &&
        (
          !Number.isInteger(qrId) ||
          qrId <= 0
        )
      ) {
        return res.status(400).send(
          "Invalid QR placement."
        );
      }

      /*
        Confirm the opportunity belongs to this
        organization and location.
      */
      const currentResult = await q(`
        SELECT
          oo.id,
          oo.organization_id,
          oo.space_id,
          s.name AS location_name

        FROM organization_opportunities oo

        JOIN spaces s
          ON s.id = oo.space_id
         AND s.organization_id = oo.organization_id

        WHERE oo.id = $1
          AND oo.organization_id = $2
          AND oo.space_id = $3
          AND COALESCE(oo.is_active, true) = true
          AND COALESCE(s.is_archived, false) = false

        LIMIT 1
      `, [
        opportunityId,
        organizationId,
        spaceId
      ]);

      const current =
        currentResult.rows[0];

      if (!current) {
        return res.status(404).send(
          "Active advertising opportunity not found."
        );
      }

      /*
        Confirm an optional QR belongs to the same
        Vivid location.
      */
      if (qrId !== null) {
        const qrResult = await q(`
          SELECT id

          FROM qr_codes

          WHERE id = $1
            AND space_id = $2
            AND COALESCE(is_archived, false) = false

          LIMIT 1
        `, [
          qrId,
          spaceId
        ]);

        if (!qrResult.rows[0]) {
          return res.status(400).send(
            "The selected QR placement does not belong to this location."
          );
        }
      }

      /*
        Prevent duplicate active titles at the same
        location, excluding the record being edited.
      */
      const duplicateResult = await q(`
        SELECT id

        FROM organization_opportunities

        WHERE organization_id = $1
          AND space_id = $2
          AND id <> $3
          AND LOWER(TRIM(title)) =
              LOWER(TRIM($4))
          AND COALESCE(is_active, true) = true

        LIMIT 1
      `, [
        organizationId,
        spaceId,
        opportunityId,
        title
      ]);

      if (duplicateResult.rows[0]) {
        return res.status(409).send(`
          Another active advertising opportunity with
          this name already exists at
          ${current.location_name}.
          <br><br>
          <a href="/org-opportunity/edit/${opportunityId}?organization_id=${organizationId}">
            Back to Edit Opportunity
          </a>
        `);
      }

      await q(`
        UPDATE organization_opportunities

        SET
  qr_id = $1,
  title = $2,
  description = $3,
  category = $4,

  price = $5,
  annual_price = $5,
  pricing_unit = $6,
  suggested_term_length = $7,
  suggested_term_unit = $8,

  status = $9,
  display_order = $10,
  updated_at = CURRENT_TIMESTAMP

WHERE id = $11
  AND organization_id = $12
  AND space_id = $13
          AND COALESCE(is_active, true) = true
      `, [
  qrId,
  title,
  description || null,
  category || null,

  price,
  pricingUnit,
  suggestedTermLength,
  suggestedTermUnit,

  status,
  displayOrder,

  opportunityId,
  organizationId,
  spaceId
]);
        return res.redirect(
        `/org-marketplace?organization_id=${organizationId}&location_id=${spaceId}`
      );

    } catch (err) {
      console.error(
        "UPDATE ORG OPPORTUNITY ERROR:",
        err
      );

      return res.status(500).send(
        "UPDATE ORG OPPORTUNITY ERROR: " +
        err.message
      );
    }
  }
);
/*
=========================================================
PUBLIC ADVERTISING PORTAL
Organization-agnostic public landing page.

Examples:
  /advertise/ccps
  /advertise/marriott
  /advertise/city-of-naples
=========================================================
*/

app.get(
  "/advertise/:slug",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      if (!slug) {
        return res.status(400).send(
          "A valid organization is required."
        );
      }

      /*
        Escape database-controlled text before placing
        it inside public HTML.
      */
      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      /*
        Load the public organization configuration.
        Nothing here is specific to schools, hotels,
        cities or any other industry.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug,
          public_heading,
          public_description,
          public_logo_url

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      /*
        Load all active organization locations and count
        opportunities that are publicly available today.

        Blank availability dates mean the opportunity
        is always available.
      */
      const locationsResult = await q(`
        SELECT
          s.id,
          s.name,
          s.location,

          COUNT(
            oo.id
          ) FILTER (
            WHERE
              COALESCE(
                oo.is_active,
                true
              ) = true

              AND oo.status = 'Available'

              AND (
                oo.available_from IS NULL
                OR oo.available_from <= CURRENT_DATE
              )

              AND (
                oo.available_until IS NULL
                OR oo.available_until >= CURRENT_DATE
              )
          )::int AS available_count

        FROM spaces s

        LEFT JOIN organization_opportunities oo
          ON oo.space_id = s.id
         AND oo.organization_id =
             s.organization_id

        WHERE s.organization_id = $1
          AND COALESCE(
            s.is_archived,
            false
          ) = false

        GROUP BY
          s.id,
          s.name,
          s.location

        ORDER BY
          s.name
      `, [organization.id]);

      const locations =
        locationsResult.rows;

      const heading =
        organization.public_heading ||
        `Advertise With ${organization.name}`;

      const description =
        organization.public_description ||
        "Explore available advertising opportunities across this organization.";

      const logoHtml =
        organization.public_logo_url
          ? `
            <img
              src="${escapeHtml(
                organization.public_logo_url
              )}"
              alt="${escapeHtml(
                organization.name
              )} logo"
              style="
                display:block;
                max-width:180px;
                max-height:100px;
                object-fit:contain;
                margin:0 auto 22px;
              "
            >
          `
          : "";

      const locationCards =
        locations.length > 0
          ? locations
              .map(location => {
                const availableCount =
                  Number(
                    location.available_count || 0
                  );

                const opportunityLabel =
                  availableCount === 1
                    ? "1 opportunity available"
                    : `${availableCount} opportunities available`;

                const locationDetail =
                  location.location
                    ? `
                      <div style="
                        color:#65776b;
                        font-size:14px;
                        margin-top:5px;
                      ">
                        ${escapeHtml(
                          location.location
                        )}
                      </div>
                    `
                    : "";
const actionHtml =
  availableCount > 0
    ? `
      <a
        href="/advertise/${encodeURIComponent(
          organization.slug
        )}/location/${location.id}"
        style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:100%;
          margin-top:14px;
          background:#176b3a;
          color:white;
          text-decoration:none;
          border-radius:9px;
          padding:11px 16px;
          font-weight:bold;
          font-size:14px;
          white-space:nowrap;
        "
      >
        View Opportunities
      </a>
    `
                    
                    : `
                      <span style="
                        display:inline-flex;
                        align-items:center;
                        justify-content:center;
                        background:#edf1ee;
                        color:#738078;
                        border-radius:9px;
                        padding:11px 16px;
                        font-weight:bold;
                        font-size:14px;
                        white-space:nowrap;
                      ">
                        None Available
                      </span>
                    `;
return `
  <article style="
background:white;
border:1px solid #dbe5dd;
border-radius:18px;
padding:18px;
display:flex;
flex-direction:column;
justify-content:space-between;
min-height:170px;
box-shadow:0 8px 24px rgba(0,0,0,.05);
transition:.2s ease;
  ">

    <div>

      <div style="
        color:#65776b;
        font-size:12px;
        font-weight:bold;
        letter-spacing:.05em;
        text-transform:uppercase;
        margin-bottom:8px;
      ">
        Location
      </div>

      <h2 style="
        margin:0;
        color:#17482f;
        font-size:20px;
font-weight:700;
line-height:1.3;
        
      ">
        ${escapeHtml(
          location.name
        )}
      </h2>

      ${locationDetail}

      <div style="
        color:${
          availableCount > 0
            ? "#176b3a"
            : "#738078"
        };
        font-size:15px;
font-weight:600;
margin-top:10px;
      ">
        ${
          availableCount === 1
            ? "1 Advertising Opportunity Available"
            : `${availableCount} Advertising Opportunities Available`
        }
      </div>

    </div>

    <div>
      ${actionHtml}
    </div>

  </article>
`;
              })
              .join("")
          : `
            <div style="
              background:white;
              border:1px solid #d9e1da;
              border-radius:14px;
              padding:28px;
              text-align:center;
              color:#65776b;
            ">
              No active locations are currently available.
            </div>
          `;

      return res.send(`
        <!DOCTYPE html>

        <html lang="en">

        <head>
          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            ${escapeHtml(heading)}
          </title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              background: #f4f7f5;
              color: #24382c;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .public-portal-header {
              background: white;
              border-bottom: 1px solid #d9e1da;
              padding: 42px 20px 36px;
              text-align: center;
            }

            .public-portal-main {
              width: min(1000px, calc(100% - 32px));
              margin: 0 auto;
              padding: 34px 0 50px;
            }

.public-location-grid {
  display:grid;
  grid-template-columns:
    repeat(auto-fill, minmax(240px, 280px));
  justify-content:center;
  gap:20px;
  width:100%;
  max-width:1400px;
  margin:0 auto;
}

            @media (max-width: 640px) {
              .public-portal-header {
                padding: 30px 18px;
              }
.public-portal-main {
  width:min(1200px, calc(100% - 32px));
  margin:0 auto;
  padding:34px 0 50px;
}
.public-location-grid {
  grid-template-columns:1fr;
}
            }
          </style>
        </head>

        <body>

          <header class="public-portal-header">

            ${logoHtml}

            <div style="
              color:#176b3a;
              font-size:13px;
              font-weight:bold;
              letter-spacing:.08em;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              Advertising Opportunities
            </div>

            <h1 style="
              margin:0;
              color:#24382c;
              font-size:clamp(30px,5vw,46px);
            ">
              ${escapeHtml(heading)}
            </h1>

            <p style="
              max-width:720px;
              margin:16px auto 0;
              color:#65776b;
              font-size:17px;
              line-height:1.6;
            ">
              ${escapeHtml(description)}
            </p>

          </header>

          <main class="public-portal-main">

            <div style="
              margin-bottom:20px;
            ">
           <section style="
    max-width:1400px;
    margin:0 auto 50px;
    text-align:center;
">

<h2 style="
    margin:0 0 12px;
    font-size:48px;
    color:#163d2d;
">
    Choose a Location
</h2>

<p style="
    max-width:760px;
    margin:0 auto 42px;
    color:#66786f;
    font-size:20px;
    line-height:1.6;
">
    Select a location to explore its currently available advertising opportunities.
</p>

          
            </div>

       <div
  class="public-location-grid"
  style="
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(240px, 280px));
    justify-content:center;
    gap:20px;
    width:100%;
    max-width:1400px;
    margin:0 auto;
  "
>
  ${locationCards}
</div>

          </main>

        </body>

        </html>
      `);

    } catch (err) {
      console.error(
        "PUBLIC ADVERTISING PORTAL ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load the Advertising Opportunities Portal."
      );
    }
  }
);
/*
=========================================================
PUBLIC LOCATION OPPORTUNITIES PAGE

Example:
  /advertise/ccps/location/60

Displays only opportunities that:
- Belong to the organization
- Belong to the selected location
- Are active
- Have Available status
- Are within their availability dates
=========================================================
*/

app.get(
  "/advertise/:slug/location/:locationId",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      const locationId = Number(
        req.params.locationId
      );

      if (
        !slug ||
        !Number.isInteger(locationId) ||
        locationId <= 0
      ) {
        return res.status(400).send(
          "A valid organization and location are required."
        );
      }

      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      /*
        Load and validate the organization.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug,
          public_heading,
          public_description,
          public_logo_url

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      /*
        Load the selected location.

        The organization_id condition prevents someone
        from accessing a location belonging to another
        organization by changing the URL.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          location

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        locationId,
        organization.id
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Location not found."
        );
      }

      /*
        Load all currently available opportunities.

        to_jsonb is used for the display fields so this
        remains compatible with the opportunity naming
        fields already used by the Marketplace builder.
      */
      const opportunitiesResult = await q(`
        SELECT
          oo.id,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'title',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'placement',
              ''
            ),
            'Advertising Opportunity'
          ) AS opportunity_name,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_group',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'area',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'venue',
              ''
            )
          ) AS opportunity_group,

          NULLIF(
            to_jsonb(oo)->>'placement',
            ''
          ) AS placement,

          NULLIF(
            to_jsonb(oo)->>'category',
            ''
          ) AS category,

          NULLIF(
            to_jsonb(oo)->>'description',
            ''
          ) AS description,

          NULLIF(
            to_jsonb(oo)->>'price',
            ''
          )::numeric AS price,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'pricing_unit',
              ''
            ),
            'year'
          ) AS pricing_unit,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_length',
            ''
          )::numeric AS suggested_term_length,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_unit',
            ''
          ) AS suggested_term_unit,

          oo.available_from,
          oo.available_until,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'display_order',
              ''
            )::integer,
            999999
          ) AS display_order

        FROM organization_opportunities oo

        WHERE oo.organization_id = $1
          AND oo.space_id = $2

          AND COALESCE(
            oo.is_active,
            true
          ) = true

          AND oo.status = 'Available'

          AND (
            oo.available_from IS NULL
            OR oo.available_from <= CURRENT_DATE
          )

          AND (
            oo.available_until IS NULL
            OR oo.available_until >= CURRENT_DATE
          )

        ORDER BY
          display_order,
          opportunity_group NULLS LAST,
          placement NULLS LAST,
          opportunity_name,
          oo.id
      `, [
        organization.id,
        location.id
      ]);

      const opportunities =
        opportunitiesResult.rows;

      const formatMoney = value => {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
          return "Contact for pricing";
        }

        return new Intl.NumberFormat(
          "en-US",
          {
            style: "currency",
            currency: "USD",
            maximumFractionDigits:
              Number.isInteger(amount)
                ? 0
                : 2
          }
        ).format(amount);
      };

      const formatDate = value => {
        if (!value) {
          return "";
        }

        const date = new Date(value);

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return "";
        }

        return date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric"
          }
        );
      };

      const formatPricingUnit = value => {
        const unit = String(
          value || ""
        )
          .trim()
          .toLowerCase();

        const labels = {
          year: "per year",
          annual: "per year",
          month: "per month",
          monthly: "per month",
          week: "per week",
          weekly: "per week",
          day: "per day",
          daily: "per day",
          event: "per event",
          season: "per season",
          semester: "per semester",
          campaign: "per campaign",
          placement: "per placement",
          flat: "total investment",
          one_time: "one-time investment",
          "one-time": "one-time investment"
        };

        return labels[unit] ||
          (
            unit
              ? `per ${unit}`
              : ""
          );
      };

      const opportunityCards =
        opportunities.length > 0
          ? opportunities
              .map(opportunity => {
                const groupHtml =
                  opportunity.opportunity_group
                    ? `
                      <div style="
                        color:#176b3a;
                        font-size:12px;
                        font-weight:bold;
                        letter-spacing:.06em;
                        text-transform:uppercase;
                        margin-bottom:8px;
                      ">
                        ${escapeHtml(
                          opportunity.opportunity_group
                        )}
                      </div>
                    `
                    : "";

                const placementHtml =
                  opportunity.placement &&
                  opportunity.placement !==
                    opportunity.opportunity_name
                    ? `
                      <div style="
                        color:#65776b;
                        font-size:15px;
                        margin-top:6px;
                        line-height:1.5;
                      ">
                        ${escapeHtml(
                          opportunity.placement
                        )}
                      </div>
                    `
                    : "";

                const categoryHtml =
                  opportunity.category
                    ? `
                      <div style="
                        margin-top:12px;
                      ">
                        <span style="
                          display:inline-flex;
                          align-items:center;
                          background:#edf5ef;
                          color:#176b3a;
                          border-radius:999px;
                          padding:6px 10px;
                          font-size:12px;
                          font-weight:bold;
                        ">
                          ${escapeHtml(
                            opportunity.category
                          )}
                        </span>
                      </div>
                    `
                    : "";

                const descriptionHtml =
                  opportunity.description
                    ? `
                      <p style="
                        margin:14px 0 0;
                        color:#65776b;
                        font-size:14px;
                        line-height:1.6;
                      ">
                        ${escapeHtml(
                          opportunity.description
                        )}
                      </p>
                    `
                    : "";

                const pricingUnit =
                  formatPricingUnit(
                    opportunity.pricing_unit
                  );

                const priceHtml =
                  opportunity.price !== null
                    ? `
                      <div style="
                        color:#17482f;
                        font-size:26px;
                        font-weight:bold;
                        line-height:1.2;
                      ">
                        ${escapeHtml(
                          formatMoney(
                            opportunity.price
                          )
                        )}
                      </div>

                      ${
                        pricingUnit
                          ? `
                            <div style="
                              color:#65776b;
                              font-size:13px;
                              margin-top:3px;
                            ">
                              ${escapeHtml(
                                pricingUnit
                              )}
                            </div>
                          `
                          : ""
                      }
                    `
                    : `
                      <div style="
                        color:#17482f;
                        font-size:19px;
                        font-weight:bold;
                      ">
                        Contact for pricing
                      </div>
                    `;

                const suggestedTermHtml =
                  opportunity.suggested_term_length &&
                  opportunity.suggested_term_unit
                    ? `
                      <div style="
                        margin-top:14px;
                        color:#52645a;
                        font-size:14px;
                      ">
                        <strong>
                          Suggested term:
                        </strong>

                        ${escapeHtml(
                          opportunity.suggested_term_length
                        )}

                        ${escapeHtml(
                          opportunity.suggested_term_unit
                        )}
                      </div>
                    `
                    : "";

                const availableFrom =
                  formatDate(
                    opportunity.available_from
                  );

                const availableUntil =
                  formatDate(
                    opportunity.available_until
                  );

                let availabilityText =
                  "Currently available";

                if (
                  availableFrom &&
                  availableUntil
                ) {
                  availabilityText =
                    `Available ${availableFrom} through ${availableUntil}`;
                } else if (availableFrom) {
                  availabilityText =
                    `Available beginning ${availableFrom}`;
                } else if (availableUntil) {
                  availabilityText =
                    `Available through ${availableUntil}`;
                }

                return `
                  <article style="
                    background:white;
                    border:1px solid #dbe5dd;
                    border-radius:18px;
                    padding:22px;
                    display:flex;
                    flex-direction:column;
                    justify-content:space-between;
                    min-height:330px;
                    box-shadow:
                      0 8px 24px
                      rgba(0,0,0,.05);
                  ">

                    <div>

                      ${groupHtml}

                      <h2 style="
                        margin:0;
                        color:#17482f;
                        font-size:21px;
                        font-weight:700;
                        line-height:1.3;
                      ">
                        ${escapeHtml(
                          opportunity.opportunity_name
                        )}
                      </h2>

                      ${placementHtml}
                      ${categoryHtml}
                      ${descriptionHtml}

                    </div>

                    <div style="
                      margin-top:24px;
                    ">

                      <div style="
                        border-top:
                          1px solid #e3eae5;
                        padding-top:18px;
                      ">

                        ${priceHtml}
                        ${suggestedTermHtml}

                        <div style="
                          margin-top:12px;
                          color:#65776b;
                          font-size:13px;
                          line-height:1.5;
                        ">
                          ${escapeHtml(
                            availabilityText
                          )}
                        </div>

                      </div>

                      <a
                        href="/advertise/${encodeURIComponent(
                          organization.slug
                        )}/location/${location.id}/opportunity/${opportunity.id}"
                        style="
                          display:flex;
                          align-items:center;
                          justify-content:center;
                          width:100%;
                          margin-top:18px;
                          background:#176b3a;
                          color:white;
                          text-decoration:none;
                          border-radius:9px;
                          padding:12px 16px;
                          font-weight:bold;
                          font-size:14px;
                        "
                      >
                        Select Opportunity
                      </a>

                    </div>

                  </article>
                `;
              })
              .join("")
          : `
            <div style="
              grid-column:1 / -1;
              background:white;
              border:1px solid #d9e1da;
              border-radius:16px;
              padding:38px 24px;
              text-align:center;
            ">

              <h2 style="
                margin:0;
                color:#17482f;
                font-size:22px;
              ">
                No Opportunities Available
              </h2>

              <p style="
                margin:10px auto 0;
                max-width:520px;
                color:#65776b;
                line-height:1.6;
              ">
                This location does not currently have any
                publicly available advertising opportunities.
              </p>

            </div>
          `;

      const locationDetailHtml =
        location.location
          ? `
            <div style="
              color:#65776b;
              font-size:17px;
              margin-top:8px;
            ">
              ${escapeHtml(
                location.location
              )}
            </div>
          `
          : "";

      const logoHtml =
        organization.public_logo_url
          ? `
            <img
              src="${escapeHtml(
                organization.public_logo_url
              )}"
              alt="${escapeHtml(
                organization.name
              )} logo"
              style="
                display:block;
                max-width:170px;
                max-height:90px;
                object-fit:contain;
                margin:0 auto 20px;
              "
            >
          `
          : "";

      return res.send(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Advertising Opportunities at
            ${escapeHtml(location.name)}
          </title>

          <style>
            * {
              box-sizing:border-box;
            }

            body {
              margin:0;
              background:#f4f7f5;
              color:#24382c;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .opportunity-header {
              background:white;
              border-bottom:
                1px solid #d9e1da;
              padding:34px 20px 38px;
              text-align:center;
            }

            .opportunity-main {
              width:min(
                1200px,
                calc(100% - 32px)
              );
              margin:0 auto;
              padding:34px 0 54px;
            }

            .opportunity-grid {
              display:grid;
              grid-template-columns:
                repeat(
                  auto-fit,
                  minmax(280px, 1fr)
                );
              gap:20px;
              align-items:stretch;
            }

            @media (
              max-width:640px
            ) {
              .opportunity-header {
                padding:26px 18px 30px;
              }

              .opportunity-main {
                width:
                  calc(100% - 24px);
                padding:
                  26px 0 40px;
              }

              .opportunity-grid {
                grid-template-columns:1fr;
              }
            }
          </style>

        </head>

        <body>

          <header class="opportunity-header">

            ${logoHtml}

            <a
              href="/advertise/${encodeURIComponent(
                organization.slug
              )}"
              style="
                display:inline-flex;
                color:#176b3a;
                text-decoration:none;
                font-size:14px;
                font-weight:bold;
                margin-bottom:22px;
              "
            >
              ← Back to Locations
            </a>

            <div style="
              color:#176b3a;
              font-size:13px;
              font-weight:bold;
              letter-spacing:.08em;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              Advertising Opportunities
            </div>

            <h1 style="
              margin:0;
              color:#24382c;
              font-size:
                clamp(
                  30px,
                  5vw,
                  46px
                );
            ">
              ${escapeHtml(
                location.name
              )}
            </h1>

            ${locationDetailHtml}

            <p style="
              max-width:700px;
              margin:18px auto 0;
              color:#65776b;
              font-size:17px;
              line-height:1.6;
            ">
              Select an opportunity below to begin your
              advertising request.
            </p>

          </header>

          <main class="opportunity-main">

            <div style="
              margin-bottom:24px;
              color:#52645a;
              font-size:15px;
              font-weight:bold;
            ">
              ${
                opportunities.length === 1
                  ? "1 opportunity available"
                  : `${opportunities.length} opportunities available`
              }
            </div>

            <div class="opportunity-grid">
              ${opportunityCards}
            </div>

          </main>

        </body>

        </html>
      `);

    } catch (err) {
      console.error(
        "PUBLIC LOCATION OPPORTUNITIES ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load advertising opportunities."
      );
    }
  }
);
/*
=========================================================
PUBLIC ADVERTISER INFORMATION FORM

Example:
  /advertise/ccps/location/60/opportunity/12

Phase 4:
- Confirms selected opportunity
- Collects business information
- Collects initial campaign information
- Does not create live Vivid Core records
- Posts to the Review & Submit route
=========================================================
*/

app.get(
  "/advertise/:slug/location/:locationId/opportunity/:opportunityId",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      const locationId = Number(
        req.params.locationId
      );

      const opportunityId = Number(
        req.params.opportunityId
      );

      if (
        !slug ||
        !Number.isInteger(locationId) ||
        locationId <= 0 ||
        !Number.isInteger(opportunityId) ||
        opportunityId <= 0
      ) {
        return res.status(400).send(
          "A valid organization, location and opportunity are required."
        );
      }

      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      /*
        Load organization.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug,
          public_heading,
          public_description,
          public_logo_url

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      /*
        Load and validate location.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          location

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        locationId,
        organization.id
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Location not found."
        );
      }

      /*
        Load the selected opportunity.

        It must belong to both the organization and
        selected location, be active, be Available,
        and be within its availability dates.
      */
      const opportunityResult = await q(`
        SELECT
          oo.id,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'title',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'placement',
              ''
            ),
            'Advertising Opportunity'
          ) AS opportunity_name,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_group',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'area',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'venue',
              ''
            )
          ) AS opportunity_group,

          NULLIF(
            to_jsonb(oo)->>'placement',
            ''
          ) AS placement,

          NULLIF(
            to_jsonb(oo)->>'category',
            ''
          ) AS category,

          NULLIF(
            to_jsonb(oo)->>'description',
            ''
          ) AS description,

          NULLIF(
            to_jsonb(oo)->>'price',
            ''
          )::numeric AS price,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'pricing_unit',
              ''
            ),
            'year'
          ) AS pricing_unit,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_length',
            ''
          )::numeric AS suggested_term_length,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_unit',
            ''
          ) AS suggested_term_unit,

          oo.available_from,
          oo.available_until

        FROM organization_opportunities oo

        WHERE oo.id = $1
          AND oo.organization_id = $2
          AND oo.space_id = $3

          AND COALESCE(
            oo.is_active,
            true
          ) = true

          AND oo.status = 'Available'

          AND (
            oo.available_from IS NULL
            OR oo.available_from <= CURRENT_DATE
          )

          AND (
            oo.available_until IS NULL
            OR oo.available_until >= CURRENT_DATE
          )

        LIMIT 1
      `, [
        opportunityId,
        organization.id,
        location.id
      ]);

      const opportunity =
        opportunityResult.rows[0];

      if (!opportunity) {
        return res.status(404).send(
          "This advertising opportunity is no longer available."
        );
      }

      const formatMoney = value => {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
          return "Contact for pricing";
        }

        return new Intl.NumberFormat(
          "en-US",
          {
            style: "currency",
            currency: "USD",
            maximumFractionDigits:
              Number.isInteger(amount)
                ? 0
                : 2
          }
        ).format(amount);
      };

      const formatPricingUnit = value => {
        const unit = String(
          value || ""
        )
          .trim()
          .toLowerCase();

        const labels = {
          year: "per year",
          annual: "per year",
          month: "per month",
          monthly: "per month",
          week: "per week",
          weekly: "per week",
          day: "per day",
          daily: "per day",
          event: "per event",
          season: "per season",
          semester: "per semester",
          campaign: "per campaign",
          placement: "per placement",
          flat: "total investment",
          one_time: "one-time investment",
          "one-time": "one-time investment"
        };

        return labels[unit] ||
          (
            unit
              ? `per ${unit}`
              : ""
          );
      };

      const priceText =
        opportunity.price !== null
          ? formatMoney(
              opportunity.price
            )
          : "Contact for pricing";

      const pricingUnitText =
        opportunity.price !== null
          ? formatPricingUnit(
              opportunity.pricing_unit
            )
          : "";

      const termText =
        opportunity.suggested_term_length &&
        opportunity.suggested_term_unit
          ? `${opportunity.suggested_term_length} ${opportunity.suggested_term_unit}`
          : "To be determined";

      const opportunityGroupHtml =
        opportunity.opportunity_group
          ? `
            <div class="summary-row">
              <div class="summary-label">
                Area / Venue
              </div>

              <div class="summary-value">
                ${escapeHtml(
                  opportunity.opportunity_group
                )}
              </div>
            </div>
          `
          : "";

      const placementHtml =
        opportunity.placement
          ? `
            <div class="summary-row">
              <div class="summary-label">
                Placement
              </div>

              <div class="summary-value">
                ${escapeHtml(
                  opportunity.placement
                )}
              </div>
            </div>
          `
          : "";

      const categoryHtml =
        opportunity.category
          ? `
            <div class="summary-row">
              <div class="summary-label">
                Category
              </div>

              <div class="summary-value">
                ${escapeHtml(
                  opportunity.category
                )}
              </div>
            </div>
          `
          : "";

      const locationDetailHtml =
        location.location
          ? `
            <div style="
              margin-top:6px;
              color:#65776b;
              font-size:15px;
            ">
              ${escapeHtml(
                location.location
              )}
            </div>
          `
          : "";

      const logoHtml =
        organization.public_logo_url
          ? `
            <img
              src="${escapeHtml(
                organization.public_logo_url
              )}"
              alt="${escapeHtml(
                organization.name
              )} logo"
              style="
                display:block;
                max-width:160px;
                max-height:85px;
                object-fit:contain;
                margin:0 auto 18px;
              "
            >
          `
          : "";

      return res.send(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Advertise With ${escapeHtml(
              organization.name
            )}
          </title>

          <style>
            * {
              box-sizing:border-box;
            }

            body {
              margin:0;
              background:#f4f7f5;
              color:#24382c;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .form-header {
              background:white;
              border-bottom:
                1px solid #d9e1da;
              padding:30px 20px 34px;
              text-align:center;
            }

            .form-main {
              width:min(
                1120px,
                calc(100% - 32px)
              );
              margin:0 auto;
              padding:34px 0 54px;
            }

            .form-layout {
              display:grid;
              grid-template-columns:
                minmax(280px, 360px)
                minmax(0, 1fr);
              gap:24px;
              align-items:start;
            }

            .panel {
              background:white;
              border:
                1px solid #dbe5dd;
              border-radius:18px;
              padding:24px;
              box-shadow:
                0 8px 24px
                rgba(0,0,0,.05);
            }

            .summary-panel {
              position:sticky;
              top:22px;
            }

            .summary-row {
              padding:14px 0;
              border-bottom:
                1px solid #e5ebe7;
            }

            .summary-row:last-child {
              border-bottom:0;
            }

            .summary-label {
              color:#65776b;
              font-size:12px;
              font-weight:bold;
              letter-spacing:.05em;
              text-transform:uppercase;
              margin-bottom:5px;
            }

            .summary-value {
              color:#24382c;
              font-size:15px;
              font-weight:600;
              line-height:1.45;
            }

            .form-section {
              margin-top:28px;
              padding-top:26px;
              border-top:
                1px solid #e2e9e4;
            }

            .form-section:first-of-type {
              margin-top:0;
              padding-top:0;
              border-top:0;
            }

            .field-grid {
              display:grid;
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
              gap:18px;
            }

            .field {
              display:flex;
              flex-direction:column;
              gap:7px;
            }

            .field.full-width {
              grid-column:1 / -1;
            }

            label {
              color:#344b3d;
              font-size:14px;
              font-weight:bold;
            }

            input,
            select,
            textarea {
              width:100%;
              border:
                1px solid #cbd8ce;
              border-radius:9px;
              background:white;
              color:#24382c;
              font:inherit;
              font-size:15px;
              padding:12px 13px;
              outline:none;
            }

            textarea {
              min-height:100px;
              resize:vertical;
            }

            input:focus,
            select:focus,
            textarea:focus {
              border-color:#176b3a;
              box-shadow:
                0 0 0 3px
                rgba(23,107,58,.10);
            }

            .required {
              color:#a33232;
            }

            .agreement {
              display:flex;
              align-items:flex-start;
              gap:11px;
              margin-top:26px;
              padding:16px;
              background:#f3f7f4;
              border:
                1px solid #dbe5dd;
              border-radius:12px;
            }

            .agreement input {
              width:auto;
              margin-top:3px;
              flex:0 0 auto;
            }

            .form-actions {
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:14px;
              margin-top:28px;
            }

            .back-button,
            .continue-button {
              display:inline-flex;
              align-items:center;
              justify-content:center;
              border-radius:9px;
              padding:12px 18px;
              font-size:14px;
              font-weight:bold;
              text-decoration:none;
              cursor:pointer;
            }

            .back-button {
              border:
                1px solid #cbd8ce;
              background:white;
              color:#344b3d;
            }

            .continue-button {
              border:0;
              background:#176b3a;
              color:white;
            }

            @media (
              max-width:820px
            ) {
              .form-layout {
                grid-template-columns:1fr;
              }

              .summary-panel {
                position:static;
              }
            }

            @media (
              max-width:620px
            ) {
              .form-main {
                width:
                  calc(100% - 24px);
                padding:
                  24px 0 40px;
              }

              .panel {
                padding:19px;
              }

              .field-grid {
                grid-template-columns:1fr;
              }

              .field.full-width {
                grid-column:auto;
              }

              .form-actions {
                flex-direction:column-reverse;
                align-items:stretch;
              }

              .back-button,
              .continue-button {
                width:100%;
              }
            }
          </style>

        </head>

        <body>

          <header class="form-header">

            ${logoHtml}

            <div style="
              color:#176b3a;
              font-size:13px;
              font-weight:bold;
              letter-spacing:.08em;
              text-transform:uppercase;
              margin-bottom:9px;
            ">
              Advertising Request
            </div>

            <h1 style="
              margin:0;
              color:#24382c;
              font-size:
                clamp(
                  28px,
                  5vw,
                  42px
                );
            ">
              Tell Us About Your Business
            </h1>

            <p style="
              max-width:680px;
              margin:14px auto 0;
              color:#65776b;
              font-size:16px;
              line-height:1.6;
            ">
              Complete the information below to continue
              your advertising request.
            </p>

          </header>

          <main class="form-main">

            <form
              method="POST"
              action="/advertise/${encodeURIComponent(
                organization.slug
              )}/location/${location.id}/opportunity/${opportunity.id}/review"
            >

              <input
                type="hidden"
                name="organization_id"
                value="${organization.id}"
              >

              <input
                type="hidden"
                name="location_id"
                value="${location.id}"
              >

              <input
                type="hidden"
                name="opportunity_id"
                value="${opportunity.id}"
              >

              <div class="form-layout">

                <aside class="panel summary-panel">

                  <div style="
                    color:#176b3a;
                    font-size:12px;
                    font-weight:bold;
                    letter-spacing:.06em;
                    text-transform:uppercase;
                    margin-bottom:8px;
                  ">
                    Selected Opportunity
                  </div>

                  <h2 style="
                    margin:0;
                    color:#17482f;
                    font-size:23px;
                    line-height:1.3;
                  ">
                    ${escapeHtml(
                      opportunity.opportunity_name
                    )}
                  </h2>

                  <div style="
                    margin-top:7px;
                    color:#52645a;
                    font-size:15px;
                    font-weight:600;
                  ">
                    ${escapeHtml(
                      location.name
                    )}
                  </div>

                  ${locationDetailHtml}

                  <div style="
                    margin-top:20px;
                  ">

                    <div class="summary-row">
                      <div class="summary-label">
                        Organization
                      </div>

                      <div class="summary-value">
                        ${escapeHtml(
                          organization.name
                        )}
                      </div>
                    </div>

                    <div class="summary-row">
                      <div class="summary-label">
                        Location
                      </div>

                      <div class="summary-value">
                        ${escapeHtml(
                          location.name
                        )}
                      </div>
                    </div>

                    <div class="summary-row">
                      <div class="summary-label">
                        Opportunity
                      </div>

                      <div class="summary-value">
                        ${escapeHtml(
                          opportunity.opportunity_name
                        )}
                      </div>
                    </div>

                    ${opportunityGroupHtml}
                    ${placementHtml}
                    ${categoryHtml}

                    <div class="summary-row">
                      <div class="summary-label">
                        Investment
                      </div>

                      <div class="summary-value">
                        ${escapeHtml(
                          priceText
                        )}

                        ${
                          pricingUnitText
                            ? `
                              <span style="
                                color:#65776b;
                                font-weight:normal;
                              ">
                                ${escapeHtml(
                                  pricingUnitText
                                )}
                              </span>
                            `
                            : ""
                        }
                      </div>
                    </div>

                    <div class="summary-row">
                      <div class="summary-label">
                        Suggested Term
                      </div>

                      <div class="summary-value">
                        ${escapeHtml(
                          termText
                        )}
                      </div>
                    </div>

                  </div>

                </aside>

                <section class="panel">

                  <div class="form-section">

                    <h2 style="
                      margin:0 0 18px;
                      color:#17482f;
                      font-size:23px;
                    ">
                      Business Information
                    </h2>

                    <div class="field-grid">

                      <div class="field full-width">
                        <label for="business_name">
                          Business Name
                          <span class="required">*</span>
                        </label>

                        <input
                          id="business_name"
                          name="business_name"
                          type="text"
                          maxlength="160"
                          autocomplete="organization"
                          required
                        >
                      </div>

                      <div class="field">
                        <label for="contact_name">
                          Primary Contact
                          <span class="required">*</span>
                        </label>

                        <input
                          id="contact_name"
                          name="contact_name"
                          type="text"
                          maxlength="160"
                          autocomplete="name"
                          required
                        >
                      </div>

                      <div class="field">
                        <label for="email">
                          Email
                          <span class="required">*</span>
                        </label>

                        <input
                          id="email"
                          name="email"
                          type="email"
                          maxlength="220"
                          autocomplete="email"
                          required
                        >
                      </div>

                      <div class="field">
                        <label for="phone">
                          Phone
                          <span class="required">*</span>
                        </label>

                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          maxlength="40"
                          autocomplete="tel"
                          required
                        >
                      </div>

                      <div class="field">
                        <label for="website">
                          Website
                        </label>

                      <input
  id="website"
  name="website"
  type="text"
  maxlength="500"
  placeholder="example.com"
  autocomplete="url"
>
                          
                        >
                      </div>

                      <div class="field full-width">
                        <label for="business_category">
                          Business Category
                        </label>

                        <select
                          id="business_category"
                          name="business_category"
                        >
                          <option value="">
                            Select a category
                          </option>

                          <option value="Restaurant">
                            Restaurant
                          </option>

                          <option value="Retail">
                            Retail
                          </option>

                          <option value="Medical">
                            Medical
                          </option>

                          <option value="Legal">
                            Legal
                          </option>

                          <option value="Automotive">
                            Automotive
                          </option>

                          <option value="Financial">
                            Financial
                          </option>

                          <option value="Hospitality">
                            Hospitality
                          </option>

                          <option value="Real Estate">
                            Real Estate
                          </option>

                          <option value="Home Services">
                            Home Services
                          </option>

                          <option value="Professional Services">
                            Professional Services
                          </option>

                          <option value="Other">
                            Other
                          </option>
                        </select>
                      </div>

                    </div>

                  </div>

                  <div class="form-section">

                    <h2 style="
                      margin:0 0 7px;
                      color:#17482f;
                      font-size:23px;
                    ">
                      Advertising Details
                    </h2>

                    <p style="
                      margin:0 0 18px;
                      color:#65776b;
                      font-size:14px;
                      line-height:1.6;
                    ">
                      Provide the basic information about your advertising request. Additional campaign setup will be completed after your request has been approved.
                      
                  
                    </p>

                    <div class="field-grid">

                      <div class="field full-width">
                        <label for="campaign_name">
                          Campaign / Promotion Name
                        </label>

                        <input
                          id="campaign_name"
                          name="campaign_name"
                          type="text"
                          maxlength="180"
                          placeholder="Example: Fall Sponsorship Campaign"
                        >
                      </div>

                      <div class="field full-width">
                        <label for="destination_url">
                          Website to Promote
                          <span class="required">*</span>
                        </label>

<input
  id="destination_url"
  name="destination_url"
  type="text"
  maxlength="1000"
  placeholder="example.com"
  required
>
                        >
                      </div>


                    
                      <div class="field full-width">
                        <label for="campaign_notes">
                          Additional Information
                        </label>

                        <textarea
                          id="campaign_notes"
                          name="campaign_notes"
                          maxlength="2000"
                          placeholder="Anything else the organization should know about your request?"
                        ></textarea>
                      </div>

                    </div>

                  </div>

                  <label class="agreement">

                    <input
                      type="checkbox"
                      name="approval_acknowledgement"
                      value="yes"
                      required
                    >

                    <span style="
                      color:#52645a;
                      font-size:14px;
                      line-height:1.55;
                    ">
                      I understand that this advertising
                      request is subject to approval by
                      ${escapeHtml(
                        organization.name
                      )}.
                    </span>

                  </label>

                  <div class="form-actions">

                    <a
                      href="/advertise/${encodeURIComponent(
                        organization.slug
                      )}/location/${location.id}"
                      class="back-button"
                    >
                      ← Back
                    </a>

                    <button
                      type="submit"
                      class="continue-button"
                    >
                      Continue to Review →
                    </button>

                  </div>

                </section>

              </div>

            </form>

          </main>

        </body>

        </html>
      `);

    } catch (err) {
      console.error(
        "PUBLIC ADVERTISER INFORMATION ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load the advertiser information form."
      );
    }
  }
);
/*
=========================================================
PUBLIC MARKETPLACE — REVIEW ADVERTISING REQUEST

POST:
/advertise/:slug/location/:locationId/opportunity/:opportunityId/review

Phase 5A:
- Receives advertiser information
- Validates required fields
- Revalidates organization, location and opportunity
- Displays a read-only review page
- Does not create Marketplace or Vivid Core records
=========================================================
*/

app.post(
  "/advertise/:slug/location/:locationId/opportunity/:opportunityId/review",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      const locationId = Number(
        req.params.locationId
      );

      const opportunityId = Number(
        req.params.opportunityId
      );

      if (
        !slug ||
        !Number.isInteger(locationId) ||
        locationId <= 0 ||
        !Number.isInteger(opportunityId) ||
        opportunityId <= 0
      ) {
        return res.status(400).send(
          "A valid organization, location and opportunity are required."
        );
      }

      const cleanText = (
        value,
        maximumLength = 500
      ) =>
        String(value ?? "")
          .trim()
          .slice(0, maximumLength);
const normalizeWebsiteUrl = value => {
  const cleaned = cleanText(
    value,
    1000
  );

  if (!cleaned) {
    return "";
  }

  if (
    /^https?:\/\//i.test(cleaned)
  ) {
    return cleaned;
  }

  return `https://${cleaned}`;
};
      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const businessName = cleanText(
        req.body.business_name,
        160
      );

      const contactName = cleanText(
        req.body.contact_name,
        160
      );

      const email = cleanText(
        req.body.email,
        220
      ).toLowerCase();

      const phone = cleanText(
        req.body.phone,
        40
      );

      const website = normalizeWebsiteUrl(
  req.body.website
);
        
        
    

      const businessCategory = cleanText(
        req.body.business_category,
        100
      );

      const campaignName = cleanText(
        req.body.campaign_name,
        180
      );

      const destinationUrl = normalizeWebsiteUrl(
  req.body.destination_url
);
        
        
      

      const campaignNotes = cleanText(
        req.body.campaign_notes,
        2000
      );

      const approvalAcknowledgement =
        cleanText(
          req.body.approval_acknowledgement,
          20
        );

      /*
        Validate required advertiser fields.
      */
      if (
        !businessName ||
        !contactName ||
        !email ||
        !phone ||
        !destinationUrl
      ) {
        return res.status(400).send(
          "Please complete all required fields before continuing."
        );
      }

      /*
        Basic email validation.
      */
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return res.status(400).send(
          "Please enter a valid email address."
        );
      }

      /*
        Basic URL validation.

        Both the optional business website and required
        website to promote must use http or https.
      */
      const isValidWebUrl = value => {
        if (!value) {
          return true;
        }

        try {
          const parsedUrl = new URL(value);

          return (
            parsedUrl.protocol === "http:" ||
            parsedUrl.protocol === "https:"
          );
        } catch {
          return false;
        }
      };

      if (
        website &&
        !isValidWebUrl(website)
      ) {
        return res.status(400).send(
          "Please enter a valid business website beginning with http:// or https://."
        );
      }

      if (!isValidWebUrl(destinationUrl)) {
        return res.status(400).send(
          "Please enter a valid website to promote beginning with http:// or https://."
        );
      }

      if (
        approvalAcknowledgement !== "yes"
      ) {
        return res.status(400).send(
          "You must acknowledge that the advertising request is subject to approval."
        );
      }

      /*
        Load organization.
      */
      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug,
          public_heading,
          public_description,
          public_logo_url

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      /*
        Load and validate location.
      */
      const locationResult = await q(`
        SELECT
          id,
          name,
          location

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        locationId,
        organization.id
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Location not found."
        );
      }

      /*
        Revalidate the selected opportunity.

        It must still belong to this organization and
        location and remain currently available.
      */
      const opportunityResult = await q(`
        SELECT
          oo.id,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'title',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'placement',
              ''
            ),
            'Advertising Opportunity'
          ) AS opportunity_name,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_group',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'area',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'venue',
              ''
            )
          ) AS opportunity_group,

          NULLIF(
            to_jsonb(oo)->>'placement',
            ''
          ) AS placement,

          NULLIF(
            to_jsonb(oo)->>'category',
            ''
          ) AS category,

          NULLIF(
            to_jsonb(oo)->>'description',
            ''
          ) AS description,

          NULLIF(
            to_jsonb(oo)->>'price',
            ''
          )::numeric AS price,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'pricing_unit',
              ''
            ),
            'year'
          ) AS pricing_unit,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_length',
            ''
          )::numeric AS suggested_term_length,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_unit',
            ''
          ) AS suggested_term_unit,

          oo.available_from,
          oo.available_until

        FROM organization_opportunities oo

        WHERE oo.id = $1
          AND oo.organization_id = $2
          AND oo.space_id = $3

          AND COALESCE(
            oo.is_active,
            true
          ) = true

          AND oo.status = 'Available'

          AND (
            oo.available_from IS NULL
            OR oo.available_from <= CURRENT_DATE
          )

          AND (
            oo.available_until IS NULL
            OR oo.available_until >= CURRENT_DATE
          )

        LIMIT 1
      `, [
        opportunityId,
        organization.id,
        location.id
      ]);

      const opportunity =
        opportunityResult.rows[0];

      if (!opportunity) {
        return res.status(404).send(
          "This advertising opportunity is no longer available."
        );
      }

      const formatMoney = value => {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
          return "Contact for pricing";
        }

        return new Intl.NumberFormat(
          "en-US",
          {
            style: "currency",
            currency: "USD",
            maximumFractionDigits:
              Number.isInteger(amount)
                ? 0
                : 2
          }
        ).format(amount);
      };

      const formatPricingUnit = value => {
        const unit = String(
          value || ""
        )
          .trim()
          .toLowerCase();

        const labels = {
          year: "per year",
          annual: "per year",
          month: "per month",
          monthly: "per month",
          week: "per week",
          weekly: "per week",
          day: "per day",
          daily: "per day",
          event: "per event",
          season: "per season",
          semester: "per semester",
          campaign: "per campaign",
          placement: "per placement",
          flat: "total investment",
          one_time: "one-time investment",
          "one-time": "one-time investment"
        };

        return labels[unit] ||
          (
            unit
              ? `per ${unit}`
              : ""
          );
      };

      const priceText =
        opportunity.price !== null
          ? formatMoney(
              opportunity.price
            )
          : "Contact for pricing";

      const pricingUnitText =
        opportunity.price !== null
          ? formatPricingUnit(
              opportunity.pricing_unit
            )
          : "";

      const termText =
        opportunity.suggested_term_length &&
        opportunity.suggested_term_unit
          ? `${opportunity.suggested_term_length} ${opportunity.suggested_term_unit}`
          : "To be determined";

      /*
        Display helpers.
      */
      const displayValue = value =>
        value
          ? escapeHtml(value)
          : `
            <span class="not-provided">
              Not provided
            </span>
          `;

      const displayMultilineValue = value =>
        value
          ? escapeHtml(value).replace(
              /\r?\n/g,
              "<br>"
            )
          : `
            <span class="not-provided">
              Not provided
            </span>
          `;

      const locationDetailHtml =
        location.location
          ? `
            <div class="location-detail">
              ${escapeHtml(
                location.location
              )}
            </div>
          `
          : "";

      const opportunityGroupHtml =
        opportunity.opportunity_group
          ? `
            <div class="review-row">
              <div class="review-label">
                Area / Venue
              </div>

              <div class="review-value">
                ${escapeHtml(
                  opportunity.opportunity_group
                )}
              </div>
            </div>
          `
          : "";

      const placementHtml =
        opportunity.placement
          ? `
            <div class="review-row">
              <div class="review-label">
                Placement
              </div>

              <div class="review-value">
                ${escapeHtml(
                  opportunity.placement
                )}
              </div>
            </div>
          `
          : "";

      const categoryHtml =
        opportunity.category
          ? `
            <div class="review-row">
              <div class="review-label">
                Opportunity Category
              </div>

              <div class="review-value">
                ${escapeHtml(
                  opportunity.category
                )}
              </div>
            </div>
          `
          : "";

      const logoHtml =
        organization.public_logo_url
          ? `
            <img
              src="${escapeHtml(
                organization.public_logo_url
              )}"
              alt="${escapeHtml(
                organization.name
              )} logo"
              class="organization-logo"
            >
          `
          : "";

      /*
        The values below are escaped for safe use inside
        hidden HTML input values.
      */
      const hiddenBusinessName =
        escapeHtml(businessName);

      const hiddenContactName =
        escapeHtml(contactName);

      const hiddenEmail =
        escapeHtml(email);

      const hiddenPhone =
        escapeHtml(phone);

      const hiddenWebsite =
        escapeHtml(website);

      const hiddenBusinessCategory =
        escapeHtml(businessCategory);

      const hiddenCampaignName =
        escapeHtml(campaignName);

      const hiddenDestinationUrl =
        escapeHtml(destinationUrl);

      const hiddenCampaignNotes =
        escapeHtml(campaignNotes);

      return res.send(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Review Advertising Request
          </title>

          <style>
            * {
              box-sizing:border-box;
            }

            body {
              margin:0;
              background:#f4f7f5;
              color:#24382c;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .review-header {
              background:white;
              border-bottom:
                1px solid #d9e1da;
              padding:30px 20px 34px;
              text-align:center;
            }

            .organization-logo {
              display:block;
              max-width:160px;
              max-height:85px;
              object-fit:contain;
              margin:0 auto 18px;
            }

            .eyebrow {
              color:#176b3a;
              font-size:13px;
              font-weight:bold;
              letter-spacing:.08em;
              text-transform:uppercase;
              margin-bottom:9px;
            }

            .review-header h1 {
              margin:0;
              color:#24382c;
              font-size:
                clamp(
                  28px,
                  5vw,
                  42px
                );
            }

            .header-description {
              max-width:680px;
              margin:14px auto 0;
              color:#65776b;
              font-size:16px;
              line-height:1.6;
            }

            .review-main {
              width:min(
                980px,
                calc(100% - 32px)
              );
              margin:0 auto;
              padding:34px 0 54px;
            }

            .panel {
              background:white;
              border:
                1px solid #dbe5dd;
              border-radius:18px;
              padding:26px;
              box-shadow:
                0 8px 24px
                rgba(0,0,0,.05);
            }

            .panel + .panel {
              margin-top:22px;
            }

            .panel-title {
              margin:0 0 6px;
              color:#17482f;
              font-size:23px;
              line-height:1.3;
            }

            .panel-description {
              margin:0 0 20px;
              color:#65776b;
              font-size:14px;
              line-height:1.55;
            }

            .location-name {
              margin-top:8px;
              color:#52645a;
              font-size:16px;
              font-weight:600;
            }

            .location-detail {
              margin-top:5px;
              color:#65776b;
              font-size:14px;
            }

            .review-grid {
              display:grid;
              grid-template-columns:
                repeat(
                  2,
                  minmax(0, 1fr)
                );
              column-gap:28px;
            }

            .review-row {
              padding:15px 0;
              border-bottom:
                1px solid #e5ebe7;
            }

            .review-row.full-width {
              grid-column:1 / -1;
            }

            .review-label {
              color:#65776b;
              font-size:12px;
              font-weight:bold;
              letter-spacing:.05em;
              text-transform:uppercase;
              margin-bottom:6px;
            }

            .review-value {
              color:#24382c;
              font-size:15px;
              font-weight:600;
              line-height:1.5;
              overflow-wrap:anywhere;
            }

            .not-provided {
              color:#849087;
              font-weight:normal;
              font-style:italic;
            }

            .approval-notice {
              display:flex;
              align-items:flex-start;
              gap:11px;
              margin-top:22px;
              padding:16px;
              background:#f3f7f4;
              border:
                1px solid #dbe5dd;
              border-radius:12px;
              color:#52645a;
              font-size:14px;
              line-height:1.55;
            }

            .approval-icon {
              display:flex;
              align-items:center;
              justify-content:center;
              flex:0 0 auto;
              width:22px;
              height:22px;
              border-radius:50%;
              background:#176b3a;
              color:white;
              font-size:13px;
              font-weight:bold;
            }

            .review-actions {
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:14px;
              margin-top:28px;
            }

            .edit-button,
            .submit-button {
              display:inline-flex;
              align-items:center;
              justify-content:center;
              border-radius:9px;
              padding:13px 19px;
              font-size:14px;
              font-weight:bold;
              text-decoration:none;
              cursor:pointer;
            }

            .edit-button {
              border:
                1px solid #cbd8ce;
              background:white;
              color:#344b3d;
            }

            .submit-button {
              border:0;
              background:#176b3a;
              color:white;
            }

            .submit-button:hover {
              background:#125a30;
            }

            @media (
              max-width:680px
            ) {
              .review-main {
                width:
                  calc(100% - 24px);
                padding:
                  24px 0 40px;
              }

              .panel {
                padding:20px;
              }

              .review-grid {
                grid-template-columns:1fr;
              }

              .review-row.full-width {
                grid-column:auto;
              }

              .review-actions {
                flex-direction:column-reverse;
                align-items:stretch;
              }

              .edit-button,
              .submit-button {
                width:100%;
              }
            }
          </style>

        </head>

        <body>

          <header class="review-header">

            ${logoHtml}

            <div class="eyebrow">
              Advertising Request
            </div>

            <h1>
              Review Your Information
            </h1>

            <p class="header-description">
              Please confirm that the information below is
              correct before submitting your advertising
              request to
              ${escapeHtml(
                organization.name
              )}.
            </p>

          </header>

          <main class="review-main">

            <section class="panel">

              <div class="eyebrow">
                Selected Opportunity
              </div>

              <h2 class="panel-title">
                ${escapeHtml(
                  opportunity.opportunity_name
                )}
              </h2>

              <div class="location-name">
                ${escapeHtml(
                  location.name
                )}
              </div>

              ${locationDetailHtml}

              <div class="review-grid">

                <div class="review-row">
                  <div class="review-label">
                    Organization
                  </div>

                  <div class="review-value">
                    ${escapeHtml(
                      organization.name
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Location
                  </div>

                  <div class="review-value">
                    ${escapeHtml(
                      location.name
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Opportunity
                  </div>

                  <div class="review-value">
                    ${escapeHtml(
                      opportunity.opportunity_name
                    )}
                  </div>
                </div>

                ${opportunityGroupHtml}
                ${placementHtml}
                ${categoryHtml}

                <div class="review-row">
                  <div class="review-label">
                    Investment
                  </div>

                  <div class="review-value">
                    ${escapeHtml(
                      priceText
                    )}

                    ${
                      pricingUnitText
                        ? `
                          <span style="
                            color:#65776b;
                            font-weight:normal;
                          ">
                            ${escapeHtml(
                              pricingUnitText
                            )}
                          </span>
                        `
                        : ""
                    }
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Suggested Term
                  </div>

                  <div class="review-value">
                    ${escapeHtml(
                      termText
                    )}
                  </div>
                </div>

              </div>

            </section>

            <section class="panel">

              <h2 class="panel-title">
                Business Information
              </h2>

              <p class="panel-description">
                Contact information for the business
                submitting this request.
              </p>

              <div class="review-grid">

                <div class="review-row">
                  <div class="review-label">
                    Business Name
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      businessName
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Primary Contact
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      contactName
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Email
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      email
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Phone
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      phone
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Business Website
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      website
                    )}
                  </div>
                </div>

                <div class="review-row">
                  <div class="review-label">
                    Business Category
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      businessCategory
                    )}
                  </div>
                </div>

              </div>

            </section>

            <section class="panel">

              <h2 class="panel-title">
                Advertising Details
              </h2>

              <p class="panel-description">
                Initial information about what the business
                would like to promote.
              </p>

              <div class="review-grid">

                <div class="review-row full-width">
                  <div class="review-label">
                    Campaign / Promotion Name
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      campaignName
                    )}
                  </div>
                </div>

                <div class="review-row full-width">
                  <div class="review-label">
                    Website to Promote
                  </div>

                  <div class="review-value">
                    ${displayValue(
                      destinationUrl
                    )}
                  </div>
                </div>

                <div class="review-row full-width">
                  <div class="review-label">
                    Additional Information
                  </div>

                  <div class="review-value">
                    ${displayMultilineValue(
                      campaignNotes
                    )}
                  </div>
                </div>

              </div>

              <div class="approval-notice">

                <span class="approval-icon">
                  ✓
                </span>

                <span>
                  This advertising request is subject to
                  review and approval by
                  ${escapeHtml(
                    organization.name
                  )}.
                  Submission does not create an active
                  advertising campaign or guarantee
                  placement availability.
                </span>

              </div>

           <form
  id="advertisingRequestForm"
  method="POST"
  action="/advertise/${encodeURIComponent(
    organization.slug
  )}/location/${location.id}/opportunity/${opportunity.id}/submit"
  onsubmit="
    const submitButton =
      this.querySelector('.submit-button');

    if (this.dataset.submitting === 'true') {
      return false;
    }

    this.dataset.submitting = 'true';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        'Submitting Request...';
    }

    return true;
  "
>

                <input
                  type="hidden"
                  name="organization_id"
                  value="${organization.id}"
                >

                <input
                  type="hidden"
                  name="location_id"
                  value="${location.id}"
                >

                <input
                  type="hidden"
                  name="opportunity_id"
                  value="${opportunity.id}"
                >

                <input
                  type="hidden"
                  name="business_name"
                  value="${hiddenBusinessName}"
                >

                <input
                  type="hidden"
                  name="contact_name"
                  value="${hiddenContactName}"
                >

                <input
                  type="hidden"
                  name="email"
                  value="${hiddenEmail}"
                >

                <input
                  type="hidden"
                  name="phone"
                  value="${hiddenPhone}"
                >

                <input
                  type="hidden"
                  name="website"
                  value="${hiddenWebsite}"
                >

                <input
                  type="hidden"
                  name="business_category"
                  value="${hiddenBusinessCategory}"
                >

                <input
                  type="hidden"
                  name="campaign_name"
                  value="${hiddenCampaignName}"
                >

                <input
                  type="hidden"
                  name="destination_url"
                  value="${hiddenDestinationUrl}"
                >

                <input
                  type="hidden"
                  name="campaign_notes"
                  value="${hiddenCampaignNotes}"
                >

                <input
                  type="hidden"
                  name="approval_acknowledgement"
                  value="yes"
                >

                <div class="review-actions">

                  <button
                    type="button"
                    class="edit-button"
                    onclick="history.back()"
                  >
                    ← Edit Information
                  </button>

                  <button
                    type="submit"
                    class="submit-button"
                  >
                    Submit Advertising Request →
                  </button>

                </div>

              </form>

            </section>

          </main>

        </body>

        </html>
      `);

    } catch (err) {
      console.error(
        "PUBLIC ADVERTISING REVIEW ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to review the advertising request."
      );
    }
  }
);
/*
=========================================================
PUBLIC MARKETPLACE — SUBMIT ADVERTISING REQUEST

POST:
/advertise/:slug/location/:locationId/opportunity/:opportunityId/submit

Phase 5B:
- Revalidates all submitted information
- Creates a Pending advertising request
- Stores an opportunity snapshot
- Does not create Vivid Core records
- Redirects to confirmation page
=========================================================
*/

app.post(
  "/advertise/:slug/location/:locationId/opportunity/:opportunityId/submit",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      const locationId = Number(
        req.params.locationId
      );

      const opportunityId = Number(
        req.params.opportunityId
      );

      if (
        !slug ||
        !Number.isInteger(locationId) ||
        locationId <= 0 ||
        !Number.isInteger(opportunityId) ||
        opportunityId <= 0
      ) {
        return res.status(400).send(
          "A valid organization, location and opportunity are required."
        );
      }

      const cleanText = (
        value,
        maximumLength = 500
      ) =>
        String(value ?? "")
          .trim()
          .slice(0, maximumLength);

      const normalizeWebsiteUrl = value => {
        const cleaned = cleanText(
          value,
          1000
        );

        if (!cleaned) {
          return "";
        }

        if (
          /^https?:\/\//i.test(cleaned)
        ) {
          return cleaned;
        }

        return `https://${cleaned}`;
      };

      const businessName = cleanText(
        req.body.business_name,
        160
      );

      const contactName = cleanText(
        req.body.contact_name,
        160
      );

      const email = cleanText(
        req.body.email,
        220
      ).toLowerCase();

      const phone = cleanText(
        req.body.phone,
        40
      );

      const website = normalizeWebsiteUrl(
        req.body.website
      );

      const businessCategory = cleanText(
        req.body.business_category,
        100
      );

      const campaignName = cleanText(
        req.body.campaign_name,
        180
      );

      const destinationUrl =
        normalizeWebsiteUrl(
          req.body.destination_url
        );

      const campaignNotes = cleanText(
        req.body.campaign_notes,
        2000
      );

      const approvalAcknowledgement =
        cleanText(
          req.body.approval_acknowledgement,
          20
        );

      if (
        !businessName ||
        !contactName ||
        !email ||
        !phone ||
        !destinationUrl
      ) {
        return res.status(400).send(
          "Please complete all required fields before submitting."
        );
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return res.status(400).send(
          "Please enter a valid email address."
        );
      }

      const isValidWebUrl = value => {
        if (!value) {
          return true;
        }

        try {
          const parsedUrl = new URL(value);

          return (
            parsedUrl.protocol === "http:" ||
            parsedUrl.protocol === "https:"
          );
        } catch {
          return false;
        }
      };

      if (
        website &&
        !isValidWebUrl(website)
      ) {
        return res.status(400).send(
          "Please enter a valid business website."
        );
      }

      if (
        !isValidWebUrl(destinationUrl)
      ) {
        return res.status(400).send(
          "Please enter a valid website to promote."
        );
      }

      if (
        approvalAcknowledgement !== "yes"
      ) {
        return res.status(400).send(
          "You must acknowledge that the request is subject to approval."
        );
      }

      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      const locationResult = await q(`
        SELECT
          id,
          name,
          location

        FROM spaces

        WHERE id = $1
          AND organization_id = $2
          AND COALESCE(
            is_archived,
            false
          ) = false

        LIMIT 1
      `, [
        locationId,
        organization.id
      ]);

      const location =
        locationResult.rows[0];

      if (!location) {
        return res.status(404).send(
          "Location not found."
        );
      }

      const opportunityResult = await q(`
        SELECT
          oo.id,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'name',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'title',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'placement',
              ''
            ),
            'Advertising Opportunity'
          ) AS opportunity_name,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'opportunity_group',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'area',
              ''
            ),
            NULLIF(
              to_jsonb(oo)->>'venue',
              ''
            )
          ) AS opportunity_group,

          NULLIF(
            to_jsonb(oo)->>'placement',
            ''
          ) AS placement,

          NULLIF(
            to_jsonb(oo)->>'category',
            ''
          ) AS category,

          NULLIF(
            to_jsonb(oo)->>'description',
            ''
          ) AS description,

          NULLIF(
            to_jsonb(oo)->>'price',
            ''
          )::numeric AS price,

          COALESCE(
            NULLIF(
              to_jsonb(oo)->>'pricing_unit',
              ''
            ),
            'year'
          ) AS pricing_unit,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_length',
            ''
          )::numeric AS suggested_term_length,

          NULLIF(
            to_jsonb(oo)->>'suggested_term_unit',
            ''
          ) AS suggested_term_unit

        FROM organization_opportunities oo

        WHERE oo.id = $1
          AND oo.organization_id = $2
          AND oo.space_id = $3

          AND COALESCE(
            oo.is_active,
            true
          ) = true

          AND oo.status = 'Available'

          AND (
            oo.available_from IS NULL
            OR oo.available_from <= CURRENT_DATE
          )

          AND (
            oo.available_until IS NULL
            OR oo.available_until >= CURRENT_DATE
          )

        LIMIT 1
      `, [
        opportunityId,
        organization.id,
        location.id
      ]);

      const opportunity =
        opportunityResult.rows[0];

      if (!opportunity) {
        return res.status(404).send(
          "This advertising opportunity is no longer available."
        );
      }
/*
=========================================================
DUPLICATE ADVERTISING REQUEST SAFEGUARD

Prevents the same request from being inserted more than
once within 60 seconds.

This protects against:

- Double-clicks
- Browser retries
- Slow network resubmissions
- Multiple rapid POST requests
=========================================================
*/

const duplicateResult = await q(`
  SELECT
    id

  FROM organization_advertising_requests

  WHERE organization_id = $1
    AND location_id = $2
    AND opportunity_id = $3

    AND LOWER(TRIM(email)) =
        LOWER(TRIM($4))

    AND LOWER(
          TRIM(
            COALESCE(
              campaign_name,
              ''
            )
          )
        ) =
        LOWER(
          TRIM(
            COALESCE(
              $5,
              ''
            )
          )
        )

    AND LOWER(
          TRIM(
            COALESCE(
              destination_url,
              ''
            )
          )
        ) =
        LOWER(
          TRIM(
            COALESCE(
              $6,
              ''
            )
          )
        )

    AND submitted_at >=
        CURRENT_TIMESTAMP
        - INTERVAL '60 seconds'

  ORDER BY
    submitted_at DESC,
    id DESC

  LIMIT 1
`, [
  organization.id,
  location.id,
  opportunity.id,
  email,
  campaignName || null,
  destinationUrl
]);

const duplicateRequest =
  duplicateResult.rows[0];

if (duplicateRequest) {
  const duplicateReference =
    `${organization.slug.toUpperCase()}-${String(
      duplicateRequest.id
    ).padStart(6, "0")}`;

  return res.redirect(
    303,
    `/advertise/${encodeURIComponent(
      organization.slug
    )}/request-submitted?request_reference=${encodeURIComponent(
      duplicateReference
    )}`
  );
}
      const insertResult = await q(`
        INSERT INTO organization_advertising_requests (
          organization_id,
          location_id,
          opportunity_id,

          business_name,
          contact_name,
          email,
          phone,
          website,
          business_category,

          campaign_name,
          destination_url,
          campaign_notes,

          opportunity_name,
          opportunity_group,
          placement,
          opportunity_category,
          opportunity_description,
          price,
          pricing_unit,
          suggested_term_length,
          suggested_term_unit,

          status,
          submitted_at,
          created_at,
          updated_at
        )

        VALUES (
          $1,
          $2,
          $3,

          $4,
          $5,
          $6,
          $7,
          $8,
          $9,

          $10,
          $11,
          $12,

          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20,
          $21,

          'Pending',
          NOW(),
          NOW(),
          NOW()
        )

        RETURNING id
      `, [
        organization.id,
        location.id,
        opportunity.id,

        businessName,
        contactName,
        email,
        phone,
        website || null,
        businessCategory || null,

        campaignName || null,
        destinationUrl,
        campaignNotes || null,

        opportunity.opportunity_name,
        opportunity.opportunity_group || null,
        opportunity.placement || null,
        opportunity.category || null,
        opportunity.description || null,
        opportunity.price,
        opportunity.pricing_unit || null,
        opportunity.suggested_term_length,
        opportunity.suggested_term_unit || null
      ]);

const requestId =
  insertResult.rows[0].id;

await q(`
  UPDATE organization_opportunities

  SET
    status = 'Pending',
    updated_at = CURRENT_TIMESTAMP

  WHERE id = $1
    AND organization_id = $2
    AND space_id = $3
    AND COALESCE(is_active, true) = true
`, [
  opportunity.id,
  organization.id,
  location.id
]);

const requestReference =
  `${organization.slug.toUpperCase()}-${String(
    requestId
  ).padStart(6, "0")}`;
    return res.redirect(
  303,
  `/advertise/${encodeURIComponent(
    organization.slug
  )}/request-submitted?request_reference=${encodeURIComponent(
    requestReference
  )}`
);

    } catch (err) {
      console.error(
        "PUBLIC ADVERTISING SUBMIT ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to submit the advertising request."
      );
    }
  }
);
/*
=========================================================
PUBLIC MARKETPLACE — REQUEST SUBMITTED

GET:
/advertise/:slug/request-submitted

- Confirms the advertising request was received
- Does not expose private request details
- Provides a clean end to the public workflow
=========================================================
*/

app.get(
  "/advertise/:slug/request-submitted",
  async (req, res) => {
    try {
      const slug = String(
        req.params.slug || ""
      )
        .trim()
        .toLowerCase();

      if (!slug) {
        return res.status(400).send(
          "A valid organization is required."
        );
      }

      const escapeHtml = value =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const organizationResult = await q(`
        SELECT
          id,
          name,
          slug,
          public_logo_url

        FROM organizations

        WHERE LOWER(TRIM(slug)) = $1
          AND COALESCE(
            is_active,
            true
          ) = true

        LIMIT 1
      `, [slug]);

      const organization =
        organizationResult.rows[0];

      if (!organization) {
        return res.status(404).send(
          "Advertising portal not found."
        );
      }

      const requestReference = String(
  req.query.request_reference || ""
).trim();

      let requestReferenceHtml = "";

if (requestReference) {
  requestReferenceHtml = `
    <div class="reference">
      Request Reference:
      <strong>
        ${escapeHtml(requestReference)}
      </strong>
    </div>
  `;
}

      const logoHtml =
        organization.public_logo_url
          ? `
            <img
              src="${escapeHtml(
                organization.public_logo_url
              )}"
              alt="${escapeHtml(
                organization.name
              )} logo"
              class="organization-logo"
            >
          `
          : "";

      return res.send(`
        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Advertising Request Submitted
          </title>

          <style>
            * {
              box-sizing:border-box;
            }

            body {
              margin:0;
              min-height:100vh;
              display:flex;
              align-items:center;
              justify-content:center;
              padding:24px;
              background:#f4f7f5;
              color:#24382c;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            .confirmation-card {
              width:min(
                680px,
                100%
              );
              background:white;
              border:
                1px solid #dbe5dd;
              border-radius:22px;
              padding:42px 34px;
              text-align:center;
              box-shadow:
                0 12px 34px
                rgba(0,0,0,.07);
            }

            .organization-logo {
              display:block;
              max-width:160px;
              max-height:85px;
              object-fit:contain;
              margin:0 auto 22px;
            }

            .success-icon {
              width:70px;
              height:70px;
              margin:0 auto 22px;
              display:flex;
              align-items:center;
              justify-content:center;
              border-radius:50%;
              background:#176b3a;
              color:white;
              font-size:34px;
              font-weight:bold;
            }

            .eyebrow {
              color:#176b3a;
              font-size:13px;
              font-weight:bold;
              letter-spacing:.08em;
              text-transform:uppercase;
              margin-bottom:10px;
            }

            h1 {
              margin:0;
              color:#24382c;
              font-size:
                clamp(
                  30px,
                  5vw,
                  44px
                );
              line-height:1.15;
            }

            .message {
              max-width:560px;
              margin:18px auto 0;
              color:#65776b;
              font-size:16px;
              line-height:1.7;
            }

            .reference {
              display:inline-block;
              margin-top:24px;
              padding:11px 15px;
              border-radius:10px;
              background:#f3f7f4;
              border:
                1px solid #dbe5dd;
              color:#52645a;
              font-size:14px;
            }

            .next-steps {
              margin-top:28px;
              padding:18px;
              border-radius:14px;
              background:#f8faf8;
              border:
                1px solid #e1e8e3;
              color:#52645a;
              font-size:14px;
              line-height:1.65;
            }

            .home-button {
              display:inline-flex;
              align-items:center;
              justify-content:center;
              margin-top:28px;
              padding:13px 20px;
              border-radius:9px;
              background:#176b3a;
              color:white;
              font-size:14px;
              font-weight:bold;
              text-decoration:none;
            }

            .home-button:hover {
              background:#125a30;
            }

            @media (
              max-width:600px
            ) {
              .confirmation-card {
                padding:32px 22px;
              }
            }
          </style>

        </head>

        <body>

          <main class="confirmation-card">

            ${logoHtml}

            <div class="success-icon">
              ✓
            </div>

            <div class="eyebrow">
              Request Submitted
            </div>

            <h1>
              Thank You
            </h1>

            <p class="message">
              Your advertising request has been submitted
              successfully to
              ${escapeHtml(
                organization.name
              )}.
            </p>

            <p class="message">
              The organization will review your request and
              contact you using the information you provided.
            </p>

            ${requestReferenceHtml}

            <div class="next-steps">
              Submission does not guarantee approval or
              placement availability. No payment has been
              collected and no active advertising campaign
              has been created.
            </div>

            <a
              href="/advertise/${encodeURIComponent(
                organization.slug
              )}"
              class="home-button"
            >
              Return to Advertising Opportunities
            </a>

          </main>

        </body>

        </html>
      `);

    } catch (err) {
      console.error(
        "PUBLIC REQUEST CONFIRMATION ERROR:",
        err
      );

      return res.status(500).send(
        "Unable to load the request confirmation page."
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
