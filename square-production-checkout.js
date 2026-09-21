'use strict';
const crypto=require('node:crypto');
const {page}=require('./square-production-sales');
const CHECKOUT_SCOPES='ORDERS_WRITE PAYMENTS_WRITE';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validClick=x=>typeof x==='string' && /^[A-Za-z0-9_-]{20,40}$/.test(x);
function parsePrice(value){
  if(typeof value!=='string' || !/^\d{1,6}(\.\d{1,2})?$/.test(value))throw Error('Enter a USD price with at most two decimal places.');
  const [d,c='']=value.split('.'),n=Number(d)*100+Number(c.padEnd(2,'0'));
  if(n<100 || n>1000000)throw Error('Offer total must be between $1 and $10,000.');
  return n;
}
function safeURL(value){
  const u=new URL(value);
  if(u.protocol!=='https:' || u.username || u.password || u.port || !['square.link','checkout.square.site'].includes(u.hostname))throw Error('Invalid Square checkout URL');
  return u.href;
}
function requestFor(offer,click,origin){
  return {idempotency_key:crypto.createHash('sha256').update(JSON.stringify(['vivid-live-v1',offer.customer_id,offer.merchant_id,click])).digest('hex'),
    order:{location_id:offer.location_id,reference_id:click,line_items:[{name:offer.name,quantity:'1',base_price_money:{amount:Number(offer.amount),currency:'USD'}}]},
    checkout_options:{allow_tipping:false,ask_for_shipping_address:false,redirect_url:origin+'/integrations/square/production/checkout/return'}};
}
function installCheckout({app,q,owner,wrap,api,getConnection,csrf,root,origin}){
  let schema;
  const ready=()=>schema || (schema=q(`CREATE TABLE IF NOT EXISTS square_production_offers (
    customer_id BIGINT NOT NULL REFERENCES users(id),campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
    merchant_id TEXT NOT NULL,location_id TEXT NOT NULL,name TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=100 AND amount<=1000000),
    enabled BOOLEAN NOT NULL DEFAULT false,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(customer_id,campaign_id));
    CREATE TABLE IF NOT EXISTS square_production_checkouts (
    customer_id BIGINT NOT NULL REFERENCES users(id),merchant_id TEXT NOT NULL,click_id TEXT NOT NULL,
    campaign_id BIGINT NOT NULL,payload JSONB NOT NULL,url TEXT,order_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(customer_id,merchant_id,click_id));`).catch(e=>{schema=null;throw e;}));
  const canCheckout=c=>c && CHECKOUT_SCOPES.split(' ').every(s=>(c.token.vivid_scopes||'').split(' ').includes(s));
  const admin='/integrations/square/production/customers/:customerId/checkout';
  const publicPath='/integrations/square/production/buy/:customerId/:campaignId';
  const selected=async(id,campaign,click)=>{
    if(!validClick(click) || !/^\d+$/.test(String(campaign)))return null;
    const rows=(await q(`SELECT o.*,e.id AS scan_id,e.qr_id FROM square_production_offers o
      JOIN campaigns c ON c.id=o.campaign_id AND c.user_id=o.customer_id
      JOIN events e ON e.campaign_id=c.id
      JOIN square_production_connections sc ON sc.customer_id=o.customer_id AND sc.merchant_id=o.merchant_id
      WHERE o.customer_id=$1 AND o.campaign_id=$2 AND o.enabled=true AND COALESCE(c.is_test,false)=false
      AND e.type='scan' AND e.vivid_click_id=$3 AND e.created_at<=NOW() AND e.created_at>=NOW()-INTERVAL '30 days'
      ORDER BY e.id LIMIT 2`,[id,campaign,click])).rows;
    return rows.length===1 ? rows[0] : null;
  };
  app.get(admin,owner,wrap(async(req,res)=>{
    await ready();const id=Number(req.params.customerId),connection=await getConnection(id);
    req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');
    if(!canCheckout(connection))return res.type('html').send(page('Enable tracked Square checkout',`<p>Optional: allow Vivid to create real Square orders and hosted checkout links for offers you configure. Customers pay on Square. Your existing sales sync continues with read-only access until you authorize checkout.</p><form method="post" action="${root(id)}/connect"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><input type="hidden" name="checkout" value="true"><button>Authorize live checkout with Square</button></form><p><a href="${root(id)}">Back to connection</a></p>`));
    const campaigns=(await q('SELECT id,name FROM campaigns WHERE user_id=$1 AND COALESCE(is_test,false)=false ORDER BY name',[id])).rows;
    const locations=((await api('/v2/locations',null,connection.token.access_token)).locations||[]).filter(l=>l.status==='ACTIVE' && l.currency==='USD');
    const offers=(await q('SELECT * FROM square_production_offers WHERE customer_id=$1 AND merchant_id=$2 ORDER BY campaign_id',[id,connection.row.merchant_id])).rows;
    res.type('html').send(page('Tracked Square offers',`<p>Configure one fixed-price USD offer per campaign. The total includes any applicable tax; this checkout adds no tax, shipping, or tip. Configure fulfillment with the merchant before enabling an offer.</p><section><form method="post" action="${root(id)}/checkout"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><p><label>Campaign <select name="campaign_id" required>${campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></p><p><label>Square location <select name="location_id" required>${locations.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label></p><p><label>Offer name <input name="name" maxlength="120" required></label></p><p><label>Total price (USD) <input name="price" type="number" min="1" max="10000" step="0.01" required></label></p><p><label><input type="checkbox" name="enabled" value="true"> Enable real customer purchases</label></p><button>Save offer</button></form></section><section><h2>Saved offers</h2>${offers.map(o=>`<p><strong>${esc(o.name)}</strong> · $${(o.amount/100).toFixed(2)} · ${o.enabled?'Enabled':'Disabled'} · Campaign ${o.campaign_id}<br>Customer Action destination:<br><code>${esc(origin)}/integrations/square/production/buy/${id}/${o.campaign_id}</code></p><form method="post" action="${root(id)}/checkout/disable"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><input type="hidden" name="campaign_id" value="${o.campaign_id}"><button>Disable new checkouts</button></form>`).join('') || '<p>No offers configured.</p>'}<p>Use the destination above for a Website Customer Action. Set its conversion value to 0 and leave its conversion page empty. Open it through the campaign QR to capture the scan reference. Saving another offer for the same campaign updates future checkouts; existing Square checkout links keep their original price.</p></section><a href="${root(id)}/sales">Verified sales</a>`));
  }));
  app.post(admin,owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload and retry.');
    await ready();const id=Number(req.params.customerId),connection=await getConnection(id);
    if(!canCheckout(connection))return res.status(409).send('Authorize Square checkout first.');
    let amount;try{amount=parsePrice(req.body.price);}catch(e){return res.status(400).send(e.message);}
    const name=String(req.body.name||'').trim(),campaign=String(req.body.campaign_id||'');
    if(!name || name.length>120 || !/^\d+$/.test(campaign))return res.status(400).send('Choose a campaign and enter an offer name.');
    const locations=(await api('/v2/locations',null,connection.token.access_token)).locations||[];
    if(!locations.some(l=>l.id===req.body.location_id && l.status==='ACTIVE' && l.currency==='USD'))return res.status(400).send('Select an active USD Square location.');
    const saved=await q(`INSERT INTO square_production_offers(customer_id,campaign_id,merchant_id,location_id,name,amount,enabled)
      SELECT c.user_id,c.id,$3,$4,$5,$6,$7 FROM campaigns c JOIN square_production_connections sc ON sc.customer_id=c.user_id
      WHERE c.user_id=$1 AND c.id=$2 AND COALESCE(c.is_test,false)=false AND sc.merchant_id=$3
      ON CONFLICT(customer_id,campaign_id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,location_id=EXCLUDED.location_id,
      name=EXCLUDED.name,amount=EXCLUDED.amount,enabled=EXCLUDED.enabled,updated_at=NOW() RETURNING campaign_id`,
      [id,campaign,connection.row.merchant_id,req.body.location_id,name,amount,req.body.enabled==='true']);
    if(!saved.rows.length)return res.status(400).send('Campaign or Square connection changed.');
    res.redirect(303,root(id)+'/checkout');
  }));
  app.post(admin+'/disable',owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload and retry.');
    await ready();if(!/^\d+$/.test(String(req.body.campaign_id)))return res.status(400).send('Invalid campaign.');
    await q('UPDATE square_production_offers SET enabled=false,updated_at=NOW() WHERE customer_id=$1 AND campaign_id=$2',[req.params.customerId,req.body.campaign_id]);
    res.redirect(303,root(Number(req.params.customerId))+'/checkout');
  }));
  app.get(publicPath,wrap(async(req,res)=>{
    await ready();const id=Number(req.params.customerId),click=req.query.vivid_click_id;
    if(!Number.isSafeInteger(id)||id<=0)return res.status(404).send('Offer unavailable.');
    const offer=await selected(id,req.params.campaignId,click);
    if(!offer)return res.status(404).send('Open an available offer through its Vivid QR code.');
    const connection=await getConnection(id);if(!canCheckout(connection))return res.status(409).send('This merchant has not enabled checkout.');
    req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');
    const attempt=(await q('SELECT payload FROM square_production_checkouts WHERE customer_id=$1 AND merchant_id=$2 AND click_id=$3',[id,offer.merchant_id,click])).rows[0];
    const item=attempt?.payload.order.line_items[0];
    res.type('html').send(page('Your purchase',`<section><h2>${esc(item?.name || offer.name)}</h2><p>Total: <strong>$${((item?.base_price_money.amount || offer.amount)/100).toFixed(2)} USD</strong></p><p>Continue to Square to enter payment details and complete your purchase.</p><form method="post"><input type="hidden" name="csrf" value="${esc(req.session.squareProductionCsrf)}"><input type="hidden" name="vivid_click_id" value="${esc(click)}"><button>Continue to secure checkout</button></form></section>`));
  }));
  app.post(publicPath,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload the offer and retry.');
    await ready();const id=Number(req.params.customerId),click=req.body.vivid_click_id;
    if(!Number.isSafeInteger(id)||id<=0)return res.status(404).send('Offer unavailable.');
    const offer=await selected(id,req.params.campaignId,click);
    if(!offer)return res.status(404).send('Offer or scan is no longer eligible.');
    const connection=await getConnection(id);
    if(!canCheckout(connection) || connection.row.merchant_id!==offer.merchant_id)return res.status(409).send('Merchant connection changed.');
    // First request freezes the price and request body. Retries reuse the same Square key and body.
    const attempt=(await q(`INSERT INTO square_production_checkouts(customer_id,merchant_id,click_id,campaign_id,payload)
      VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(customer_id,merchant_id,click_id)
      DO UPDATE SET click_id=EXCLUDED.click_id RETURNING *`,[id,offer.merchant_id,click,offer.campaign_id,JSON.stringify(requestFor(offer,click,origin))])).rows[0];
    if(!attempt || String(attempt.campaign_id)!==String(offer.campaign_id))throw Error('Checkout conflict');
    let url=attempt.url;
    if(!url){
      const result=await api('/v2/online-checkout/payment-links',attempt.payload,connection.token.access_token);
      if(!result.payment_link?.order_id)throw Error('Missing Square order');
      url=safeURL(result.payment_link.url);
      await q('UPDATE square_production_checkouts SET url=$4,order_id=$5 WHERE customer_id=$1 AND merchant_id=$2 AND click_id=$3',[id,offer.merchant_id,click,url,result.payment_link.order_id]);
    }
    res.redirect(303,safeURL(url));
  }));
  app.get('/integrations/square/production/checkout/return',wrap(async(req,res)=>{
    res.type('html').send(page('Thank you',`<p>Your checkout session has ended. Check your Square receipt for payment confirmation. Contact the merchant about your order.</p>`));
  }));
}
module.exports={installCheckout,CHECKOUT_SCOPES,parsePrice,safeURL,requestFor,validClick};
