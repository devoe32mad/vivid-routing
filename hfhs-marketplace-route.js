"use strict";

module.exports = function registerHfhsMarketplace(app, deps) {
  const q = deps.q;
  const escapeHtml = deps.escapeHtml;
  function imageFor(title) {
    const v = String(title || "").toLowerCase();

    // Fundraising / gala
    if (v.includes("pink ball")) {
      return "https://www.henryford.com/-/media/project/hfhs/henryford/calendar/fundraising-events/pink-ball/pink-ball-save-the-date-2026-lg.jpg?extension=webp&hash=B07D8ABE8535DAC3CB9C7E6D024B691E";
    }
    if (v.includes("medallion")) {
      return "https://visitorlando.widen.net/content/h67zmuxgug/jpeg/182240-bonnet-creek-ballroom-event1.jpg?color=ffffffff&crop=true&h=1252&position=c&q=80&quality=80&u=kggsuk";
    }

    // Trade-show / conference exhibitor cards
    if (
      v.includes("obesity symposium") ||
      v.includes("advanced endoscopy") ||
      v.includes("sinus and nasal") ||
      v.includes("cancer research symposium")
    ) {
      return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/hcp/med-ed/residencies-wyn/emergency-medicine/didactics-lecture.jpg?extension=webp&hash=D74BB9D42AE45836AA5351B5B2B8B70E";
    }

    // CME / medical education
    if (
      v.includes("breast oncology") ||
      v.includes("motown women") ||
      v.includes("thoracic cancer") ||
      v.includes("gu cancer")
    ) {
      return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/hcp/med-ed/residencies-wyn/emergency-medicine/didactics-practice.jpg?extension=webp&hash=C179435DEE8CA1677135921C0FB559D7";
    }

    // Golf outings
    if (
      v.includes("warren golf") ||
      v.includes("providence golf") ||
      v.includes("hospice golf") ||
      v.includes("rochester golf")
    ) {
      return "https://www.lantheus.com/assets/lantheus-golf2025-8-1536x1024.jpg";
    }

    // Destination Grand is a premium gala / fundraising experience
    if (v.includes("destination grand ball")) {
      return "https://images.squarespace-cdn.com/content/v1/5f053e64617861499e8324ad/198757a7-fc25-4cb2-82ca-82961d0d044c/9118-guardsmen-250222.jpg";
    }

    // Future of Health uses an actual HFHS development image
    if (v.includes("future of health")) {
      return "https://www.henryford.com/-/media/project/hfhs/henryford/images/content-images/henry-ford/campaign/future-of-health/foh-cta-hospital-groundbreaking.jpg?extension=webp&h=496&hash=FCB62CB7564B3DD9FCF631556419144C&iar=0&w=747";
    }

    // Ambassador Club / M1 Concourse
    if (v.includes("ambassador club")) {
      return "https://www.autodromodimodena.it/file/1920x0/servizi_agenzie/eventi_aziendali/modena_eventi-incentive5.jpg";
    }

    // Safe healthcare fallback
    return "https://www.henryford.com/-/media/project/hfhs/henryford/news/2026/hhdetroit.jpg?extension=webp&h=450&hash=131FAC73E953D0035031AB8FF9C52BB2&iar=0&w=600";
  }

  function imagePosition(title) {
    const v = String(title || "").toLowerCase();
    if (v.includes("pink ball")) return "center 42%";
    if (v.includes("medallion")) return "center 55%";
    if (v.includes("obesity symposium")) return "center 42%";
    if (v.includes("advanced endoscopy")) return "center 45%";
    if (v.includes("sinus and nasal")) return "center 44%";
    if (v.includes("cancer research symposium")) return "center 42%";
    if (v.includes("breast oncology")) return "center 38%";
    if (v.includes("motown women")) return "center 38%";
    if (v.includes("thoracic cancer")) return "center 38%";
    if (v.includes("gu cancer")) return "center 38%";
    if (v.includes("warren golf")) return "center 46%";
    if (v.includes("providence golf")) return "center 46%";
    if (v.includes("hospice golf")) return "center 46%";
    if (v.includes("rochester golf")) return "center 46%";
    if (v.includes("destination grand")) return "center 42%";
    if (v.includes("future of health")) return "center 50%";
    if (v.includes("ambassador club")) return "center 48%";
    return "center center";
  }

  function imageFit(title) {
    const v = String(title || "").toLowerCase();
    // Official event graphics should be fully visible rather than aggressively cropped.
    if (v.includes("pink ball")) return "contain";
    return "cover";
  }



  app.get("/advertise/henry-ford-health-demo/program/:programId", async (req, res) => {
    try {
      const programId = Number(req.params.programId);
      if (!Number.isInteger(programId) || programId <= 0) {
        return res.status(400).send("Invalid sponsorship category.");
      }

      const orgResult = await q(
        "SELECT id,name FROM organizations WHERE slug=$1 AND COALESCE(is_active,true)=true LIMIT 1",
        ["henry-ford-health-demo"]
      );
      if (!orgResult.rows.length) return res.status(404).send("Marketplace not found.");
      const org = orgResult.rows[0];

      const programResult = await q(
        `SELECT id,name,description
           FROM organization_programs
          WHERE id=$1
            AND organization_id=$2
            AND COALESCE(is_active,true)=true
          LIMIT 1`,
        [programId, org.id]
      );
      if (!programResult.rows.length) return res.status(404).send("Sponsorship category not found.");
      const program = programResult.rows[0];

      const eventsResult = await q(
        `SELECT
            s.id AS space_id,
            s.name AS event_name,
            s.location AS event_location,
            s.description AS event_description,
            s.live_date AS event_date,
            COUNT(oo.id)::int AS opportunity_count
          FROM spaces s
          JOIN organization_opportunities oo
            ON oo.space_id=s.id
           AND oo.program_id=$2
          WHERE s.organization_id=$1
            AND COALESCE(s.is_archived,false)=false
            AND COALESCE(oo.is_active,true)=true
            AND oo.status='Available'
          GROUP BY s.id,s.name,s.location,s.description,s.live_date
          ORDER BY COALESCE(s.live_date,'9999-12-31'::date),s.name`,
        [org.id, programId]
      );

      const formatEventDate = value => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-US", {
          month:"long",
          day:"numeric",
          year:"numeric",
          timeZone:"UTC"
        });
      };

      const eventCards = eventsResult.rows.map(event => {
        const url =
          "/advertise/henry-ford-health-demo/location/" +
          Number(event.space_id) +
          "?program_id=" +
          programId;

        const dateLabel = formatEventDate(event.event_date);
        const imageTitle = event.event_name || program.name;

        return `
          <a class="event-card" href="${url}">
            <div class="event-photo">
              <img
                src="${imageFor(imageTitle)}"
                alt=""
                style="object-fit:${imageFit(imageTitle)};object-position:${imagePosition(imageTitle)};"
              >
              <div class="event-shade"></div>
              <div class="event-count">
                ${Number(event.opportunity_count || 0)} sponsorship options
              </div>
            </div>

            <div class="event-body">
              <div class="event-kicker">
                ${escapeHtml(program.name)}
              </div>

              <h2>${escapeHtml(event.event_name)}</h2>

              ${dateLabel ? `<div class="event-meta">${escapeHtml(dateLabel)}</div>` : ""}
              ${event.event_location ? `<div class="event-meta">${escapeHtml(event.event_location)}</div>` : ""}

              <p>
                ${escapeHtml(event.event_description || "")}
              </p>

              <div class="event-action">
                View sponsorship opportunities →
              </div>
            </div>
          </a>
        `;
      }).join("");

      res.set("X-Robots-Tag","noindex, nofollow, noarchive");

      return res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(program.name)} | Henry Ford Health Vivid Demo</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f5f7fa;color:#17324d;font-family:Arial,Helvetica,sans-serif}
.top{background:#fff;border-bottom:1px solid #dce4ec;padding:18px 5vw}
.top a{text-decoration:none;color:#125ca8;font-weight:900}
.hero{background:linear-gradient(120deg,#092f57,#155d92);color:#fff;padding:42px 5vw}
.hero>div,.wrap{max-width:1280px;margin:auto}
.hero-kicker{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#c7e3f5}
.hero h1{font-size:clamp(34px,5vw,52px);margin:7px 0 10px}
.hero p{max-width:900px;font-size:17px;line-height:1.6;color:#e7f2fa}
.wrap{padding:38px 28px 70px}
.helper{font-size:18px;color:#5f7285;line-height:1.55;max-width:900px;margin:0 0 22px}
.event-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
.event-card{display:block;background:#fff;border:1px solid #dbe4ed;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 6px 20px rgba(17,48,82,.08);transition:.18s ease}
.event-card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(17,48,82,.14)}
.event-photo{height:230px;position:relative;overflow:hidden;background:#eef3f7}
.event-photo img{width:100%;height:100%;display:block}
.event-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,30,53,0) 35%,rgba(6,30,53,.55) 100%)}
.event-count{position:absolute;right:14px;top:14px;background:rgba(255,255,255,.94);color:#15577f;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900}
.event-body{padding:20px}
.event-kicker{font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:900;color:#4c7da6}
.event-body h2{font-size:25px;line-height:1.2;margin:7px 0 10px;color:#183e62}
.event-meta{font-size:13px;color:#4f667b;margin:3px 0}
.event-body p{font-size:14px;line-height:1.55;color:#627487;margin:13px 0 18px}
.event-action{border-top:1px solid #e8edf2;padding-top:14px;color:#1768a7;font-size:13px;font-weight:900}
@media(max-width:800px){.event-grid{grid-template-columns:1fr}.event-photo{height:220px}.wrap{padding-left:16px;padding-right:16px}}
</style>
</head>
<body>
  <div class="top">
    <a href="/advertise/henry-ford-health-demo">← All sponsorship categories</a>
  </div>

  <div class="hero">
    <div>
      <div class="hero-kicker">Choose an event</div>
      <h1>${escapeHtml(program.name)}</h1>
      <p>${escapeHtml(program.description || "")}</p>
    </div>
  </div>

  <main class="wrap">
    <p class="helper">
      Select a specific Henry Ford Health event or program to view the sponsorship inventory available within it.
    </p>

    <div class="event-grid">
      ${eventCards || "<p>No events are currently loaded in this category.</p>"}
    </div>
  </main>
</body>
</html>`);
    } catch (error) {
      console.error("HFHS EVENT BROWSER ERROR:", error);
      return res.status(500).send("Unable to load HFHS events.");
    }
  });

  app.get("/advertise/henry-ford-health-demo/location/:locationId", async (req, res) => {
    try {
      const locationId=Number(req.params.locationId);
      const programId=Number(req.query.program_id);
      if(!Number.isInteger(locationId)||locationId<=0) return res.status(400).send("Invalid location.");

      const orgResult=await q(
        "SELECT id,name FROM organizations WHERE slug=$1 AND COALESCE(is_active,true)=true LIMIT 1",
        ["henry-ford-health-demo"]
      );
      if(!orgResult.rows.length) return res.status(404).send("Marketplace not found.");
      const org=orgResult.rows[0];

      const locationResult=await q(
        "SELECT id,name,location FROM spaces WHERE id=$1 AND organization_id=$2 AND COALESCE(is_archived,false)=false LIMIT 1",
        [locationId,org.id]
      );
      if(!locationResult.rows.length) return res.status(404).send("Opportunity group not found.");
      const location=locationResult.rows[0];

      const params=[org.id,locationId];
      let programWhere="";
      if(Number.isInteger(programId)&&programId>0){programWhere=" AND oo.program_id=$3";params.push(programId);}

      const result=await q(
        `SELECT oo.id,oo.title,oo.description,oo.category,oo.price,oo.pricing_unit,oo.status,oo.display_order,
                oo.space_id,oo.program_id,op.name AS program_name,op.description AS program_description
           FROM organization_opportunities oo
           JOIN organization_programs op ON op.id=oo.program_id
          WHERE oo.organization_id=$1
            AND oo.space_id=$2
            AND COALESCE(oo.is_active,true)=true
            AND oo.status='Available'
            ${programWhere}
          ORDER BY COALESCE(oo.display_order,999),oo.id`,
        params
      );

      const rows=result.rows;
      const heading=rows[0]?.program_name || location.name;
      const intro=rows[0]?.program_description || "";
      const businessVivid = module.exports.businessSection();
      const cards=rows.map(o=>{
        const n=Number(o.price);
        const price=Number.isFinite(n)&&n>0
          ? n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits: 0, minimumFractionDigits: 0})
          : "Custom";
        const url="/advertise/henry-ford-health-demo/location/"+Number(o.space_id)+"/opportunity/"+Number(o.id);
        return `<a class="card" href="${url}">
          <div class="photo">
            <img src="${imageFor(o.title)}" alt="" style="object-fit:${imageFit(o.title)};object-position:${imagePosition(o.title)};">
            <span>Available</span>
          </div>
          <div class="body">
            <div class="cat">${escapeHtml(o.category||heading)}</div>
            <h3>${escapeHtml(o.title)}</h3>
            <p>${escapeHtml(String(o.description||"").split("\\n")[0])}</p>
            <div class="mini-meta">
              <span>${price}</span>
              <span>Request online</span>
            </div>
            <div class="bottom"><strong>View details</strong><b>Continue →</b></div>
          </div>
        </a>`;
      }).join("");

      res.set("X-Robots-Tag","noindex, nofollow, noarchive");
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(heading)} | Henry Ford Health Vivid Demo</title>
      <style>
      *{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#17324d;font-family:Arial,Helvetica,sans-serif}
      .top{background:#fff;border-bottom:1px solid #dce4ec;padding:18px 5vw}.top a{text-decoration:none;color:#125ca8;font-weight:900}
      .hero{background:linear-gradient(120deg,#092f57,#155d92);color:#fff;padding:38px 5vw}.hero>div,.wrap{max-width:1280px;margin:auto}
      .hero h1{font-size:clamp(32px,4vw,48px);margin:4px 0 9px}.hero p{max-width:900px;color:#e6f1fa;font-size:17px;line-height:1.55}
      .wrap{padding:34px 28px 60px}.count{font-weight:800;color:#425a6f;margin-bottom:18px}
      .event-tools{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 26px}
      .tool-btn{appearance:none;border:1px solid #bfd0df;background:#fff;color:#174d78;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}
      .tool-btn:hover{background:#f2f7fb}
      .journey{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0 0 26px}
      .journey-step{background:#fff;border:1px solid #dce5ed;border-radius:11px;padding:13px;font-size:13px;color:#4f667a}
      .journey-step b{display:block;color:#173f64;margin-bottom:4px}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
      .card{background:#fff;border:1px solid #dbe4ed;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 4px 16px rgba(17,48,82,.07);display:flex;flex-direction:column}
      .card:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(17,48,82,.13)}
      .photo{height:190px;position:relative;overflow:hidden;background:#eef3f7}.photo img{width:100%;height:100%;display:block}
      .photo span{position:absolute;right:10px;top:10px;background:#e8f6ef;color:#16724a;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}
      .body{padding:17px;display:flex;flex-direction:column;flex:1}.cat{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#477ca8}
      h3{font-size:21px;line-height:1.25;margin:7px 0 10px}.body p{font-size:14px;line-height:1.52;color:#627487;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
      .mini-meta{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px}.mini-meta span{background:#f2f6fa;border-radius:999px;padding:6px 8px;font-size:11px;font-weight:800;color:#486279}
      .bottom{margin-top:auto;border-top:1px solid #e8edf2;padding-top:13px;display:flex;justify-content:space-between;gap:10px}.bottom strong{color:#123f69}.bottom b{font-size:12px;color:#1768a7}
      .business-vivid{margin-top:30px;padding:24px;background:#fff;border:1px solid #cbdce8;border-radius:14px}
      .business-vivid h2{font-size:25px;margin:9px 0 12px}.business-vivid p{max-width:960px;color:#52697c;line-height:1.6}
      .business-vivid .tool-btn{display:inline-block;text-decoration:none;margin:5px 0}.business-vivid .optional-note{font-size:12px;margin-bottom:0}
      .performance{margin-top:34px;background:#0f3f69;color:#fff;border-radius:16px;padding:24px}
      .performance h2{margin:0 0 8px}.performance p{color:#dcecf8;max-width:900px;line-height:1.55}
      .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px}.metric{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:14px}.metric b{display:block;font-size:22px}.metric span{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#d5e7f5}
      @media(max-width:1050px){.grid{grid-template-columns:repeat(2,1fr)}.journey{grid-template-columns:repeat(2,1fr)}.metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.grid{grid-template-columns:1fr}.wrap{padding-left:16px;padding-right:16px}.journey{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}}
      </style></head><body>
      <div class="top"><a href="/advertise/henry-ford-health-demo">← Henry Ford Health Sponsorship Marketplace</a></div>
      <div class="hero"><div><div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#c7e3f5">Available Sponsorship Inventory</div><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p></div></div>
      <main class="wrap">
        <div class="event-tools">
          <button class="tool-btn" type="button" onclick="navigator.clipboard.writeText(location.href)">Copy Event Link</button>
          <button class="tool-btn" type="button" onclick="navigator.share ? navigator.share({title:document.title,url:location.href}) : navigator.clipboard.writeText(location.href)">Share Event</button>
        </div>

        <div class="journey">
          <div class="journey-step"><b>1. Browse</b>Review available sponsorship inventory.</div>
          <div class="journey-step"><b>2. Select</b>Choose the opportunity that fits.</div>
          <div class="journey-step"><b>3. Onboard</b>Submit company details and assets.</div>
          <div class="journey-step"><b>4. Fulfill</b>HFHS manages sponsor deliverables.</div>
          <div class="journey-step"><b>5. Measure</b>Review post-event performance.</div>
        </div>

        <div class="count">${rows.length} sponsorship opportunities available for this event</div>
        <div class="grid">${cards}</div>
        ${businessVivid}

        <section class="performance">
          <h2>What sponsors can receive after activation</h2>
          <p>Vivid connects the sponsorship record to measurable engagement so HFHS can provide a clearer post-event performance summary and support the renewal conversation.</p>
          <div class="metrics">
            <div class="metric"><b>Scans</b><span>Physical engagement</span></div>
            <div class="metric"><b>Clicks</b><span>Destination activity</span></div>
            <div class="metric"><b>Actions</b><span>Qualified response</span></div>
            <div class="metric"><b>Value</b><span>Attributed outcome</span></div>
            <div class="metric"><b>ROI</b><span>Performance view</span></div>
          </div>
        </section>
      </main>
      </body></html>`);
    } catch(error) {
      console.error("HFHS LOCATION MARKETPLACE ERROR:",error);
      return res.status(500).send("Unable to load HFHS sponsorship opportunities.");
    }
  });

  app.get("/advertise/henry-ford-health-demo", async (req, res) => {
    try {
      const orgResult = await q(
        "SELECT id,name,public_heading FROM organizations WHERE slug=$1 AND COALESCE(is_active,true)=true LIMIT 1",
        ["henry-ford-health-demo"]
      );
      if (!orgResult.rows.length) return res.status(404).send("Marketplace not found.");
      const org = orgResult.rows[0];

      const result = await q(
        `SELECT
            op.id AS program_id,
            op.name AS program_name,
            op.description AS program_description,
            op.display_order AS program_order,
            COUNT(oo.id)::int AS opportunity_count,
            MIN(oo.space_id) AS space_id,
            MIN(oo.title) FILTER (WHERE oo.display_order = (
              SELECT MIN(oo2.display_order)
              FROM organization_opportunities oo2
              WHERE oo2.organization_id=oo.organization_id
                AND oo2.program_id=oo.program_id
                AND COALESCE(oo2.is_active,true)=true
                AND oo2.status='Available'
            )) AS sample_title
          FROM organization_programs op
          JOIN organization_opportunities oo ON oo.program_id=op.id
          JOIN spaces s ON s.id=oo.space_id
          WHERE op.organization_id=$1
            AND COALESCE(op.is_active,true)=true
            AND COALESCE(oo.is_active,true)=true
            AND oo.status='Available'
            AND COALESCE(s.is_archived,false)=false
          GROUP BY op.id,op.name,op.description,op.display_order
          ORDER BY COALESCE(op.display_order,999),op.name`,
        [org.id]
      );

      const displayName = name => {
        const v=String(name||"").toLowerCase();
        if(v.includes("fundraising")) return "Balls & Signature Events";
        if(v.includes("trade")) return "Trade Shows & Conferences";
        if(v.includes("cme")) return "CME & Medical Education";
        if(v.includes("community")) return "Golf Outings & Community Fundraisers";
        if(v.includes("sports")) return "Strategic Partnerships & Future of Health";
        return name || "Sponsorship Opportunities";
      };

      const categoryImage = name => {
        const v=String(name||"").toLowerCase();
        if(v.includes("fundraising")) return imageFor("Pink Ball");
        if(v.includes("trade")) return imageFor("4th Annual Obesity Symposium");
        if(v.includes("cme")) return imageFor("Annual Breast Oncology Symposium");
        if(v.includes("community")) return imageFor("Warren Golf Classic");
        if(v.includes("sports")) return imageFor("Future of Health");
        return imageFor("");
      };

      const tiles=result.rows.map(row=>{
        const title=displayName(row.program_name);
        const url="/advertise/henry-ford-health-demo/program/"+Number(row.program_id);
        const count=Number(row.opportunity_count||0);
        return `<a class="category-card" href="${url}">
          <div class="category-photo">
            <img src="${categoryImage(row.program_name)}" alt="" style="object-fit:cover;object-position:center center;">
            <div class="shade"></div>
            <div class="category-count">${count} opportunities</div>
            <div class="category-copy">
              <h2>${escapeHtml(title)}</h2>
              <p>${escapeHtml(row.program_description || "")}</p>
              <span>Explore opportunities →</span>
            </div>
          </div>
        </a>`;
      }).join("");

      res.set("X-Robots-Tag","noindex, nofollow, noarchive");
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Henry Ford Health Sponsorship Marketplace | Vivid Demo</title>
      <style>
      *{box-sizing:border-box}
      body{margin:0;background:#f5f7fa;color:#17324d;font-family:Arial,Helvetica,sans-serif}
      .top{background:#fff;border-bottom:1px solid #dce4ec;padding:18px 5vw;display:flex;gap:14px;align-items:center}
      .brand{font-size:22px;font-weight:900;color:#125ca8}
      .demo{font-size:11px;font-weight:900;background:#fceaf3;color:#8b315f;padding:6px 9px;border-radius:999px}
      .hero{background:linear-gradient(120deg,#092f57,#155d92);color:#fff;padding:48px 5vw}
      .hero>div,.wrap{max-width:1280px;margin:auto}
      .hero h1{font-size:clamp(34px,5vw,56px);margin:5px 0 12px}
      .hero p{max-width:900px;font-size:18px;line-height:1.55;color:#e6f1fa}
      .wrap{padding:38px 28px 70px}
      .introline{font-size:18px;color:#5d7287;margin:0 0 22px;max-width:900px;line-height:1.55}
      .category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
      .category-card{display:block;text-decoration:none;color:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(16,47,80,.12);transition:.18s ease;background:#123f69}
      .category-card:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(16,47,80,.18)}
      .category-card:last-child:nth-child(odd){grid-column:1/-1}
      .category-photo{height:310px;position:relative;overflow:hidden}
      .category-photo img{width:100%;height:100%;display:block;object-fit:cover;object-position:center center}
      .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,28,51,.08) 10%,rgba(5,28,51,.82) 100%)}
      .category-count{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.94);color:#17567f;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900}
      .category-copy{position:absolute;left:24px;right:24px;bottom:22px}
      .category-copy h2{font-size:30px;line-height:1.1;margin:0 0 9px}
      .category-copy p{font-size:14px;line-height:1.5;margin:0 0 13px;color:#edf5fb;max-width:720px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .category-copy span{font-weight:900;font-size:14px}
      @media(max-width:800px){.category-grid{grid-template-columns:1fr}.category-card:last-child:nth-child(odd){grid-column:auto}.category-photo{height:270px}}
      </style></head><body>
      <div class="top"><div class="brand">Henry Ford Health</div><div class="demo">PRIVATE VIVID CONCEPT</div></div>
      <div class="hero"><div>
        <div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#c7e3f5">Sponsorship & Activation Marketplace</div>
        <h1>${escapeHtml(org.public_heading || "Henry Ford Health Sponsorship Marketplace")}</h1>
        <p>Explore sponsorship opportunities by category. Choose an area below, then browse the specific events, exhibits and partnership opportunities available within it.</p>
      </div></div>
      <main class="wrap">
        <p class="introline">Start with the type of opportunity that interests you. Each section opens into specific Henry Ford Health event and sponsorship examples.</p>
        <div class="category-grid">${tiles || "<p>No available sponsorship categories are loaded.</p>"}</div>
      </main>
      </body></html>`);
    } catch (error) {
      console.error("HFHS MARKETPLACE LANDING ERROR:",error);
      return res.status(500).send("Unable to load HFHS marketplace demonstration.");
    }
  });
};

module.exports.businessSection = function(){return `<section aria-labelledby="business-vivid-title" style="margin:30px 0;padding:24px;background:#fff;border:1px solid #cbdce8;border-radius:14px;color:#17324d">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#477ca8">Optional for every sponsor and advertiser</div>
<h2 id="business-vivid-title" style="font-size:25px;margin:9px 0 12px">Get more from your sponsorship with Vivid</h2>
<p style="max-width:960px;line-height:1.6;color:#52697c">Make it easy for people to take the next step with your business. Use a Vivid QR code on event signage, a golf hole sign, an exhibit booth, a program ad or a handout to share an offer, invite an inquiry or link to your website—and measure scans, clicks and configured conversions.</p>
<p style="max-width:960px;line-height:1.6;color:#52697c">You can also choose to use Vivid across your own real-world placements, website and connected digital campaigns for a broader view of your marketing performance.</p>
<a href="https://vividspots.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 15px;border:1px solid #bfd0df;border-radius:9px;color:#174d78;text-decoration:none;font-weight:800">Explore Vivid for Your Business ↗</a>
<p style="font-size:12px;line-height:1.6;color:#52697c;margin-bottom:0">Entirely optional. Additional Vivid services are priced separately and are not required to sponsor this event. Conversion and revenue reporting require tracking setup.</p>
</section>`;};
