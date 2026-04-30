const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let events = [];

const placements = {
  school1: {
    name: "School 1 Car Line",
    host: "Demo School",
    location: "Naples, FL",
    annualImpressions: 146000,
    placementCost: 800,
    dealOfDayRevenue: 50,
    hostPayout: 300,
    ads: [
      {
        advertiser: "Dunkin",
        campaign: "Morning Coffee Offer",
        deal: "Start your day with a local coffee stop.",
        featured: true,
        featuredWeight: 80,
        standardWeight: 20,
        offerUrl: "https://www.dunkindonuts.com",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dunkin+Naples+FL",
        wazeUrl: "https://waze.com/ul?q=Dunkin%20Naples%20FL&navigate=yes",
        campaignCost: 500,
        avgCustomerValue: 50
      },
      {
        advertiser: "Chick-fil-A",
        campaign: "Lunch Family Meal",
        deal: "Quick lunch option for busy families.",
        featured: false,
        featuredWeight: 80,
        standardWeight: 20,
        offerUrl: "https://www.chick-fil-a.com",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Chick-fil-A+Naples+FL",
        wazeUrl: "https://waze.com/ul?q=Chick-fil-A%20Naples%20FL&navigate=yes",
        campaignCost: 300,
        avgCustomerValue: 40
      }
    ]
  }
};

function pickWeightedAd(ads) {
  const totalWeight = ads.reduce((sum, ad) => {
    return sum + (ad.featured ? ad.featuredWeight : ad.standardWeight);
  }, 0);

  let random = Math.random() * totalWeight;

  for (const ad of ads) {
    const weight = ad.featured ? ad.featuredWeight : ad.standardWeight;
    if (random < weight) return ad;
    random -= weight;
  }

  return ads[0];
}

async function saveEventToDb(event) {
  try {
    await pool.query(
      `INSERT INTO events
       (placement_id, placement_name, advertiser, campaign, type, featured)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.placementId || "school1",
        event.placement || event.placementName || "School 1 Car Line",
        event.advertiser || "",
        event.campaign || "",
        event.type || "",
        event.featured || false
      ]
    );
  } catch (err) {
    console.error("DB save failed:", err.message);
  }
}

async function getDbEvents() {
  try {
    const result = await pool.query(
      `SELECT placement_id, placement_name, advertiser, campaign, type, featured, created_at
       FROM events
       ORDER BY created_at DESC
       LIMIT 500`
    );

    return result.rows.map(row => ({
      placementId: row.placement_id,
      placement: row.placement_name,
      advertiser: row.advertiser,
      campaign: row.campaign,
      type: row.type,
      featured: row.featured,
      time: new Date(row.created_at).toLocaleString()
    }));
  } catch (err) {
    console.error("DB read failed:", err.message);
    return events.slice().reverse();
  }
}

function pageShell(title, content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #f4f7f1;
          color: #123d25;
        }
        .topbar {
          background: linear-gradient(135deg, #123d25, #2f7d46);
          color: white;
          padding: 30px 40px;
        }
        .brand {
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #d7eadb;
          font-weight: bold;
        }
        h1 {
          margin: 8px 0 6px;
          font-size: 34px;
        }
        h2 {
          margin-top: 34px;
        }
        .subtitle {
          color: #d7eadb;
          margin: 0;
        }
        .wrap {
          padding: 30px 40px;
          max-width: 1180px;
          margin: 0 auto;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin: 22px 0 30px;
        }
        .card {
          background: white;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 8px 22px rgba(0,0,0,.08);
        }
        .label {
          color: #65776b;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .num {
          font-size: 30px;
          font-weight: bold;
        }
        .good { color: #1f7a3f; }
        .bad { color: #b00020; }
        .btn {
          display: inline-block;
          background: #2f7d46;
          color: white;
          padding: 12px 16px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: bold;
          margin: 5px 8px 5px 0;
        }
        .btn.secondary {
          background: #123d25;
        }
        table {
          width: 100%;
          background: white;
          border-collapse: collapse;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 8px 22px rgba(0,0,0,.08);
          margin-bottom: 30px;
        }
        th, td {
          padding: 14px;
          border-bottom: 1px solid #e7eee7;
          text-align: left;
          vertical-align: top;
        }
        th {
          background: #eaf3e8;
          color: #123d25;
        }
        .note {
          background: white;
          border-left: 6px solid #2f7d46;
          padding: 18px;
          border-radius: 16px;
          box-shadow: 0 8px 18px rgba(0,0,0,.06);
          margin: 20px 0;
        }
        .choice-card {
          max-width: 560px;
          margin: 36px auto;
          background: white;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 10px 28px rgba(0,0,0,.14);
        }
        .choice-btn {
          display: block;
          background: #2f7d46;
          color: white;
          padding: 17px;
          margin: 12px 0;
          text-align: center;
          text-decoration: none;
          border-radius: 14px;
          font-weight: bold;
          font-size: 16px;
        }
        .choice-btn.dark {
          background: #123d25;
        }
        .pill {
          display: inline-block;
          background: #eaf3e8;
          padding: 7px 10px;
          border-radius: 999px;
          color: #123d25;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .deal-pill {
          display: inline-block;
          background: #fff4d6;
          padding: 8px 12px;
          border-radius: 999px;
          color: #7a4b00;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .footer {
          color: #65776b;
          font-size: 13px;
          margin-top: 24px;
        }
        @media (max-width: 800px) {
          .topbar, .wrap { padding: 22px; }
          .cards { grid-template-columns: 1fr; }
          h1 { font-size: 28px; }
        }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}

function calculateStats(placement, sourceEvents) {
  const placementEvents = sourceEvents.filter(e => e.placementId === "school1" || e.placement === placement.name);

  const scans = placementEvents.filter(e => e.type === "scan").length;
  const featuredScans = placementEvents.filter(e => e.type === "scan" && e.featured).length;
  const offers = placementEvents.filter(e => e.type === "offer").length;
  const maps = placementEvents.filter(e => e.type === "maps").length;
  const waze = placementEvents.filter(e => e.type === "waze").length;

  const intentClicks = offers + maps + waze;
  const intentRate = scans ? ((intentClicks / scans) * 100).toFixed(1) : "0.0";

  const conversionRate = 0.1;
  const avgCustomerValue = 50;
  const customers = Math.round(intentClicks * conversionRate);
  const revenue = customers * avgCustomerValue;

  const cac = customers ? (placement.placementCost / customers).toFixed(2) : "0.00";
  const costPerScan = scans ? (placement.placementCost / scans).toFixed(2) : "0.00";
  const costPerIntent = intentClicks ? (placement.placementCost / intentClicks).toFixed(2) : "0.00";
  const roi = (((revenue - placement.placementCost) / placement.placementCost) * 100).toFixed(1);
  const cpm = ((placement.placementCost / placement.annualImpressions) * 1000).toFixed(2);

  const adminRevenue = placement.placementCost + placement.dealOfDayRevenue;
  const vividNet = adminRevenue - placement.hostPayout;

  return {
    scans,
    featuredScans,
    offers,
    maps,
    waze,
    intentClicks,
    intentRate,
    customers,
    revenue,
    cac,
    costPerScan,
    costPerIntent,
    roi,
    cpm,
    adminRevenue,
    hostPayout: placement.hostPayout,
    vividNet
  };
}

app.get("/", (req, res) => {
  const content = `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Smart Routing Engine</h1>
      <p class="subtitle">Physical Placements. Digital Intelligence.</p>
    </div>

    <div class="wrap">
      <div class="note">
        Scan traffic rotates between advertisers, prioritizes the Deal of the Day, routes users to offers or stores, and tracks real-world intent.
      </div>

      <a class="btn" href="/r/school1">Test QR Experience</a>
      <a class="btn secondary" href="/dashboard">View Dashboard</a>
      <a class="btn secondary" href="/admin">Admin Preview</a>
      <a class="btn secondary" href="/analytics">Analytics JSON</a>
    </div>
  `;

  res.send(pageShell("Vivid Smart Routing", content));
});

app.get("/r/:placementId", async (req, res) => {
  const placementId = req.params.placementId;
  const placement = placements[placementId];

  if (!placement) return res.status(404).send("Placement not found");

  const ad = pickWeightedAd(placement.ads);

  const event = {
    type: "scan",
    placementId,
    placement: placement.name,
    advertiser: ad.advertiser,
    campaign: ad.campaign,
    featured: ad.featured,
    time: new Date().toLocaleString()
  };

  events.push(event);
  await saveEventToDb(event);

  const content = `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>${ad.advertiser}</h1>
      <p class="subtitle">${ad.campaign}</p>
    </div>

    <div class="wrap">
      <div class="choice-card">
        ${ad.featured ? `<span class="deal-pill">🔥 Deal of the Day</span>` : `<span class="pill">Featured Local Offer</span>`}
        <h1>${ad.advertiser}</h1>
        <p style="color:#65776b;">${ad.deal}</p>

        <a class="choice-btn" href="/click/offer/${encodeURIComponent(ad.advertiser)}">View Offer</a>
        <a class="choice-btn dark" href="/click/maps/${encodeURIComponent(ad.advertiser)}">Open in Google Maps</a>
        <a class="choice-btn dark" href="/click/waze/${encodeURIComponent(ad.advertiser)}">Open in Waze</a>

        <p class="footer">Powered by Vivid Spots — measurable local engagement from real-world placements.</p>
      </div>
    </div>
  `;

  res.send(pageShell(`${ad.advertiser} Offer`, content));
});

app.get("/click/:type/:advertiser", async (req, res) => {
  const type = req.params.type;
  const advertiser = decodeURIComponent(req.params.advertiser);
  const ad = placements.school1.ads.find(a => a.advertiser === advertiser);

  if (!ad) return res.status(404).send("Ad not found");

  const event = {
    type,
    placementId: "school1",
    placement: placements.school1.name,
    advertiser: ad.advertiser,
    campaign: ad.campaign,
    featured: ad.featured,
    time: new Date().toLocaleString()
  };

  events.push(event);
  await saveEventToDb(event);

  if (type === "offer") return res.redirect(ad.offerUrl);
  if (type === "maps") return res.redirect(ad.mapsUrl);
  if (type === "waze") return res.redirect(ad.wazeUrl);

  res.redirect("/");
});

app.get("/dashboard", async (req, res) => {
  const placement = placements.school1;
  const dbEvents = await getDbEvents();
  const stats = calculateStats(placement, dbEvents);

  const advertiserRows = placement.ads.map(ad => {
    const adEvents = dbEvents.filter(e => e.advertiser === ad.advertiser);
    const scans = adEvents.filter(e => e.type === "scan").length;
    const clicks = adEvents.filter(e => e.type !== "scan").length;
    const intentRate = scans ? ((clicks / scans) * 100).toFixed(1) : "0.0";
    const customers = Math.round(clicks * 0.1);
    const revenue = customers * ad.avgCustomerValue;
    const roi = (((revenue - ad.campaignCost) / ad.campaignCost) * 100).toFixed(1);

    return `
      <tr>
        <td>${ad.featured ? "🔥 " : ""}${ad.advertiser}</td>
        <td>${ad.campaign}</td>
        <td>${ad.featured ? "Deal of the Day" : "Standard"}</td>
        <td>${scans}</td>
        <td>${clicks}</td>
        <td>${intentRate}%</td>
        <td>$${ad.campaignCost}</td>
        <td>$${revenue}</td>
        <td class="${roi >= 0 ? "good" : "bad"}">${roi}%</td>
      </tr>
    `;
  }).join("");

  const activityRows = dbEvents.slice(0, 25).map(e => `
    <tr>
      <td>${e.time}</td>
      <td>${e.type}</td>
      <td>${e.advertiser}</td>
      <td>${e.campaign}</td>
      <td>${e.featured ? "Yes" : "No"}</td>
    </tr>
  `).join("");

  const content = `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>ROI Dashboard</h1>
      <p class="subtitle">Visibility → Engagement → Store Intent → Revenue</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/r/school1">Test QR</a>
      <a class="btn secondary" href="/admin">Admin</a>
      <a class="btn secondary" href="/analytics">Analytics JSON</a>

      <div class="note">
        <strong>Placement:</strong> ${placement.name}<br/>
        <strong>Host:</strong> ${placement.host}<br/>
        <strong>Model:</strong> Rotating ad placement with Deal of the Day priority and store-intent tracking.
      </div>

      <div class="cards">
        <div class="card"><div class="label">Annual Impressions</div><div class="num">${placement.annualImpressions.toLocaleString()}</div></div>
        <div class="card"><div class="label">Total Scans</div><div class="num">${stats.scans}</div></div>
        <div class="card"><div class="label">Featured Scans</div><div class="num">${stats.featuredScans}</div></div>
        <div class="card"><div class="label">Intent Clicks</div><div class="num">${stats.intentClicks}</div></div>
        <div class="card"><div class="label">Intent Rate</div><div class="num">${stats.intentRate}%</div></div>
        <div class="card"><div class="label">Estimated Customers</div><div class="num">${stats.customers}</div></div>
        <div class="card"><div class="label">Estimated Revenue</div><div class="num">$${stats.revenue}</div></div>
        <div class="card"><div class="label">CAC</div><div class="num">$${stats.cac}</div></div>
        <div class="card"><div class="label">ROI</div><div class="num ${stats.roi >= 0 ? "good" : "bad"}">${stats.roi}%</div></div>
        <div class="card"><div class="label">Placement Cost</div><div class="num">$${placement.placementCost}</div></div>
        <div class="card"><div class="label">CPM</div><div class="num">$${stats.cpm}</div></div>
        <div class="card"><div class="label">Cost Per Intent</div><div class="num">$${stats.costPerIntent}</div></div>
      </div>

      <h2>Advertiser Performance</h2>
      <table>
        <tr>
          <th>Advertiser</th>
          <th>Campaign</th>
          <th>Placement Type</th>
          <th>Scans</th>
          <th>Intent Clicks</th>
          <th>Intent Rate</th>
          <th>Campaign Cost</th>
          <th>Est. Revenue</th>
          <th>ROI</th>
        </tr>
        ${advertiserRows}
      </table>

      <h2>Recent Activity</h2>
      <table>
        <tr>
          <th>Time</th>
          <th>Event</th>
          <th>Advertiser</th>
          <th>Campaign</th>
          <th>Featured</th>
        </tr>
        ${activityRows}
      </table>
    </div>
  `;

  res.send(pageShell("Vivid ROI Dashboard", content));
});

app.get("/admin", async (req, res) => {
  const placement = placements.school1;
  const dbEvents = await getDbEvents();
  const stats = calculateStats(placement, dbEvents);

  const rows = placement.ads.map(ad => `
    <tr>
      <td>${ad.featured ? "🔥 " : ""}${ad.advertiser}</td>
      <td>${ad.campaign}</td>
      <td>${ad.featured ? "Deal of the Day" : "Standard"}</td>
      <td>${ad.featured ? ad.featuredWeight : ad.standardWeight}</td>
      <td>$${ad.campaignCost}</td>
      <td>$${ad.avgCustomerValue}</td>
      <td>${ad.offerUrl}</td>
    </tr>
  `).join("");

  const content = `
    <div class="topbar">
      <div class="brand">Vivid Spots</div>
      <h1>Admin Preview</h1>
      <p class="subtitle">Campaign routing, monetization, and placement controls.</p>
    </div>

    <div class="wrap">
      <a class="btn" href="/dashboard">Dashboard</a>
      <a class="btn secondary" href="/r/school1">Test QR</a>

      <div class="note">
        <strong>Admin-only revenue view:</strong><br/>
        Advertiser/placement revenue: $${placement.placementCost}<br/>
        Deal of the Day revenue: $${placement.dealOfDayRevenue}<br/>
        Host payout: $${stats.hostPayout}<br/>
        <strong>Vivid net revenue: $${stats.vividNet}</strong>
      </div>

      <h2>Active Campaigns</h2>
      <table>
        <tr>
          <th>Advertiser</th>
          <th>Campaign</th>
          <th>Type</th>
          <th>Routing Weight</th>
          <th>Campaign Cost</th>
          <th>Avg Customer Value</th>
          <th>Offer URL</th>
        </tr>
        ${rows}
      </table>

      <h2>Next Admin Controls</h2>
      <table>
        <tr><th>Feature</th><th>Purpose</th></tr>
        <tr><td>Change Campaign Anytime</td><td>Swap offers without changing the QR code while keeping historical metrics.</td></tr>
        <tr><td>Campaign History</td><td>Preserve performance by campaign, advertiser, and date range.</td></tr>
        <tr><td>Deal of the Day</td><td>Monetize priority placement for the best daily offer.</td></tr>
        <tr><td>Admin Login</td><td>Separate Vivid, host, and advertiser dashboards.</td></tr>
        <tr><td>QR Generator</td><td>Generate printable QR codes for every placement.</td></tr>
      </table>
    </div>
  `;

  res.send(pageShell("Vivid Admin", content));
});

app.get("/analytics", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'scan') AS scans,
        COUNT(*) FILTER (WHERE type IN ('offer','maps','waze')) AS intent_clicks,
        COUNT(*) FILTER (WHERE featured = true AND type = 'scan') AS featured_scans
      FROM events
    `);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        placement_id TEXT,
        placement_name TEXT,
        advertiser TEXT,
        campaign TEXT,
        type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
    `);

    res.send("DB initialized and updated");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error initializing DB: " + err.message);
  }
});

    res.send("DB initialized");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error initializing DB: " + err.message);
  }
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
