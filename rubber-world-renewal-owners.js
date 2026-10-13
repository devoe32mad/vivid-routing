'use strict';
const fs=require('fs'),path=require('path');
async function load(q,org){return (await q('SELECT id,advertiser_id FROM contracts WHERE organization_id=$1 ORDER BY advertiser_id,id',[org])).rows;}
function enhance(html,rows,org){
 const ids=new Set(rows.map(r=>Number(r.id)));
 html=html.replace(/<a\b[^>]*href=["']\/org-contract\/(\d+)\/(?:renew|renewal-review)\?[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,(anchor,id)=>ids.has(Number(id))?`<div data-rw-renewal="${Number(id)}"></div>`+anchor:anchor);
 const payload=JSON.stringify({org,rows}).replace(/</g,'\\u003c');
 const extra=`<style>.rw-owner-box{border:1px solid #cbdcd1;background:#f2f8f4;border-radius:10px;padding:16px;margin-bottom:14px}.rw-owner-box button{background:#17573a;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer;font:inherit}.rw-owner-box .rw-unassigned{background:#fff0ca;color:#794f00}.rw-owner-box label{display:block;margin:10px 0}.rw-owner-box input,.rw-owner-box select,.rw-owner-box textarea{width:100%;box-sizing:border-box;padding:8px;font:inherit}.rw-owner-box summary{cursor:pointer}.rw-owner-box small{display:block;color:#576c60;margin:7px 0}.rw-owner-filter{background:#fff;border:1px solid #cbdcd1;padding:18px;border-radius:10px;margin:20px 0}.rw-owner-filter select{padding:8px;margin:5px 14px 5px 5px}.rw-owner-filter p{margin:8px 0}.rw-owner-box [role=status]{font-size:13px;color:#17613e}</style><script id="rw-renewal-data" type="application/json">${payload}</script><script>${fs.readFileSync(path.join(__dirname,'rubber-world-renewal-owners-client.js'),'utf8')}</script>`;
 return /<\/body>/i.test(html)?html.replace(/<\/body>/i,extra+'</body>'):html+extra;
}
module.exports={load,enhance};
