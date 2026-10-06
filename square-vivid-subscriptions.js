"use strict";

const crypto=require("node:crypto");

const PRICE_CENTS=3500;
const PLAN_NAME="Vivid Performance";

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;

function safeSquareUrl(value){
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port||!["square.link","checkout.square.site"].includes(u.hostname))throw Error("Invalid Square checkout URL");
  return u.href;
}

function installVividSubscriptions({app,q,api,getConnection,origin,env=process.env}){
  const billingCustomerId=Number(env.SQUARE_VIVID_BILLING_CUSTOMER_ID||0);
  const planVariationId=String(env.SQUARE_VIVID_PERFORMANCE_PLAN_VARIATION_ID||"").trim();

  let schema;
  const ready=()=>schema||(schema=q(`
    CREATE TABLE IF NOT EXISTS square_vivid_performance_subscriptions (
      qr_id BIGINT PRIMARY KEY REFERENCES qr_codes(id) ON DELETE CASCADE,
      request_id BIGINT NOT NULL REFERENCES organization_advertising_requests(id) ON DELETE CASCADE,
      advertiser_user_id BIGINT REFERENCES users(id),
      square_billing_customer_id BIGINT NOT NULL,
      plan_variation_id TEXT NOT NULL,
      payment_link_id TEXT,
      square_order_id TEXT,
      square_subscription_id TEXT,
      checkout_url TEXT,
      status TEXT NOT NULL DEFAULT 'checkout_created'
        CHECK(status IN ('checkout_created','active','cancelled','failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(e=>{schema=null;throw e;}));

  const configured=()=>validId(billingCustomerId)&&planVariationId.length>0;

  app.post("/admin/sponsorship-performance/subscribe",async(req,res)=>{
    try{
      if(!req.session?.user)return res.status(401).send("Sign in to Vivid first.");
      if(!validId(req.body?.qr_id))return res.status(400).send("Valid placement required.");
      if(!configured())return res.status(503).send("Vivid Performance billing is not configured yet.");

      const userId=Number(req.session.user.login_user_id||req.session.user.id);
      const email=String(req.session.user.email||"").trim();
      const qrId=Number(req.body.qr_id);

      const placement=(await q(`
        SELECT
          ar.id AS request_id,
          ar.created_vivid_user_id,
          ar.email,
          ar.business_name,
          qr.id AS qr_id,
          s.name AS placement_name
        FROM organization_advertising_requests ar
        JOIN qr_codes qr ON qr.id=ar.created_qr_id
        JOIN spaces s ON s.id=qr.space_id
        JOIN sponsorship_performance_plans spp ON spp.qr_id=qr.id
        LEFT JOIN users u ON u.id=ar.created_vivid_user_id
        WHERE qr.id=$1
          AND ar.status='Approved'
          AND spp.plan='basic'
          AND spp.status='upgrade_requested'
          AND (
            ar.created_vivid_user_id=$2
            OR u.advertiser_customer_id=$2
            OR (
              NULLIF(TRIM($3::text),'') IS NOT NULL
              AND (
                LOWER(TRIM(ar.email))=LOWER(TRIM($3::text))
                OR LOWER(TRIM(u.email))=LOWER(TRIM($3::text))
              )
            )
          )
        ORDER BY ar.id DESC
        LIMIT 1
      `,[qrId,userId,email])).rows[0];

      if(!placement)return res.status(404).send("This upgrade request is not available for your account.");

      await ready();
      const existing=(await q(`
        SELECT checkout_url,status
        FROM square_vivid_performance_subscriptions
        WHERE qr_id=$1
      `,[qrId])).rows[0];

      if(existing?.status==="active"){
        return res.redirect(303,"/admin/sponsorship-performance?request_id="+Number(placement.request_id));
      }
      if(existing?.checkout_url&&existing.status==="checkout_created"){
        return res.redirect(303,safeSquareUrl(existing.checkout_url));
      }

      const connection=await getConnection(billingCustomerId);
      if(!connection)return res.status(503).send("Vivid Square billing connection is not connected.");

      const needed=["ORDERS_READ","ORDERS_WRITE","PAYMENTS_WRITE","SUBSCRIPTIONS_READ","SUBSCRIPTIONS_WRITE","ITEMS_READ","ITEMS_WRITE"];
      const scopes=String(connection.token?.vivid_scopes||"").split(" ");
      if(!needed.every(s=>scopes.includes(s))){
        return res.status(503).send("Vivid Square billing needs one-time subscription authorization.");
      }

      const idempotency=crypto.createHash("sha256")
        .update(["vivid-performance-subscription-v1",placement.request_id,qrId,planVariationId].join(":"))
        .digest("hex");

      const payload={
        idempotency_key:idempotency,
        quick_pay:{
          name:PLAN_NAME,
          price_money:{amount:PRICE_CENTS,currency:"USD"},
          location_id:connection.token.location_id||connection.row.location_id
        },
        checkout_options:{
          subscription_plan_id:planVariationId,
          redirect_url:origin+"/admin/sponsorship-performance/subscription-return?request_id="+Number(placement.request_id)
        },
        payment_note:"Vivid Performance request "+Number(placement.request_id)+" / QR "+qrId,
        pre_populated_data:placement.email?{buyer_email:placement.email}:undefined
      };

      if(!payload.quick_pay.location_id){
        const locations=(await api("/v2/locations",null,connection.token.access_token)).locations||[];
        const active=locations.find(l=>l.status==="ACTIVE"&&l.currency==="USD");
        if(!active)return res.status(503).send("Vivid Square billing has no active USD location.");
        payload.quick_pay.location_id=active.id;
      }

      const result=await api("/v2/online-checkout/payment-links",payload,connection.token.access_token);
      if(!result.payment_link?.url||!result.payment_link?.id)throw Error("Square did not return a payment link.");

      await q(`
        INSERT INTO square_vivid_performance_subscriptions(
          qr_id,request_id,advertiser_user_id,square_billing_customer_id,plan_variation_id,
          payment_link_id,square_order_id,checkout_url,status,updated_at
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'checkout_created',NOW())
        ON CONFLICT(qr_id) DO UPDATE SET
          request_id=EXCLUDED.request_id,
          advertiser_user_id=EXCLUDED.advertiser_user_id,
          square_billing_customer_id=EXCLUDED.square_billing_customer_id,
          plan_variation_id=EXCLUDED.plan_variation_id,
          payment_link_id=EXCLUDED.payment_link_id,
          square_order_id=EXCLUDED.square_order_id,
          checkout_url=EXCLUDED.checkout_url,
          status='checkout_created',
          updated_at=NOW()
      `,[
        qrId,
        Number(placement.request_id),
        Number(placement.created_vivid_user_id)||null,
        billingCustomerId,
        planVariationId,
        result.payment_link.id,
        result.payment_link.order_id||null,
        safeSquareUrl(result.payment_link.url)
      ]);

      return res.redirect(303,safeSquareUrl(result.payment_link.url));
    }catch(error){
      console.error("VIVID PERFORMANCE SUBSCRIPTION CHECKOUT ERROR",error?.message||error);
      return res.status(502).send("Unable to start Vivid Performance billing. Please try again.");
    }
  });

  app.get("/admin/sponsorship-performance/subscription-return",async(req,res)=>{
    const requestId=Number(req.query.request_id||0);
    const suffix=validId(requestId)?"?request_id="+requestId+"&billing=processing":"?billing=processing";
    return res.redirect(303,"/admin/sponsorship-performance"+suffix);
  });
}

module.exports={installVividSubscriptions,PRICE_CENTS,PLAN_NAME,safeSquareUrl};
