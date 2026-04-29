const express = require("express");

const app = express();

let scans = [];

const placementCost = 800;
const conversionRate = 0.10;

const campaigns = [
  {
    name: "Dunkin",
    weight: 70,
    url: "https://www.dunkindonuts.com",
    campaignCost: 500,
    avgCustomerValue: 50
  },
  {
    name: "Chick-fil-A",
    weight: 30,
    url: "https://www.chick-fil-a.com",
    campaignCost: 300,
    avgCustomerValue: 40
  }
];

app.get("/", (req, res) => {
  res.send(`
    <h1>Vivid Smart Routing is live 🚀</h1>
    <p><a href="/r/school1">Test School QR</a></p>
    <p><a href="/dashboard">View Dashboard</a></p>
  `);
});

app.get("/r/:slug", (req, res) => {
  const slug = req.params.slug;
  const selected = pickCampaign(campaigns);

  scans.push({
    location: slug,
    advertiser: selected.name,
    time: new Date().toLocaleString()
  });

  console.log("Scan from:", slug, "→ Sending to:", selected.name);

  res.redirect(selected.url);
});

app.get("/dashboard", (req, res) => {
  const totalScans = scans.length;
  const estimatedCustomers = Math.round(totalScans * conversionRate);
  const estimatedRevenue = campaigns.reduce((sum, c) => {
    const count = scans.filter(s => s.advertiser === c.name).length;
    return sum + Math.round(count * conversionRate) * c.avgCustomerValue;
  }, 0);

  const placementROI = placementCost
    ? Math.round(((estimatedRevenue - placementCost) / placementCost) * 100)
    : 0;

  const costPerScan = totalScans ? (placementCost / totalScans).toFixed(2) : "0.00";
  const blendedCAC = estimatedCustomers ? (placementCost / estimatedCustomers).toFixed(2) : "0.00";

  const campaignRows = campaigns.map(c => {
    const scanCount = scans.filter(s => s.advertiser === c.name).length;
    const customers = Math.round(scanCount * conversionRate);
    const revenue = customers * c.avgCustomerValue;
    const cac = customers ? (c.campaignCost / customers).toFixed(2) : "0.00";
    const roi = c.campaignCost
      ? Math.round(((revenue - c.campaignCost) / c.campaignCost) * 100)
      : 0;

    return { ...c, scanCount, customers, revenue, cac, roi };
  });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vivid ROI Dashboard</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #f4f7f1;
          color: #16301f;
        }
        .header {
          background: #123d25;
          color: white;
          padding: 28px 40px;
        }
        .container {
          padding: 35px 40px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 30px;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 8px 20px rgba(0,0,0,.08);
        }
        .label {
          color: #6a7a70;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .number {
          font-size: 32px;
          font-weight: bold;
        }
        table {
          width: 100%;
          background: white;
          border-collapse: collapse;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(0,0,0,.08);
          margin-bottom: 30px;
        }
        th, td {
          padding: 15px;
          border-bottom: 1px solid #e6eee6;
          text-align: left;
        }
        th {
          background: #eaf3e8;
        }
        .button {
          display: inline-block;
          background: #2f7d46;
          color: white;
          padding: 12px 18px;
          border-radius: 12px;
          text-decoration: none;
          margin-right: 10px;
          font-weight: bold;
        }
        .good {
          color: #1f7a3f;
          font-weight: bold;
        }
        .bad {
          color: #b00020;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Vivid ROI Dashboard</h1>
        <p>Physical Placements. Digital Intelligence.</p>
      </div>

      <div class="container">
        <p>
          <a class="button" href="/r/school1">Test School QR</a>
          <a class="button" href="/dashboard">Refresh Dashboard</a>
        </p>

        <div class="cards">
          <div class="card">
            <div class="label">Total Scans</div>
            <div class="number">${totalScans}</div>
          </div>

          <div class="card">
            <div class="label">Estimated Customers</div>
            <div class="number">${estimatedCustomers}</div>
          </div>

          <div class="card">
            <div class="label">Estimated Revenue</div>
            <div class="number">$${estimatedRevenue}</div>
          </div>

          <div class="card">
            <div class="label">Placement ROI</div>
            <div class="number ${placementROI >= 0 ? "good" : "bad"}">${placementROI}%</div>
          </div>

          <div class="card">
            <div class="label">Placement Cost</div>
            <div class="number">$${placementCost}</div>
          </div>

          <div class="card">
            <div class="label">Cost Per Scan</div>
            <div class="number">$${costPerScan}</div>
          </div>

          <div class="card">
            <div class="label">Blended CAC</div>
            <div class="number">$${blendedCAC}</div>
          </div>

          <div class="card">
            <div class="label">Conversion Assumption</div>
            <div class="number">${conversionRate * 100}%</div>
          </div>
        </div>

        <h2>Advertiser ROI</h2>
        <table>
          <tr>
            <th>Advertiser</th>
            <th>Scans</th>
            <th>Est. Customers</th>
            <th>Campaign Cost</th>
            <th>Avg Customer Value</th>
            <th>Est. Revenue</th>
            <th>CAC</th>
            <th>ROI</th>
          </tr>
          ${campaignRows.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.scanCount}</td>
              <td>${c.customers}</td>
              <td>$${c.campaignCost}</td>
              <td>$${c.avgCustomerValue}</td>
              <td>$${c.revenue}</td>
              <td>$${c.cac}</td>
              <td class="${c.roi >= 0 ? "good" : "bad"}">${c.roi}%</td>
            </tr>
          `).join("")}
        </table>

        <h2>Recent Scan Activity</h2>
        <table>
          <tr>
            <th>Time</th>
            <th>Placement</th>
            <th>Routed To</th>
          </tr>
          ${scans.slice(-20).reverse().map(scan => `
            <tr>
              <td>${scan.time}</td>
              <td>${scan.location}</td>
              <td>${scan.advertiser}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    </body>
    </html>
  `);
});

function pickCampaign(campaigns) {
  const total = campaigns.reduce((sum, c) => sum + c.weight, 0);
  let random = Math.random() * total;

  for (const c of campaigns) {
    if (random < c.weight) return c;
    random -= c.weight;
  }

  return campaigns[0];
}

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
app.get("/dashboard", (req, res) => {
  res.json({
    spots: [
      {
        name: "School Car Line",
        impressions: 146000,
        scans: 10000,
        customers: 104,
        spend: 800,
        cac: (800 / 104).toFixed(2),
        roi: ((104 * 25 - 800) / 800).toFixed(2) // assuming $25 value per customer
      },
      {
        name: "Gym Entrance",
        impressions: 120000,
        scans: 8500,
        customers: 90,
        spend: 800,
        cac: (800 / 90).toFixed(2),
        roi: ((90 * 25 - 800) / 800).toFixed(2)
      }
    ]
  });
});