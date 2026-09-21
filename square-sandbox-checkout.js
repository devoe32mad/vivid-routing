'use strict';
// Owner-operated Sandbox demo. Never creates live payments or conversion events.
const crypto = require('node:crypto');
const {page} = require('./square-sandbox-sales');
const CHECKOUT_SCOPES = 'ORDERS_WRITE PAYMENTS_WRITE';
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validClick = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(x);
function checkoutRequest(id, merchant, click, location, origin) {
  return {
    idempotency_key: crypto.createHash('sha256').update(JSON.stringify(['vivid-sandbox-checkout-v1',id,merchant,click])).digest('hex'),
    description: 'Vivid Sandbox attribution test',
    order: {location_id:location, reference_id:click,
      line_items:[{name:'Vivid Sandbox test purchase',quantity:'1',base_price_money:{amount:1000,currency:'USD'}}]},
    checkout_options: {allow_tipping:false,ask_for_shipping_address:false,
      redirect_url:origin+'/integrations/square/sandbox/customers/'+id+'/checkout/return'}
  };
}
function safeCheckoutURL(value) {
  const url = new URL(value);
  const hosts = ['square.link','square.site','squareupsandbox.com'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !hosts.some(host=>url.hostname===host || url.hostname.endsWith('.'+host))) throw Error('Invalid checkout URL');
  return url.href;
}
function installCheckout({app,q,owner,wrap,api,getConnection,csrf,root,origin}) {
  const route='/integrations/square/sandbox/customers/:customerId/checkout';
  const eligibleScan = async (id,click) => {
    if (!validClick(click)) return null;
    const result=await q(`SELECT e.id AS scan_id, e.qr_id, e.campaign_id, c.name
      FROM events e JOIN campaigns c ON c.id=e.campaign_id
      WHERE c.user_id=$1 AND c.is_test=true AND e.type='scan' AND e.vivid_click_id=$2
      AND e.created_at<=NOW() AND e.created_at>=NOW()-INTERVAL '30 days'
      ORDER BY e.id LIMIT 2`,[id,click]);
    return result.rows.length===1 ? result.rows[0] : null;
  };
  const connectionFor = async (id,res) => {
    const connection=await getConnection(id);
    if(!connection || !CHECKOUT_SCOPES.split(' ').every(scope=>(connection.token.vivid_scopes || '').split(' ').includes(scope))) {
      res.status(409).type('html').send(page('Enable Sandbox checkout',`<p>Reconnect your Square test account to allow creation of test orders and checkout pages. This stays in Sandbox.</p><a href="${root(id)}">Open Square connection</a>`));
      return null;
    }
    return connection;
  };
  app.get(route,owner,wrap(async(req,res)=>{
    const id=Number(req.params.customerId);
    const connection=await connectionFor(id,res); if(!connection)return;
    const click=req.query.vivid_click_id;
    if(click===undefined) {
      const destination=origin+root(id)+'/checkout';
      return res.type('html').send(page('Set up a tracked test checkout',`<p>This owner-operated demo creates a $10 USD Square Sandbox checkout. It requires a signed-in Vivid account and a campaign marked <strong>Test Campaign</strong>.</p><section><ol><li>In your test campaign, add a Website customer action named <strong>Square test checkout</strong>.</li><li>Use this Destination URL:<p><code>${esc(destination)}</code></p></li><li>Leave the conversion page empty and set this action’s conversion value to 0. Save.</li><li>Open the campaign’s QR and select Square test checkout. Vivid carries the scan reference automatically.</li></ol></section><p>Complete the checkout with Square test card details, then import the test sales to verify the campaign match. No live revenue or ROI is changed.</p><a href="${root(id)}/sales">View test sales</a>`));
    }
    const scan=await eligibleScan(id,click);
    if(!scan)return res.status(400).send('Open this checkout through a QR for a Test Campaign in this advertiser account. The scan must be unique and less than 30 days old.');
    const data=await api('/v2/locations',null,connection.token.access_token);
    const locations=(data.locations || []).filter(l=>l.status==='ACTIVE' && l.currency==='USD');
    if(!locations.length)return res.status(409).send('This demo needs an active USD Square Sandbox location.');
    req.session.squareSandboxCsrf ||= crypto.randomBytes(32).toString('hex');
    res.type('html').send(page('Your tracked test checkout',`<p>Sandbox only. No real money. Use Square test card details on the next page.</p><section><h2>$10.00 test purchase</h2><p>Campaign: <strong>${esc(scan.name)}</strong> · QR ${esc(scan.qr_id)}</p><p>Your scan reference has been captured automatically.</p><form method="post" action="${root(id)}/checkout"><input type="hidden" name="csrf" value="${esc(req.session.squareSandboxCsrf)}"><input type="hidden" name="vivid_click_id" value="${esc(click)}"><p><label>Square test location <select name="location_id">${locations.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label></p><button>Continue to Square test checkout</button></form></section><p>Retrying this scan reuses the same checkout request. Start with a new QR scan for a new purchase.</p>`));
  }));
  app.post(route,owner,wrap(async(req,res)=>{
    if(!csrf(req))return res.status(403).send('Reload the test checkout and retry.');
    const id=Number(req.params.customerId),click=req.body.vivid_click_id;
    const scan=await eligibleScan(id,click);
    if(!scan)return res.status(400).send('No unique eligible scan for this advertiser’s Test Campaign.');
    const connection=await connectionFor(id,res); if(!connection)return;
    const data=await api('/v2/locations',null,connection.token.access_token);
    const location=(data.locations || []).find(l=>l.id===req.body.location_id && l.status==='ACTIVE' && l.currency==='USD');
    if(!location)return res.status(400).send('Select an active USD location from this Square test account.');
    const result=await api('/v2/online-checkout/payment-links',checkoutRequest(id,connection.row.merchant_id,click,location.id,origin),connection.token.access_token);
    if(!result.payment_link?.order_id || !result.payment_link?.url)throw Error('Missing checkout');
    res.redirect(303,safeCheckoutURL(result.payment_link.url));
  }));
  app.get(route+'/return',owner,wrap(async(req,res)=>{
    const id=Number(req.params.customerId);
    res.type('html').send(page('Check your test purchase',`<p>You have returned from Square. Returning here does not confirm payment.</p><p>Open test sales and click <strong>Import latest 90 days</strong>. A completed payment should appear with its campaign match.</p><a href="${root(id)}/sales">Open Square test sales</a>`));
  }));
}
module.exports={installCheckout,CHECKOUT_SCOPES,checkoutRequest,safeCheckoutURL,validClick};
