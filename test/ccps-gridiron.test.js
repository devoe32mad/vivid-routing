'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const grid=require('../ccps-gridiron');
const render=(path,query={})=>grid.render({path,query});
test('Gridiron categories and golf packages navigate internally through to selected details',()=>{
 const home=render('/advertise/ccps',{program_id:1300104});
 for(const group of grid.groups){assert.ok(home.includes(group.name));const page=render('/advertise/ccps',{program_id:group.key==='golf'?1300105:1300104,group:group.key});
 for(const item of grid.items.filter(x=>x.group===group.key)){
  const href='/advertise/ccps/location/36/opportunity/'+item.id;assert.ok(page.includes(href));
  const detail=render(href);assert.ok(detail.includes(item.title.replaceAll('′','′')));assert.ok(detail.includes('View-only demo'));assert.ok(detail.includes('disabled'));
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
 const html=render('/advertise/ccps/location/36/opportunity/1300311');assert.match(html,/Pricing to be confirmed/);assert.match(html,/2026 outing has concluded/);assert.ok(!html.includes('$0'));
});
