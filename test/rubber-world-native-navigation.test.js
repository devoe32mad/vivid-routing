'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const nav=require('../rubber-world-native-navigation');
test('native navigation leaves normal and HFHS reads unchanged',()=>{
 const sql='SELECT * FROM campaigns';assert.equal(nav.sqlFor(sql),sql);assert.equal(nav.blockedWrite('UPDATE campaigns SET name=$1'),false);
});
test('Rubber World native read context scopes records and suppresses writes',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{await db.exec('CREATE TABLE campaigns(id INT PRIMARY KEY,name TEXT); INSERT INTO campaigns VALUES(1,\'Selected\'),(2,\'Other advertiser\');');
 await nav.run({campaignIds:[1],qrIds:[11],locationIds:[100]},async()=>{
 assert.deepEqual((await db.query(nav.sqlFor('SELECT * FROM campaigns'))).rows,[{id:1,name:'Selected'}]);
 assert.equal(nav.blockedWrite('INSERT INTO campaigns VALUES(3,\'No\')'),true);
 });assert.equal(nav.sqlFor('SELECT * FROM campaigns'),'SELECT * FROM campaigns');
 }finally{await db.close();}
});
test('top links map to native Vivid routes',()=>{const {routeAllowed}=require('../rubber-world-review');for(const path of nav.paths)assert.equal(routeAllowed(path,40),true,path);});
