'use strict';
// This entry point never runs on production. Only the isolated Railway project may start it.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const PROJECT='ad3be879-a03e-4703-96ed-bb366127d83c';
async function start(){
 if(process.env.MCA_DEMO_ISOLATED!=='1'||(process.env.RAILWAY_PROJECT_ID!==PROJECT&&process.env.MCA_LOCAL_QA!=='1'))throw Error('MCA demo requires its dedicated isolated project');
 if(!process.env.MCA_REVIEW_TOKEN)throw Error('MCA_REVIEW_TOKEN is required');
 process.env.SESSION_SECRET ||= crypto.randomBytes(48).toString('hex');
 process.env.BASE_URL ||= 'https://'+(process.env.RAILWAY_PUBLIC_DOMAIN||'localhost:3000');
 // No mail, billing, AI or production integration credentials are used by this demo.
 const imageDir=path.join(__dirname,'assets/mca-isolated');fs.mkdirSync(imageDir,{recursive:true});
 const images=require('./mca-demo-images.json');
 await Promise.all(Object.entries(images).map(async([name,url])=>{if(fs.existsSync(path.join(imageDir,name)))return;const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('MCA image fetch failed: '+name);fs.writeFileSync(path.join(imageDir,name),Buffer.from(await response.arrayBuffer()));}));
 const {Pool}=require('pg'),pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
 const q=(sql,params=[])=>pool.query(sql,params);
 await require('./mca-demo-schema').initialize(q);
 const client=await pool.connect();let fixture;
 try{fixture=await require('./mca-demo-seed').seed(client)}finally{client.release()}
 await require('./mca-demo-runtime').prepare(q,fixture);
 await pool.end();
 let source=fs.readFileSync(require.resolve('./server'),'utf8');
 source=source.replace('const { Resend } = require(\"resend\");', 'const Resend=class{constructor(){this.emails={send:async()=>({data:{id:\"demo-email-suppressed\"},error:null})}}};');
 source=require('./install-responsibility').install(source);
 source=require('./install-reporting-date-defaults').install(source);
 source=require('./install-qr-edit').install(source);
 const editAnchor='  \"/admin/edit-campaign/:campaignId\",\n  requireLogin,\n  async (req, res) => {\n    try {';
 source=source.replaceAll(editAnchor,editAnchor+'\n      const marketplaceRequest = null;');
 source=source.replace('${navItem("Sales Rep Report",', '${navItem("Sponsor Journey", `/org-sponsor-journey?organization_id=${organizationId}`, "journey")}\n${navItem("Sales Rep Report",');
 source=source.replace('const disabledPublicMaintenanceRoutes =','require("./mca-demo-runtime").register(app,{q,organizationNav,fixture:'+JSON.stringify(fixture)+'});\nconst disabledPublicMaintenanceRoutes =');
 source=source.replaceAll('https://vivid-routing-production.up.railway.app',process.env.BASE_URL);
 const appModule=new Module(path.join(__dirname,'mca-demo-server.js'),module);appModule.filename=path.join(__dirname,'mca-demo-server.js');appModule.paths=module.paths;appModule._compile(source,appModule.filename);
}
module.exports={start,PROJECT};
if(require.main===module)start().catch(e=>{console.error('ISOLATED MCA STARTUP:',e);process.exitCode=1});
