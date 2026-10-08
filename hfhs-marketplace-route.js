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

  app.get("/advertise/henry-ford-health-demo", async (req, res) => {
    try {
      const orgResult = await q("SELECT id,name,public_heading FROM organizations WHERE slug=$1 AND COALESCE(is_active,true)=true LIMIT 1", ["henry-ford-health-demo"]);
      if (!orgResult.rows.length) return res.status(404).send("Marketplace not found.");
      const org = orgResult.rows[0];
      const result = await q(`SELECT oo.id,oo.title,oo.description,oo.category,oo.price,oo.pricing_unit,oo.status,oo.display_order,oo.space_id,oo.program_id,op.name AS program_name,op.description AS program_description,op.display_order AS program_order
        FROM organization_opportunities oo
        JOIN organization_programs op ON op.id=oo.program_id
        JOIN spaces s ON s.id=oo.space_id
        WHERE oo.organization_id=$1 AND COALESCE(oo.is_active,true)=true AND oo.status=$2 AND COALESCE(s.is_archived,false)=false
        ORDER BY COALESCE(op.display_order,999),op.name,COALESCE(oo.display_order,999),oo.id`, [org.id,"Available"]);
      const groups = new Map();
      for (const row of result.rows) {
        const key = String(row.program_name || "Opportunities");
        if (!groups.has(key)) groups.set(key,{name:key,description:row.program_description || "",order:Number(row.program_order || 999),items:[]});
        groups.get(key).items.push(row);
      }
      const sections = Array.from(groups.values()).sort((a,b)=>a.order-b.order).map(section => {
        const cards = section.items.slice(0,4).map(o => {
          const n = Number(o.price);
          const price = Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}) : "Custom";
          const url = "/advertise/henry-ford-health-demo/location/" + Number(o.space_id) + "?program_id=" + Number(o.program_id);
          return `<a class="card" href="${url}"><div class="photo"><img src="${imageFor(o.title)}" alt="" style="object-fit:${imageFit(o.title)};object-position:${imagePosition(o.title)};"><span>Available</span></div><div class="body"><div class="cat">${escapeHtml(o.category || section.name)}</div><h3>${escapeHtml(o.title)}</h3><p>${escapeHtml(String(o.description || "").split("\\n")[0])}</p><div class="bottom"><strong>${price}</strong><b>View opportunity →</b></div></div></a>`;
        }).join("");
        return `<section><h2>${escapeHtml(section.name)}</h2><p class="intro">${escapeHtml(section.description)}</p><div class="grid">${cards}</div></section>`;
      }).join("");
      res.set("X-Robots-Tag","noindex, nofollow, noarchive");
      return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Henry Ford Health Sponsorship Marketplace | Vivid Demo</title><style>
      *{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#17324d;font-family:Arial,Helvetica,sans-serif}.top{background:#fff;border-bottom:1px solid #dce4ec;padding:18px 5vw;display:flex;gap:14px;align-items:center}.brand{font-size:22px;font-weight:900;color:#125ca8}.demo{font-size:11px;font-weight:900;background:#fceaf3;color:#8b315f;padding:6px 9px;border-radius:999px}.hero{background:linear-gradient(120deg,#092f57,#155d92);color:#fff;padding:48px 5vw}.hero>div,.wrap{max-width:1280px;margin:auto}.hero h1{font-size:clamp(34px,5vw,56px);margin:5px 0 12px}.hero p{max-width:900px;font-size:18px;line-height:1.55;color:#e6f1fa}.wrap{padding:10px 28px 60px}section{padding-top:38px}h2{font-size:29px;color:#123f69;margin:0}.intro{color:#61758a;line-height:1.55;max-width:960px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid #dbe4ed;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 4px 16px rgba(17,48,82,.07);display:flex;flex-direction:column}.card:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(17,48,82,.13)}.photo{height:175px;position:relative;overflow:hidden;background:#e7eef5}.photo img{width:100%;height:100%;display:block;background:#eef3f7}.photo span{position:absolute;right:10px;top:10px;background:#e8f6ef;color:#16724a;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}.body{padding:16px;display:flex;flex-direction:column;flex:1}.cat{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#477ca8}.body h3{font-size:19px;line-height:1.25;margin:7px 0 8px}.body p{font-size:14px;line-height:1.48;color:#627487;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.bottom{margin-top:auto;border-top:1px solid #e8edf2;padding-top:12px;display:flex;justify-content:space-between;gap:8px}.bottom strong{color:#123f69}.bottom b{font-size:12px;color:#1768a7}@media(max-width:1050px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.grid{grid-template-columns:1fr}.wrap{padding-left:16px;padding-right:16px}.photo{height:210px}}
      </style></head><body><div class="top"><div class="brand">Henry Ford Health</div><div class="demo">PRIVATE VIVID CONCEPT</div></div><div class="hero"><div><div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#c7e3f5">Sponsorship & Activation Marketplace</div><h1>${escapeHtml(org.public_heading || "Henry Ford Health Sponsorship Marketplace")}</h1><p>Explore example sponsorship opportunities across fundraising events, conferences, medical education, community health and strategic partnerships. Select any card to continue into the Vivid opportunity and onboarding flow.</p></div></div><main class="wrap">${sections || "<p>No available sponsorship opportunities are loaded.</p>"}</main></body></html>`);
    } catch (error) {
      console.error("HFHS MARKETPLACE LANDING ERROR:",error);
      return res.status(500).send("Unable to load HFHS marketplace demonstration.");
    }
  });
};
