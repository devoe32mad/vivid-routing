const express = require("express");
const app = express();

const port = process.env.PORT || 8080;

let events = [];

/**
 * SIMPLE ROTATING ADS
 */
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

/**
 * HOME
 */
app.get("/", (req, res) => {
  res.send(`
    <h1>Vivid Smart Routing 🚀</h1>
    <a href="/r/school1">Test QR</a><br/>
    <a href="/dashboard">Dashboard</a><br/>
    <a href="/admin">Admin</a>
  `);
});

/**
 * ROUTING → CHOICE PAGE
 */
app.get("/r/:placementId", (req, res) => {
  const placement = placements[req.params.placementId];

  if (!placement) return res.send("Placement not found");

  const ad = placement.ads[placement.currentIndex];

  placement.currentIndex =
    (placement.currentIndex + 1) % placement.ads.length;

  events.push({
    type: "scan",
    advertiser: ad.advertiser,
    campaign: ad.campaign,
    time: new Date().toLocaleString()
  });

  res.send(`
    <h1>${ad.advertiser}</h1>
    <p>${ad.campaign}</p>

    <a href="/click/offer/${ad.advertiser}">Get Offer</a><br/>
    <a href="/click/maps/${ad.advertiser}">Google Maps</a><br/>
    <a href="/click/waze/${ad.advertiser}">Waze</a>
  `);
});

/**
 * CLICK TRACKING
 */
app.get("/click/:type/:advertiser", (req, res) => {
  const { type, advertiser } = req.params;

  const ad = placements.school1.ads.find(a => a.advertiser === advertiser);

  if (!ad) return res.send("Ad not found");

  events.push({
    type,
    advertiser,
    time: new Date().toLocaleString()
  });

  if (type === "offer") return res.redirect(ad.offerUrl);
  if (type === "maps") return res.redirect(ad.mapsUrl);
  if (type === "waze") return res.redirect(ad.wazeUrl);

  res.redirect("/");
});

/**
 * DASHBOARD (MONEY METRICS)
 */
app.get("/dashboard", (req, res) => {
  const placementCost = 800;

  const scans = events.filter(e => e.type === "scan").length;
  const offers = events.filter(e => e.type === "offer").length;
  const maps = events.filter(e => e.type === "maps").length;
  const waze = events.filter(e => e.type === "waze").length;

  const intentClicks = offers + maps + waze;
  const intentRate = scans ? ((intentClicks / scans) * 100).toFixed(1) : 0;

  const conversionRate = 0.1;
  const avgCustomerValue = 50;

  const customers = Math.round(intentClicks * conversionRate);
  const revenue = customers * avgCustomerValue;

  const cac = customers ? (placementCost / customers).toFixed(2) : 0;
  const costPerScan = scans ? (placementCost / scans).toFixed(2) : 0;
  const roi = ((revenue - placementCost) / placementCost * 100).toFixed(1);

  res.send(`
    <h1>📊 Vivid ROI Dashboard</h1>

    <h2>Top Metrics</h2>
    <p>Impressions: 146,000 (modeled)</p>
    <p>Scans: ${scans}</p>
    <p>Intent Clicks: ${intentClicks}</p>
    <p>Intent Rate: ${intentRate}%</p>

    <h2>Revenue Model</h2>
    <p>Customers: ${customers}</p>
    <p>Revenue: $${revenue}</p>

    <h2>Efficiency</h2>
    <p>Placement Cost: $${placementCost}</p>
    <p>Cost per Scan: $${costPerScan}</p>
    <p>CAC: $${cac}</p>
    <p>ROI: ${roi}%</p>

    <hr/>

    <h3>Breakdown</h3>
    <p>Offer Clicks: ${offers}</p>
    <p>Maps Clicks: ${maps}</p>
    <p>Waze Clicks: ${waze}</p>
  `);
});

/**
 * ADMIN
 */
app.get("/admin", (req, res) => {
  res.send(`
    <h1>Admin Panel</h1>
    <p>Advertisers:</p>
    <ul>
      <li>Dunkin</li>
      <li>Chick-fil-A</li>
    </ul>
    <a href="/dashboard">View Dashboard</a>
  `);
});

/**
 * START SERVER (CRITICAL)
 */
app.listen(port, () => {
  console.log("Server running on port " + port);
});
