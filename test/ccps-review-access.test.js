'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Module=require('node:module');
const filename=require.resolve('../ccps-review-access');
const token='test-only-review-token',hash=crypto.createHash('sha256').update(token).digest('hex');
const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(filename,'utf8').replace(/const TOKEN_HASH='[^']+'/,`const TOKEN_HASH='${hash}'`),filename);const review=m.exports;
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},send(s){this.body=s;return this},redirect(s){this.location=s;return this}});
function fixture(){
 let enter,guard;review.register({get:(_p,h)=>enter=h,use:h=>guard=h},{q:async(sql,p)=>{
  if(sql.includes('SELECT u.id AS customer_id'))return {rows:[{customer_id:10,email:'mike@vividspots.com'}]};
  if(sql.includes('SELECT DISTINCT s.id AS location_id'))return {rows:[{location_id:36,qr_id:97,campaign_id:68}]};
  if(sql.includes('SELECT id FROM spaces'))return {rows:[{id:36}]};
  return {rows:p?.[0]===200?[{id:200}]:[]};
 }});
 const session={cookie:{},regenerate(cb){for(const k of ['user','orgUser','platformUser','hfhsReview'])delete this[k];cb()},save:cb=>cb(),destroy(cb){this.destroyed=true;cb()}};
 return {enter,guard,session};
}
test('token entry regenerates session; three homes, expiry and tampered tokens enforced',async()=>{
 for(const view of ['enterprise','advertiser','marketplace']){
  const {enter,session}=fixture(),res=response();session.platformUser={id:1};
  await enter({params:{token,view},session},res);assert.equal(session.platformUser,undefined);assert.equal(session.ccpsReview.ownerId,10);assert.ok(res.location);assert.equal(res.headers['Cache-Control'],'no-store');
 }
 const {enter,session}=fixture(),res=response();await enter({params:{token:'invalid',view:'enterprise'},session},res);assert.equal(res.code,404);assert.equal(session.ccpsReview,undefined);
 assert.equal(review.validToken(null),false);assert.equal(review.validToken(token),true);
});
test('review permits scoped navigation, filters and exports but blocks writes and cross-account identifiers',async()=>{
 const {enter,guard,session}=fixture();await enter({params:{token,view:'enterprise'},session},response());
 for(const path of ['/org-organization/13','/org-business-breakdown','/advertise/ccps/build-my-campaign','/org-revenue-pipeline/location/36','/org-revenue-pipeline/location/36/revenue','/reports','/help','/org-help','/admin/reports','/my-setup','/export/report.pdf','/advertise/ccps','/org-operations']){
  let passed=false;const req={path,method:'GET',query:{},session},res=response();await guard(req,res,()=>passed=true);assert.equal(passed,true,path);assert.equal(req.ccpsReviewVerified,true);assert.equal(session.user.ccpsReview,true);
 }
 for(const [path,method,query] of [['/admin/schedule','GET',{}],['/admin/assign','GET',{}],['/admin/new-campaign','GET',{}],['/reports','POST',{}],['/org-settings','POST',{}],['/admin/archive-campaign/68','GET',{}],['/r/97','GET',{}],['/org-contract/200/activate','GET',{}],['/org-organization/39','GET',{}],['/reports','GET',{organization_id:39}],['/reports','GET',{campaignId:71}],['/reports','GET',{qrId:100}],['/reports','GET',{account:6}],['/admin/view-campaign/71','GET',{}],['/org-revenue-pipeline/location/119','GET',{}],['/admin/marketing-command-center','GET',{}]]){
  let passed=false;const res=response();await guard({path,method,query,session},res,()=>passed=true);assert.equal(passed,false,path);assert.equal(res.code,403,path);
 }
 const res=response();await guard({path:'/my-setup',method:'GET',query:{},session},res,()=>{});res.send('<main><form method="post"><button>Save</button></form><form method="get"><button>Filter</button></form><a href="/admin/archive-campaign/68">Archive</a></main>');assert.match(res.body,/fieldset disabled/);assert.match(res.body,/<form method="get">/);assert.doesNotMatch(res.body,/Archive<\/a>|<form method="post">/);
 session.ccpsReview.expires=0;const expired=response();await guard({path:'/reports',method:'GET',query:{},session},expired,()=>assert.fail());assert.equal(expired.code,410);assert.equal(session.destroyed,true);
});
test('advertiser dataset excludes other organizations, other owners and mixed assignments',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`CREATE TABLE spaces(id INT,organization_id INT);CREATE TABLE qr_codes(id INT,space_id INT);CREATE TABLE campaigns(id INT,user_id INT);CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT);
 INSERT INTO spaces VALUES(36,13),(119,39),(21,NULL);INSERT INTO qr_codes VALUES(97,36),(100,119),(26,21),(98,36);
 INSERT INTO campaigns VALUES(68,10),(71,6),(27,10),(69,10),(99,9);
 INSERT INTO qr_campaigns VALUES(97,68),(100,71),(26,27),(98,69),(98,99),(26,69);`);
 const s=await review.reportScope((sql,p)=>db.query(sql,p),{id:10,role:'customer',ccpsReview:true});assert.deepEqual(s,{campaignIds:[68],qrIds:[97],locationIds:[36]});
 assert.equal(await review.reportScope(()=>assert.fail(),{id:10,role:'customer'}),null);
 }finally{await db.close()}
});
test('shared demo serves CCPS photos but rejects other organizations and photo writes',async()=>{
 const {enter,guard,session}=fixture();await enter({params:{token,view:'marketplace'},session},response());
 for(const [path,method,expected] of [['/org-opportunity/200/photo','GET',true],['/org-opportunity/999/photo','GET',false],['/org-opportunity/200/photo','POST',false]]){
  let passed=false;const res=response();await guard({path,method,query:{},session},res,()=>passed=true);assert.equal(passed,expected);if(!expected)assert.equal(res.code,403);
 }
});
test('school cards reuse scoped artwork and hidden navigation stays hidden',async()=>{
 const presentation=require('../ccps-demo-presentation');
 const html=presentation.render('<h2>Barron Collier High School</h2><img src="/org-opportunity/148/photo">',[{name:'Barron Collier High School',photo_id:147}]);
 assert.match(html,/src="\/org-opportunity\/147\/photo\?ccps_demo=2"/);
 assert.match(html,/src="\/org-opportunity\/148\/photo\?ccps_demo=2"/);
 assert.match(html,/object-position:center/);
 const {enter,guard,session}=fixture();await enter({params:{token,view:'marketplace'},session},response());const res=response();
 await guard({path:'/advertise/ccps',method:'GET',query:{},session},res,()=>{});
 res.send('<main><a style="display:none" href="/admin/ai-readiness">AI Readiness</a><a href="/reports">Reports</a></main>');
 assert.doesNotMatch(res.body,/AI Readiness/);assert.match(res.body,/href="\/reports"/);
});
test('available advertising responds with school totals and scoped inventory links',async()=>{
 const html=await require('../ccps-demo-presentation').available(async sql=>{assert.match(sql,/oo.organization_id=13/);assert.match(sql,/available_until>=CURRENT_DATE/);return {rows:[{id:36,name:'Barron Collier High School',spots:3,value:20000},{id:40,name:'Gulf Coast High School',spots:3,value:17500}]}});
 assert.match(html,/6 available spots · \$37,500/);assert.match(html,/location_id=36&status=Available/);assert.match(html,/location_id=40&status=Available/);
 const {enter,guard,session}=fixture();await enter({params:{token,view:'enterprise'},session},response());const res=response();
 await guard({path:'/org-business-breakdown',method:'GET',query:{metric:'available'},session},res,()=>assert.fail('Must return available breakdown'));
 assert.equal(res.code,200);assert.match(res.body,/CCPS Available Advertising/);
});
