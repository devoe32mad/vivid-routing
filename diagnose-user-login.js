"use strict";
const { Pool } = require("pg");
const EMAIL = "michaelandrewdevoe@gmail.com";
async function main(){
  if(!process.env.DATABASE_URL) return;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{
    client=await pool.connect();
    const r=await client.query(`
      SELECT
        u.id,
        u.email,
        u.role,
        u.account_status,
        u.password IS NOT NULL AS has_password,
        CASE
          WHEN u.password IS NULL THEN 'none'
          WHEN u.password LIKE 'scrypt:%' THEN 'scrypt-colon'
          WHEN u.password LIKE 'scrypt$%' THEN 'scrypt-dollar'
          WHEN u.password LIKE '$2%' THEN 'bcrypt-like'
          ELSE 'other'
        END AS password_format,
        u.password_created_at,
        COUNT(ou.id)::int AS organization_memberships,
        ARRAY_REMOVE(ARRAY_AGG(o.id ORDER BY o.id), NULL) AS organization_ids,
        ARRAY_REMOVE(ARRAY_AGG(o.slug ORDER BY o.id), NULL) AS organization_slugs
      FROM users u
      LEFT JOIN organization_users ou
        ON ou.user_id=u.id AND COALESCE(ou.is_active,true)=true
      LEFT JOIN organizations o
        ON o.id=ou.organization_id AND COALESCE(o.is_active,true)=true
      WHERE LOWER(TRIM(u.email))=LOWER(TRIM($1))
      GROUP BY u.id,u.email,u.role,u.account_status,u.password,u.password_created_at
      ORDER BY u.id
    `,[EMAIL]);
    console.log("LOGIN DIAGNOSTIC:",JSON.stringify(r.rows));
  } catch(e){
    console.error("LOGIN DIAGNOSTIC ERROR:",e.message);
  } finally {
    if(client) client.release();
    await pool.end();
  }
}
if(require.main===module) main();
