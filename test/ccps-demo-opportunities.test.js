'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');const scope=require('../ccps-demo-data-scope');
test('academic and arts inventory joins both demo schools with pictures and leaves source inventory untouched',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE organization_programs(id int,organization_id int,name text,program_type text,audience_scope text,is_active boolean,public_image_url text,external_action_url text);
 CREATE TABLE organization_opportunities(id int,organization_id int,space_id int,program_id int,title text,description text,price numeric,status text,is_active boolean,photo_data bytea,photo_mime_type text);
 INSERT INTO organization_programs VALUES(537,13,'Athletics','sponsorship','location',true,null,null);
 INSERT INTO organization_opportunities(id,organization_id,space_id,program_id,title,price,status,is_active) VALUES(147,13,36,537,'Existing',10000,'Available',true);`);
 const q=s=>db.query(scope.sqlFor(s));
 await scope.run(true,async()=>{
 const rows=(await q(`SELECT o.space_id,count(*)::int count,sum(o.price)::int value FROM organization_opportunities o JOIN organization_programs p ON p.id=o.program_id WHERE o.id>1300000 AND o.id<1300300 GROUP BY o.space_id ORDER BY o.space_id`)).rows;
 assert.deepEqual(rows,[{space_id:36,count:4,value:5000},{space_id:40,count:4,value:5000}]);
 const pictures=(await q('SELECT photo_data,photo_mime_type,description FROM organization_opportunities WHERE id>1300000 AND id<1300300')).rows;
 for(const p of pictures){assert.equal(p.photo_mime_type,'image/jpeg');assert.ok(p.photo_data.length>10000);assert.match(p.description,/Sample price:/);assert.match(p.description,/stock photography/);}
 const giving=(await q("SELECT external_action_url FROM organization_programs WHERE program_type='giving'")).rows;
 assert.equal(giving.length,1);assert.ok(giving.every(p=>p.external_action_url.startsWith('https://')));
 assert.equal((await q('SELECT count(*)::int n FROM organization_opportunities')).rows[0].n,20);
 });
 assert.equal((await q('SELECT count(*)::int n FROM organization_opportunities')).rows[0].n,1);
 assert.equal((await q('SELECT count(*)::int n FROM organization_programs')).rows[0].n,1);
 }finally{await db.close();}
});
