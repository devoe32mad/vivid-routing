"use strict";

function escapeHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function normalizeUrl(value){const url=String(value||"").trim();if(!url)return "";return /^(https?:\/\/|mailto:|tel:|sms:)/i.test(url)?url:`https://${url}`;}

function validateDraftPublish(input={}){
  const value={
    name:String(input.name||"").trim().slice(0,120),advertiser:String(input.advertiser||"").trim().slice(0,160),
    campaignUrl:normalizeUrl(input.campaignUrl),conversionUrl:normalizeUrl(input.conversionUrl),
    averageCustomerValue:Math.max(0,Number(input.averageCustomerValue||0)),confirmed:String(input.confirmed||"")==="yes"
  };
  const errors=[];
  if(!value.name)errors.push("Campaign name is required.");
  if(!value.advertiser)errors.push("Advertiser name is required.");
  if(!/^https?:\/\//i.test(value.campaignUrl))errors.push("A valid HTTP or HTTPS destination URL is required.");
  if(value.conversionUrl&&!/^https?:\/\//i.test(value.conversionUrl))errors.push("Conversion URL must use HTTP or HTTPS.");
  if(!value.confirmed)errors.push("Confirm that you reviewed the draft before publishing.");
  return {valid:errors.length===0,errors,value};
}

function renderDraftReview(draft,{enterprise=false,organizationId=0,error="",advertiserName=""}={}){
  const brief=typeof draft.brief_json==="string"?JSON.parse(draft.brief_json):(draft.brief_json||{});
  const plan=typeof draft.plan_json==="string"?JSON.parse(draft.plan_json):(draft.plan_json||{});
  const base=enterprise?`/org-ai-campaign-draft/${Number(draft.id)}?organization_id=${Number(organizationId)}`:`/admin/ai-campaign-draft/${Number(draft.id)}`;
  const published=String(draft.status)==="published";
  const campaignLink=published&&draft.campaign_id?(enterprise?`/org-campaign/${Number(draft.campaign_id)}?organization_id=${Number(organizationId)}&qr_id=${Number(draft.placement_id)}`:`/admin/view-campaign/${Number(draft.campaign_id)}`):"";
  return `<main style="max-width:1040px;margin:0 auto;padding:26px 22px 50px;"><section style="background:linear-gradient(135deg,#0b1f3a,#2563eb);color:#fff;border-radius:18px;padding:24px;"><div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#dbeafe;">Vivid AI Campaign Draft</div><h1 style="margin:7px 0;">Review before publishing</h1><p style="color:#dbeafe;margin:0;">Approval created this editable draft. Nothing becomes active until Publish Campaign is confirmed.</p></section>
  ${error?`<div style="margin-top:16px;padding:13px;border-radius:10px;background:#fff0f0;color:#9b1c1c;">${escapeHtml(error)}</div>`:""}
  <section style="margin-top:18px;background:#fff;border:1px solid #dbe4f0;border-radius:16px;padding:20px;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;"><div><small>Placement</small><strong style="display:block;">${escapeHtml(plan.placement||`Placement ${draft.placement_id}`)}</strong></div><div><small>Schedule</small><strong style="display:block;">${escapeHtml(plan.schedule||"")}</strong></div><div><small>Audience</small><strong style="display:block;">${escapeHtml(plan.audience||brief.audience||"")}</strong></div><div><small>Recommended message</small><strong style="display:block;">${escapeHtml(plan.headline||brief.offer||"")}</strong></div></div></section>
  ${published?`<section style="margin-top:18px;background:#effaf3;border:1px solid #9bd5ad;border-radius:16px;padding:20px;"><h2 style="margin-top:0;">Campaign published</h2><p>The campaign record, destination, and placement assignment were created successfully.</p><a href="${escapeHtml(campaignLink)}" style="font-weight:900;color:#1559c7;">View source campaign →</a></section>`:`<section style="margin-top:18px;background:#fff;border:1px solid #dbe4f0;border-radius:16px;padding:20px;"><h2 style="margin-top:0;">Campaign details</h2><form method="POST" action="${escapeHtml(base)}"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;"><div><label>Campaign name</label><input name="name" required value="${escapeHtml(brief.name||draft.name||"")}"></div><div><label>Advertiser name</label><input name="advertiser" required value="${escapeHtml(advertiserName)}" placeholder="Business or brand name"></div><div style="grid-column:1/-1;"><label>Destination URL</label><input name="campaign_url" required placeholder="https://example.com/offer"></div><div style="grid-column:1/-1;"><label>Conversion confirmation URL (optional)</label><input name="conversion_url" placeholder="https://example.com/thank-you"></div><div><label>Average customer value</label><input name="average_customer_value" type="number" min="0" step="0.01" value="0"></div></div><label style="display:flex;gap:9px;align-items:flex-start;margin-top:18px;"><input type="checkbox" name="confirmed" value="yes" required style="width:auto;margin-top:3px;"><span>I reviewed the destination, dates, placement, message, and tracking. Publish and assign this campaign.</span></label><button type="submit" style="margin-top:16px;border:0;border-radius:10px;background:#2563eb;color:#fff;padding:12px 16px;font-weight:900;cursor:pointer;">Publish Campaign</button></form></section>`}</main>`;
}

module.exports={normalizeUrl,renderDraftReview,validateDraftPublish};
