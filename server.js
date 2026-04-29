const express = require("express");

const app = express();
app.use(express.urlencoded({ extended: true }));

let events = [];

const placements = {
  school1: {
    name: "Gulf Coast HS Car Line",
    cost: 800,
    advertisers: [
      {
        name: "Dunkin",
        weight: 70,
        campaignCost: 500,
        avgCustomerValue: 50,
        campaigns: [
          {
            name: "Morning Coffee Offer",
            offerUrl: "https://www.dunkindonuts.com",
            stores: [
              {
                name: "Dunkin - Pine Ridge",
                weight: 70,
                inventory: "high",
                mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dunkin+Pine+Ridge+Naples+FL",
                wazeUrl: "https://waze.com/ul?q=Dunkin%20Pine%20Ridge%20Naples%20FL&navigate=yes"
              },
              {
                name: "Dunkin - Immokalee",
                weight: 30,
                inventory: "normal",
                mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dunkin+Immokalee+Naples+FL",
                wazeUrl: "https://waze.com/ul?q=Dunkin%20Immokalee%20Naples%20FL&navigate=yes"
              }
            ]
          }
        ]
      },
      {
        name: "Chick-fil-A",
        weight: 30,
        campaignCost: 300,
        avgCustomerValue: 40,
        campaigns: [
          {
            name: "Lunch Family Meal",
            offerUrl: "https://www.chick-fil-a.com",
            stores: [
              {
                name: "Chick-fil-A - Naples",
                weight: 100,
                inventory: "normal",
                mapsUrl: "https://www.google.com/maps/search/?api=1&query=Chick-fil-A+Naples+FL",
                wazeUrl: "https://waze.com/ul?q=Chick-fil-A%20Naples%20FL&navigate=yes"
              }
            ]
          }
        ]
      }
    ]
  }
};

app.get("/", (req, res) => {
  res.send(`
    <h1>Vivid Smart Routing is live 🚀</h1>
    <p><a href="/r/school1">Test School QR</a></p>
    <p><a href="/dashboard">Dashboard</a></p>
    <p><a href="/admin">Admin</a></p>
  `);
});

app.get("/r/:placementId", (req, res) => {
  const placementId = req.params.placementId;
  const placement = placements[placementId];

  if (!placement) return res.send("Placement not found");

  const advertiser = pickWeighted(placement.advertisers);
  const campaign = advertiser.campaigns[0];
  const store = pickWeighted(campaign.stores);

  events.push({
    type: "scan",
    placementId,
    placementName: placement.name,
    advertiser: advertiser.name,
    campaign: campaign.name,
    store: store.name,
    time: new Date().toLocaleString()
  });

  res.send(renderChoicePage({ placementId, placement, advertiser, campaign, store }));
});

app.get("/go/:type/:placementId/:advertiser/:campaign/:store", (req, res) => {
  const { type, placementId, advertiser, campaign, store } = req.params;

  const placement = placements[placementId];
  const ad = placement.advertisers.find(a => a.name === advertiser);
  const camp = ad.campaigns.find(c => c.name === campaign);
  const selectedStore = camp.stores.find(s => s.name === store);

  events.push({
    type,
    placementId,
    placementName: placement.name,
    advertiser,
    campaign,
    store,
    time: new Date().toLocaleString()
  });

  if (type === "maps") return res.redirect(selectedStore.mapsUrl);
  if (type === "waze") return res.redirect(selectedStore.wazeUrl);
  if (type === "offer") return res.redirect(camp.offerUrl);

  res.redirect("/");
});

app.get("/dashboard", (req, res) => {
  const scans = events.filter(e => e.type === "scan").length;
  const maps = events.filter(e => e.type === "maps").length;
  const waze = events.filter(e => e.type === "waze").length;
  const offers = events.filter(e => e.type === "offer").length;
  const navClicks = maps + waze;
  const intentRate = scans ? Math.round((navClicks / scans) * 100) : 0;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vivid Routing Dashboard</title>
      <style>
        body { font-family: Arial; margin:0; background:#f4f7f1; color:#123d25; }
        .header { background:#123d25; color:white; padding:28px 40px; }
        .wrap { padding:30px 40px; }
        .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:30px; }
        .card { background:white; border-radius:16px; padding:22px; box-shadow:0 8px 20px rgba(0,0,0,.08); }
        .label { color:#6b7b70; font-size:13px; }
        .num { font-size:32px; font-weight:bold; margin-top:8px; }
        table { width:100%; background:white; border-collapse:collapse; border-radius:16px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,.08); }
        th, td { padding:14px; border-bottom:1px solid #e6eee6; text-align:left; }
        th { background:#eaf3e8; }
        .btn { background:#2f7d46; color:white; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:bold; }
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
          <div class="card"><div class="label">Map Clicks</div><div class="num">${maps}</div></div>
          <div class="card"><div class="label">Waze Clicks</div><div class="num">${waze}</div></div>
          <div class="card"><div class="label">Store Intent Rate</div><div class="num">${intentRate}%</div></div>
          <div class="card"><div class="label">Offer Clicks</div><div class="num">${offers}</div></div>
          <div class="card"><div class="label">Navigation Clicks</div><div class="num">${navClicks}</div></div>
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
            <th>Store</th>
          </tr>
          ${events.slice(-30).reverse().map(e => `
            <tr>
              <td>${e.time}</td>
              <td>${e.type}</td>
              <td>${e.placementName}</td>
              <td>${e.advertiser}</td>
              <td>${e.campaign}</td>
              <td>${e.store}</td>
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
    <h1>Vivid Admin</h1>
    <p>This is the control center preview.</p>

    <h2>${placement.name}</h2>

    <table border="1" cellpadding="10">
      <tr>
        <th>Advertiser</th>
        <th>Weight</th>
        <th>Campaign</th>
        <th>Stores</th>
      </tr>
      ${placement.advertisers.map(ad => `
        <tr>
          <td>${ad.name}</td>
          <td>${ad.weight}%</td>
          <td>${ad.campaigns[0].name}</td>
          <td>${ad.campaigns[0].stores.map(s => `${s.name} (${s.inventory})`).join("<br>")}</td>
        </tr>
      `).join("")}
    </table>

    <p><a href="/dashboard">Back to Dashboard</a></p>
  `);
});

function renderChoicePage({ placementId, placement, advertiser, campaign, store }) {
  const enc = encodeURIComponent;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${advertiser.name} Offer</title>
      <style>
        body { font-family: Arial; background:#f4f7f1; color:#123d25; padding:30px; }
        .card { max-width:520px; margin:auto; background:white; padding:28px; border-radius:20px; box-shadow:0 8px 24px rgba(0,0,0,.12); }
        h1 { margin-top:0; }
        .btn { display:block; background:#2f7d46; color:white; padding:16px; margin:12px 0; text-align:center; text-decoration:none; border-radius:12px; font-weight:bold; }
        .sub { color:#6b7b70; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${advertiser.name}</h1>
        <p class="sub">${campaign.name}</p>
        <h2>${store.name}</h2>
        <p>Choose how you want to continue:</p>

        <a class="btn" href="/go/maps/${enc(placementId)}/${enc(advertiser.name)}/${enc(campaign.name)}/${enc(store.name)}">Open in Google Maps</a>
        <a class="btn" href="/go/waze/${enc(placementId)}/${enc(advertiser.name)}/${enc(campaign.name)}/${enc(store.name)}">Open in Waze</a>
        <a class="btn" href="/go/offer/${enc(placementId)}/${enc(advertiser.name)}/${enc(campaign.name)}/${enc(store.name)}">View Offer</a>

        <p class="sub">Powered by Vivid Spots</p>
      </div>
    </body>
    </html>
  `;
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;

  for (const item of items) {
    if (random < item.weight) return item;
    random -= item.weight;
  }

  return items[0];
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});