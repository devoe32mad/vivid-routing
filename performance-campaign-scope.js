"use strict";
// Match established Vivid campaign ownership, including marketplace placements.
// EXISTS prevents multiple placements from multiplying events.
function performanceCampaignScope(parameter='$1') {
 if(!/^\$[1-9]\d*$/.test(parameter))throw Error('Invalid SQL parameter');
 return `(c.user_id=${parameter} OR EXISTS (
   SELECT 1 FROM qr_campaigns scope_qc
   JOIN qr_codes scope_qr ON scope_qr.id=scope_qc.qr_id
   JOIN spaces scope_space ON scope_space.id=scope_qr.space_id
   WHERE scope_qc.campaign_id=c.id AND scope_space.user_id=${parameter}
 )) AND COALESCE(c.is_test,false)=false`;
}
module.exports={performanceCampaignScope};
