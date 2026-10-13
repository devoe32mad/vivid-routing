'use strict';
// Reviewed against rubberworld.com and its 2026 media file on 2026-10-13.
// Prices and availability below are intentionally fictional demonstration data.
const source='https://rubberworld.com/pdfs/2026%20Media%20File.pdf';
const groups=[
 {key:'email',name:'Daily News Email',description:'Email advertising with tracked campaign links and renewal reporting.',packages:[
  {name:'Daily News — Email Advertising',items:[['News Sponsor — 500 × 75',1100],['Right Column Ad — 190 px wide',650]]}]},
 {key:'industry-links',name:'Industry Links',description:'An annual company visibility package spanning the magazine and website.',packages:[
  {name:'Industry Links — Annual Package',items:[['Company Website Promotion Package',1200]],detail:'Package components: magazine website profile, year-long magazine and Industry Links listings, and a week on the homepage. Confirm current terms with Rubber World.'}]},
 {key:'webinars',name:'Webinars',description:'Webinar promotion connected to registration and follow-up campaign measurement.',packages:[
  {name:'Technical Webinar — Demo Package',items:[['Technical Webinar Campaign',3500]],detail:'Demonstrate registration and follow-up links. Attendee, polling and Q&A data require a webinar-platform integration; they are not imported in this demo.'}]},
 {key:'whitepapers',name:'White Paper Marketing',description:'Technical content promotion and lead-generation campaigns.',packages:[
  {name:'White Paper — Demo Lead Campaign',items:[['White Paper Promotion Campaign',2000]],detail:'Connect promotional placements to an advertiser landing page and configured download or enquiry conversions. No real leads are collected.'}]},
 {key:'directories',name:'Blue Book & Red Book',description:'Reference-publication advertising, supplier visibility and annual renewals.',packages:[
  {name:'Blue Book — Reference Advertising',items:[['Blue Book Display Ad',1900],['Blue Book Online Advertising',900]]},
  {name:'Rubber Red Book — Buyer’s Guide',items:[['Red Book Display Ad',1850],['Supplier Logo Listing',300],['Product / Service Target Ad',500],['Product / Service Showcase Ad',700]]}]},
 {key:'show-dailies',name:'Global Polymer Summit Dailies',description:'Show-publication advertising packages with exhibitor campaign measurement.',packages:[
  {name:'GPS 2026 — Three-Edition Demo Package',items:[['Tabloid Page Package',3000],['Cover Banner Package',2600],['Back Cover Package',4200]],detail:'Historical 2026 event example: September 28–October 1. Demonstration inventory only, not a currently bookable event offer.'}]},
 {key:'print',packages:[{name:'Special Print Packages',items:[['Full Page + Corporate Profile',2800],['Issue Insert',950],['Classified Advertisement',250]],detail:'Corporate profiles accompany qualifying July/August full-page ads. Inserts and classifieds have separate specifications. These are illustrative packages; publisher confirmation is required.'}]}
];
async function expand(client,manifest,{EMAIL,SLUG,NOTICE,START}){
 if(manifest.catalogueVersion===2)return;
 const identity=(await client.query('SELECT id FROM organizations WHERE id=$1 AND customer_id=$2 AND slug=$3',[manifest.organizationId,manifest.ownerId,SLUG])).rows;
 if(identity.length!==1)throw Error('Rubber World catalogue identity mismatch');
 const org=manifest.organizationId,owner=manifest.ownerId;
 for(const group of groups){
  let program=manifest.programs.find(p=>p.key===group.key);
  if(!program){
   const r=await client.query(`INSERT INTO organization_programs(organization_id,name,description,program_type,audience_scope,display_order,is_active,created_at,updated_at)
    VALUES($1,$2,$3,'publication','organization',$4,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`,[org,group.name,group.description,manifest.programs.length+1]);
   program={key:group.key,id:Number(r.rows[0].id),name:group.name};manifest.programs.push(program);
  }
  for(const pack of group.packages){
   const r=await client.query(`INSERT INTO spaces(user_id,organization_id,name,location,description,live_date,created_at)
    VALUES($1,$2,$3,$4,$5,$6::date,$6::date) RETURNING id`,[owner,org,pack.name,program.name,NOTICE,START]);
   const locationId=Number(r.rows[0].id);manifest.locations.push({key:group.key+'-'+locationId,id:locationId,name:pack.name});
   for(const [title,price]of pack.items){
    const description=NOTICE+' '+(pack.detail||'Illustrative placement based on a published product family. Confirm current specifications, rates and availability with Rubber World.')+' Source: '+source;
    const result=await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,title,description,category,price,annual_price,pricing_unit,suggested_term_length,suggested_term_unit,status,display_order,is_active,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$7,'Per Demo Package',1,'Packages','Available',$8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`,[org,locationId,program.id,title,description,program.name,price,manifest.opportunities.length+1]);
    manifest.opportunities.push({id:Number(result.rows[0].id),program:group.key,title,price});
   }
  }
 }
 // Replace the initial generic website examples with the publisher's actual formats.
 const website=manifest.programs.find(p=>p.key==='website');
 for(const [old,title]of [['Homepage Banner','Page Sponsor — 360 × 90'],['Article Banner','Section Row — 728 × 90'],['Product Directory Feature','Right Column Ad — 300 × 250']]){
  await client.query('UPDATE organization_opportunities SET title=$1 WHERE organization_id=$2 AND program_id=$3 AND title=$4',[title,org,website.id,old]);
  const o=manifest.opportunities.find(o=>o.program==='website'&&o.title===old);if(o)o.title=title;
 }
 manifest.catalogueVersion=2;
}
module.exports={expand,groups,source};
