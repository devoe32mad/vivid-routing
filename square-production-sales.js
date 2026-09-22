'use strict';
// Verified live payment ledger and native conversion reporting.
const crypto = require('node:crypto');
const {createLedger}=require('./square-production-ledger');
const {createConversions}=require('./square-production-conversions');
const {createRedemptions,orderEvidence}=require('./square-production-redemptions');
const SALES_SCOPES = 'MERCHANT_PROFILE_READ PAYMENTS_READ ORDERS_READ';
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function money(m) {
  if (!m || !Number.isSafeInteger(m.amount) || m.amount < 0 || !/^[A-Z]{3}$/.test(m.currency)) throw Error('Invalid money');
  return {amount:m.amount,currency:m.currency};
}
function normalizePayment(p) {
  if (!p.id || !p.location_id || !Number.isFinite(Date.parse(p.created_at))) throw Error('Invalid payment');
  return {id:p.id,location_id:p.location_id,created_at:p.created_at,status:p.status,
    total:money(p.total_money || p.amount_money),order_id:p.order_id || null,
    reference:p.reference_id || null,refund_ids:p.refund_ids || []};
}
function normalizeRefund(r) {
  if (!r.id) throw Error('Invalid refund');
  return {id:r.id,payment_id:r.payment_id || null,status:r.status,amount:money(r.amount_money),created_at:r.created_at};
}
function amounts(p, refunds) {
  const gross = p.status === 'COMPLETED' ? p.total.amount : 0;
  const completed = refunds.filter(r=>r.payment_id===p.id && r.status==='COMPLETED');
  if (completed.some(r=>r.amount.currency!==p.total.currency)) throw Error('Currency mismatch');
  const refunded = completed.reduce((n,r)=>n+r.amount.amount,0);
  if (refunded > gross) throw Error('Refund exceeds completed payment');
  return {gross,refunded,net:gross-refunded};
}
function campaignTotals(snapshot) {
  const groups=new Map();
  for(const p of snapshot.payments){
    if(!p.match || p.status!=='COMPLETED')continue;
    const key=JSON.stringify([p.match.campaign_id,p.total.currency]);
    if(!groups.has(key))groups.set(key,{campaign_id:p.match.campaign_id,name:p.match.name,currency:p.total.currency,count:0,gross:0,refunded:0,net:0});
    const row=groups.get(key),a=amounts(p,snapshot.refunds);
    row.count++;for(const k of ['gross','refunded','net'])row[k]+=a[k];
  }
  return [...groups.values()];
}
const format = (amount,currency) => {const f=new Intl.NumberFormat('en-US',{style:'currency',currency});return f.format(amount / 10**f.resolvedOptions().maximumFractionDigits);};
function csvCell(value){const x=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(x) ? "'"+x : x).replace(/"/g,'""')+'"';}
function exportSales(snapshot){
  const rows=[['Payment ID','Created UTC','Currency','Status','Collected minor units','Refunded minor units','Net minor units','Campaign ID','Campaign','Vivid click ID','Scan ID','QR ID']];
  for(const p of snapshot.payments){const a=amounts(p,snapshot.refunds);rows.push([p.id,p.created_at,p.total.currency,p.status,a.gross,a.refunded,a.net,p.match?.campaign_id,p.match?.name,p.match?.click_id,p.match?.scan_id,p.match?.qr_id]);}
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
function page(title,body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vivid Spots</title><style>body{margin:0;background:#f3f6fa;color:#14243c;font:16px/1.5 system-ui,sans-serif}main{max-width:1120px;margin:40px auto;padding:24px}h1{margin:8px 0}a{color:#165ca8}section,.notice{background:white;border:1px solid #d9e2ed;border-radius:12px;padding:20px;margin:18px 0}button{background:#153659;color:white;border:0;border-radius:7px;padding:12px 20px;font:inherit;cursor:pointer}.badge{font-size:13px;font-weight:700;letter-spacing:.08em;color:#6a4914}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #e2e8ef;vertical-align:top}.scroll{overflow:auto}summary{cursor:pointer;font-weight:600}dl{display:grid;grid-template-columns:minmax(100px,180px) 1fr;gap:8px}dd{margin:0;overflow-wrap:anywhere}small{color:#4c6077}code{overflow-wrap:anywhere}input,select{font:inherit;padding:8px;max-width:100%;box-sizing:border-box}input:not([type=checkbox]),select{display:block;width:100%;margin:5px 0}button{margin:5px 0}form{margin:12px 0}@media(max-width:600px){main{margin:0;padding:16px}dl{display:block}dd{margin-bottom:12px}}</style></head><body><main><div class="badge">VIVID SPOTS · SQUARE LIVE</div><h1>${esc(title)}</h1>${body}</main></body></html>`;
}
async function collect(api,path,key,token,params) {
  const rows = new Map(); let cursor;
  for(let page=0;page<20;page++) {
    const query=new URLSearchParams({...params,limit:'100',...(cursor ? {cursor} : {})});
    const data=await api(path+'?'+query,null,token);
    for(const row of data[key] || []) rows.set(row.id,row);
    if(!data.cursor)return [...rows.values()];
    if(data.cursor===cursor)throw Error('Repeated cursor');
    cursor=data.cursor;
  }
  throw Error('Import exceeds pilot limit');
}
function installSales({app,q,owner,wrap,api,getConnection,csrf,root,sync}) {
  let schema;
  const ready=()=>schema || (schema=q(`CREATE TABLE IF NOT EXISTS square_production_sales (
    customer_id BIGINT NOT NULL REFERENCES users(id), merchant_id TEXT NOT NULL,
    snapshot JSONB NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(customer_id,merchant_id))`).catch(e=>{schema=null;throw e;}));
  const route='/integrations/square/production/customers/:customerId/sales';
  const permitted=token=>SALES_SCOPES.split(' ').every(s=>(token.vivid_scopes || '').split(' ').includes(s));
  const enrich=async(id,raw,token,changedRefund=null)=>{
    const p=normalizePayment(raw),refunds=new Map();
    for(const rid of p.refund_ids){
      const r=normalizeRefund((await api('/v2/refunds/'+encodeURIComponent(rid),null,token)).refund);
      if(r.payment_id!==p.id)throw Error('Refund payment mismatch');
      refunds.set(r.id,r);
    }
    if(changedRefund){const r=normalizeRefund(changedRefund);if(r.payment_id!==p.id)throw Error('Refund mismatch');refunds.set(r.id,r);}
    if(p.order_id){
      const order=(await api('/v2/orders/'+encodeURIComponent(p.order_id),null,token)).order;
      if(order?.id!==p.order_id || order.location_id!==p.location_id)throw Error('Order mismatch');
      p.order_reference=order.reference_id || null;
      p.instore=orderEvidence(order,p);
    }
    const refs=[...new Set([p.reference,p.order_reference].filter(x=>typeof x==='string' && x.length>0))];
    if(!p.instore && refs.length===1 && refs[0].length<=192){
      const matched=await q(`SELECT e.id AS scan_id,e.qr_id,e.campaign_id,e.vivid_click_id AS click_id,c.name
        FROM events e JOIN campaigns c ON c.id=e.campaign_id
        WHERE c.user_id=$1 AND COALESCE(c.is_test,false)=false AND e.type='scan' AND e.vivid_click_id=$2
        AND e.created_at<=$3::timestamptz AND e.created_at>=$3::timestamptz-INTERVAL '30 days'
        ORDER BY e.id LIMIT 2`,[id,refs[0],p.created_at]);
      if(matched.rows.length===1)p.match=matched.rows[0];
    }
    const list=[...refunds.values()];amounts(p,list);
    return {payment:p,refunds:list};
  };
  const ledger=createLedger({q,api,enrich});
  const conversions=createConversions({q});
  const redemptions=createRedemptions({q});
  const load=async id=>{await ready();return ledger.load(id);};
  app.get(route,owner,wrap(async(req,res)=>{
    req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');
    const id=Number(req.params.customerId), connection=await getConnection(id);
    if(!connection)return res.status(409).send(page('Connect Square first',`<a href="${root(id)}">Back to connection</a>`));
    const intro=`<p>Verified Square sales retained from the initial 90-day import onward. Matched completed USD payments also appear in Vivid conversions and revenue. Each payment is counted once; completed refunds reduce its revenue.</p><a href="${root(id)}">Back to connection</a>`;
    if(!permitted(connection.token))return res.type('html').send(page('Enable live sales',intro+`<section><h2>One more authorization</h2><p>Reconnect your Square live account and allow read access to payments and orders. This also lets Vivid read refunds. This page imports live transactions only.</p><a href="${root(id)}">Reconnect Square live account</a></section>`));
    const row=await load(id), snap=row?.snapshot;
    const campaignFilter=String(req.query?.campaign || '');
    if(snap && campaignFilter){snap.payments=snap.payments.filter(p=>String(p.match?.campaign_id)===campaignFilter);}
    const from=String(req.query?.from || ''),to=String(req.query?.to || '');
    if([from,to].some(v=>v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)))) || (from && to && from>to))return res.status(400).send('Choose a valid date range.');
    if(snap){snap.payments=snap.payments.filter(p=>(!from || p.created_at.slice(0,10)>=from) && (!to || p.created_at.slice(0,10)<=to));}
    if(req.query?.format==='csv'){
      res.set('Content-Disposition','attachment; filename="square-verified-sales.csv"');
      return res.type('text/csv').send(exportSales(snap || {payments:[],refunds:[]}));
    }
    const reportQuery=new URLSearchParams({campaign:campaignFilter,from,to}).toString();
    const detailPage=Math.max(1,Number.parseInt(req.query?.page || '1',10)||1),pageSize=50;
    const action=`<section><form method="post" action="${root(id)}/sales/import"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><button>Sync latest sales</button></form><p><small>Each Square payment is stored once. Later changes and refunds update its record; older imported sales remain in history.</small></p></section>`;
    const state=await sync.status(id);
    const syncMessage=!sync.enabled ? 'Automatic syncing is disabled.' : state?.status==='retry' ? 'The last sync failed. Vivid will retry automatically; reconnect Square if this persists.' : state?.status==='syncing' ? 'Sync in progress.' : 'Automatic sync checks for sales and refunds every five minutes.';
    let body=intro+`<section><h2>Sync status</h2><p>${esc(syncMessage)}</p><p>Last successful sync: ${state?.last_success ? esc(new Date(state.last_success).toISOString()) : 'Not yet'}</p><small>Refresh this page to see updated results. Manual import is also available.</small></section>`+action;
    body+=`<section><form method="get"><input type="hidden" name="campaign" value="${esc(campaignFilter)}"><label>Payment date from (UTC) <input type="date" name="from" value="${esc(from)}"></label><label>Through <input type="date" name="to" value="${esc(to)}"></label><button>Filter sales</button></form><a href="${root(id)}/sales?${esc(reportQuery)}&format=csv">Export verified sales CSV</a> · <a href="${root(id)}/sales">All retained sales</a></section>`;
    if(!snap)body+='<section>No transactions imported yet. Import your Square live activity to begin.</section>';
    else {
      const totals={};
      for(const p of snap.payments){const a=amounts(p,snap.refunds);const t=totals[p.total.currency] ||= {gross:0,refunded:0,net:0,matched:0};for(const k of ['gross','refunded','net'])t[k]+=a[k];if(p.match)t.matched+=a.net;}
      body+=`<p>Imported ${esc(new Date(row.imported_at).toISOString())} · ${row.state?.window ? 'Sync is still catching up; totals may be incomplete.' : 'Retained payment history'}</p><section><h2>Payment totals</h2><p>Collected amounts include any tax and tips. Pending and failed payments are excluded; only completed refunds reduce net amounts.</p><div class="scroll"><table><thead><tr><th>Currency</th><th>Collected</th><th>Refunded</th><th>Net collected</th><th>Matched net</th></tr></thead><tbody>${Object.entries(totals).map(([c,t])=>`<tr><td>${esc(c)}</td>${['gross','refunded','net','matched'].map(k=>`<td>${esc(format(t[k],c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
      const campaigns=campaignTotals(snap);
      body+=`<section><h2>Matched campaign results</h2><p>Verified Square payments less completed refunds. Matched completed USD payments feed Vivid conversion counts, revenue and ROI. A refund adjusts the original conversion’s revenue; the completed purchase remains one conversion. Estimates for the same customer action and scan are superseded, not added again. Other currencies remain in this report only. Test campaigns are excluded from matching.</p>${campaigns.length ? `<div class="scroll"><table><thead><tr><th>Campaign</th><th>Currency</th><th>Payments</th><th>Collected</th><th>Refunded</th><th>Net collected</th></tr></thead><tbody>${campaigns.map(c=>`<tr><td><a href="${root(id)}/sales?campaign=${esc(c.campaign_id)}">${esc(c.name)}</a> (ID ${esc(c.campaign_id)})</td><td>${esc(c.currency)}</td><td>${c.count}</td>${['gross','refunded','net'].map(k=>`<td>${esc(format(c[k],c.currency))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>No completed payments have matched a campaign yet.</p>'}</section>`;
      body+=`<section><h2>Transactions (${snap.payments.length})</h2><p>Online purchases require an exact payment or order reference. In-store purchases require a merchant-approved, single-use Vivid code on the paid Square order. Both must link to this advertiser’s eligible scan within 30 days. Conflicting evidence remains unmatched.</p>${snap.payments.length ? snap.payments.slice((detailPage-1)*pageSize,detailPage*pageSize).map(p=>{
        const a=amounts(p,snap.refunds),refunds=snap.refunds.filter(r=>r.payment_id===p.id);
        return `<details><summary>${esc(p.created_at.slice(0,10))} · ${esc(format(a.net,p.total.currency))} · ${esc(p.status)} · ${p.match ? 'Matched: '+esc(p.match.name) : 'Unmatched'}</summary><dl><dt>Square payment</dt><dd>${esc(p.id)}</dd><dt>Square location</dt><dd>${esc(p.location_id)}</dd><dt>Square order</dt><dd>${esc(p.order_id || 'None')}</dd><dt>Payment reference</dt><dd>${esc(p.reference || 'None')}</dd><dt>Order reference</dt><dd>${esc(p.order_reference || 'None')}</dd><dt>Collected / refunded / net</dt><dd>${esc(format(a.gross,p.total.currency))} / ${esc(format(a.refunded,p.total.currency))} / ${esc(format(a.net,p.total.currency))}</dd><dt>Attribution evidence</dt><dd>${p.match ? (p.match.method==='in_store_code' ? 'In-store code: '+esc(p.match.code)+' · Scan reference: ' : 'Exact reference: ')+esc(p.match.click_id)+' · Campaign '+esc(p.match.campaign_id)+' · QR '+esc(p.match.qr_id)+' · Scan '+esc(p.match.scan_id) : (p.instore ? 'No eligible approved in-store code matched this payment. Check code, location, approval time and single-card checkout.' : 'No unique eligible Vivid scan reference found.')}</dd></dl><h3>Refunds</h3>${refunds.length ? '<ul>'+refunds.map(r=>`<li>${esc(r.id)} · ${esc(r.status)} · ${esc(format(r.amount.amount,r.amount.currency))}</li>`).join('')+'</ul>' : '<p>No refunds.</p>'}</details>`;
      }).join('<hr>') : '<p>No Square live payments were found in this period.</p>'}</section>`;
    }
    if(snap?.payments.length>pageSize)body+=`<p>Page ${detailPage} · ${detailPage>1 ? `<a href="?page=${detailPage-1}&${esc(reportQuery)}">Previous</a>` : ''} ${detailPage*pageSize<snap.payments.length ? `<a href="?page=${detailPage+1}&${esc(reportQuery)}">Next</a>` : ''}</p>`;
    res.type('html').send(page('Square live sales',body));
  }));
  const syncSales=async(id,lease)=>{
    const connection=await getConnection(id);
    if(!connection || !permitted(connection.token))throw Error('Reconnect required');
    await ready();
    await ledger.run(id,connection,lease);
    await redemptions.reconcile(id,connection,lease);
    await conversions.reconcile(id,connection,lease);
  };
  app.post(route+'/import',owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload the connection page and retry.');
    const id=Number(req.params.customerId),connection=await getConnection(id);
    if(!connection || !permitted(connection.token))return res.status(409).send('Reconnect Square and allow payment and order read permissions first.');
    const done=await sync.run(id,lease=>syncSales(id,lease));
    if(!done)return res.status(409).send(page('Sync in progress',`<p>A sync is already running. Please return to sales shortly.</p><a href="${root(id)}/sales">View live sales</a>`));
    res.redirect(root(id)+'/sales');
  }));
  return {syncSales,redemptions};
}
module.exports={installSales,SALES_SCOPES,normalizePayment,normalizeRefund,amounts,collect,page,campaignTotals,exportSales};



