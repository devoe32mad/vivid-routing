const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

/**
 * SIMPLE DATA (safe defaults)
 */
const placements = {
  school1: {
    name: "School 1",
    ads: [
      {
        advertiser: "Dunkin",
        url: "https://www.dunkindonuts.com",
      },
      {
        advertiser: "Chick-fil-A",
        url: "https://www.chick-fil-a.com",
      },
    ],
    currentIndex: 0,
  },
};

/**
 * SAFE ROTATING ROUTE
 */
app.get("/r/:placementId", (req, res) => {
  const placementId = req.params.placementId;
  const placement = placements[placementId];

  if (!placement) {
    return res.status(404).send("Placement not found");
  }

  const ad = placement.ads[placement.currentIndex];

  // rotate index
  placement.currentIndex =
    (placement.currentIndex + 1) % placement.ads.length;

  console.log(`Redirecting to ${ad.advertiser}: ${ad.url}`);

  return res.redirect(ad.url);
});

/**
 * DASHBOARD
 */
app.get("/dashboard", (req, res) => {
  res.send(`
    <h1>Vivid Dashboard</h1>
    <p>Placements Active: ${Object.keys(placements).length}</p>
    <a href="/r/school1">Test School 1</a>
  `);
});

/**
 * ADMIN (simple for now)
 */
app.get("/admin", (req, res) => {
  res.send(`
    <h1>Admin Panel</h1>
    <p>Manage placements (next step)</p>
    <a href="/dashboard">Go to Dashboard</a>
  `);
});

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
 * START SERVER
 */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});