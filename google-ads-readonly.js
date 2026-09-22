"use strict";
const crypto = require("node:crypto");
const {dateRange} = require("./marketing-command-center");
const PATH = "/admin/connectors/google-ads";
const SCOPE = "https://www.googleapis.com/auth/adwords";
const ACCOUNT_QUERY = "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account FROM customer LIMIT 1";

class ConnectorError extends Error {
  constructor(code) { super(code); this.code = code; }
}
// Only fixed provider codes are retained. Never retain response messages, request
// URLs, OAuth codes, credentials, customer IDs or provider metadata in diagnostics.
const GOOGLE_ERROR_CODES = new Map([
  ["invalid_client", "oauth_client"], ["unauthorized_client", "oauth_client"],
  ["invalid_grant", "authorization"], ["redirect_uri_mismatch", "oauth_redirect"],
  ["CUSTOMER_NOT_FOUND", "customer_missing"], ["CUSTOMER_NOT_ENABLED", "customer_inactive"],
  ["INCOMPLETE_SIGNUP", "customer_signup"], ["USER_PERMISSION_DENIED", "account_permission"],
  ["GOOGLE_ACCOUNT_USER_AND_ADS_USER_MISMATCH", "account_permission"],
  ["CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION", "project_access"],
  ["SERVICE_DISABLED", "api_disabled"], ["ACCESS_TOKEN_SCOPE_INSUFFICIENT", "oauth_scope"],
  ["OAUTH_TOKEN_SCOPE_INSUFFICIENT", "oauth_scope"],
  ["DEVELOPER_TOKEN_NOT_APPROVED", "project_access"],
  ["DEVELOPER_TOKEN_PROHIBITED", "project_access"],
  ["ACTION_NOT_PERMITTED", "google_access"], ["PERMISSION_DENIED", "google_access"],
  ["INVALID_LOGIN_CUSTOMER_ID", "manager_invalid"],
  ["INVALID_CUSTOMER_ID", "customer_missing"]
]);
function providerError(body, status, stage) {
  const candidates = [];
  if (typeof body?.error === "string") candidates.push(body.error);
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  for (const detail of details) {
    candidates.push(detail?.reason);
    for (const error of Array.isArray(detail?.errors) ? detail.errors : []) {
      for (const field of ["authenticationError", "authorizationError", "requestError", "headerError"]) {
        candidates.push(error?.errorCode?.[field]);
      }
    }
  }
  candidates.push(body?.error?.status);
  const providerCode = candidates.find(value => GOOGLE_ERROR_CODES.has(value)) || "UNKNOWN";
  const code = status === 429 || status >= 500 ? "temporary" :
    GOOGLE_ERROR_CODES.get(providerCode) || (status === 401 ? "authorization" : "google_access");
  const error = new ConnectorError(code);
  error.diagnostic = Object.freeze({stage, httpStatus:status, providerCode});
  return error;
}
function customerId(value) {
  if (typeof value !== "string" || !/^(\d{10}|\d{3}-\d{3}-\d{4})$/.test(value.trim())) return "";
  return value.trim().replace(/-/g, "");
}
function equal(a, b) {
  return typeof a === "string" && typeof b === "string" && a.length > 0 &&
    Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function configuration(env) {
  const key = Buffer.from(env.GOOGLE_ADS_TOKEN_KEY || "", "base64");
  let redirect;
  try { redirect = new URL(env.GOOGLE_ADS_REDIRECT_URI); } catch { throw new ConnectorError("configuration"); }
  if (key.length !== 32 || !env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_CLIENT_SECRET ||
      redirect.protocol !== "https:" || redirect.pathname !== PATH + "/callback" ||
      redirect.username || redirect.password || redirect.search || redirect.hash ||
      !/^v\d+$/.test(env.GOOGLE_ADS_API_VERSION || "v25")) throw new ConnectorError("configuration");
  return {key, redirect:redirect.href, clientId:env.GOOGLE_ADS_CLIENT_ID,
    clientSecret:env.GOOGLE_ADS_CLIENT_SECRET, version:env.GOOGLE_ADS_API_VERSION || "v25"};
}
function seal(value, key, context) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("google-ads-readonly:" + context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString("base64")).join(".");
}
function unseal(value, key, context) {
  const [iv, tag, data] = value.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("google-ads-readonly:" + context)); cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString());
}
function importRange(input) {
  const range = dateRange(input);
  if (Date.parse(range.to) - Date.parse(range.from) > 30 * 86400000) throw new ConnectorError("date_range");
  return range;
}
function reportQuery(range) {
  const {from, to} = importRange(range);
  return `SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;
}
function normalizeRows(rows, account, range) {
  const seen = new Set();
  const integer = value => {
    const v = String(value ?? "0");
    if (!/^\d+$/.test(v) || BigInt(v) > 9223372036854775807n) throw new ConnectorError("invalid_report");
    return v;
  };
  const decimal = value => {
    const v = Number(value ?? 0);
    // Adjustments can produce negative values; fractional conversions are valid.
    if (!Number.isFinite(v)) throw new ConnectorError("invalid_report");
    return v;
  };
  return rows.map(row => {
    const date = row.segments?.date, campaign = row.campaign, metrics = row.metrics || {};
    if (typeof date !== "string" || !campaign || !/^\d+$/.test(String(campaign.id))) throw new ConnectorError("invalid_report");
    dateRange({from:date,to:date});
    if (date < range.from || date > range.to || seen.has(date + ":" + campaign.id)) throw new ConnectorError("invalid_report");
    seen.add(date + ":" + campaign.id);
    const item = {date, campaign_id:String(campaign.id), campaign_name:String(campaign.name || "Unnamed campaign").slice(0,240),
      campaign_status:String(campaign.status || "UNKNOWN"), channel:String(campaign.advertisingChannelType || "UNKNOWN"),
      currency_code:account.currencyCode, account_timezone:account.timeZone, impressions:integer(metrics.impressions),
      clicks:integer(metrics.clicks), cost_micros:integer(metrics.costMicros), conversions:decimal(metrics.conversions),
      conversion_value:decimal(metrics.conversionsValue)};
    return {...item, payload_hash:hash(JSON.stringify(item))};
  });
}

function createGoogleReader({config, fetcher=fetch}) {
  async function request(url, options, stage) {
    let response;
    try { response = await fetcher(url, {...options, redirect:"error", signal:AbortSignal.timeout(15000)}); }
    catch { throw new ConnectorError("network"); }
    if (!response.ok) {
      let body = {};
      try { body = await response.json(); } catch { /* Never expose provider bodies or tokens. */ }
      throw providerError(body, response.status, stage);
    }
    try { return await response.json(); } catch { throw new ConnectorError("invalid_report"); }
  }
  async function token(fields, requireRefresh) {
    const result = await request("https://oauth2.googleapis.com/token", {method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...fields}).toString()}, requireRefresh ? "oauth_exchange" : "oauth_refresh");
    if (typeof result.access_token !== "string" || !result.access_token ||
        (requireRefresh && (typeof result.refresh_token !== "string" || !result.refresh_token)) ||
        !(Number(result.expires_in) > 0) ||
        (result.scope && !String(result.scope).split(" ").includes(SCOPE))) throw new ConnectorError("authorization");
    return {access_token:result.access_token,refresh_token:result.refresh_token || fields.refresh_token,
      expires_at:Date.now() + Number(result.expires_in) * 1000};
  }
  // Deliberately no generic Google API path or caller-provided GAQL. These two fixed
  // read queries are the entire Ads API surface. OAuth's scope itself is broader.
  async function search(accessToken, id, managerId, query) {
    if (!customerId(id) || (managerId && !customerId(managerId))) throw new ConnectorError("account");
    const results = [], seen = new Set(); let pageToken;
    const until = Date.now() + 120000;
    do {
      if (Date.now() > until || seen.size >= 20) throw new ConnectorError("report_too_large");
      const data = await request(`https://googleads.googleapis.com/${config.version}/customers/${id}/googleAds:search`, {
        method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer " + accessToken,
          ...(managerId ? {"login-customer-id":managerId} : {})},
        body:JSON.stringify({query,...(pageToken ? {pageToken} : {})})}, query === ACCOUNT_QUERY ? "account_check" : "report_read");
      if (data.results !== undefined && !Array.isArray(data.results)) throw new ConnectorError("invalid_report");
      results.push(...(data.results || []));
      if (results.length > 100000) throw new ConnectorError("report_too_large");
      pageToken = data.nextPageToken;
      if (pageToken && (typeof pageToken !== "string" || seen.has(pageToken))) throw new ConnectorError("invalid_report");
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    return results;
  }
  return {
    exchange:code => token({grant_type:"authorization_code",code,redirect_uri:config.redirect}, true),
    refresh:refreshToken => token({grant_type:"refresh_token",refresh_token:refreshToken}, false),
    async account(accessToken, id, managerId) {
      const rows = await search(accessToken,id,managerId,ACCOUNT_QUERY), account = rows[0]?.customer;
      if (rows.length !== 1 || String(account?.id) !== id || account.manager || account.testAccount ||
          !/^[A-Z]{3}$/.test(account.currencyCode) || typeof account.timeZone !== "string") throw new ConnectorError("account");
      try { new Intl.DateTimeFormat("en-US",{timeZone:account.timeZone}).format(); } catch { throw new ConnectorError("account"); }
      return account;
    },
    async report(accessToken, id, managerId, account, range) {
      return normalizeRows(await search(accessToken,id,managerId,reportQuery(range)),account,range);
    }
  };
}
module.exports = {PATH,SCOPE,ConnectorError,configuration,customerId,equal,hash,seal,unseal,importRange,reportQuery,normalizeRows,createGoogleReader};
