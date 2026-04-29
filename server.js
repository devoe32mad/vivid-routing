const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

let events = [];

const placements = {
  school1: {
    name: "School 1 Car Line",
    currentIndex: 0,
    ads: [
      {
        advertiser: "Dunkin",
        campaign: "Morning Coffee Offer",
        offerUrl: "https://www.dunkindonuts.com",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dunkin+Naples+FL",
        wazeUrl: "https://waze.com/ul?q=Dunkin%20Naples%20FL&navigate=yes"
      },
      {
        advertiser: "Chick-fil-A",
        campaign: "Lunch Family Meal",
        offerUrl: "https://www.chick-fil-a.com",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Chick-fil-A+Naples+FL",
        wazeUrl: "https://waze.com/ul?q=Chick-fil-A%20Naples%20FL&navigate=yes"
      }
    ]
  }
};

app.get("/", (req, res) => {
  res.send(`
    <h1>Vivid Smart Routing 🚀</h1>
    <a href="/r/school1">Test QR</a><br/>
    <a href="/dashboard">Dashboard</a><br/>
    <a href="/admin">Admin</a>
  `);
});

app.get("/r/:placementId", (req, res) => {
  const placementId = req.params.placementId;
  const placement = placements[placementId];

  if (!placement) {
    return res.status(404).send("Placement not found");
  }

  const ad = placement.ads[placement.currentIndex];

  placement.currentIndex = (placement.currentIndex + 1) % placement.ads.length;

  events.push({
    type: "scan",
    placementId,
    placementName: placement.name,
    advertiser: ad.advertiser,
    campaign: ad.campaign,
    time: new Date().toLocaleString()
  });

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${ad.advertiser} | Vivid</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f7f1;
            color: #123d25;
            padding: 30px;
          }
          .card {
            max-width: 520px;
            margin: 40px auto;
            background: white;
            padding: 28px;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,.12);
          }
          h1 {
            margin-top: 0;
            font-size: 34px;
          }
          .sub {
            color: #63756b;
            font-size: 16px;
          }
          .btn {
            display: block;
            background: #2f7d46;
            color: white;
            padding: 16px;
            margin: 12px 0;
            text-align: center;
            text-decoration: none;
            border-radius: 12px;
            font-weight: bold;
          }
          .footer {
            margin-top: 24px;
            font-size: 13px;
            color: #63756b;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${ad.advertiser}</h1>
          <p class="sub">${ad.campaign}</p>
          <p>Choose how you want to continue:</p>

          <a class="btn" href="/click/offer/${placementId}/${encodeURIComponent(ad.advertiser)}">Get Offer</a>
          <a class="btn" href="/click/maps/${placementId}/${encodeURIComponent(ad.advertiser)}">Open in Google Maps</a>
          <a class="btn" href="/click/waze/${placementId}/${encodeURIComponent(ad.advertiser)}">Open in Waze</a>

          <p class="footer">Powered by Vivid Spots — Physical Placements. Digital Intelligence.</p>
        </div>
      </body>
    </html>
  `);
});

app.get("/click/:type/:placementId/:advertiser", (req, res) => {
  const { type, placementId, advertiser } = req.params;
  const placement = placements[placementId];

  if (!placement) {
    return res.status(404).send("Placement not found");
  }

  const decodedAdvertiser = decodeURIComponent(advertiser);
  const ad = placement.ads.find((item) => item.advertiser === decodedAdvertiser);

  if (!ad) {
    return res.status(404).send("Advertiser not found");
  }

  events.push({
    type,
    placementId,
    placementName: placement.name,
    advertiser: ad.advertiser,
    campaign: ad.campaign,
    time: new Date().toLocaleString()
  });

  if (type === "offer") return res.redirect(ad.offerUrl);
  if (type === "maps") return res.redirect(ad.mapsUrl);
  if (type === "waze") return res.redirect(ad.wazeUrl);

  return res.redirect("/");
});

app.get("/dashboard", (req, res) => {
  const scans = events.filter((e) => e.type === "scan").length;
  const offers = events.filter((e) => e.type === "offer").length;
  const maps = events.filter((e) => e.type === "maps").length;
  const waze = events.filter((e) => e.type === "waze").length;
  const intentClicks = offers + maps + waze;
  const intentRate = scans ? Math.round((intentClicks / scans) * 100) : 0;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vivid Dashboard</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f4f7f1;
            color: #123d25;
          }
          .header {
            background: #123d25;
            color: white;
            padding: 28px 40px;
          }
          .wrap {
            padding: 30px 40px;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
          }
          .card {
            background: white;
            border-radius: 16px;
            padding: 22px;
            box-shadow: 0 8px 20px rgba(0,0,0,.08);
          }
          .label {
            color: #6b7b70;
            font-size: 13px;
          }
          .num {
            font-size: 32px;
            font-weight: bold;
            margin-top: 8px;
          }
          table {
            width: 100%;
            background: white;
            border-collapse: collapse;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(0,0,0,.08);
          }
          th, td {
            padding: 14px;
            border-bottom: 1px solid #e6eee6;
            text-align: left;
          }
          th {
            background: #eaf3e8;
          }
          .btn {
            background: #2f7d46;
            color: white;
            padding: 10px 14px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Vivid Traffic Routing Dashboard</h1>
          <p>Scans → Store Intent → Offers → ROI</p>
        </div>

        <div class="wrap">
          <p>
            <a class="btn" href="/r/school1">Test QR</a>
            <a class="btn" href="/admin">Admin</a>
          </p>

          <div class="cards">
            <div class="card"><div class="label">Total Scans</div><div class="num">${scans}</div></div>
            <div class="card"><div class="label">Offer Clicks</div><div class="num">${offers}</div></div>
            <div class="card"><div class="label">Google Maps Clicks</div><div class="num">${maps}</div></div>
            <div class="card"><div class="label">Waze Clicks</div><div class="num">${waze}</div></div>
            <div class="card"><div class="label">Intent Clicks</div><div class="num">${intentClicks}</div></div>
            <div class="card"><div class="label">Intent Rate</div><div class="num">${intentRate}%</div></div>
            <div class="card"><div class="label">Active Placement</div><div class="num">school1</div></div>
            <div class="card"><div class="label">Model</div><div class="num">Rotating</div></div>
          </div>

          <h2>Recent Activity</h2>
          <table>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Placement</th>
              <th>Advertiser</th>
              <th>Campaign</th>
            </tr>
            ${events.slice(-30).reverse().map((e) => `
              <tr>
                <td>${e.time}</td>
                <td>${e.type}</td>
                <td>${e.placementName}</td>
                <td>${e.advertiser}</td>
                <td>${e.campaign}</td>
              </tr>
            `).join("")}
          </table>
        </div>
      </body>
    </html>
  `);
});

app.get("/admin", (req, res) => {
  const placement = placements.school1;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vivid Admin</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f4f7f1;
            color: #123d25;
          }
          .header {
            background: #123d25;
            color: white;
            padding: 28px 40px;
          }
          .wrap {
            padding: 30px 40px;
          }
          table {
            width: 100%;
            background: white;
            border-collapse: collapse;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(0,0,0,.08);
          }
          th, td {
            padding: 14px;
            border-bottom: 1px solid #e6eee6;
            text-align: left;
          }
          th {
            background: #eaf3e8;
          }
          .btn {
            background: #2f7d46;
            color: white;
            padding: 10px 14px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Vivid Admin</h1>
          <p>Campaign routing control preview</p>
        </div>

        <div class="wrap">
          <p>
            <a class="btn" href="/">Home</a>
            <a class="btn" href="/dashboard">Dashboard</a>
            <a class="btn" href="/r/school1">Test QR</a>
          </p>

          <h2>${placement.name}</h2>

          <table>
            <tr>
              <th>Advertiser</th>
              <th>Campaign</th>
              <th>Offer URL</th>
              <th>Maps URL</th>
              <th>Waze URL</th>
            </tr>
            ${placement.ads.map((ad) => `
              <tr>
                <td>${ad.advertiser}</td>
                <td>${ad.campaign}</td>
                <td>${ad.offerUrl}</td>
                <td>${ad.mapsUrl}</td>
                <td>${ad.wazeUrl}</td>
              </tr>
            `).join("")}
          </table>

          <h2>Next Admin Features</h2>
          <ul>
            <li>Change advertiser rotation percentages</li>
            <li>Turn advertisers on/off</li>
            <li>Edit offer links</li>
            <li>Edit Google Maps / Waze destination links</li>
            <li>Add multiple placements and stores</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});