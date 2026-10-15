'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {enrich,columnsWithRep,widths}=require('../pdf-report-responsibility');
test('PDF joins canonical IDs, keeps unassigned rows and all reps sharing a QR',()=>{
 const model={roots:[{key:'opportunity:1',rep_name:'Jane Doe'},{key:'opportunity:2',rep_name:'Bill Smith'}],entities:new Map([
 ['opportunity:1',{root:'opportunity:1'}],['request:7',{root:'opportunity:1',created_qr_id:10}],['contract:8',{root:'opportunity:2',qr_id:10}]])};
 const data={placements:[{qrId:10},{qrId:11}],approvedOpportunities:[{requestId:7}],pendingOpportunities:[{opportunityId:2}],availableOpportunities:[{opportunityId:1},{opportunityId:999}]};
 enrich(data,model);
 assert.deepEqual(data.placements.map(r=>r.salesRep),['Bill Smith, Jane Doe','Unassigned']);
 assert.equal(data.approvedOpportunities[0].salesRep,'Jane Doe');
 assert.deepEqual(data.availableOpportunities.map(r=>r.salesRep),['Jane Doe','Unassigned']);
});
test('PDF allocates full header words and adds owner cells without losing values',()=>{
 const doc={font(){return this},fontSize(){return this},widthOfString(s){return s.length*4}};
 const {columns,rowMapper}=columnsWithRep([{label:'QR Placement',ratio:.93},{label:'Conversions',ratio:.07}],[{salesRep:'Jane Doe'}],r=>[r.name,r.conversions]);
 const sized=widths(doc,columns,708,7);
 assert.ok(sized[1].width-8>=doc.widthOfString('Conversions'));
 assert.ok(Math.abs(sized.reduce((n,c)=>n+c.width,0)-708)<.001);
 assert.deepEqual(rowMapper({name:'Ad',conversions:15,salesRep:'Jane Doe'}),['Ad',15,'Jane Doe']);
});

test('only the CCPS PDF uses school-contact terminology',()=>{
 const scope=require('../ccps-demo-data-scope');const result=()=>columnsWithRep([{label:'Name',ratio:1}],[{salesRep:'Jane Doe'}],r=>[r.name]);
 assert.equal(scope.run(true,result).columns.at(-1).label,'School Contact');
 assert.equal(result().columns.at(-1).label,'Sales Rep');
});
