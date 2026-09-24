"use strict";
const PATH = "/admin/connectors/google-ads";
const {googleRecommendations,sum}=require("./marketing-performance-insights");
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const amount = (value,currency) => `${Number(value || 0).toLocaleString("en-US",{maximumFractionDigits:2})} ${esc(currency)}`;
const when = value => value ? esc(new Date(value).toISOString()) : "Never";
function syncStatus(c,autoSync=true) {
  if(!autoSync)return "Automatic sync disabled by administrator · manual refresh available";
  if(c.status==="attention_required")return "Reconnect required · automatic sync paused";
  if(c.last_error)return "Last attempt failed · automatic retry scheduled";
  if(!c.last_auto_synced_at)return "First automatic sync queued";
  return "Automatic sync every hour";
}
function renderRecommendations(evidence,range) {
  const items=googleRecommendations(evidence,range);
  return `<section><h2>Automatic recommendations</h2><p>Updated from the latest imported evidence when you open this dashboard. Today is excluded from performance comparisons. Suggestions require your review and never change ads or budgets.</p>${items.map(r=>`<article><strong>${esc(r.title)}</strong><p>${esc(r.reason)}</p><small>${esc(r.signal)}</small></article>`).join("")}</section>`;
}
function renderEvidence({connections=[],rows=[],daily=[],campaigns=[]}={},range,{autoSync=true}={}) {
  return `<section id="google-evidence"><h2>Google Ads · platform-reported evidence</h2>
  <p>Google conversions and conversion value are attribution claims, not verified sales. They may overlap with Vivid, Square and other platforms and are never added to Vivid revenue. Google’s conversion definitions and attribution settings apply; this import does not capture those settings. Dates below follow each Google account’s timezone; Vivid dates use UTC. Different currencies are kept separate.</p>
  ${connections.length ? connections.map(c=>`<p><a href="${PATH}/${Number(c.id)}">${esc(c.account_name)} · ${esc(c.customer_id)}</a> · ${esc(c.status)}<br>
    Last successful import: ${when(c.last_synced_at)}. Most recent imported window: ${esc(c.last_from || "none")} – ${esc(c.last_to || "none")} (${esc(c.account_timezone)}).
    <strong>${esc(syncStatus(c,autoSync))}</strong>${autoSync&&c.status!=="attention_required"?` · Next due: ${when(c.next_sync_at)}`:""}.</p>`).join("") : "<p>No Google account connected.</p>"}
  <p>Displayed period: ${esc(range.from)} – ${esc(range.to)}. Only imported records are shown; missing dates are not evidence of zero activity. ${autoSync?"The latest 31 account-calendar days refresh automatically every hour, including revised results. Google reporting can lag behind activity. Older imported dates remain available; refresh older periods on demand.":"Automatic syncing is disabled; use Refresh now on the account dashboard."}</p>
  ${campaigns.length?`<h3>Connected campaigns</h3><p>Current names and statuses from the latest sync. Performance below uses your selected dates.</p><ul>${campaigns.map(c=>`<li><strong>${esc(c.campaign_name)}</strong> · ${esc(c.campaign_status)} · ${esc(c.channel)} · Campaign ${esc(c.campaign_id)}${rows.some(r=>String(r.connection_id)===String(c.connection_id)&&r.campaign_id===c.campaign_id)?"":" · No reporting data for this period"}</li>`).join("")}</ul>`:""}
  <div class="mcc-grid">${connections.map(c=>{
    const t=sum(rows.filter(r=>String(r.connection_id)===String(c.id))),hasRows=rows.some(r=>String(r.connection_id)===String(c.id));
    return `<article class="mcc-card"><h3>${esc(c.account_name)} · ${esc(c.currency_code)}</h3>${hasRows?`<dl><dt>Spend</dt><dd>${amount(t.cost_micros/1e6,c.currency_code)}</dd><dt>Impressions / clicks</dt><dd>${t.impressions} / ${t.clicks}</dd><dt>Click-through rate</dt><dd>${t.impressions?(100*t.clicks/t.impressions).toFixed(2)+"%":"—"}</dd><dt>Average cost per click</dt><dd>${t.clicks?amount(t.cost_micros/1e6/t.clicks,c.currency_code):"—"}</dd><dt>Google-reported conversions</dt><dd>${t.conversions}</dd></dl>`:"<p>No reporting rows yet for this period. A new campaign may not have delivery data yet.</p>"}</article>`;
  }).join("")}</div>
  <div class="mcc-scroll"><table><thead><tr><th>Account / campaign</th><th>Channel</th><th>Timezone</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Avg. CPC</th><th>Reported conversions</th><th>Reported value</th></tr></thead><tbody>
  ${rows.length ? rows.map(r=>`<tr><td><a href="${PATH}/${Number(r.connection_id)}?from=${range.from}&amp;to=${range.to}">${esc(connections.find(c=>String(c.id)===String(r.connection_id))?.account_name)} / ${esc(r.campaign_name)}</a><br><small>Campaign ${esc(r.campaign_id)}</small></td>
    <td>${esc(r.channel)}</td><td>${esc(r.account_timezone)}</td><td>${amount(Number(r.cost_micros)/1000000,r.currency_code)}</td><td>${esc(r.impressions)}</td><td>${esc(r.clicks)}</td><td>${Number(r.impressions)>0?(100*Number(r.clicks)/Number(r.impressions)).toFixed(2)+"%":"—"}</td><td>${Number(r.clicks)>0?amount(Number(r.cost_micros)/1e6/Number(r.clicks),r.currency_code):"—"}</td><td>${esc(r.conversions)}</td><td>${amount(r.conversion_value,r.currency_code)}</td></tr>`).join("") : '<tr><td colspan="10">No imported Google campaign records in this period.</td></tr>'}
  </tbody></table></div>
  <details><summary>Daily performance by account</summary>${renderDaily(daily,connections)}</details></section>`;
}
function renderDaily(daily,connections) {
  const groups=new Map();
  for(const r of daily){const key=JSON.stringify([r.connection_id,r.date,r.currency_code]);if(!groups.has(key))groups.set(key,{...r,rows:[]});groups.get(key).rows.push(r);}
  return `<div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Account</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Reported conversions</th></tr></thead><tbody>${[...groups.values()].reverse().map(g=>{const t=sum(g.rows);return `<tr><td>${esc(g.date)}</td><td>${esc(connections.find(c=>String(c.id)===String(g.connection_id))?.account_name)}</td><td>${amount(t.cost_micros/1e6,g.currency_code)}</td><td>${t.impressions}</td><td>${t.clicks}</td><td>${t.conversions}</td></tr>`;}).join("")||'<tr><td colspan="6">No daily reporting rows in this period.</td></tr>'}</tbody></table></div>`;
}
const style = `<style>.gads{max-width:1150px;margin:28px auto;padding:20px;color:#102b50;font:15px/1.5 system-ui}.gads a{color:#1559c7}.gads section{border:1px solid #dbe5f0;border-radius:14px;padding:20px;margin:16px 0}.gads form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0}.gads label{display:grid}.gads input,.gads button{padding:10px;border:1px solid #bbc9d9;border-radius:8px;font:inherit}.gads button{background:#102b50;color:white;cursor:pointer}.gads table{border-collapse:collapse;width:100%}.gads td,.gads th{padding:10px;text-align:left;border-bottom:1px solid #dbe5f0}.mcc-scroll{overflow:auto}.gads .mcc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.gads .mcc-card{background:white;border-radius:10px;padding:16px}.gads dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gads dd{margin:0;font-weight:600}.gads article+article{border-top:1px solid #dbe5f0;margin-top:16px;padding-top:16px}.gads summary{cursor:pointer;margin:16px 0}</style>`;
const field = csrf => `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
function renderHome({configured,connections,csrf,notice="",autoSync=true}) {
  return `${style}<main class="gads"><a href="/admin/marketing-command-center">← Marketing Command Center</a><h1>Connect Google Ads</h1><p>${esc(notice)}</p>
    <section><h2>Your account, your evidence</h2><p>Connect an account you are authorized to use. Its reports remain private to your Vivid advertiser login. Enterprise sharing requires a separate future campaign-sharing step.</p>
    <p>Vivid only reads Google Ads reports. Google’s consent screen uses its broader Ads permission; Vivid does not implement campaign, bid or spending changes. For an additional access restriction, authorize a Google user with read-only Ads access.</p>
    ${configured ? `<form method="post" action="${PATH}/connect">${field(csrf)}<label>Google Ads customer ID<input name="customer_id" placeholder="123-456-7890" required maxlength="12"></label>
      <label>Manager ID (only if accessed through a manager)<input name="manager_id" placeholder="Optional" maxlength="12"></label><button>Continue to Google</button></form>
      <p>Find your customer ID in Google Ads. After signing in, Vivid checks access to this account before saving the connection. Your connection is saved for future visits; you do not need to re-enter this ID each time. Connect each additional account separately.</p>` : "<p>Google connection setup is not enabled yet. Vivid needs its Google application configuration before accounts can authorize access.</p>"}</section>
    <h2>Your dashboards</h2>${connections.length ? connections.map(c=>`<section><a href="${PATH}/${Number(c.id)}">${esc(c.account_name)} · ${esc(c.customer_id)} · Open dashboard</a><p>${esc(syncStatus(c,autoSync))} · Last sync ${when(c.last_synced_at)}</p></section>`).join("") : "<p>No accounts connected.</p>"}</main>`;
}
function renderAccount({connection,rows,daily=[],campaigns=[],syncs,csrf,range,notice="",autoSync=true,aiVisible=false}) {
  const root = PATH + "/" + Number(connection.id);
  return `${style}<main class="gads"><a href="/admin/marketing-command-center">← Marketing dashboard</a> · <a href="${PATH}">Google connections</a><h1>${esc(connection.account_name)} · Google Ads dashboard</h1><p>${esc(notice)}</p>
  <form method="get"><label>From (account timezone)<input type="date" name="from" value="${range.from}" required></label><label>To<input type="date" name="to" value="${range.to}" required></label><button>View period</button></form>
  <form method="post" action="${root}/sync">${field(csrf)}<input type="hidden" name="from" value="${range.from}"><input type="hidden" name="to" value="${range.to}"><button>Refresh now</button><span>Optional refresh of the selected period, up to 31 days.</span></form>
  ${renderEvidence({connections:[connection],rows,daily,campaigns},range,{autoSync})}
  ${aiVisible?renderRecommendations({connections:[connection],daily},range):""}
  <h2>Import history</h2><ul>${syncs.length ? syncs.map(s=>`<li>${when(s.started_at)} · ${esc(s.date_from)} – ${esc(s.date_to)} · ${esc(s.status)} · ${Number(s.rows_imported)} records · ${esc(s.api_version)}${s.error_code ? " · " + esc(s.error_code) : ""}</li>`).join("") : "<li>No imports yet.</li>"}</ul>
  <section><h2>Disconnect and remove imported evidence</h2><p>This removes this account’s saved credentials and imported Google reports from Vivid. It does not change Google campaigns or Vivid campaign records. You can also revoke Vivid access in your Google Account permissions.</p><form method="post" action="${root}/disconnect">${field(csrf)}<label><input type="checkbox" name="confirm" value="remove" required> Remove this connection and its Google evidence</label><button>Disconnect account</button></form></section></main>`;
}
module.exports = {renderEvidence,renderHome,renderAccount,syncStatus};
