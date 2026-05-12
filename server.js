# Replace Entire server.js With This Stable Version

```js
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "vivid-secret",
    resave: false,
    saveUninitialized: false,
  })
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

app.get("/", (req, res) => {
  res.send(`
    <h1>Vivid Platform</h1>
    <a href="/login">Login</a>
  `);
});

app.get("/init-db", async (req, res) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        advertiser TEXT,
        name TEXT,
        avg_customer_value NUMERIC DEFAULT 50,
        conversion_rate NUMERIC DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        name TEXT,
        location TEXT,
        annual_impressions NUMERIC DEFAULT 146000,
        placement_cost NUMERIC DEFAULT 800,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id SERIAL PRIMARY KEY,
        space_id INT,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS qr_campaigns (
        id SERIAL PRIMARY KEY,
        qr_id INT,
        campaign_id INT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        qr_id INT,
        campaign_id INT,
        type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      INSERT INTO users (email,password,role)
      VALUES ('admin@vividspots.com','admin123','admin')
      ON CONFLICT (email)
      DO UPDATE SET password='admin123'
    `);

    const campaignCheck = await query(`SELECT COUNT(*) FROM campaigns`);

    if (Number(campaignCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO campaigns (advertiser,name,avg_customer_value,conversion_rate)
        VALUES
        ('Dunkin','Morning Coffee Offer',50,10),
        ('Pepsi','Low Inventory Store Push',35,12)
      `);
    }

    const spaceCheck = await query(`SELECT COUNT(*) FROM spaces`);

    if (Number(spaceCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO spaces (name,location,annual_impressions,placement_cost)
        VALUES
        ('School 1 Car Line','Naples, FL',146000,800)
      `);
    }

    const qrCheck = await query(`SELECT COUNT(*) FROM qr_codes`);

    if (Number(qrCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO qr_codes (space_id,name)
        VALUES (1,'QR 1')
      `);
    }

    const assignCheck = await query(`SELECT COUNT(*) FROM qr_campaigns`);

    if (Number(assignCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO qr_campaigns (qr_id,campaign_id,is_active)
        VALUES (1,1,true)
      `);
    }

    res.send("DB initialized successfully");
  } catch (err) {
    res.send(err.message);
  }
});

app.get("/login", (req, res) => {
  res.send(`
    <h1>Login</h1>

    <form method="POST" action="/login">
      <input name="email" placeholder="email" />
      <br /><br />
      <input name="password" type="password" placeholder="password" />
      <br /><br />
      <button type="submit">Login</button>
    </form>

    <br />

    admin@vividspots.com<br />
    admin123
  `);
});

app.post("/login", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [req.body.email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.send("User not found");
    }

    if (user.password !== req.body.password) {
      return res.send("Invalid password");
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    res.redirect("/dashboard");
  } catch (err) {
    res.send(err.message);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/r/:id", async (req, res) => {
  const qrId = Number(req.params.id);

  const active = await query(`
    SELECT c.*
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    WHERE qc.qr_id = $1
    AND qc.is_active = true
    LIMIT 1
  `,[qrId]);

  const campaign = active.rows[0];

  if (!campaign) {
    return res.send("No campaign assigned");
  }

  await query(
    `INSERT INTO events (qr_id,campaign_id,type) VALUES ($1,$2,$3)`,
    [qrId, campaign.id, "scan"]
  );

  res.send(`
    <h1>${campaign.name}</h1>
    <p>${campaign.advertiser}</p>

    <a href="/offer/${qrId}">Offer Click</a>
    <br /><br />
    <a href="/maps/${qrId}">Google Maps</a>
  `);
});

app.get("/offer/:id", async (req, res) => {
  const qrId = Number(req.params.id);

  const active = await query(`
    SELECT c.*
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    WHERE qc.qr_id = $1
    AND qc.is_active = true
    LIMIT 1
  `,[qrId]);

  const campaign = active.rows[0];

  await query(
    `INSERT INTO events (qr_id,campaign_id,type) VALUES ($1,$2,$3)`,
    [qrId, campaign.id, "offer"]
  );

  res.send("Offer clicked");
});

app.get("/maps/:id", async (req, res) => {
  const qrId = Number(req.params.id);

  const active = await query(`
    SELECT c.*
    FROM qr_campaigns qc
    JOIN campaigns c ON c.id = qc.campaign_id
    WHERE qc.qr_id = $1
    AND qc.is_active = true
    LIMIT 1
  `,[qrId]);

  const campaign = active.rows[0];

  await query(
    `INSERT INTO events (qr_id,campaign_id,type) VALUES ($1,$2,$3)`,
    [qrId, campaign.id, "maps"]
  );

  res.redirect("https://google.com/maps");
});

app.get("/dashboard", requireLogin, async (req, res) => {
  try {
    const qrRows = await query(`
      SELECT
      qr.id,
      qr.name,
      qr.created_at,
      s.name AS location_name,
      s.location,
      s.annual_impressions,
      s.placement_cost
      FROM qr_codes qr
      LEFT JOIN spaces s ON s.id = qr.space_id
      ORDER BY qr.id
    `);

    const campaignRows = await query(`
      SELECT * FROM campaigns ORDER BY id
    `);

    let qrTable = "";

    for (const qr of qrRows.rows) {
      const metrics = await query(`
        SELECT
        COUNT(*) FILTER (WHERE type='scan') AS scans,
        COUNT(*) FILTER (WHERE type='offer') AS offers,
        COUNT(*) FILTER (WHERE type='maps') AS maps
        FROM events
        WHERE qr_id = $1
      `,[qr.id]);

      const row = metrics.rows[0];

      const scans = Number(row.scans || 0);
      const offers = Number(row.offers || 0);
      const maps = Number(row.maps || 0);

      const intent = offers + maps;

      const liveDays = Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(qr.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )
      );

      const allocatedCost =
        (Number(qr.placement_cost || 800) / 365) * liveDays;

      const customers = Math.round(intent * 0.1);

      const revenue = customers * 50;

      const cac = customers > 0
        ? allocatedCost / customers
        : 0;

      const roi = allocatedCost > 0
        ? ((revenue - allocatedCost) / allocatedCost) * 100
        : 0;

      const cpm = Number(qr.annual_impressions || 0) > 0
        ? (allocatedCost / Number(qr.annual_impressions)) * 1000
        : 0;

      qrTable += `
        <tr>
          <td>${qr.name}</td>
          <td>${qr.location_name || ""}</td>
          <td>${scans}</td>
          <td>${intent}</td>
          <td>$${allocatedCost.toFixed(2)}</td>
          <td>$${cac.toFixed(2)}</td>
          <td>$${cpm.toFixed(2)}</td>
          <td>${roi.toFixed(1)}%</td>
        </tr>
      `;
    }

    let campaignTable = "";

    for (const campaign of campaignRows.rows) {
      const metrics = await query(`
        SELECT
        COUNT(*) FILTER (WHERE type='scan') AS scans,
        COUNT(*) FILTER (WHERE type='offer') AS offers,
        COUNT(*) FILTER (WHERE type='maps') AS maps
        FROM events
        WHERE campaign_id = $1
      `,[campaign.id]);

      const row = metrics.rows[0];

      const scans = Number(row.scans || 0);
      const offers = Number(row.offers || 0);
      const maps = Number(row.maps || 0);

      const intent = offers + maps;

      const assignments = await query(`
        SELECT
        s.placement_cost,
        qc.started_at
        FROM qr_campaigns qc
        JOIN qr_codes qr ON qr.id = qc.qr_id
        JOIN spaces s ON s.id = qr.space_id
        WHERE qc.campaign_id = $1
      `,[campaign.id]);

      let totalCost = 0;

      for (const a of assignments.rows) {
        const days = Math.max(
          1,
          Math.ceil(
            (Date.now() - new Date(a.started_at).getTime()) /
            (1000 * 60 * 60 * 24)
          )
        );

        totalCost +=
          (Number(a.placement_cost || 800) / 365) * days;
      }

      const customers = Math.round(
        intent * (Number(campaign.conversion_rate || 10) / 100)
      );

      const revenue =
        customers * Number(campaign.avg_customer_value || 50);

      const cac = customers > 0
        ? totalCost / customers
        : 0;

      const roi = totalCost > 0
        ? ((revenue - totalCost) / totalCost) * 100
        : 0;

      campaignTable += `
        <tr>
          <td>${campaign.advertiser}</td>
          <td>${campaign.name}</td>
          <td>${scans}</td>
          <td>${intent}</td>
          <td>$${revenue.toFixed(2)}</td>
          <td>$${totalCost.toFixed(2)}</td>
          <td>$${cac.toFixed(2)}</td>
          <td>${roi.toFixed(1)}%</td>
        </tr>
      `;
    }

    res.send(`
      <h1>ROI Dashboard</h1>

      <a href="/logout">Logout</a>

      <h2>QR ROI</h2>

      <table border="1" cellpadding="8">
        <tr>
          <th>QR</th>
          <th>Location</th>
          <th>Scans</th>
          <th>Intent</th>
          <th>Allocated Cost</th>
          <th>CAC</th>
          <th>CPM</th>
          <th>ROI</th>
        </tr>
        ${qrTable}
      </table>

      <br /><br />

      <h2>Campaign ROI</h2>

      <table border="1" cellpadding="8">
        <tr>
          <th>Advertiser</th>
          <th>Campaign</th>
          <th>Scans</th>
          <th>Intent</th>
          <th>Revenue</th>
          <th>Allocated Cost</th>
          <th>CAC</th>
          <th>ROI</th>
        </tr>
        ${campaignTable}
      </table>
    `);
  } catch (err) {
    res.send("Dashboard error: " + err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

# Then Do This

1. Delete everything in current server.js
2. Paste this entire file
3. Save
4. Commit:

```txt
stable rebuild
```

5. Deploy
6. Run:

```txt
/init-db
```

7. Login:

```txt
admin@vividspots.com
admin123
```
