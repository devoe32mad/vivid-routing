"use strict";
const PATH = "/admin/connectors/google-ads";
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const amount = (value,currency) => `${Number(value || 0).toLocaleString("en-US",{maximumFractionDigits:2})} ${esc(currency)}`;
const when = value => value ? esc(new Date(value).toISOString()) : "Never";
function renderEvidence({connections=[],rows=[]}={},range) {
  return `<section id="google-evidence"><h2>Google Ads · platform-reported evidence</h2>
  <p>Google conversions and conversion value are attribution claims, not verified sales. They may overlap with Vivid, Square and other platforms and are never added to Vivid revenue. Google’s conversion definitions and attribution settings apply; this import does not capture those settings. Dates below follow each Google account’s timezone; Vivid dates use UTC. Different currencies are kept separate.</p>
  ${connections.length ? connections.map(c=>`<p><a href="${PATH}/${Number(c.id)}">${esc(c.account_name)} · ${esc(c.customer_id)}</a> · ${esc(c.status)}<br>
    Last successful import: ${when(c.last_synced_at)}. Most recent imported window: ${esc(c.last_from || "none")} – ${esc(c.last_to || "none")} (${esc(c.account_timezone)}).
    ${c.last_error ? "Last attempt failed; displayed evidence may be stale. Open the account to retry." : ""}</p>`).join("") : "<p>No Google account connected.</p>"}
  <p>Displayed period: ${esc(range.from)} – ${esc(range.to)}. Only imported records are shown; missing dates are not evidence of zero activity. Imports currently run when you request them.</p>
  <div class="mcc-scroll"><table><thead><tr><th>Account / campaign</th><th>Channel</th><th>Timezone</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Reported conversions</th><th>Reported value</th></tr></thead><tbody>
  ${rows.length ? rows.map(r=>`<tr><td><a href="${PATH}/${Number(r.connection_id)}?from=${range.from}&amp;to=${range.to}">${esc(connections.find(c=>String(c.id)===String(r.connection_id))?.account_name)} / ${esc(r.campaign_name)}</a><br><small>Campaign ${esc(r.campaign_id)}</small></td>
    <td>${esc(r.channel)}</td><td>${esc(r.account_timezone)}</td><td>${amount(Number(r.cost_micros)/1000000,r.currency_code)}</td><td>${esc(r.impressions)}</td><td>${esc(r.clicks)}</td><td>${esc(r.conversions)}</td><td>${amount(r.conversion_value,r.currency_code)}</td></tr>`).join("") : '<tr><td colspan="8">No imported Google campaign records in this period.</td></tr>'}
  </tbody></table></div></section>`;
}
const style = `<style>.gads{max-width:1150px;margin:28px auto;padding:20px;color:#102b50;font:15px/1.5 system-ui}.gads a{color:#1559c7}.gads section{border:1px solid #dbe5f0;border-radius:14px;padding:20px;margin:16px 0}.gads form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0}.gads label{display:grid}.gads input,.gads button{padding:10px;border:1px solid #bbc9d9;border-radius:8px;font:inherit}.gads button{background:#102b50;color:white;cursor:pointer}.gads table{border-collapse:collapse;width:100%}.gads td,.gads th{padding:10px;text-align:left;border-bottom:1px solid #dbe5f0}.mcc-scroll{overflow:auto}</style>`;
const field = csrf => `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
function renderHome({configured,connections,csrf,notice=""}) {
  return `${style}<main class="gads"><a href="/admin/marketing-command-center">← Marketing Command Center</a><h1>Connect Google Ads</h1><p>${esc(notice)}</p>
    <section><h2>Your account, your evidence</h2><p>Connect an account you are authorized to use. Its reports remain private to your Vivid advertiser login. Enterprise sharing requires a separate future campaign-sharing step.</p>
    <p>Vivid only reads Google Ads reports. Google’s consent screen uses its broader Ads permission; Vivid does not implement campaign, bid or spending changes. For an additional access restriction, authorize a Google user with read-only Ads access.</p>
    ${configured ? `<form method="post" action="${PATH}/connect">${field(csrf)}<label>Google Ads customer ID<input name="customer_id" placeholder="123-456-7890" required maxlength="12"></label>
      <label>Manager ID (only if accessed through a manager)<input name="manager_id" placeholder="Optional" maxlength="12"></label><button>Continue to Google</button></form>
      <p>Find your customer ID in Google Ads. After signing in, Vivid checks access to this account before saving the connection. Connect each additional account separately.</p>` : "<p>Google connection setup is not enabled yet. Vivid needs its Google application configuration before accounts can authorize access.</p>"}</section>
    <h2>Your connections</h2>${connections.length ? connections.map(c=>`<section><a href="${PATH}/${Number(c.id)}">${esc(c.account_name)} · ${esc(c.customer_id)}</a><p>${esc(c.status)} · Last import ${when(c.last_synced_at)}</p></section>`).join("") : "<p>No accounts connected.</p>"}</main>`;
}
function renderAccount({connection,rows,syncs,csrf,range,notice=""}) {
  const root = PATH + "/" + Number(connection.id);
  return `${style}<main class="gads"><a href="${PATH}">← Google connections</a><h1>${esc(connection.account_name)}</h1><p>${esc(notice)}</p>
  <form method="get"><label>From (account timezone)<input type="date" name="from" value="${range.from}" required></label><label>To<input type="date" name="to" value="${range.to}" required></label><button>View imported dates</button></form>
  <form method="post" action="${root}/sync">${field(csrf)}<input type="hidden" name="from" value="${range.from}"><input type="hidden" name="to" value="${range.to}"><button>Import this period from Google</button><span>Up to 31 days per import. Re-import recent dates to capture attribution updates.</span></form>
  ${renderEvidence({connections:[connection],rows},range)}
  <h2>Import history</h2><ul>${syncs.length ? syncs.map(s=>`<li>${when(s.started_at)} · ${esc(s.date_from)} – ${esc(s.date_to)} · ${esc(s.status)} · ${Number(s.rows_imported)} records · ${esc(s.api_version)}${s.error_code ? " · " + esc(s.error_code) : ""}</li>`).join("") : "<li>No imports yet.</li>"}</ul>
  <section><h2>Disconnect and remove imported evidence</h2><p>This removes this account’s saved credentials and imported Google reports from Vivid. It does not change Google campaigns or Vivid campaign records. You can also revoke Vivid access in your Google Account permissions.</p><form method="post" action="${root}/disconnect">${field(csrf)}<label><input type="checkbox" name="confirm" value="remove" required> Remove this connection and its Google evidence</label><button>Disconnect account</button></form></section></main>`;
}
module.exports = {renderEvidence,renderHome,renderAccount};
