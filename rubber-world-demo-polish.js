'use strict';
// All presentation patches below require the verified Rubber World review session.
function install(source){
 const marker='// RUBBER_WORLD_POLISH_V2';if(source.includes(marker))return source;
 function once(a,b){if(source.split(a).length!==2)throw Error('Rubber World polish anchor missing: '+a.slice(0,90));source=source.replace(a,b);}
 const font='if (!req.hfhsReviewVerified && !req.rubberWorldReviewVerified && !req.ccpsReviewVerified) doc.font("Helvetica");';
 once(font,'if (req.rubberWorldReviewVerified || (!req.hfhsReviewVerified && !req.ccpsReviewVerified)) doc.font("Helvetica");');
 once('const includeTest = req.query.include_test !== undefined', 'const includeTest = req.rubberWorldReviewVerified ? true : req.query.include_test !== undefined');
 const pdfStart=source.indexOf('app.get(\n  "/export/report.pdf",'),pdfEnd=source.indexOf('\napp.',pdfStart+1);
 let pdf=source.slice(pdfStart,pdfEnd);
 pdf=pdf.replace('      doc.pipe(res);',`      if(req.rubberWorldReviewVerified){
        const nativeFont=doc.font;
        doc.font=function(name,...args){return nativeFont.call(this,/^Helvetica(?:-Bold)?$/.test(name)?require('path').join(__dirname,'assets/fonts/DejaVuSans.ttf'):name,...args);};
      }
      doc.pipe(res);`);
 source=source.slice(0,pdfStart)+pdf+source.slice(pdfEnd);
 const start=source.indexOf('async function buildOrganizationExportData('),end=source.indexOf('\nasync function ',start+1);
 let part=source.slice(start,end);
 const dateClause=`AND (\n        NULLIF($2, '') IS NULL\n        OR r.approved_at::date >= NULLIF($2, '')::date\n      )\n\n      AND (\n        NULLIF($3, '') IS NULL\n        OR r.approved_at::date <= NULLIF($3, '')::date\n      )`;
 if(!part.includes(dateClause))throw Error('RW export dates anchor missing');
 part=part.replace(dateClause,`AND (\n        \${req.rubberWorldReviewVerified ? \`EXISTS (SELECT 1 FROM contracts rc WHERE rc.id=r.created_contract_id AND rc.organization_id=r.organization_id AND LOWER(rc.status) IN ('active','approved','signed') AND (NULLIF($2,'') IS NULL OR COALESCE(rc.end_date,rc.expiration_date,'9999-12-31'::date)>=NULLIF($2,'')::date) AND (NULLIF($3,'') IS NULL OR rc.start_date IS NULL OR rc.start_date<=NULLIF($3,'')::date))\` : \`(NULLIF($2,'') IS NULL OR r.approved_at::date>=NULLIF($2,'')::date) AND (NULLIF($3,'') IS NULL OR r.approved_at::date<=NULLIF($3,'')::date)\`}\n      )`);
 source=source.slice(0,start)+part+source.slice(end);
 const anchor='      const advertiserCount =\n        Number(advertiserResult.rows[0]?.advertisers || 0);';
 once(anchor,`      if(req.rubberWorldReviewVerified){
        const counts=(await q(\`SELECT s.id,COUNT(DISTINCT c.id)::int AS campaigns FROM spaces s LEFT JOIN qr_codes qr ON qr.space_id=s.id LEFT JOIN qr_campaigns qc ON qc.qr_id=qr.id AND COALESCE(qc.is_active,true) AND qc.ended_at IS NULL LEFT JOIN campaigns c ON c.id=qc.campaign_id AND c.organization_id=s.organization_id AND COALESCE(c.is_archived,false)=false WHERE s.organization_id=$1 AND s.id=ANY($2::int[]) GROUP BY s.id\`,[orgId,allowedLocationIds])).rows;
        for(const location of locations)location.active_campaigns=counts.find(c=>Number(c.id)===Number(location.id))?.campaigns||0;
        totals.activeCampaigns=(await q(\`SELECT COUNT(DISTINCT c.id)::int AS count FROM campaigns c JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id JOIN spaces s ON s.id=qr.space_id WHERE c.organization_id=$1 AND s.organization_id=$1 AND s.id=ANY($2::int[]) AND ($3::int IS NULL OR s.id=$3) AND COALESCE(c.is_archived,false)=false AND COALESCE(qc.is_active,true) AND qc.ended_at IS NULL\`,[orgId,allowedLocationIds,selectedLocationId])).rows[0].count;
      }
`+anchor);
 const locStart=source.indexOf('  "/org-location/:locationId",'),locEnd=source.indexOf('\napp.',locStart);
 let loc=source.slice(locStart,locEnd);
 const locAnchor='const qrCards = qrPlacements.map(qr => `';
 if(!loc.includes(locAnchor))throw Error('RW location cards anchor missing');
 loc=loc.replace(locAnchor,`if(req.rubberWorldReviewVerified)totals.activeCampaigns=Number((await q(\`SELECT COUNT(DISTINCT c.id)::int AS count FROM campaigns c JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id WHERE c.organization_id=$1 AND qr.space_id=$2 AND COALESCE(c.is_archived,false)=false AND COALESCE(qc.is_active,true) AND qc.ended_at IS NULL\`,[organizationId,location.id])).rows[0].count);\n`+locAnchor);
 source=source.slice(0,locStart)+loc+source.slice(locEnd);
 return source+'\n'+marker+'\n';
}
module.exports={install};
