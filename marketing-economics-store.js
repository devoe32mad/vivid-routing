"use strict";
const SCHEMA=`
CREATE TABLE IF NOT EXISTS marketing_account_economics(
  owner_user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gross_margin_pct NUMERIC(5,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(gross_margin_pct IS NULL OR (gross_margin_pct>=0 AND gross_margin_pct<=100))
);`;
function createMarketingEconomicsStore(q){
  let schema;
  const ready=()=>schema||(schema=q(SCHEMA).catch(error=>{schema=null;throw error;}));
  return {
    ready,
    async load(userId){await ready();return (await q("SELECT gross_margin_pct::text,updated_at FROM marketing_account_economics WHERE owner_user_id=$1",[userId])).rows[0]||{gross_margin_pct:null,updated_at:null};},
    async save(userId,marginPct){await ready();return (await q(`INSERT INTO marketing_account_economics(owner_user_id,gross_margin_pct) VALUES($1,$2)
      ON CONFLICT(owner_user_id) DO UPDATE SET gross_margin_pct=EXCLUDED.gross_margin_pct,updated_at=NOW()
      RETURNING gross_margin_pct::text,updated_at`,[userId,marginPct])).rows[0];}
  };
}
module.exports={SCHEMA,createMarketingEconomicsStore};
