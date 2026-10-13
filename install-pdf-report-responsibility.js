'use strict';
function install(source){
 const marker='// PDF_REPORT_RESPONSIBILITY_V1';if(source.includes(marker))return source;
 const start=source.indexOf('  "/org-export/report.pdf",'),end=source.indexOf('\napp.',start);
 if(start<0||end<0)throw Error('PDF export route not found');
 let part=source.slice(start,end);
 const once=(a,b)=>{if(part.split(a).length!==2)throw Error('PDF anchor missing: '+a);part=part.replace(a,b);};
 once('      const generatedAt =',`      ${marker}
      const pdfOwnership = require('./pdf-report-responsibility');
      const ownershipContext = await require('./responsibility-routes').context(req,q);
      pdfOwnership.enrich(data,ownershipContext.model);
      const generatedAt =`);
 once('size: "LETTER",','size: "LETTER",\n          layout: "landscape",');
 once('        const normalizedColumns =\n          columns.map(column => ({\n            ...column,\n            width:\n              totalWidth *\n              column.ratio\n          }));',`        ({columns,rowMapper}=pdfOwnership.columnsWithRep(columns,rows,rowMapper));
        const normalizedColumns = pdfOwnership.widths(doc,columns,totalWidth,fontSize);`);
 return source.slice(0,start)+part+source.slice(end);
}
module.exports={install};
