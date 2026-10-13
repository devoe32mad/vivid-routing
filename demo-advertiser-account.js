'use strict';
function surface(path){return path==='/my-setup'||path.startsWith('/demo-advertiser/placement/')||/^\/(?:reports(?:-|$)|admin\/(?:reports|view-|edit-|campaign\/|marketing-command-center)|export\/|qr\/|campaign-help)/.test(path);}
async function narrow(q,user,scope){
 if(!user.demoAdvertiserId)return scope;
 const rows=(await q(`SELECT DISTINCT c.id AS campaign_id,qr.id AS qr_id,qr.space_id AS location_id FROM campaigns c JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id WHERE c.id=ANY($1::int[]) AND c.advertiser_id=$2 AND qr.id=ANY($3::int[])`,[scope.campaignIds,user.demoAdvertiserId,scope.qrIds])).rows;
 return {campaignIds:[...new Set(rows.map(r=>Number(r.campaign_id)))],qrIds:[...new Set(rows.map(r=>Number(r.qr_id)))],locationIds:[...new Set(rows.map(r=>Number(r.location_id)))]};
}
async function select(req,q,user,review,scope){
 if(!surface(req.path))return scope;
 const people=(await q('SELECT DISTINCT advertiser_id,advertiser FROM campaigns WHERE id=ANY($1::int[]) AND advertiser_id IS NOT NULL ORDER BY advertiser,advertiser_id',[scope.campaignIds])).rows;
 const id=Number(req.query.advertiser_id||review.advertiserId||people[0]?.advertiser_id);
 if(!people.some(p=>Number(p.advertiser_id)===id))throw Object.assign(Error('Choose an advertiser from this demo.'),{status:403});
 review.advertiserId=id;user.demoAdvertiserId=id;
 req.demoAdvertiserPeople=people;
 if(req.path==='/my-setup'||req.path.startsWith('/demo-advertiser/placement/'))req.query.advertiser_id=String(id);
 return narrow(q,user,scope);
}
async function respond(req,res,q,org,allowed){
 if(req.path==='/my-setup')return false;
 const match=req.path.match(/^\/demo-advertiser\/placement\/(\d+)$/);
 if(req.path!=='/my-setup'&&!match)return false;
 if(match&&!allowed.qrIds.includes(Number(match[1]))){res.status(403).send('This placement belongs to another demo advertiser.');return true;}
 const portal=require('./rubber-world-advertiser-portal');
 const data=await portal.load(q,org,req.query);
 // Account options come from the verified demo scope; rows from the selected account only.
 data.people=req.demoAdvertiserPeople.map(p=>[Number(p.advertiser_id),p.advertiser]);
 data.rows=data.rows.filter(r=>allowed.qrIds.includes(Number(r.qr_id))&&allowed.campaignIds.includes(Number(r.campaign_id)));
 if(org===13){const access=await require('./report-performance-upgrade').load({q,req});for(const r of data.rows)if(require('./report-performance-upgrade').restricted(access,'qr_id',r.qr_id)){r.basic=true;for(const k of ['clicks','conversions','revenue'])r[k]=null;}}
 data.brand=org===13?'CCPS':'Henry Ford Health';data.marketplace=org===13?'ccps':'henry-ford-health-demo';data.detailRoot='/demo-advertiser/placement';data.editable=org===39;
 res.send(portal.render(data,req.query,match?.[1]));return true;
}
module.exports={surface,narrow,select,respond};
