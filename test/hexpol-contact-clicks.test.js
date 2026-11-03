"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto");
const {PGlite}=require("@electric-sql/pglite");
const {createContactClicks,renderContactClicks}=require("../hexpol-contact-clicks");
const trackerSource=fs.readFileSync(require.resolve("../public/vivid-website.js"),"utf8");
const origin="https://www.hexpol.com",path="/rubber/what-we-offer/qualityjourney",url=origin+path;

for (const tagId of [55,94]) test(`Quality Journey tag ${tagId} counts the two real email buttons without changing the mail link or sending email details`,()=>{
  const requests=[],listeners=[],scan=crypto.randomUUID();
  const context={URL,URLSearchParams,Date,document:{currentScript:{src:"https://vivid.example/vivid-website.js",getAttribute:n=>n==="data-vivid-campaign"?String(tagId):JSON.stringify([{path,label:"Quality Journey"}])},
    addEventListener:(event,fn)=>listeners.push(fn)},window:{crypto,location:new URL(url+"/?vivid_click_id="+scan)},sessionStorage:{setItem(){},getItem(){return null}},
    fetch:(endpoint,options)=>{requests.push({endpoint,options,body:JSON.parse(options.body)});return Promise.resolve();}};
  vm.runInNewContext(trackerSource,context);vm.runInNewContext(trackerSource,context);
  assert.equal(requests.length,1);assert.equal(listeners.length,1);
  const click=(label,href,trusted=true)=>listeners[0]({isTrusted:trusted,button:0,target:{closest:()=>Object.assign(new URL(href,origin),{textContent:label})}});
  click("Contact Us Today","mailto:sample@example.com?subject=private");
  click("Contact us to Start the Conversation","/cdn-cgi/l/email-protection#private");
  click("Contact Us Today","https://example.net/cdn-cgi/l/email-protection#private");
  click("Contact","mailto:sample@example.com");
  click("Contact Us Today","mailto:sample@example.com",false);
  click("Contact Us Today","/rubber/contact/");
  assert.equal(requests.length,3);
  assert.deepEqual(requests.slice(1).map(x=>x.body.button_key),["contact_today","start_conversation"]);
  assert.notEqual(requests[1].body.click_event_id,requests[2].body.click_event_id);
  for(const r of requests.slice(1)){
    assert.deepEqual(Object.keys(r.body).sort(),["button_key","campaign_id","click_event_id","page_url","vivid_click_id"]);
    assert.equal(r.body.page_url,url);assert.equal(r.body.campaign_id,tagId);assert.equal(r.body.vivid_click_id,scan);assert.equal(r.options.keepalive,true);
    assert.doesNotMatch(JSON.stringify(r.body),/private|sample@/);
  }
  context.window={location:new URL(url),crypto};vm.runInNewContext(trackerSource,context);
  assert.equal(listeners.length,1);assert.equal(requests.length,3);
});

test("report counts actual taps and unique QR journeys across both buttons, independent of page visits and conversions",async()=>{
  const db=new PGlite(),q=(s,p)=>db.query(s,p),track=createContactClicks(q);
  try{
    await db.exec(`CREATE TABLE events(id serial primary key,vivid_click_id text,type text,campaign_id int,qr_id int,created_at timestamp default current_timestamp);
      CREATE TABLE campaigns(id int primary key,user_id int,advertiser text,is_archived boolean,start_date date,end_date date);
      CREATE TABLE qr_codes(id int primary key); CREATE TABLE qr_campaigns(qr_id int,campaign_id int,is_active boolean);
      CREATE TABLE campaign_destinations(campaign_id int,destination_url text,is_active boolean);
      INSERT INTO campaigns VALUES(55,7,'Hexpol',true,NULL,NULL),(93,7,'Hexpol',false,NULL,NULL),(89,8,'Hexpol',false,NULL,NULL);
      INSERT INTO qr_codes VALUES(61),(96); INSERT INTO qr_campaigns VALUES(61,93,true);`);
    await q("INSERT INTO campaign_destinations VALUES(93,$1,true)",[url+"/"]);
    const [a,b,wrong,foreign,expired]=Array.from({length:5},()=>crypto.randomUUID());
    for(const [id,qr,c] of [[a,61,93],[b,61,93],[wrong,96,93],[foreign,61,89],[expired,61,93]])
      await q("INSERT INTO events(vivid_click_id,type,campaign_id,qr_id) VALUES($1,'scan',$2,$3)",[id,c,qr]);
    await q("UPDATE events SET created_at=CURRENT_TIMESTAMP-INTERVAL '25 hours' WHERE vivid_click_id=$1",[expired]);
    const tap=(id,button="contact_today",event=crypto.randomUUID(),site=origin)=>track.record({vivid_click_id:id,click_event_id:event,page_url:url,button_key:button},site);
    const campaign={id:93,advertiser:"Hexpol"};
    let id=crypto.randomUUID();
    await Promise.all([tap(a,"contact_today",id),tap(a,"contact_today",id)]);
    await tap(a);await tap(a,"start_conversation");await tap(b,"start_conversation");
    for(const invalid of [wrong,foreign,expired,crypto.randomUUID()])await tap(invalid);
    await tap(a,"invalid");await tap(a,"contact_today",crypto.randomUUID(),"https://other.example");
    await q("UPDATE qr_campaigns SET is_active=false");await tap(a);
    let summary=await track.summary(campaign,30);
    const byButton=new Map(summary.map(r=>[r.button_key,[r.clicks,r.visits]]));
    assert.deepEqual(byButton.get(null),[4,2]);assert.deepEqual(byButton.get("contact_today"),[2,1]);assert.deepEqual(byButton.get("start_conversation"),[2,2]);
    assert.equal(await track.summary({id:93,advertiser:"Other"},30),null);
    assert.match(renderContactClicks(summary),/Both buttons combined/);
    assert.equal((await q("SELECT COUNT(*)::int AS n FROM events WHERE type<>'scan'")).rows[0].n,0);
    await q("UPDATE hexpol_contact_clicks SET created_at=CURRENT_TIMESTAMP-INTERVAL '8 days' WHERE click_event_id=$1",[id]);
    assert.equal((await track.summary(campaign,7)).find(r=>r.button_key===null).clicks,3);
  }finally{await db.close();}
});
