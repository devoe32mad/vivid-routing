'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=require('../org-date-filter-context');
const original=fs.readFileSync(require.resolve('../server'),'utf8');
const {install}=require('../install-org-user-context');
test('all seven date forms preserve resolved organization; installer is idempotent',()=>{
 const source=install(original);
 assert.equal(install(source),source);
 const calls=[...source.matchAll(/\$\{orgDateFilterForm\(\{([\s\S]*?)\}\)/g)];
 assert.equal(calls.length,7);
 for(const call of calls)assert.match(call[1],/organizationId: (org.id|organizationId),/);
 new vm.Script(source);
});
test('GET submission and Clear keep organization and drill-down scope',()=>{
 const source=install(original),start=source.indexOf('function orgDateFilterForm({'),end=source.indexOf('async function getOrganizationScope(',start);
 const scope={orgDateContext:context};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);
 for(const action of ['/org-location/59','/org-qr/96','/org-campaign/7']){
  const html=scope.orgDateFilterForm({action,fromDate:'2026-09-23',toDate:'2026-09-30',organizationId:26,locationId:59,qrId:96});
  const inputs=[...html.matchAll(/<input\s+[^>]*name="([^"]+)"\s+value="([^"]*)"[^>]*>/g)];
  const params=new URLSearchParams(inputs.map(m=>[m[1],m[2]]));
  assert.equal(params.get('organization_id'),'26');assert.equal(params.get('from'),'2026-09-23');assert.equal(params.get('to'),'2026-09-30');
  assert.ok(html.includes(`href="${action}?organization_id=26&location_id=59&qr_id=96"`));
 }
});
test('context permits positive numeric IDs only',()=>{
 assert.equal(context.hiddenContext({organizationId:'\"><script>',locationId:-1,qrId:0}),'');
});
