'use strict';
// Use canonical, organization-scoped ownership; never infer a rep from a display name.
function enrich(data, model) {
 const roots=new Map(model.roots.map(r=>[r.key,r]));
 const owner=(kind,id)=>roots.get(model.entities.get(`${kind}:${Number(id)}`)?.root)?.rep_name;
 const qrOwners=new Map();
 for(const e of model.entities.values()) {
  const qr=Number(e.qr_id||e.created_qr_id);if(!qr)continue;
  const name=roots.get(e.root)?.rep_name||'Unassigned';
  if(!qrOwners.has(qr))qrOwners.set(qr,new Set());qrOwners.get(qr).add(name);
 }
 for(const name of ['approvedOpportunities','pendingOpportunities','availableOpportunities'])
  for(const row of data[name]||[])row.salesRep=owner('request',row.requestId)||owner('opportunity',row.opportunityId)||'Unassigned';
 for(const row of data.placements||[])row.salesRep=[...(qrOwners.get(Number(row.qrId))||['Unassigned'])].sort().join(', ');
 return data;
}
function columnsWithRep(columns,rows,rowMapper){
 if(!rows.some(r=>Object.prototype.hasOwnProperty.call(r,'salesRep')))return {columns,rowMapper};
 return {columns:[...columns.map(c=>({...c,ratio:c.ratio*0.88})),{label:'Sales Rep',ratio:0.12}],rowMapper:r=>[...rowMapper(r),r.salesRep||'Unassigned']};
}
// Reserve enough width for the longest header word so PDFKit never splits it mid-word.
function widths(doc,columns,totalWidth,fontSize){
 doc.font('Helvetica-Bold').fontSize(fontSize);
 const minimums=columns.map(c=>Math.max(...c.label.split(/\s+/).map(w=>doc.widthOfString(w)))+10);
 const remaining=totalWidth-minimums.reduce((a,b)=>a+b,0),sum=columns.reduce((a,c)=>a+c.ratio,0);
 if(remaining<0)throw Error('PDF table headers exceed page width');
 return columns.map((c,i)=>({...c,width:minimums[i]+remaining*c.ratio/sum}));
}
module.exports={enrich,columnsWithRep,widths};
