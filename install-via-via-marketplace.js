"use strict";
const fs = require('fs');
const path = require('path');
const KEY = 'jim-evaluation-2026-09-v1';
const DISCLAIMER = 'Demo opportunity only. University names and logos identify illustrative campus markets; no university affiliation or endorsement is implied. Listed costs are sample placement prices, not VIA VIA fees or referral rewards. No purchase or physical space is offered.';
const INTRO = 'Connect · Refer · Earn. Activate your network with VIA VIA. Explore a campus partner opportunity designed to bring people and businesses together through trusted introductions. Help connect businesses with talent, service providers and new customers, powered by word-of-mouth.';
const TYPES = [
 'Use a career fair presence to introduce VIA VIA to students, alumni and local employers. Invite participants to explore becoming a VIA VIA partner and connect people they know with relevant talent opportunities.',
 'Bring VIA VIA to a student organization community. Invite members and alumni to explore becoming a VIA VIA partner and put their relationships to work through introductions to talent, services and customers.',
 'Feature an invitation to become a VIA VIA partner in a campus newsletter. Give readers a clear way to discover the referral marketplace and explore opportunities to connect businesses with people they trust.',
 'Create a conversation around VIA VIA at a campus networking event. Invite students, alumni and local businesses to explore becoming partners and make introductions that can help others find talent, services and customers.'
];
function install(source) {
 const marker = '/* VIA VIA campus partner logos v1 */';
 if(source.includes(marker)) return source;
 const start=source.indexOf('  "/advertise/:slug",');
 const end=source.indexOf('  "/advertise/:slug/location/:locationId",',start);
 if(start<0||end<0) throw new Error('Marketplace route markers changed');
 let part=source.slice(start,end);
 const query='          s.location,\n\n          COUNT(';
 if(!part.includes(query)) throw new Error('Marketplace location query changed');
 part=part.replace(query,'          s.location,\n          MIN(oo.id) FILTER (WHERE oo.photo_data IS NOT NULL AND oo.status = \'Available\') AS campus_photo_id,\n\n          COUNT(');
 const card='      ${locationDetail}\n';
 if(!part.includes(card)) throw new Error('Marketplace location card changed');
 part=part.replace(card,`      \${locationDetail}
      \${organization.slug === 'via-via-demo' && location.campus_photo_id ? \`
        <img src="/org-opportunity/\${Number(location.campus_photo_id)}/photo"
             alt="\${escapeHtml(location.name.replace(/^Demo — /, ''))} logo"
             width="560" height="200" loading="lazy"
             style="display:block;width:100%;height:100px;object-fit:contain;margin-top:14px;border-radius:8px;">
        <p style="font-size:14px;line-height:1.5;color:#52665a;">Explore becoming a VIA VIA partner in this campus market. Connect people you know with talent, services and customers.</p>
      \` : ''}
`);
 let tail=source.slice(end);
 const photoPattern=/(src="\/org-opportunity\/\$\{opportunity\.id\}\/photo"[\s\S]{0,500}?)object-fit:cover;/g;
 let photoCount=0;
 tail=tail.replace(photoPattern,(_,prefix)=>{photoCount++;return prefix+"object-fit:${organization.slug === 'via-via-demo' ? 'contain' : 'cover'};";});
 if(photoCount!==2)throw new Error('Public opportunity photo templates changed');
 return source.slice(0,start)+marker+'\n'+part+tail;
}
function installFile(){
 const filename=path.join(__dirname,'server.js');
 const original=fs.readFileSync(filename,'utf8');
 const next=install(original);if(next!==original)fs.writeFileSync(filename,next);
}
async function update(client,manifest){
 if(manifest.partnerPresentationVersion===1)return;
 const logos=require('./via-via-campus-logos.json');
 const keys=['alabama','auburn','uab','uah','georgia','gatech','gastate','gasouthern'];
 if(manifest.fixture!==KEY||manifest.locations.length!==8||manifest.opportunities.length!==8||keys.some(k=>!logos[k]))throw new Error('VIA VIA fixture or logos incomplete');
 const org=await client.query("SELECT id FROM organizations WHERE id=$1 AND slug='via-via-demo' AND name='VIA VIA'",[manifest.organizationId]);
 if(org.rows.length!==1)throw new Error('VIA VIA organization identity changed');
 await client.query('UPDATE organizations SET public_heading=$2,public_description=$3 WHERE id=$1',
  [manifest.organizationId,'Become a VIA VIA Partner',INTRO+'\n\nChoose a campus market below, review an opportunity and submit a demo request to experience the partner onboarding process.\n\n'+DISCLAIMER]);
 await client.query('UPDATE organization_programs SET description=$3 WHERE id=$1 AND organization_id=$2',
  [manifest.programId,manifest.organizationId,INTRO+'\n\nExplore eight campus markets in Alabama and Georgia. Select an opportunity to experience the request and approval journey.\n\n'+DISCLAIMER]);
 for(let i=0;i<8;i++){
  const loc=manifest.locations[i],op=manifest.opportunities[i],logo=logos[keys[i]];
  if(op.locationId!==loc.id)throw new Error('VIA VIA opportunity location mapping changed');
  const description='Become a VIA VIA Partner — '+loc.name.replace(/^Demo — /,'')+'\n\n'+TYPES[i%4]+'\n\nSelect this opportunity and submit your business and contact details to explore the demo partner onboarding process. Requests are reviewed before activation.\n\n'+DISCLAIMER;
  const result=await client.query(`UPDATE organization_opportunities SET description=$4,photo_data=$5,photo_mime_type=$6
   WHERE id=$1 AND organization_id=$2 AND space_id=$3 AND program_id=$7 RETURNING id`,
   [op.id,manifest.organizationId,loc.id,description,Buffer.from(logo.data,'base64'),logo.mime,manifest.programId]);
  if(result.rows.length!==1)throw new Error('VIA VIA opportunity identity changed');
 }
 manifest.partnerPresentationVersion=1;
 await client.query('UPDATE vivid_evaluation_fixtures SET manifest=$1::jsonb WHERE fixture_key=$2 AND organization_id=$3',
 [JSON.stringify(manifest),KEY,manifest.organizationId]);
}
module.exports={install,installFile,update};
