'use strict';
// Production read-only pilot report. Rolling 90-day window; never writes conversion events.
const crypto = require('node:crypto');
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
const format = (amount,currency) => new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount / (currency==='JPY' ? 1 : 100));
function page(title,body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vivid Spots</title><style>body{margin:0;background:#f3f6fa;color:#14243c;font:16px/1.5 system-ui,sans-serif}main{max-width:1120px;margin:40px auto;padding:24px}h1{margin:8px 0}a{color:#165ca8}section,.notice{background:white;border:1px solid #d9e2ed;border-radius:12px;padding:20px;margin:18px 0}button{background:#153659;color:white;border:0;border-radius:7px;padding:12px 20px;font:inherit;cursor:pointer}.badge{font-size:13px;font-weight:700;letter-spacing:.08em;color:#6a4914}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #e2e8ef;vertical-align:top}.scroll{overflow:auto}summary{cursor:pointer;font-weight:600}dl{display:grid;grid-template-columns:minmax(100px,180px) 1fr;gap:8px}dd{margin:0;overflow-wrap:anywhere}small{color:#4c6077}code{overflow-wrap:anywhere}@media(max-width:600px){main{margin:0;padding:16px}dl{display:block}dd{margin-bottom:12px}}</style></head><body><main><div class="badge">VIVID SPOTS · SQUARE LIVE</div><h1>${esc(title)}</h1>${body}</main></body></html>`;
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
  const load=async id=>{
    await ready();
    return (await q(`SELECT s.snapshot,s.imported_at FROM square_production_sales s
      JOIN square_production_connections c ON c.customer_id=s.customer_id AND c.merchant_id=s.merchant_id
      WHERE s.customer_id=$1`,[id])).rows[0];
  };
  app.get(route,owner,wrap(async(req,res)=>{
    req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');
    const id=Number(req.params.customerId), connection=await getConnection(id);
    if(!connection)return res.status(409).send(page('Connect Square first',`<a href="${root(id)}">Back to connection</a>`));
    const intro=`<p>Live Square transactions from the latest 90 days. This report does not change existing campaign conversion revenue or ROI.</p><a href="${root(id)}">Back to connection</a>`;
    if(!permitted(connection.token))return res.type('html').send(page('Enable live sales',intro+`<section><h2>One more authorization</h2><p>Reconnect your Square live account and allow read access to payments and orders. This also lets Vivid read refunds. This page imports live transactions only.</p><a href="${root(id)}">Reconnect Square live account</a></section>`));
    const row=await load(id), snap=row?.snapshot;
    const action=`<section><form method="post" action="${root(id)}/sales/import"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><button>Import latest 90 days</button></form><p><small>Re-importing replaces this snapshot without duplicating sales. Includes refunds for the imported payments, even if issued later.</small></p></section>`;
    const state=await sync.status(id);
    const syncMessage=!sync.enabled ? 'Automatic syncing is disabled.' : state?.status==='retry' ? 'The last sync failed. Vivid will retry automatically; reconnect Square if this persists.' : state?.status==='syncing' ? 'Sync in progress.' : 'Automatic sync checks for sales and refunds every five minutes.';
    let body=intro+`<section><h2>Sync status</h2><p>${esc(syncMessage)}</p><p>Last successful sync: ${state?.last_success ? esc(new Date(state.last_success).toISOString()) : 'Not yet'}</p><small>Refresh this page to see updated results. Manual import is also available.</small></section>`+action;
    if(!snap)body+='<section>No transactions imported yet. Import your Square live activity to begin.</section>';
    else {
      const totals={};
      for(const p of snap.payments){const a=amounts(p,snap.refunds);const t=totals[p.total.currency] ||= {gross:0,refunded:0,net:0,matched:0};for(const k of ['gross','refunded','net'])t[k]+=a[k];if(p.match)t.matched+=a.net;}
      body+=`<p>Imported ${esc(new Date(row.imported_at).toISOString())} · Payments created ${esc(snap.begin)} to ${esc(snap.end)} (UTC)</p><section><h2>Payment totals</h2><p>Collected amounts include any tax and tips. Pending and failed payments are excluded; only completed refunds reduce net amounts.</p><div class="scroll"><table><thead><tr><th>Currency</th><th>Collected</th><th>Refunded</th><th>Net collected</th><th>Matched net</th></tr></thead><tbody>${Object.entries(totals).map(([c,t])=>`<tr><td>${esc(c)}</td>${['gross','refunded','net','matched'].map(k=>`<td>${esc(format(t[k],c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
      const campaigns=campaignTotals(snap);
      body+=`<section><h2>Matched campaign results</h2><p>Verified Square payments less completed refunds. These totals are separate from existing conversion revenue and ROI. Test campaigns are excluded from matching.</p>${campaigns.length ? `<div class="scroll"><table><thead><tr><th>Campaign</th><th>Currency</th><th>Payments</th><th>Collected</th><th>Refunded</th><th>Net collected</th></tr></thead><tbody>${campaigns.map(c=>`<tr><td>${esc(c.name)} (ID ${esc(c.campaign_id)})</td><td>${esc(c.currency)}</td><td>${c.count}</td>${['gross','refunded','net'].map(k=>`<td>${esc(format(c[k],c.currency))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>No completed payments have matched a campaign yet.</p>'}</section>`;
      body+=`<section><h2>Transactions (${snap.payments.length})</h2><p>Matching requires a payment or order reference equal to an existing Vivid click ID for this advertiser, from a scan within 30 days before the payment. Conflicting references remain unmatched.</p>${snap.payments.length ? snap.payments.map(p=>{
        const a=amounts(p,snap.refunds),refunds=snap.refunds.filter(r=>r.payment_id===p.id);
        return `<details><summary>${esc(p.created_at.slice(0,10))} · ${esc(format(a.net,p.total.currency))} · ${esc(p.status)} · ${p.match ? 'Matched: '+esc(p.match.name) : 'Unmatched'}</summary><dl><dt>Square payment</dt><dd>${esc(p.id)}</dd><dt>Square location</dt><dd>${esc(p.location_id)}</dd><dt>Square order</dt><dd>${esc(p.order_id || 'None')}</dd><dt>Payment reference</dt><dd>${esc(p.reference || 'None')}</dd><dt>Order reference</dt><dd>${esc(p.order_reference || 'None')}</dd><dt>Collected / refunded / net</dt><dd>${esc(format(a.gross,p.total.currency))} / ${esc(format(a.refunded,p.total.currency))} / ${esc(format(a.net,p.total.currency))}</dd><dt>Attribution evidence</dt><dd>${p.match ? 'Exact reference: '+esc(p.match.click_id)+' · Campaign '+esc(p.match.campaign_id)+' · QR '+esc(p.match.qr_id)+' · Scan '+esc(p.match.scan_id) : 'No unique eligible Vivid scan reference found.'}</dd></dl><h3>Refunds</h3>${refunds.length ? '<ul>'+refunds.map(r=>`<li>${esc(r.id)} · ${esc(r.status)} · ${esc(format(r.amount.amount,r.amount.currency))}</li>`).join('')+'</ul>' : '<p>No refunds.</p>'}</details>`;
      }).join('<hr>') : '<p>No Square live payments were found in this period.</p>'}</section>`;
    }
    res.type('html').send(page('Square live sales',body));
  }));
  const syncSales=async(id,lease)=>{
    const connection=await getConnection(id);
    if(!connection || !permitted(connection.token))throw Error('Reconnect required');
    await ready();
    const end=new Date().toISOString(),begin=new Date(Date.now()-90*86400000).toISOString();
    const deadline=Date.now()+45000;
    const boundedApi=(...args)=>{if(Date.now()>deadline)throw Error('Import deadline exceeded');return api(...args);};
    const raw=await collect(boundedApi,'/v2/payments','payments',connection.token.access_token,{begin_time:begin,end_time:end,sort_order:'DESC'});
    const payments=raw.map(normalizePayment), refundMap=new Map(),orders=new Map();
    // Fetch each payment's own refunds, rather than using refund creation dates.
    // This keeps an old payment and a newer refund together.
    for(const p of payments) {
      for(const rid of p.refund_ids)if(!refundMap.has(rid)) {
        const data=await boundedApi('/v2/refunds/'+encodeURIComponent(rid),null,connection.token.access_token);
        const r=normalizeRefund(data.refund);
        if(r.payment_id!==p.id)throw Error('Refund payment mismatch');
        refundMap.set(rid,r);
      }
      if(p.order_id){
        if(!orders.has(p.order_id)){
          const data=await boundedApi('/v2/orders/'+encodeURIComponent(p.order_id),null,connection.token.access_token);
          if(data.order?.id!==p.order_id || data.order.location_id!==p.location_id)throw Error('Order mismatch');
          orders.set(p.order_id,data.order.reference_id || null);
        }
        p.order_reference=orders.get(p.order_id);
      }
      const refs=[...new Set([p.reference,p.order_reference].filter(x=>typeof x==='string' && x.length>0 && x.length<=192))];
      if(refs.length===1){
        const matched=await q(`SELECT e.id AS scan_id,e.qr_id,e.campaign_id,e.vivid_click_id AS click_id,c.name
          FROM events e JOIN campaigns c ON c.id=e.campaign_id
          WHERE c.user_id=$1 AND COALESCE(c.is_test,false)=false AND e.type='scan' AND e.vivid_click_id=ANY($2::text[])
            AND e.created_at <= $3::timestamptz AND e.created_at >= $3::timestamptz - INTERVAL '30 days'
          ORDER BY e.created_at,e.id LIMIT 2`,[id,refs,p.created_at]);
        if(matched.rows.length===1)p.match=matched.rows[0];
      }
    }
    const refunds=[...refundMap.values()];
    for(const p of payments)amounts(p,refunds); // Validate before replacing the last successful snapshot.
    const snapshot={begin,end,payments,refunds};
    const saved=await q(`INSERT INTO square_production_sales(customer_id,merchant_id,snapshot)
      SELECT customer_id,merchant_id,$3::jsonb FROM square_production_connections
      WHERE customer_id=$1 AND merchant_id=$2 AND token_ciphertext=$4
        AND EXISTS(SELECT 1 FROM square_production_sync WHERE customer_id=$1 AND lease=$5 AND lease_until>NOW())
      ON CONFLICT(customer_id,merchant_id) DO UPDATE SET snapshot=EXCLUDED.snapshot,imported_at=NOW() RETURNING customer_id`,
      [id,connection.row.merchant_id,JSON.stringify(snapshot),connection.row.token_ciphertext,lease]);
    if(!saved.rows.length)throw Error('Connection changed during import');
  };
  app.post(route+'/import',owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload the connection page and retry.');
    const id=Number(req.params.customerId),connection=await getConnection(id);
    if(!connection || !permitted(connection.token))return res.status(409).send('Reconnect Square and allow payment and order read permissions first.');
    const done=await sync.run(id,lease=>syncSales(id,lease));
    if(!done)return res.status(409).send(page('Sync in progress',`<p>A sync is already running. Please return to sales shortly.</p><a href="${root(id)}/sales">View live sales</a>`));
    res.redirect(root(id)+'/sales');
  }));
  return {syncSales};
}
module.exports={installSales,SALES_SCOPES,normalizePayment,normalizeRefund,amounts,collect,page,campaignTotals};

