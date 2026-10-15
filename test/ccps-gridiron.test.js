'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const grid=require('../ccps-gridiron');
const render=(path,query={})=>grid.render({path,query});
test('Gridiron categories and golf packages navigate internally through to selected details',()=>{
 const home=render('/advertise/ccps',{program_id:1300104});
 for(const group of grid.groups){assert.ok(home.includes(group.name));const page=render('/advertise/ccps',{program_id:group.key==='golf'?1300105:1300104,group:group.key});
 for(const item of grid.items.filter(x=>x.group===group.key)){
  const href='/advertise/ccps/location/36/opportunity/'+item.id;assert.ok(page.includes(href));
  const detail=render(href);if(['golf','signs','bricks'].includes(item.group)){assert.equal(detail,null);continue;}assert.ok(detail.includes(item.title.replaceAll('′','′')));assert.ok(detail.includes('View-only demo'));assert.ok(detail.includes('disabled'));
 }}
 assert.equal(render('/advertise/ccps',{program_id:537}),null);
 assert.equal(render('/advertise/other',{program_id:1300104}),null);
 assert.equal(render('/advertise/ccps/location/40/opportunity/1300311'),null);
});
test('published prices are preserved and unpriced golf packages do not invent current offers',()=>{
 assert.deepEqual(grid.items.filter(x=>x.group==='signs').map(x=>x.price),[500,1000,2000]);
 assert.deepEqual(grid.items.filter(x=>x.group==='bricks').map(x=>x.price),[50,200]);
 assert.equal(grid.items.filter(x=>x.group==='golf').length,4);
 for(const x of grid.items.filter(x=>x.group==='golf')){assert.equal(x.price,null);assert.equal(x.demo,true);}
 const path='/advertise/ccps/location/36/opportunity/1300311';assert.equal(render(path),null);
 const html=grid.decorateRequest('<aside class="panel summary-panel">Contact for pricing</aside><input name="business_name">',path);assert.match(html,/club confirmation/);assert.match(html,/2026 outing has concluded/);assert.ok(!html.includes('$0'));assert.match(html,/name="business_name"/);assert.match(html,/<img/);
 const native='<aside class="panel summary-panel">STEM</aside>';assert.equal(grid.decorateRequest(native,'/advertise/ccps/location/36/opportunity/1300201'),native);assert.equal(grid.decorateRequest(native,'/advertise/other/location/36/opportunity/1300311'),native);
});
