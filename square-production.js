"use strict";
const crypto = require('node:crypto');
const {createSync} = require('./square-production-sync');
const BASE = 'https://connect.squareup.com';
const {installSales, SALES_SCOPES} = require('./square-production-sales');
const SCOPES = SALES_SCOPES;
const PATH = '/integrations/square/production';
function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) &&
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function seal(value, key, context) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('square-production:' + context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString('base64')).join('.');
}
function unseal(value, key, context) {
  const [iv, tag, data] = value.split('.').map(x => Buffer.from(x, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('square-production:' + context));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString());
}
function configuration(env) {
  const key = Buffer.from(env.SQUARE_PRODUCTION_TOKEN_KEY || '', 'base64');
  const redirect = env.SQUARE_PRODUCTION_REDIRECT_URL || '';
  const url = new URL(redirect);
  if (key.length !== 32 || !env.SQUARE_PRODUCTION_APPLICATION_SECRET ||
      !/^sq0idp-[A-Za-z0-9_-]+$/.test(env.SQUARE_PRODUCTION_APPLICATION_ID || '') ||
      url.protocol !== 'https:' || url.pathname !== PATH + '/callback' ||
      url.search || url.hash || url.username || url.password) throw new Error('Invalid Square configuration');
  return {key, redirect, id: env.SQUARE_PRODUCTION_APPLICATION_ID, secret: env.SQUARE_PRODUCTION_APPLICATION_SECRET};
}
function install({app, q, requireAdvertiserCustomerManager, env = process.env, fetcher = fetch}) {
  // Explicit opt-in: no routes or database changes until enabled.
  if (env.SQUARE_PRODUCTION_ENABLED !== 'true') return;
  const config = configuration(env);
  let schema;
  const ready = () => schema || (schema = q(`CREATE TABLE IF NOT EXISTS square_production_connections (
    customer_id BIGINT PRIMARY KEY REFERENCES users(id), merchant_id TEXT NOT NULL UNIQUE,
    token_ciphertext TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS square_production_states (
      state_hash TEXT PRIMARY KEY, customer_id BIGINT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`).catch(e => {schema = null; throw e;}));
  const save = req => new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
  const api = async (path, body, token) => {
    const response = await fetcher(BASE + path, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
      headers: {'Content-Type':'application/json', 'Square-Version':'2025-01-23',
        ...(token ? {Authorization: 'Bearer ' + token} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (!response.ok) throw new Error('Square request failed');
    return response.json();
  };
  const wrap = fn => async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer');
    try {await ready(); await fn(req, res);} catch (_) {
      // Never log request URLs, OAuth codes, secrets, or Square responses.
      res.status(502).send('Square live connection request could not be completed. Please retry or reconnect.');
    }
  };
  const root = id => PATH + '/customers/' + id;
  const csrf = req => equal(req.body?.csrf, req.session.squareProductionCsrf);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const owner = (req, res, next) => {
    if (!req.session?.user) return res.status(401).send('Sign in to Vivid first.');
    return requireAdvertiserCustomerManager(req, res, next);
  };
  app.get(PATH + '/customers/:customerId', owner, wrap(async (req, res) => {
    const id = Number(req.params.customerId);
    req.session.squareProductionCsrf ||= crypto.randomBytes(32).toString('hex');
    const result = await q('SELECT merchant_id, updated_at FROM square_production_connections WHERE customer_id=$1', [id]);
    const row = result.rows[0];
    const form = (action, label) => `<form method="post" action="${root(id)}/${action}"><input type="hidden" name="csrf" value="${req.session.squareProductionCsrf}"><button>${label}</button></form>`;
    res.type('html').send(`<!doctype html><html><head><title>Square live connection | Vivid Spots</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>Square live connection</h1><p>Live connection for advertiser ${id}. Vivid reads payments, orders and refunds. Verified Square totals appear in a separate report; existing campaign ROI is unchanged.</p><p>${row ? 'Connected merchant: ' + escape(row.merchant_id) : 'Not connected'}</p>${form('connect', row ? 'Reconnect Square live account' : 'Connect Square live account')}${row ? `<p><a href="${root(id)}/locations">View Square live locations</a></p><p><a href="${root(id)}/sales">View Square live sales</a></p>` + form('disconnect', 'Disconnect Square live account') : ''}</main></body></html>`);
  }));
  app.post(PATH + '/customers/:customerId/connect', owner, wrap(async (req, res) => {
    if (!csrf(req)) return res.status(403).send('Reload the Square connection page and retry.');
    const id = Number(req.params.customerId);
    const customer = await q("SELECT id FROM users WHERE id=$1 AND role=\'customer\'", [id]);
    if (!customer.rows.length) return res.status(404).send('Advertiser not found.');
    const state = crypto.randomBytes(32).toString('hex');
    req.session.squareProductionPending = {state, customerId:id, userId:req.session.user.id, until:Date.now()+600000};
    await q('DELETE FROM square_production_states WHERE expires_at < NOW()');
    await q('INSERT INTO square_production_states(state_hash,customer_id,expires_at) VALUES($1,$2,$3)',
      [crypto.createHash('sha256').update(state).digest('hex'),id,new Date(Date.now()+600000)]);
    await save(req);
    const url = new URL(BASE + '/oauth2/authorize');
    url.search = new URLSearchParams({client_id:config.id, scope:SCOPES, state, redirect_uri:config.redirect, session:'false'}).toString();
    res.redirect(url.toString());
  }));
  app.get(PATH + '/callback', (req, res, next) => {
    const pending = req.session?.squareProductionPending;
    if (!pending || pending.until < Date.now() || !equal(req.query.state, pending.state) ||
      pending.userId !== req.session?.user?.id) return res.status(403).send('Square authorization expired or invalid. Start again in Vivid.');
    req.params.customerId = String(pending.customerId);
    return owner(req, res, next);
  }, wrap(async (req, res) => {
    const pending = req.session.squareProductionPending;
    delete req.session.squareProductionPending;
    await save(req);
    const consumed = await q('DELETE FROM square_production_states WHERE state_hash=$1 AND customer_id=$2 AND expires_at>NOW() RETURNING customer_id',
      [crypto.createHash('sha256').update(pending.state).digest('hex'),pending.customerId]);
    if (!consumed.rows.length) return res.status(403).send('Authorization already used or expired.');
    if (req.query.error) return res.redirect(root(pending.customerId));
    if (typeof req.query.code !== 'string' || !req.query.code) return res.status(400).send('Missing authorization code.');
    const token = await api('/oauth2/token', {client_id:config.id, client_secret:config.secret,
      grant_type:'authorization_code', code:req.query.code, redirect_uri:config.redirect});
    if (!token.access_token || !token.refresh_token || !token.merchant_id || !Number.isFinite(Date.parse(token.expires_at))) throw new Error('Invalid token');
    await q(`INSERT INTO square_production_connections(customer_id,merchant_id,token_ciphertext,expires_at)
      VALUES($1,$2,$3,$4) ON CONFLICT(customer_id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,
      token_ciphertext=EXCLUDED.token_ciphertext,expires_at=EXCLUDED.expires_at,updated_at=NOW()`,
    [pending.customerId, token.merchant_id, seal({...token,vivid_scopes:SCOPES}, config.key, String(pending.customerId)), token.expires_at]);
    res.redirect(root(pending.customerId));
  }));
  const getConnection = async id => {
    const result = await q('SELECT * FROM square_production_connections WHERE customer_id=$1', [id]);
    const row = result.rows[0];
    if (!row) return null;
    let token = unseal(row.token_ciphertext, config.key, String(id));
    if (Date.parse(row.expires_at) < Date.now()+86400000) {
      const refreshed = await api('/oauth2/token', {client_id:config.id,client_secret:config.secret,
        grant_type:'refresh_token',refresh_token:token.refresh_token});
      if (!refreshed.access_token || !Number.isFinite(Date.parse(refreshed.expires_at))) throw new Error('Invalid refresh');
      token = {...token,...refreshed};
      const ciphertext = seal(token,config.key,String(id));
      const updated = await q('UPDATE square_production_connections SET token_ciphertext=$1,expires_at=$2,updated_at=NOW() WHERE customer_id=$3 AND token_ciphertext=$4 RETURNING customer_id',
        [ciphertext,token.expires_at,id,row.token_ciphertext]);
      if (!updated.rows.length) {
        const current=(await q('SELECT * FROM square_production_connections WHERE customer_id=$1',[id])).rows[0];
        if(!current || current.merchant_id!==row.merchant_id)throw Error('Connection changed');
        return {row:current,token:unseal(current.token_ciphertext,config.key,String(id))};
      }
      row.token_ciphertext = ciphertext;
    }
    return {row,token};
  };
  const sync=createSync({q,ready,enabled:env.SQUARE_PRODUCTION_AUTO_SYNC !== 'false'});
  const {syncSales}=installSales({app,q,owner,wrap,api,getConnection,csrf,root,sync});
  sync.start(syncSales);
  app.get(PATH + '/customers/:customerId/locations', owner, wrap(async (req, res) => {
    const id = Number(req.params.customerId), connection = await getConnection(id);
    if (!connection) return res.status(409).send('Connect a Square live account first.');
    const {token} = connection;
    const data = await api('/v2/locations', null, token.access_token);
    res.type('html').send(`<!doctype html><title>Square live locations</title><h1>Square live locations</h1><ul>${(data.locations || []).map(l => `<li>${escape(l.name)} — ${escape(l.id)}</li>`).join('')}</ul><a href="${root(id)}">Back to connection</a>`);
  }));
  app.post(PATH + '/customers/:customerId/disconnect', owner, wrap(async (req, res) => {
    if (!csrf(req)) return res.status(403).send('Reload the connection page and retry.');
    const id = Number(req.params.customerId);
    const result = await q('SELECT token_ciphertext FROM square_production_connections WHERE customer_id=$1', [id]);
    if (result.rows[0]) {
      const token = unseal(result.rows[0].token_ciphertext,config.key,String(id));
      const response = await fetcher(BASE+'/oauth2/revoke', {method:'POST',signal:AbortSignal.timeout(15000),
        headers:{'Content-Type':'application/json',Authorization:'Client '+config.secret},
        body:JSON.stringify({client_id:config.id,access_token:token.access_token})});
      if (!response.ok) throw new Error('Revocation failed');
      await q('DELETE FROM square_production_connections WHERE customer_id=$1', [id]);
    }
    delete req.session.squareProductionPending;
    res.redirect(root(id));
  }));
}
module.exports = {install, configuration, seal, unseal, equal};


