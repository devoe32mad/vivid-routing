'use strict';
const jobs = require('./hexpol-careers-jobs.json');
const MAIN = 'https://myjobs.adp.com/hexpolexternalcareersite/cx/job-listing';
const BASE = 'https://vivid-routing-production.up.railway.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function initialActions(qrId, campaignId, actions) {
  if (Number(qrId) !== 125 || Number(campaignId) !== 88) return actions;
  const main = actions.find(a => a.destination_url === MAIN);
  return main ? [main] : actions;
}
function register(app, q) {
  app.get('/hexpol-careers/jobs.json', async (req, res) => {
    try {
      const result = await q('SELECT destination_url FROM campaign_destinations WHERE campaign_id = 88 AND COALESCE(is_active, true) = true');
      const active = new Set(result.rows.map(r => r.destination_url));
      res.json({campaignId:88, qrId:125, mainUrl:MAIN, configuredJobs:jobs.filter(j=>active.has(j.url)).length,
        jobs:jobs.map(j=>({...j,active:active.has(j.url),trackingUrl:BASE+'/hexpol-careers/job/'+j.requisition}))});
    } catch (error) { res.status(503).json({error:'Job mapping unavailable'}); }
  });
  app.get('/hexpol-careers/job/:requisition', async (req,res) => {
    const job = jobs.find(j=>j.requisition === req.params.requisition);
    if (!job) return res.status(404).send('Unknown HEXPOL job.');
    const clickId = String(req.query.vivid_click_id || '');
    if (clickId && !UUID.test(clickId)) return res.status(400).send('Invalid click ID.');
    try {
      const result = await q(`SELECT cd.id FROM campaign_destinations cd
        JOIN qr_campaigns qc ON qc.campaign_id=cd.campaign_id AND qc.qr_id=125 AND COALESCE(qc.is_active,true)=true
        WHERE cd.campaign_id=88 AND cd.destination_url=$1 AND COALESCE(cd.is_active,true)=true ORDER BY cd.id LIMIT 1`,[job.url]);
      if (!result.rows.length) return res.status(404).send('This job is unavailable.');
      res.set('Cache-Control','no-store');
      return res.redirect('/destination-click/'+result.rows[0].id+'?qr_id=125'+(clickId?'&vivid_click_id='+encodeURIComponent(clickId):''));
    } catch(error) { return res.status(503).send('Job tracking is temporarily unavailable.'); }
  });
  app.get('/hexpol-careers/integration.js', (req,res)=>res.sendFile(require('path').join(__dirname,'public/vivid-hexpol-careers.js')));
  app.get('/hexpol-careers/adp-setup', (req,res)=>res.type('text/plain').sendFile(require('path').join(__dirname,'HEXPOL-ADP-SETUP.md')));
}
module.exports={jobs,MAIN,UUID,initialActions,register};
