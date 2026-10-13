'use strict';
const steps={
 '/admin/new-qr':['Create QR Code','Choose the school placement this QR code represents.'],
 '/admin/new-campaign':['Create Campaign','Add the sponsor’s offer and destination.'],
 '/admin/assign':['Assign Campaign','Connect a campaign to its QR code.'],
 '/admin/schedule':['Schedule Campaigns','Basic placements run every day. Performance supports scheduled promotions.']
};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function respond(req,res,q,allowed){
 const step=steps[req.path];if(!step)return false;
 const locations=(await q('SELECT id,name FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[13])).rows;
 const qrs=(await q('SELECT id,name FROM qr_codes WHERE id=ANY($1::int[])',[allowed.qrIds])).rows;
 const campaigns=(await q('SELECT id,name FROM campaigns WHERE id=ANY($1::int[])',[allowed.campaignIds])).rows;
 const select=(label,rows)=>`<label>${label}<select>${rows.map(r=>`<option value="${Number(r.id)}">${escape(r.name)}</option>`).join('')}</select></label>`;
 let fields='';
 if(req.path==='/admin/new-qr')fields=select('School / location',locations)+'<label>QR code name<input placeholder="e.g. Stadium fence banner"></label>';
 if(req.path==='/admin/new-campaign')fields='<label>Campaign name<input placeholder="e.g. Family savings offer"></label><label>Destination URL<input type="url" placeholder="https://example.com/offer"></label>';
 if(['/admin/assign','/admin/schedule'].includes(req.path))fields=select('QR code',qrs)+select('Campaign',campaigns);
 if(req.path==='/admin/schedule')fields+='<label>Schedule<select><option>Every day — Basic default</option><option>Custom schedule — Performance preview</option></select></label><label>Start date<input type="date"></label><label>End date<input type="date"></label>';
 res.send(`<!doctype html><html><head><title>${step[0]} — CCPS demo</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f5f7fb;color:#17263b;font:16px system-ui}main{max-width:680px;margin:40px auto;padding:32px;background:white;border-radius:18px}label{display:block;margin:24px 0;font-weight:600}input,select{display:block;box-sizing:border-box;width:100%;padding:12px;margin-top:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}a{color:#2563eb}button{padding:13px 20px;border:0;border-radius:9px;font:inherit;background:#e2e8f0;color:#475569}.note{padding:16px;background:#eff6ff;border-radius:10px}</style></head><body><main><a href="/my-setup">← Back to My Setup</a><h1>${step[0]}</h1><p>${step[1]}</p><p class="note">View-only demo. Explore these example fields; nothing is created, saved or scheduled.</p>${fields}<button type="button" disabled>Save unavailable in view-only demo</button><p><a href="/reports">View sponsorship reports →</a></p></main></body></html>`);
 return true;
}
module.exports={steps,respond};
