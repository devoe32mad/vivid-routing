"use strict";
const dashboard = "/admin/marketing-command-center";
const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function addMarketingReturn(html, req) {
  const path = String(req.path || "");
  const connector = /^\/admin\/connectors\/(?:google-analytics|google-ads|meta-ads|linkedin-ads)(?:\/|$)/.test(path);
  if (req.method !== "GET" || (!connector && !(path === dashboard && req.query?.platform))) return html;
  if (!/<main\b/i.test(html) || html.includes('id="marketing-return-nav"')) return html;
  const saved = req.session?.marketingReturn || {};
  const params = new URLSearchParams();
  const actor = req.session?.user;
  const account = actor?.role === "super_admin" ? id(saved.accountId) || id(req.session?.marketingAccountId) || id(actor.id) : id(actor?.id);
  if (account) params.set("account", String(account));
  const query = req.query || {};
  const range = validDate(query.from) && validDate(query.to) && query.from <= query.to ? query : saved;
  if (validDate(range.from) && validDate(range.to) && range.from <= range.to) {
    params.set("from", range.from); params.set("to", range.to);
  }
  const href = dashboard + (params.size ? "?" + params.toString().replace(/&/g,"&amp;") : "");
  const nav = `<nav id="marketing-return-nav" aria-label="Return to dashboard" style="position:sticky;top:12px;z-index:20;margin:0 0 18px;width:fit-content;max-width:100%"><a href="${href}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#102b50;color:#fff;font-weight:700;text-decoration:none;box-shadow:0 2px 8px #102b5026">← Marketing Command Center</a></nav>`;
  return html.replace(/<main\b[^>]*>/i, main => main + nav);
}
module.exports = {addMarketingReturn};
