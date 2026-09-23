"use strict";
const path = require("node:path");
const {configuredWebsitePages} = require("./website-page-config");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function cleanUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
    return { origin: u.origin, host: u.host.replace(/^www\./, ""), url: u.origin + (u.pathname.replace(/\/+$/, "") || "/") };
  } catch (_) { return null; }
}
function createTracker(q) {
  let ready;
  function ensureSchema() {
    if (!ready) ready = q(`CREATE TABLE IF NOT EXISTS campaign_website_visits (
      id BIGSERIAL PRIMARY KEY,
      scan_event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      qr_id INTEGER NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
      vivid_click_id TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (campaign_id, vivid_click_id, page_url)
    )`).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function record(data, origin) {
    const url = cleanUrl(data?.page_url);
    if (!data || !Number.isSafeInteger(data.campaign_id) || data.campaign_id <= 0 || !uuid(data.vivid_click_id) || !url || origin !== url.origin) return false;
    // Only an existing QR journey in this campaign and within 24 hours is eligible.
    // Existing event timestamps are stored as UTC without a timezone.
    const scan = (await q(`SELECT e.id,e.qr_id,e.campaign_id,c.campaign_url FROM events e
      JOIN campaigns c ON c.id=e.campaign_id
      WHERE e.vivid_click_id=$1 AND e.type='scan' AND e.campaign_id=$2
        AND e.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '24 hours'
        AND e.created_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      ORDER BY e.created_at,e.id LIMIT 1`, [data.vivid_click_id, data.campaign_id])).rows[0];
    if (!scan || !scan.qr_id) return false;
    const destinations = (await q(`SELECT cd.destination_url FROM events e
      JOIN campaign_destinations cd ON cd.id=e.campaign_destination_id AND cd.campaign_id=e.campaign_id
      WHERE e.vivid_click_id=$1 AND e.campaign_id=$2 AND e.type='destination_click'`, [data.vivid_click_id, data.campaign_id])).rows;
    const allowed = [scan.campaign_url, ...destinations.map(d => d.destination_url)].some(value => cleanUrl(value)?.host === url.host);
    if (!allowed) return false;
    await ensureSchema();
    await q(`INSERT INTO campaign_website_visits (scan_event_id,campaign_id,qr_id,vivid_click_id,page_url,page_name)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (campaign_id,vivid_click_id,page_url) DO NOTHING`,
    [scan.id,scan.campaign_id,scan.qr_id,data.vivid_click_id,url.url,
      typeof data.page_name === "string" && data.page_name.trim() ? data.page_name.trim().slice(0,100) : new URL(url.url).pathname]);
    return true;
  }
  return {ensureSchema, record};
}
const trackers = new WeakMap();
function sharedTracker(q) {
  if (!trackers.has(q)) trackers.set(q,createTracker(q));
  return trackers.get(q);
}
const cardStyles = `<style>
.vivid-page-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:18px;margin:22px 0}
.vivid-page-card{background:#fff;border:1px solid #dce5f2;border-radius:18px;padding:22px;box-shadow:0 8px 22px #10264208;min-width:0}
.vivid-page-card h4{font-size:19px;color:#102642;margin:16px 0 4px}
.vivid-page-top,.vivid-page-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
.vivid-page-icon{display:grid;place-items:center;width:44px;height:44px;background:#edf3ff;color:#245de2;border-radius:12px}
.vivid-page-badge{font-size:12px;font-weight:650;padding:5px 9px;border-radius:20px;background:#f1f4f8;color:#52647a}
.vivid-page-badge.received{color:#16633b;background:#e4f8ec}
.vivid-page-url{font-size:12px;color:#617087;overflow-wrap:anywhere;min-height:42px;margin:0}
.vivid-page-count{font-size:42px;font-weight:750;line-height:1.1;color:#102642;margin:22px 0 5px;font-variant-numeric:tabular-nums}
.vivid-page-label{font-size:13px;color:#52647a;margin:0 0 18px}
.vivid-page-foot{border-top:1px solid #edf0f5;padding-top:14px;font-size:12px;color:#617087;align-items:flex-start}
.vivid-page-foot a{color:#245de2;white-space:nowrap;font-weight:650}
.vivid-page-flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#52647a;font-size:13px}
.vivid-page-flow span{background:#edf3ff;border-radius:9px;padding:9px 13px;color:#183a69}
</style>`;
function renderPageCards(campaign,rows) {
  const canonical=value=>cleanUrl(value)?.url || "";
  const configured=configuredWebsitePages(campaign);
  const cards=configured.map(p=>({...p,record:rows.find(r=>canonical(r.page_url)===canonical(p.url))}));
  for(const row of rows)if(!cards.some(p=>canonical(p.url)===canonical(row.page_url)))cards.push({name:row.page_name,url:row.page_url,icon:"page",record:row});
  if(!cards.length)return '<p><strong>Awaiting tracked page visits.</strong> Install the website tracker on the landing page and each page you want to measure, then test with a fresh QR scan. Each received page will appear as a card here.</p>';
  const icons={quality:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',contact:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',offer:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',about:'<path d="M5 21V5l7-2 7 2v16M3 21h18M9 8h1m4 0h1M9 12h1m4 0h1M10 21v-5h4v5"/>',find:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',page:'<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>'};
  return `<div class="vivid-page-flow" aria-label="QR scan to website to page visits"><span>QR scan</span> → <span>${esc(campaign.advertiser||"Campaign")} website</span> → <span>${cards.length} website ${cards.length===1?"page":"pages"}</span></div>
    <div class="vivid-page-grid">${cards.map(p=>{
      const hasData=!!p.record,valid=cleanUrl(p.url);
      return `<article class="vivid-page-card"><div class="vivid-page-top"><span class="vivid-page-icon"><svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[p.icon]||icons.page}</svg></span>
        <span class="vivid-page-badge ${hasData?"received":""}">${hasData?"Data received":"Awaiting data"}</span></div>
        <h4>${esc(p.name)}</h4><p class="vivid-page-url">${esc(valid?new URL(valid.url).host+new URL(valid.url).pathname:p.url)}</p>
        <div class="vivid-page-count" data-page-visits="${hasData?Number(p.record.visits):"pending"}" aria-label="${hasData?Number(p.record.visits)+" QR visits":"No tracking data yet"}">${hasData?Number(p.record.visits):"—"}</div>
        <p class="vivid-page-label">QR visits reaching this page</p>
        <div class="vivid-page-foot"><span>${hasData?"Last received<br>"+esc(new Date(p.record.last_visit).toISOString().replace("T"," ").slice(0,16))+" UTC":"No visits received<br>in this period"}</span>
        ${valid?`<a href="${esc(valid.url)}" target="_blank" rel="noopener noreferrer">View page ↗</a>`:""}</div></article>`;
    }).join("")}</div>${configured.length&&!rows.length?'<p>These are the five pages selected for tracking. Counters will update as attributed visits arrive after installation.</p>':""}`;
}
async function mySetupWebsiteTracking({q,user,campaigns}) {
  const allowed = campaigns.filter(c => user.role === "super_admin" || Number(c.user_id) === Number(user.id));
  const heading = '<section id="website-page-tracking"><h2>Website Page Tracking</h2>';
  if (!allowed.length) return heading+'<p>Your campaign website pages will appear here after you create a campaign.</p></section>';
  try {
    await sharedTracker(q).ensureSchema();
    const rows = (await q(`SELECT v.campaign_id,v.page_url,MAX(v.page_name) AS page_name,
      COUNT(*)::int AS visits,MAX(v.created_at) AS last_visit
      FROM campaign_website_visits v JOIN campaigns c ON c.id=v.campaign_id
      WHERE v.campaign_id=ANY($1::int[]) AND ($2::boolean OR c.user_id=$3)
        AND v.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY v.campaign_id,v.page_url ORDER BY v.campaign_id,v.page_url`,
      [allowed.map(c=>Number(c.id)),user.role==="super_admin",Number(user.id)])).rows;
    return heading+cardStyles+`<p>See which website pages people reach after scanning your QR. Last 30 days · one count per QR visit per page · times in UTC.</p>
      ${allowed.map(c=>{
        const pages=rows.filter(r=>Number(r.campaign_id)===Number(c.id));
        return `<div class="card"><h3>${esc(c.advertiser)} — ${esc(c.name)}</h3>
          <p><a class="btn secondary" href="/admin/campaign/${Number(c.id)}/website-pages">Open page-by-page report</a></p>
          ${renderPageCards(c,pages)}
          </div>`;
      }).join("")}
      <p>Page visits measure engagement. Completed inquiries and sales are tracked separately. Missing records do not confirm zero activity or whether the script is installed.</p></section>`;
  } catch(error) {
    console.error("My Setup website tracking failed",error.code || "internal");
    return heading+'<p>Website page tracking is temporarily unavailable. Your other setup information is still available. Please try again.</p></section>';
  }
}
function renderReport(campaign, rows, days) {
  return `<div class="topbar"><div class="brand">Vivid Spots</div><h1>Website page visits</h1>
    <p class="subtitle">${esc(campaign.advertiser)} — ${esc(campaign.name)}</p></div>
    <main class="wrap"><p><a href="/my-setup">My Setup</a> · <a href="/admin/edit-campaign/${campaign.id}">Campaign settings</a></p>
    <div class="card"><h2>Pages reached after a QR scan</h2>
    <form method="get"><label for="days">Reporting period</label><select id="days" name="days">
    ${[7,30,90,365].map(d=>`<option value="${d}" ${d===days?"selected":""}>Last ${d} days</option>`).join("")}</select><button class="btn" type="submit">Update</button></form>
    <p>Each QR visit is counted once per page. Refreshing a page does not add another count. A visit can reach several pages, so these counts should not be added together as unique visitors.</p>
    <p>These are page arrivals, not individual link clicks, completed inquiries, sales, or revenue. Attribution lasts up to 24 hours in the same browser tab. Times below are UTC.</p>
    <div style="overflow-x:auto"><table><thead><tr><th>Page</th><th>URL</th><th>QR visits reaching page</th><th>Last recorded visit</th></tr></thead><tbody>
    ${rows.length ? rows.map(r=>`<tr><td>${esc(r.page_name)}</td><td>${esc(r.page_url)}</td><td>${Number(r.visits)}</td><td>${esc(new Date(r.last_visit).toISOString().replace("T"," ").slice(0,19))}</td></tr>`).join("") : '<tr><td colspan="4">No attributed page visits recorded in this period. Install the website tracker on the landing page and each tracked page, then test with a fresh QR scan.</td></tr>'}
    </tbody></table></div></div>
    <div class="card"><h2>Installation</h2><p>Use the Vivid website-visit snippet configured for this campaign (ID ${Number(campaign.id)}). Install it once on the QR landing page and all pages being measured, through the website’s consent controls. The separate conversion script remains for confirmed outcomes.</p>
    <p>Tracking depends on the advertiser installing the script. This report does not verify installation or infer zero activity from missing records.</p></div></main>`;
}
function registerWebsitePageTracking({app,q,page,requireLogin,express}) {
  const tracker = sharedTracker(q);
  app.get("/vivid-website.js", (req,res) => res.set("Cache-Control","public, max-age=300").sendFile(path.join(__dirname,"public/vivid-website.js")));
  app.post("/website/page-visit", express.text({type:"text/plain",limit:"4kb"}), async(req,res) => {
    try {
      let data;
      try { data = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch (_) { return res.status(400).end(); }
      await tracker.record(data, req.get("Origin"));
      // A uniform response prevents disclosing whether a journey exists.
      return res.status(204).end();
    } catch (error) { console.error("Website page tracking failed", error.code || "internal"); return res.status(503).end(); }
  });
  app.get("/admin/campaign/:campaignId/website-pages", requireLogin, async(req,res) => {
    try {
      if (!/^[1-9]\d*$/.test(req.params.campaignId) || !Number.isSafeInteger(Number(req.params.campaignId))) return res.status(400).send("Valid campaign ID required.");
      const campaign = (await q(`SELECT id,name,advertiser FROM campaigns WHERE id=$1 AND ($2::boolean OR user_id=$3)`,
        [Number(req.params.campaignId),req.session.user.role === "super_admin",Number(req.session.user.id)])).rows[0];
      if (!campaign) return res.status(404).send("Campaign not found or access denied.");
      await tracker.ensureSchema();
      const days = [7,30,90,365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
      const rows = (await q(`SELECT page_url,MAX(page_name) AS page_name,COUNT(*)::int AS visits,MAX(created_at) AS last_visit
        FROM campaign_website_visits WHERE campaign_id=$1 AND created_at >= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 day')
        GROUP BY page_url ORDER BY visits DESC,page_url`,[campaign.id,days])).rows;
      res.set("Cache-Control","no-store");
      return res.send(page("Website page visits",renderReport(campaign,rows,days)));
    } catch(error) { console.error("Website page report failed",error.code || "internal"); return res.status(500).send("Unable to load website page visits. Please try again."); }
  });
}
module.exports = {cleanUrl,createTracker,renderReport,registerWebsitePageTracking,mySetupWebsiteTracking,renderPageCards};
