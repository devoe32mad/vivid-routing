"use strict";

const crypto = require("node:crypto");
const { page } = require("./square-production-sales");
const PATH = "/admin/sponsorship-performance/billing";
const BILLING_SCOPES = "ITEMS_READ ITEMS_WRITE SUBSCRIPTIONS_READ SUBSCRIPTIONS_WRITE ORDERS_READ ORDERS_WRITE PAYMENTS_WRITE INVOICES_READ";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function installBillingSetup({app, q, ready, api, getConnection, env}) {
  app.get(PATH, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!req.session?.user) return res.status(401).send("Sign in to Vivid as an administrator first.");
    if (!["admin", "super_admin"].includes(req.session.user.role)) return res.status(403).send("Vivid administrator access required.");
    try {
      await ready();
      const connections = (await q(`SELECT c.customer_id,c.merchant_id,u.email
        FROM square_production_connections c JOIN users u ON u.id=c.customer_id
        ORDER BY c.customer_id`)).rows;
      const selected = Number(req.query?.customer_id || env.SQUARE_VIVID_BILLING_CUSTOMER_ID || 0);
      const row = connections.find(c => Number(c.customer_id) === selected);
      req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString("hex");
      let detail = "<p>Select the Vivid Spots merchant connection below. Advertisers' merchant accounts must not be used to collect Vivid subscription fees.</p>";
      if (row) {
        const connection = await getConnection(selected);
        if (!connection) throw Error("Connection unavailable");
        const scopes = String(connection.token.vivid_scopes || "").split(" ");
        const missing = BILLING_SCOPES.split(" ").filter(s => !scopes.includes(s));
        detail = `<h2>Selected connection: ${esc(row.email || selected)}</h2><p>Square merchant: ${esc(row.merchant_id)}</p>
          <p>${missing.length ? "Additional subscription authorization is required." : "Subscription permissions are present."}</p>
          <form method="post" action="/integrations/square/production/customers/${selected}/connect">
          <input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}">
          <input type="hidden" name="billing" value="true">
          <button>${missing.length ? "Authorize Square subscription billing" : "Reconnect Square subscription billing"}</button></form>`;
        if (scopes.includes("ITEMS_READ")) {
          const variations = [];
          const cursors = new Set();
          let cursor;
          do {
            const result = await api("/v2/catalog/list?types=SUBSCRIPTION_PLAN_VARIATION" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), null, connection.token.access_token);
            variations.push(...(result.objects || []).filter(v => !v.is_deleted));
            cursor = result.cursor;
            if (cursor && (cursors.has(cursor) || cursors.size >= 20)) throw Error("Catalog pagination incomplete");
            if (cursor) cursors.add(cursor);
          } while (cursor);
          detail += `<h3>Square subscription plan variations</h3><p>Use a monthly, ongoing plan with no trial or discount. This screen reads the catalog; it does not change prices or enroll customers.</p>
            <table><thead><tr><th>Name</th><th>Variation ID</th><th>Schedule and price</th></tr></thead><tbody>${variations.map(v => `<tr><td>${esc(v.subscription_plan_variation_data?.name)}</td><td>${esc(v.id)}</td><td>${(v.subscription_plan_variation_data?.phases || []).map(p => esc([p.cadence, p.periods ? p.periods + " periods" : "ongoing", p.pricing?.price_money ? (Number(p.pricing.price_money.amount)/100).toFixed(2) + " " + p.pricing.price_money.currency : "item-based price"].join(" · "))).join("<br>")}</td></tr>`).join("") || '<tr><td colspan="3">No subscription plan variations found.</td></tr>'}</tbody></table>`;
        }
      }
      return res.type("html").send(page("Vivid Performance billing setup", `<section><h1>Vivid Performance billing setup</h1>
        <p><strong>Customer subscription checkout is not live.</strong> Payment-confirmed activation and final pricing must be verified before enabling checkout.</p>
        <p>Vivid Performance: $36.50/month per placement, processing included. No separate processing fee.</p>
        <h2>Connected Square accounts</h2><ul>${connections.map(c => `<li><a href="${PATH}?customer_id=${Number(c.customer_id)}">${esc(c.email || "Customer " + c.customer_id)}</a> — merchant ${esc(c.merchant_id)}</li>`).join("") || "<li>No Square production accounts are connected. Connect Vivid Spots through its advertiser account's Square integration first.</li>"}</ul>
        ${detail}<h2>Current configuration</h2><p>Billing customer ID: ${esc(env.SQUARE_VIVID_BILLING_CUSTOMER_ID || "Not set")}<br>Plan variation ID: ${esc(env.SQUARE_VIVID_PERFORMANCE_PLAN_VARIATION_ID || "Not set")}</p></section>`));
    } catch (_) {
      return res.status(502).send("Unable to read Square billing setup. Retry or reconnect the Square account.");
    }
  });
}

module.exports = {installBillingSetup, BILLING_SCOPES, PATH};
