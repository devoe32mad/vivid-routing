'use strict';
// Illustrative inventory only, exposed by the CCPS review's request-local read model.
const photos=require('./ccps-demo-photos.json');
const programs=[
 {id:1300101,name:'Academics & STEM',description:'Illustrative ways to support learning, student achievement and STEM enrichment. Sample pricing; school approval required.',display_order:20},
 {id:1300102,name:'Theatre & Performing Arts',description:'Illustrative sponsorships for school productions, printed programs and the performing arts. Sample pricing; school approval required.',display_order:21}
].map(p=>({...p,organization_id:13,program_type:'sponsorship',audience_scope:'location',is_active:true}));
const templates=[
 {key:'stem',program:1300101,title:'STEM Showcase Sponsor (Demo)',price:1500,unit:'event',term:'Event',label:'STEM SHOWCASE',sub:'Support discovery and innovation',description:'Illustrative sponsorship of one school STEM showcase. Sample package includes sponsor recognition on event signage, a sponsor acknowledgement in the event program, and a QR link to a school-approved family offer. Supports project materials and event costs. No access to student information. Sample price: $1,500 per event; benefits and availability require school approval.'},
 {key:'awards',program:1300101,title:'Academic Achievement Night Sponsor (Demo)',price:1000,unit:'event',term:'Event',label:'ACADEMIC ACHIEVEMENT',sub:'Celebrate learning and student achievement',description:'Illustrative sponsorship of one academic recognition evening. Sample package includes sponsor acknowledgement in the printed program, welcome signage and a QR link to a school-approved sponsor page. Supports the recognition event; sponsorship does not influence student awards or selection. Sample price: $1,000 per event; benefits and availability require school approval.'},
 {key:'theatre',program:1300102,title:'Theatre Production Sponsor (Demo)',price:2000,unit:'production',term:'Production',label:'THEATRE PRODUCTION',sub:'Help bring the school stage to life',description:'Illustrative sponsorship of one school theatre production and its scheduled performances. Sample package includes lobby signage, sponsor acknowledgement in the show program and a QR link to a school-approved family offer. Supports sets, costumes and production expenses. Sample price: $2,000 per production; benefits and availability require school approval.'},
 {key:'program',program:1300102,title:'Performing Arts Program Advertisement (Demo)',price:500,unit:'production',term:'Production',label:'PERFORMING ARTS',sub:'Reach families through the show program',description:'Illustrative advertisement in the printed program for one school production. Sample package includes a half-page sponsor advertisement and a QR link to a school-approved sponsor page, distributed during the production run. Artwork is subject to school approval. Sample price: $500 per production; benefits and availability require school approval.'}
];
const opportunities=[36,40].flatMap((school,i)=>templates.map((t,j)=>({
 id:1300201+i*10+j,organization_id:13,space_id:school,program_id:t.program,title:t.title,
 description:t.description+' Illustrative stock photography, not a CCPS campus or event. Photo: '+photos[t.program===1300102?'theatre':'stem'].credit+'.',category:programs.find(p=>p.id===t.program).name,
 price:t.price,annual_price:null,pricing_unit:t.unit,suggested_term_length:1,suggested_term_unit:t.term,
 status:'Available',display_order:20+j,is_active:true,
 photo_data:'\\x'+photos[t.program===1300102?'theatre':'stem'].hex,photo_mime_type:'image/jpeg'
})));
programs.push(
 {id:1300103,organization_id:13,name:'Fund a Classroom Project',program_type:'giving',audience_scope:'organization',is_active:true,display_order:22,
 description:'Help bring a teacher’s idea to life through Champions For Learning, Collier County’s education foundation. Explore classroom supplies, enrichment and innovative learning projects. Partner-run giving; current project availability is confirmed on the foundation’s site.',
 public_image_url:photos.stem.url,external_action_url:'https://championsforlearning.org/classroom-grants/',external_action_label:'Explore classroom giving'},
 {id:1300104,organization_id:13,name:'Golf & Cougar Community Support',program_type:'giving',audience_scope:'organization',is_active:true,display_order:23,
 description:'Connect with the Barron Collier Gridiron Club to support Cougar football through golf, donations and booster involvement. Its 2026 golf outing has concluded; ask the club about future outings and sponsorships. Booster-run, with dates and prices confirmed by the club.',
 public_image_url:'https://static.wixstatic.com/media/fe7834_2d537a796b814a09a2ef2d3170bb2814~mv2.jpg',external_action_url:'https://www.barroncolliergridiron.com/',external_action_label:'Visit the Gridiron Club'}
);
function union(table,rows){const hex=Buffer.from(JSON.stringify(rows)).toString('hex');return `SELECT * FROM public.${table} UNION ALL SELECT * FROM jsonb_populate_recordset(NULL::public.${table},convert_from(decode('${hex}','hex'),'UTF8')::jsonb)`;}
module.exports={programs,opportunities,definitions:{organization_programs:union('organization_programs',programs),organization_opportunities:union('organization_opportunities',opportunities)}};

function install(source){
 const marker='<!-- CCPS_GIVING_PHOTOS_V1 -->';if(source.includes(marker))return source;
 const anchor='<span>Ways to Give</span>\n              <strong>${escapeHtml(program.name)}</strong>';
 if(source.split(anchor).length!==2)throw Error('Giving card anchor missing');
 return source.replace(anchor,marker+'\n'+
 '${program.public_image_url ? `<img src="${escapeHtml(program.public_image_url)}" alt="${escapeHtml(program.name)}" loading="lazy" style="width:100%;height:170px;object-fit:cover;object-position:center 72%;border-radius:10px;margin-bottom:14px;">` : ""}\n'+anchor)
 .replace('<b>Continue to the organization’s giving page →</b>','<b>${escapeHtml(program.external_action_label || "Continue to the organization’s giving page")} →</b>');
}
module.exports.install=install;
