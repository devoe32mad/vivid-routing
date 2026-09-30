"use strict";
const fs=require('fs'),path=require('path');
function install(source){
 const marker='// CONSISTENT_PERFORMANCE_EVIDENCE';
 if(source.includes(marker))return source;
 const start=source.indexOf('app.get("/admin/ai-insights"'),next=source.slice(start+1).search(/\napp\.(?:get|post)\(/),end=next<0?-1:start+1+next;
 if(start<0||end<0)throw Error('Performance evidence route anchors missing');
 let route=source.slice(start,end);
 function replace(before,after,expected=1){const count=route.split(before).length-1;if(count!==expected)throw Error(`Performance evidence anchor count ${count}: ${before}`);route=route.split(before).join(after);}
 replace('    const eventWhereSql =',`    ${marker}
    const {performanceCampaignScope}=require("./performance-campaign-scope");
    eventParams.push(performanceUserId);
    eventWhere.push(performanceCampaignScope('$'+eventParams.length));
    const eventWhereSql =`);
 replace(`        $1::int IS NULL

        OR c.user_id = $1

        OR s.user_id = $1`,`        \${performanceCampaignScope()}`);
 replace('const activeCampaigns =','const performanceCampaignIds = campaignsResult.rows.map(c=>Number(c.id));\nconst activeCampaigns =');
 replace('      WHERE qr.space_id = $1',`      WHERE qr.space_id = $1
        AND e.campaign_id = ANY($2::int[])`);
 replace('    Number(location.id)\n  ];','    Number(location.id), performanceCampaignIds\n  ];');
 replace('  const placementMetricsResult =',`  values.push(performanceCampaignIds);
  placementEventWhere.push(\`e.campaign_id = ANY($\${values.length}::int[])\`);
  const placementMetricsResult =`);
 return source.slice(0,start)+route+source.slice(end);
}
if(require.main===module){const file=process.env.VIVID_SERVER_FILE||path.join(__dirname,'server.js');fs.writeFileSync(file,install(fs.readFileSync(file,'utf8')));}
module.exports={install};
