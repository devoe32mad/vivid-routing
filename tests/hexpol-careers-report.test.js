const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const r=require('../hexpol-careers-report'),{jobs,MAIN}=require('../hexpol-careers');
test('shortcut only for HEXPOL campaign owner scope and never demo portals',()=>{
 assert.match(r.shortcut({},[{id:88}]),/Job Click Report/);
 assert.equal(r.shortcut({},[{id:55}]),'');
 for(const key of ['hfhsReviewVerified','rubberWorldReviewVerified','ccpsReviewVerified'])assert.equal(r.shortcut({[key]:true},[{id:88}]),'');
});
test('date validation and default 30 Eastern calendar days',()=>{
 assert.deepEqual(r.dates({},new Date('2026-10-15T02:00:00Z')),{from:'2026-09-15',to:'2026-10-14'});
 for(const query of [{from:'2026-02-30'},{from:'2026-10-15',to:'2026-10-14'},{to:'invalid'}])assert.throws(()=>r.dates(query),/valid/);
});
test('27 zero-inclusive rows, job and main counts separate, account and Eastern date boundaries',async()=>{
 const db=new PGlite();await db.exec(`CREATE TABLE campaigns(id int,user_id int);INSERT INTO campaigns VALUES(88,9);
 CREATE TABLE campaign_destinations(id serial primary key,campaign_id int,destination_url text,is_active bool);
 CREATE TABLE events(id serial primary key,campaign_destination_id int,campaign_id int,type text,vivid_click_id text,created_at timestamp);`);
 await db.query('INSERT INTO campaign_destinations(campaign_id,destination_url,is_active) VALUES(88,$1,true),(88,$2,true)',[jobs[0].url,MAIN]);
 await db.exec(`INSERT INTO events(campaign_destination_id,campaign_id,type,vivid_click_id,created_at) VALUES
 (1,88,'destination_click','one','2026-10-14 03:59:59'),(1,88,'destination_click','one','2026-10-14 04:00:00'),
 (1,88,'destination_click','one','2026-10-15 03:59:59'),(1,88,'destination_click','two','2026-10-15 04:00:00'),
 (2,88,'destination_click','one','2026-10-14 10:00:00'),(1,89,'destination_click','three','2026-10-14 10:00:00');`);
 const req={session:{user:{id:9,role:'customer'}},query:{from:'2026-10-14',to:'2026-10-14'}};
 const data=await r.load(db.query.bind(db),req);assert.equal(data.rows.length,27);assert.equal(data.clicks,2);assert.equal(data.mainClicks,1);assert.equal(data.rows[0].visitors,1);assert.equal(data.rows[1].clicks,0);
 assert.equal((r.html(data).match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g)||[]).length,27);
 await assert.rejects(()=>r.load(db.query.bind(db),{...req,session:{user:{id:10,role:'customer'}}}),/unavailable/);
 await assert.rejects(()=>r.load(db.query.bind(db),{...req,hfhsReviewVerified:true}),/demo/);
 const pdf=await r.pdf(data);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>5000);
 await db.close();
});
test('advertiser font fix retains demo branch and installer compiles',()=>{
 const fs=require('fs'),vm=require('vm');const source=fs.readFileSync(require('path').join(__dirname,'../server.js'),'utf8');
 const installer=fs.readFileSync(require('path').join(__dirname,'../install-hfhs-report-scope.js'),'utf8');
 const context={module:{exports:{}},require,Buffer};vm.runInNewContext(installer+'\nmodule.exports.polish=installAdvertiserPdfPolish;',context);
 const patched=context.module.exports.polish(source);new vm.Script(patched);
 assert.match(patched,/if \(!req.hfhsReviewVerified && !req.rubberWorldReviewVerified && !req.ccpsReviewVerified\) doc.font\("Helvetica"\);\s*else\s*doc.font\(require/);
});
