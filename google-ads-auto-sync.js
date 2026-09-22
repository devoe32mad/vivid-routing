"use strict";

// Dates are calendar dates in the advertising account, including around DST.
function accountToday(timezone, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
function recentRange(timezone, now = new Date()) {
  const to = accountToday(timezone, now);
  return {from:new Date(Date.parse(to)-30*86400000).toISOString().slice(0,10),to};
}
function createAutoSync({store, enabled=true, logger=console}) {
  let running=false, timer;
  async function tick() {
    if (!enabled || running) return;
    running=true;
    try {
      await store.ready();
      const due = await store.due();
      for (const row of due) {
        try {
          const count = await store.sync(row.owner_user_id,row.id,recentRange(row.account_timezone),{dueOnly:true});
          if(count !== null) logger.info("google_ads_auto_sync " + JSON.stringify({connectionId:String(row.id),status:"succeeded",rows:count}));
        } catch(error) {
          // Row locks coordinate workers, manual refresh and disconnect. A locked
          // row is retried on the next tick; no provider responses enter logs.
          if(error.code !== "55P03" && error.code !== "not_found") {
            logger.warn("google_ads_auto_sync " + JSON.stringify({connectionId:String(row.id),status:"retry_or_attention"}));
          }
        }
      }
    } catch { logger.warn("google_ads_auto_sync unavailable"); }
    finally { running=false; }
  }
  function start() {
    if(!enabled || timer) return;
    timer=setInterval(tick,60000);
    timer.unref?.();
    void tick();
  }
  function stop() {clearInterval(timer);timer=null;}
  return {tick,start,stop};
}
module.exports={accountToday,recentRange,createAutoSync};
