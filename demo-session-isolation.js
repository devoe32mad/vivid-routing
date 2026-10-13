'use strict';
// Keep independently authorized demos in distinct cookie/path namespaces.
// Existing demo guards still validate tokens, expiry, tenant IDs and permitted actions.
const demos={ccps:'ccpsReview','rubber-world':'rubberWorldReview'};
function localUrl(value,prefix){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.startsWith('/demo/'))return value;
 return prefix+value;
}
function htmlUrls(body,prefix){
 // Root-relative attributes and quoted script URLs; leave external URLs and anchors intact.
 return body.replace(/(["'`])(\/(?!\/)[^\s"'`<>]*)\1/g,(whole,quote,url)=>quote+localUrl(url,prefix)+quote);
}
function independentStore(session,shared){
 if(!shared)return undefined;
 // express-session assigns store.generate for each middleware. A shared instance
 // would make regeneration use the last middleware's cookie path/options.
 const store=new session.Store();
 for(const method of ['get','set','destroy','touch','all','length','clear'])if(typeof shared[method]==='function')store[method]=shared[method].bind(shared);
 for(const event of ['connect','disconnect'])shared.on(event,(...args)=>store.emit(event,...args));
 return store;
}
function tenantFromUrl(raw){
 const url=new URL(raw,'http://local');
 if(/^\/advertise\/ccps(?:\/|$)/.test(url.pathname)||url.pathname==='/org-organization/13'||url.searchParams.get('organization_id')==='13')return 'ccps';
 if(/^\/advertise\/rubber-world-demo(?:\/|$)/.test(url.pathname)||url.pathname==='/org-organization/40'||url.searchParams.get('organization_id')==='40')return 'rubber-world';
 return null;
}
function middleware(session,options){
 const normal=session(options);
 const scoped=Object.fromEntries(Object.keys(demos).map(key=>[key,session({...options,store:independentStore(session,options.store),name:`vivid.demo.${key}.sid`,cookie:{...options.cookie,path:`/demo/${key}`}})]));
 return function demoSession(req,res,next){
  const entry=req.url.match(/^\/(ccps|rubber-world)-review\//);
  if(entry)return res.redirect(307,`/demo/${entry[1]}${req.url}`);
  const match=req.url.match(/^\/demo\/(ccps|rubber-world)(?=\/|\?|$)/);
  if(!match)return normal(req,res,error=>{
   if(error)return next(error);
   // Migrate old, unprefixed tabs only when the browser is in a demo session.
   // The destination still requires its own signed cookie or invitation token.
   if(req.session?.ccpsReview||req.session?.rubberWorldReview){
    const tenant=tenantFromUrl(req.url);
    if(tenant){res.setHeader('Cache-Control','no-store');return res.redirect(307,`/demo/${tenant}${req.url}`);}
   }
   next();
  });
  const key=match[1],prefix=`/demo/${key}`;
  req.url=req.url.slice(prefix.length)||'/';if(req.url.startsWith('?'))req.url='/'+req.url;
  const setHeader=res.setHeader;
  res.setHeader=function(name,value){return setHeader.call(this,name,String(name).toLowerCase()==='location'?localUrl(value,prefix):value);};
  const send=res.send;
  res.send=function(body){return send.call(this,typeof body==='string'&&/<(?:html|body|main|div|a|form)\b/i.test(body)?htmlUrls(body,prefix):body);};
  // Reject attempts to establish a different demo identity in this namespace.
  const review=req.url.match(/^\/([^/?]+)-review\//);
  if(review&&review[1]!==key)return res.status(404).send('Demo link not found.');
  scoped[key](req,res,error=>{
   if(error)return next(error);
   if(!review&&!req.session?.[demos[key]]){
    res.setHeader('Cache-Control','no-store');
    return res.status(401).send(`<h2>${key==='ccps'?'CCPS':'Rubber World'} demo session ended</h2><p>Please reopen the original demo invitation link to continue.</p>`);
   }
   next();
  });
 };
}
function install(source){
 const marker='require("./demo-session-isolation").middleware(session, {';
 if(source.includes(marker))return source;
 const anchor='session({\n    store: new PgSession({';
 if(source.split(anchor).length!==2)throw Error('Session isolation anchor missing');
 return source.replace(anchor,marker+'\n    store: new PgSession({');
}
module.exports={middleware,install,localUrl,htmlUrls,tenantFromUrl};
