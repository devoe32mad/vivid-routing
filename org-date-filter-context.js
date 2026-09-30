'use strict';
// Preserve only navigation IDs, not arbitrary request parameters.
function contextParams({organizationId, locationId, qrId}) {
  const params = new URLSearchParams();
  for (const [name,value] of [['organization_id',organizationId],['location_id',locationId],['qr_id',qrId]]) {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) params.set(name,String(id));
  }
  return params;
}
function hiddenContext(context) {
  return Array.from(contextParams(context),([name,value]) => `<input type="hidden" name="${name}" value="${value}">`).join('');
}
function clearUrl(action,context) {
  const params = contextParams(context).toString();
  return action + (params ? '?' + params : '');
}
function install(source) {
  const marker = '// Preserve organization context when applying or clearing dates.';
  if (source.includes(marker)) return source;
  const start=source.indexOf('function orgDateFilterForm({');
  const end=source.indexOf('async function getOrganizationScope(',start);
  if(start<0 || end<0) throw Error('Date filter helper anchors missing');
  let helper=source.slice(start,end);
  helper=helper.replace('  toDate\n','  toDate,\n  organizationId,\n  locationId,\n  qrId\n');
  helper=helper.replace('      <div style="min-width:165px;">','      ${orgDateContext.hiddenContext({organizationId,locationId,qrId})}\n      <div style="min-width:165px;">');
  helper=helper.replace('href="${action}"','href="${orgDateContext.clearUrl(action,{organizationId,locationId,qrId})}"');
  source=source.slice(0,start)+marker+'\nconst orgDateContext = require("./org-date-filter-context");\n'+helper+source.slice(end);
  let count=0;
  source=source.replace(/(\$\{orgDateFilterForm\(\{\s*action: `([^`]+)`,)/g,(match,prefix,action)=>{
    count++;
    const org=action.startsWith('/org-organization/') ? 'org.id' : 'organizationId';
    return prefix+`\n  organizationId: ${org},\n  locationId: req.query.location_id,\n  qrId: req.query.qr_id,`;
  });
  if(count!==7) throw Error('Unexpected organization date form count: '+count);
  return source;
}
module.exports={contextParams,hiddenContext,clearUrl,install};
