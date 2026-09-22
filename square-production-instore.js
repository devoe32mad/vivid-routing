'use strict';
const crypto=require('node:crypto');
const QRCode=require('qrcode');
const cashierScript=require('node:fs').readFileSync(require('node:path').join(__dirname,'square-instore-cashier-client.js'),'utf8');
const {page,SALES_SCOPES}=require('./square-production-sales');
const {createRedemptions,normalizeCode}=require('./square-production-redemptions');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idOK=x=>/^\d+$/.test(String(x)) && Number.isSafeInteger(Number(x)) && Number(x)>0;
const clickOK=x=>typeof x==='string' && /^[A-Za-z0-9_-]{20,40}$/.test(x);
const date=x=>new Date(x).toLocaleString('en-US',{timeZone:'UTC'})+' UTC';
const time=x=>`<time datetime="${esc(new Date(x).toISOString())}">${esc(date(x))}</time>`;
function installInstore({app,q,owner,wrap,api,getConnection,csrf,root,origin,redemptions}){
  const model=redemptions || createRedemptions({q});
  const admin='/integrations/square/production/customers/:customerId/instore';
  const publicPath='/integrations/square/production/claim/:customerId/:campaignId';
  const prepare=req=>{req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');};
  const hidden=req=>`<input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}">`;
  const connection=async id=>{const c=await getConnection(id);return c && SALES_SCOPES.split(' ').every(s=>(c.token.vivid_scopes||'').split(' ').includes(s)) ? c : null;};
  const locations=async c=>((await api('/v2/locations',null,c.token.access_token)).locations||[]).filter(l=>l.status==='ACTIVE' && l.currency==='USD');
  const back=id=>`<p><a href="${root(id)}/instore">In-store offers</a> · <a href="${root(id)}/instore/redeem">Validate a customer code</a> · <a href="${root(id)}/sales">Verified sales</a></p>`;
  const copyScriptPath='/integrations/square/production/instore-copy.js';
  app.get(copyScriptPath,wrap(async(req,res)=>res.type('application/javascript').send(cashierScript)));
  const codeBlock=code=>`<label for="claim-code">Code</label><input id="claim-code" readonly value="${esc(code)}" autocomplete="off" spellcheck="false" style="font-family:monospace;font-weight:700;font-size:1.3em"><button id="copy-claim-code" type="button" hidden>Copy code</button><span id="copy-code-status" role="status" aria-live="polite"></span><script src="${copyScriptPath}" defer></script>`;
  const terms=r=>`<h2>${esc(r.name)}</h2><p style="white-space:pre-wrap">${esc(r.terms)}</p><p>Location: <strong>${esc(r.location_name)}</strong></p>`;
  async function claimPage(r){
    const expired=Date.parse(r.expires_at)<=Date.now() || (r.checkout_until && Date.parse(r.checkout_until)<=Date.now());
    const cashierUrl=origin+root(Number(r.customer_id))+'/instore/redeem?code='+encodeURIComponent(r.code);
    const qr=!expired && !r.payment_id ? await QRCode.toString(cashierUrl,{type:'svg',width:240,margin:4,errorCorrectionLevel:'M'}) : '';
    return page('Your in-store offer',`<section>${terms(r)}${r.payment_id ? '<p>This offer has been redeemed.</p>' : expired ? '<p>This code has expired.</p>' : `<p>Show this to the cashier before paying.</p><div role="img" aria-label="Cashier QR code to check this offer" style="max-width:240px">${qr}</div><p><small>Cashier: scan with your phone camera while signed in to Vivid, or enter the code below.</small></p>${codeBlock(r.code)}<p>Valid until ${time(r.checkout_until||r.expires_at)}.</p><p>${r.approved_at ? 'Approved for this checkout. Complete payment with the cashier.' : 'The cashier will check the offer and apply it to eligible items.'}</p>`}<p>One use for this claim. Payment takes place at the merchant’s Square checkout.</p></section>`);
  }
  const changeLocation=(id,code)=>`<p><a href="${root(id)}/instore/redeem?code=${encodeURIComponent(code)}&amp;choose_location=1">Change checkout location</a></p>`;
  const unavailable=(id,code)=>page('Code unavailable',`<p>This code is invalid, expired, already redeemed, or belongs to a different merchant or location.</p>${code?changeLocation(id,code):''}${back(id)}`);
  const checkoutSteps=r=>`<ol><li>Apply the offer to the eligible items in Square.</li><li>Paste the code into an eligible item’s <strong>Note</strong>. Keep only the code in that note.</li><li>Complete one card payment for the full order before <span id="checkout-deadline">${time(r.checkout_until||r.expires_at)}</span>.</li></ol><p>Vivid will confirm the sale automatically after Square reports the completed payment. You do not need to wait here.</p>`;
  const cashierPage=(req,id,r,approved)=>page(approved?'Approved for this checkout':'Check offer eligibility',`${back(id)}<section>${terms(r)}${approved?'':changeLocation(id,r.code)}${codeBlock(r.code)}${approved?'':`<form id="approve-checkout" method="post" action="${root(id)}/instore/approve">${hidden(req)}<input type="hidden" name="code" value="${esc(r.code)}"><input type="hidden" name="location_id" value="${esc(r.location_id)}"><p>By confirming, you have checked the eligible items and will apply this offer in Square.</p><button id="approve-button" name="confirm" value="true">${r.approved_at?'Resume checkout':'Confirm eligible items'}</button><p id="approval-status" role="status" aria-live="polite"></p></form>`}<div id="checkout-steps" ${approved?'':'hidden'}>${checkoutSteps(r)}</div><p><a href="${root(id)}/instore/redeem">Next customer</a></p></section>`);
  app.get(admin,owner,wrap(async(req,res)=>{
    await model.ready();prepare(req);const id=Number(req.params.customerId),c=await connection(id);
    if(!c)return res.status(409).send(page('Connect Square first',`<a href="${root(id)}">Square connection</a>`));
    const [campaigns,locs,offers]=await Promise.all([
      q('SELECT id,name FROM campaigns WHERE user_id=$1 AND NOT COALESCE(is_test,false) ORDER BY name',[id]),locations(c),
      q('SELECT * FROM square_instore_offers WHERE customer_id=$1 AND merchant_id=$2 ORDER BY campaign_id',[id,c.row.merchant_id])]);
    res.type('html').send(page('Square in-store offers',`<p>Customers claim an offer through a campaign QR. At checkout, an authorized Vivid merchant user validates the code, applies the offer in Square, and copies the code into an item note before taking payment.</p>${back(id)}<section><form method="post">${hidden(req)}
      <label>Campaign<select name="campaign_id" required>${campaigns.rows.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
      <label>Square location<select name="location_id" required>${locs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>
      <label>Offer name<input name="name" maxlength="120" required></label>
      <label>Offer terms and eligible products<textarea name="terms" maxlength="2000" rows="5" style="width:100%;box-sizing:border-box;font:inherit" required placeholder="Example: 10% off one eligible sandwich. Excludes drinks. Cannot be combined with other discounts."></textarea></label>
      <p>Claims expire after seven days, or sooner if the originating scan reaches 30 days. Existing claims keep their original terms. One code per claim; this does not enforce a one-per-person promotion.</p>
      <p><label><input type="checkbox" name="enabled" value="true"> Enable customer claims</label></p><button>Save in-store offer</button></form></section>
      <section><h2>Saved offers</h2>${offers.rows.map(o=>`${terms(o)}<p>Campaign ${o.campaign_id} · ${o.enabled?'Enabled':'Disabled'}</p><p>Customer Action destination:<br><code>${esc(origin)}/integrations/square/production/claim/${id}/${o.campaign_id}</code></p><form method="post" action="${root(id)}/instore/disable">${hidden(req)}<input type="hidden" name="campaign_id" value="${o.campaign_id}"><button>Disable new claims</button></form><hr>`).join('')||'<p>No in-store offers saved.</p>'}
      <p>Use the destination in a Website Customer Action with conversion value 0 and no conversion page. Customers must open it through the campaign QR. Saving this form does not change campaign routing.</p></section>
      <section><h2>Pilot checkout</h2><p>Use a single USD card payment for the full order. Split payments, cash and gift cards are not supported by this pilot. Square handles the basket, taxes and payment. Staff check product eligibility and apply the discount; Vivid does not apply or verify the discount automatically.</p><p>Attributed revenue is the entire paid order, including other basket items, taxes and tips, less completed refunds. It is not limited to the discounted item and does not measure incremental lift.</p></section>`));
  }));
  app.post(admin,owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload and retry.');
    await model.ready();const id=Number(req.params.customerId),c=await connection(id);
    if(!c)return res.status(409).send('Connect Square first.');
    const name=String(req.body.name||'').trim(),text=String(req.body.terms||'').trim();
    if(!idOK(req.body.campaign_id)||!name||name.length>120||!text||text.length>2000)return res.status(400).send('Choose a campaign and enter an offer name and terms.');
    const loc=(await locations(c)).find(l=>l.id===req.body.location_id);
    if(!loc)return res.status(400).send('Choose an active USD Square location.');
    const result=await q(`INSERT INTO square_instore_offers(customer_id,campaign_id,merchant_id,location_id,location_name,name,terms,enabled)
      SELECT c.user_id,c.id,sc.merchant_id,$4,$5,$6,$7,$8 FROM campaigns c
      JOIN square_production_connections sc ON sc.customer_id=c.user_id
      WHERE c.user_id=$1 AND c.id=$2 AND sc.merchant_id=$3 AND NOT COALESCE(c.is_test,false)
      ON CONFLICT(customer_id,campaign_id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,location_id=EXCLUDED.location_id,
        location_name=EXCLUDED.location_name,name=EXCLUDED.name,terms=EXCLUDED.terms,enabled=EXCLUDED.enabled,updated_at=NOW()
      RETURNING campaign_id`,[id,req.body.campaign_id,c.row.merchant_id,loc.id,loc.name,name,text,req.body.enabled==='true']);
    if(!result.rows.length)return res.status(400).send('Campaign or merchant connection changed.');
    res.redirect(303,root(id)+'/instore');
  }));
  app.post(admin+'/disable',owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload and retry.');
    if(!idOK(req.body.campaign_id))return res.status(400).send('Invalid campaign.');
    await model.ready();await q('UPDATE square_instore_offers SET enabled=false,updated_at=NOW() WHERE customer_id=$1 AND campaign_id=$2',[req.params.customerId,req.body.campaign_id]);
    res.redirect(303,root(Number(req.params.customerId))+'/instore');
  }));
  app.get(publicPath,wrap(async(req,res)=>{
    if(!idOK(req.params.customerId)||!idOK(req.params.campaignId)||!clickOK(req.query.vivid_click_id))return res.status(404).send('Open this offer through its Vivid QR code.');
    const offer=await model.offer(req.params.customerId,req.params.campaignId,req.query.vivid_click_id);
    if(!offer)return res.status(404).send('This offer or scan is no longer available.');
    prepare(req);
    res.type('html').send(page('Claim your in-store offer',`<section>${terms(offer)}<p>Claim a code, then show it to the cashier before paying. The cashier checks eligibility and applies the offer.</p><form method="post">${hidden(req)}<input type="hidden" name="vivid_click_id" value="${esc(req.query.vivid_click_id)}"><button>Claim offer</button></form></section>`));
  }));
  app.post(publicPath,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload the offer and retry.');
    if(!idOK(req.params.customerId)||!idOK(req.params.campaignId)||!clickOK(req.body.vivid_click_id))return res.status(404).send('Offer unavailable.');
    const claim=await model.issue(req.params.customerId,req.params.campaignId,req.body.vivid_click_id);
    if(!claim)return res.status(404).send('This offer or scan is no longer available.');
    res.type('html').send(await claimPage(claim));
  }));
  app.get(admin+'/redeem',owner,wrap(async(req,res)=>{
    prepare(req);const id=Number(req.params.customerId),c=await connection(id);
    if(!c)return res.status(409).send('Connect Square first.');
    const locs=await locations(c);
    const remembered=req.session.squareInstoreLocation;
    const chosen=req.query?.choose_location==='1'?null:locs.length===1?locs[0]:remembered?.customerId===id && remembered.merchantId===c.row.merchant_id ? locs.find(l=>l.id===remembered.locationId) : null;
    const code=normalizeCode(req.query?.code);
    if(req.query?.code && !code)return res.status(400).send(unavailable(id));
    if(code && chosen){
      // Scanning performs a read-only lookup. Only the explicit POST can approve.
      const r=await model.lookup(id,code,chosen.id);
      if(!r)return res.status(409).send(unavailable(id,code));
      return res.type('html').send(cashierPage(req,id,r,false));
    }
    res.type('html').send(page('Cashier checkout',`${back(id)}<section><p>Scan the customer’s offer QR with your phone camera, or enter their short code here.</p><form method="post" action="${root(id)}/instore/lookup">${hidden(req)}<label>Checkout location<select name="location_id" required>${chosen?'':'<option value="">Choose your checkout location</option>'}${locs.map(l=>`<option value="${esc(l.id)}" ${l.id===chosen?.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label><label>Customer code<input name="code" maxlength="25" autocomplete="off" autocapitalize="characters" required spellcheck="false" value="${esc(code||'')}" placeholder="V-7K3M9R2X"></label><button>Check code</button></form><p>Keep Vivid signed in on the cashier device. Check the customer’s items before confirming the offer.</p></section>`));
  }));
  for(const action of ['lookup','approve'])app.post(admin+'/'+action,owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload and retry.');
    const id=Number(req.params.customerId),c=await connection(id),code=normalizeCode(req.body.code);
    if(!c)return res.status(409).send('Connect Square first.');
    if(!code || typeof req.body.location_id!=='string')return res.status(400).send('Enter the complete customer code and select a location.');
    if(action==='approve' && req.body.confirm!=='true')return res.status(400).send('Confirm the items meet the offer terms.');
    // Location must still be active at approval, not only when the offer was configured.
    if(action==='approve' && !(await locations(c)).some(l=>l.id===req.body.location_id))return res.status(409).send('Checkout location is no longer active.');
    const r=action==='lookup' ? await model.lookup(id,code,req.body.location_id) : await model.approve(id,code,req.body.location_id,req.session.user.id);
    if(!r)return res.status(409).send(unavailable(id,code));
    req.session.squareInstoreLocation={customerId:id,merchantId:c.row.merchant_id,locationId:r.location_id};
    prepare(req);
    if(action==='approve' && req.headers?.accept==='application/json')return res.type('application/json').send(JSON.stringify({code:r.code,checkout_until:new Date(r.checkout_until).toISOString()}));
    res.type('html').send(cashierPage(req,id,r,action==='approve'));
  }));
  return model;
}
module.exports={installInstore};
