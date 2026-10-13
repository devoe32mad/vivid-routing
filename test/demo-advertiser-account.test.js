'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const accounts=require('../demo-advertiser-account');
test('account narrowing intersects the authorized campaign and QR scope',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{await db.exec('CREATE TABLE campaigns(id INT,advertiser_id INT);CREATE TABLE qr_codes(id INT,space_id INT);CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT);INSERT INTO campaigns VALUES(1,10),(2,20),(3,10);INSERT INTO qr_codes VALUES(11,100),(22,200),(33,300);INSERT INTO qr_campaigns VALUES(11,1),(22,2),(33,3);');
 const scoped=await accounts.narrow((sql,args)=>db.query(sql,args),{demoAdvertiserId:10},{campaignIds:[1,2],qrIds:[11,22],locationIds:[100,200]});
 assert.deepEqual(scoped,{campaignIds:[1],qrIds:[11],locationIds:[100]});
 }finally{await db.close();}
});
test('CCPS Basic portal masks paid metrics and retains brand',()=>{
 const {render}=require('../rubber-world-advertiser-portal');
 const html=render({brand:'CCPS',marketplace:'ccps',detailRoot:'/demo-advertiser/placement',from:'2026-09-14',to:'2026-10-13',rows:[{advertiser_id:10,advertiser:'Dental Demo',qr_id:11,campaign_id:1,qr_name:'School banner',basic:true,scans:42,clicks:null,conversions:null,revenue:null}]},{});
 assert.match(html,/CCPS · ADVERTISER PORTAL/);assert.match(html,/>42</);assert.match(html,/Basic includes scans/);assert.match(html,/>—</);assert.doesNotMatch(html,/Rubber World|rubber-world-demo/);
});
