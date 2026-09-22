"use strict";

const crypto = require("crypto");
const { validateCampaignRequest, renderCampaignBuilder, renderConfirmation, renderEnterpriseQueue, renderVividCampaignBuilder, renderVividConfirmation } = require("./marketplace-campaign-builder");

function registerMarketplaceCampaignBuilderRoutes({ app, q, orgPage, organizationNav, requireOrganizationPermission, getOrganizationScope, sendOrganizationNotification }) {
  let schemaReady = false;
  async function ensureSchema() {
    if (schemaReady) return;
    await q(`CREATE TABLE IF NOT EXISTS marketplace_campaign_briefs(
      id BIGSERIAL PRIMARY KEY,reference TEXT NOT NULL UNIQUE,organization_id INTEGER NOT NULL REFERENCES organizations(id),
      company_name TEXT NOT NULL,contact_name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',
      objective TEXT NOT NULL,audience TEXT NOT NULL,geography TEXT NOT NULL,offer TEXT NOT NULL,monthly_budget NUMERIC NOT NULL,
      preferred_start_date DATE,notes TEXT NOT NULL DEFAULT '',approval_required BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'Awaiting Review',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await q(`CREATE INDEX IF NOT EXISTS marketplace_campaign_briefs_org_created_idx ON marketplace_campaign_briefs(organization_id,created_at DESC)`);
    await q(`ALTER TABLE marketplace_campaign_briefs ALTER COLUMN organization_id DROP NOT NULL`);
    await q(`ALTER TABLE marketplace_campaign_briefs ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'enterprise_marketplace'`);
    await q(`ALTER TABLE marketplace_campaign_briefs ADD COLUMN IF NOT EXISTS campaign_scope TEXT NOT NULL DEFAULT 'specific_marketplace'`);
    await q(`ALTER TABLE marketplace_campaign_briefs ADD COLUMN IF NOT EXISTS requested_channels JSONB NOT NULL DEFAULT '[]'::jsonb`);
    schemaReady = true;
  }
  async function organizationForSlug(slug) {
    return (await q(`SELECT id,name,slug FROM organizations WHERE LOWER(TRIM(slug))=$1 AND COALESCE(is_active,true)=true LIMIT 1`, [String(slug || "").trim().toLowerCase()])).rows[0] || null;
  }
  app.get("/build-my-campaign", (req, res) => res.send(renderVividCampaignBuilder({})));
  app.post("/build-my-campaign", async (req, res) => {
    try {
      const checked = validateCampaignRequest(req.body);
      if (!checked.valid) return res.status(400).send(renderVividCampaignBuilder({ error:checked.errors.join(" "), values:req.body }));
      await ensureSchema(); const reference = `VIVID-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; const v = checked.value;
      await q(`INSERT INTO marketplace_campaign_briefs(reference,organization_id,company_name,contact_name,email,phone,objective,audience,geography,offer,monthly_budget,preferred_start_date,notes,approval_required,origin_type,campaign_scope,requested_channels) VALUES($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'vivid_direct',$14,$15::jsonb)`, [reference,v.companyName,v.contactName,v.email,v.phone,v.objective,v.audience,v.geography,v.offer,v.monthlyBudget,v.startDate||null,v.notes,v.approvalRequired,v.campaignScope,JSON.stringify(v.channels)]);
      if (typeof sendOrganizationNotification === "function") await sendOrganizationNotification({ to:"mike@vividspots.com", subject:`New Vivid-wide marketing brief: ${v.companyName}`, senderName:"Vivid", html:`<h2>New Run My Marketing request</h2><p><strong>${v.companyName}</strong> submitted ${reference} directly to Vivid.</p><p>Goal: ${v.objective}<br>Scope: ${v.campaignScope}<br>Channels: ${v.channels.join(", ")}<br>Budget: $${v.monthlyBudget}/month<br>Contact: ${v.contactName} (${v.email})</p>` });
      res.redirect(`/build-my-campaign/received?reference=${encodeURIComponent(reference)}`);
    } catch (error) { console.error("VIVID CAMPAIGN BUILDER SUBMIT ERROR", error); res.status(500).send("Unable to submit marketing brief."); }
  });
  app.get("/build-my-campaign/received", (req, res) => res.send(renderVividConfirmation({ reference:String(req.query.reference || "Received") })));
  app.get("/advertise/:slug/build-my-campaign", async (req, res) => {
    try { const organization = await organizationForSlug(req.params.slug); if (!organization) return res.status(404).send("Advertising portal not found."); res.send(renderCampaignBuilder({ organization })); }
    catch (error) { console.error("MARKETPLACE CAMPAIGN BUILDER ERROR", error); res.status(500).send("Unable to load Campaign Builder."); }
  });
  app.post("/advertise/:slug/build-my-campaign", async (req, res) => {
    try {
      const organization = await organizationForSlug(req.params.slug); if (!organization) return res.status(404).send("Advertising portal not found.");
      const checked = validateCampaignRequest(req.body);
      if (!checked.valid) return res.status(400).send(renderCampaignBuilder({ organization, error: checked.errors.join(" "), values: req.body }));
      await ensureSchema();
      const reference = `VIVID-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const v = checked.value;
      await q(`INSERT INTO marketplace_campaign_briefs(reference,organization_id,company_name,contact_name,email,phone,objective,audience,geography,offer,monthly_budget,preferred_start_date,notes,approval_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [reference,organization.id,v.companyName,v.contactName,v.email,v.phone,v.objective,v.audience,v.geography,v.offer,v.monthlyBudget,v.startDate || null,v.notes,v.approvalRequired]);
      if (typeof sendOrganizationNotification === "function") await sendOrganizationNotification({ to:"mike@vividspots.com", subject:`New Vivid campaign brief: ${v.companyName}`, senderName:organization.name, html:`<h2>New Build My Campaign request</h2><p><strong>${v.companyName}</strong> submitted ${reference} through ${organization.name}.</p><p>Goal: ${v.objective}<br>Budget: $${v.monthlyBudget}/month<br>Contact: ${v.contactName} (${v.email})</p>` });
      res.redirect(`/advertise/${encodeURIComponent(organization.slug)}/build-my-campaign/received?reference=${encodeURIComponent(reference)}`);
    } catch (error) { console.error("MARKETPLACE CAMPAIGN BUILDER SUBMIT ERROR", error); res.status(500).send("Unable to submit campaign brief."); }
  });
  app.get("/advertise/:slug/build-my-campaign/received", async (req, res) => {
    try { const organization = await organizationForSlug(req.params.slug); if (!organization) return res.status(404).send("Advertising portal not found."); res.send(renderConfirmation({ organization, reference:String(req.query.reference || "Received") })); }
    catch (error) { res.status(500).send("Unable to load confirmation."); }
  });
  const requireOrgManager = requireOrganizationPermission("manage_advertisers");
  app.get("/org-campaign-builder-requests", requireOrgManager, async (req, res) => {
    try {
      await ensureSchema(); const scope = await getOrganizationScope(req); const orgId = Number(scope.organizationId); const actor = req.session.orgUser || req.session.user;
      const organization = (await q("SELECT id,name FROM organizations WHERE id=$1", [orgId])).rows[0]; if (!organization) return res.status(404).send("Organization not found.");
      const requests = (await q("SELECT * FROM marketplace_campaign_briefs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100", [orgId])).rows;
      res.send(orgPage("Campaign Builder Requests", organizationNav({ organizationId:orgId, organizationName:organization.name, activePage:"campaign-builder", userName:actor?.name || actor?.email || "" }) + renderEnterpriseQueue({ organization, requests })));
    } catch (error) { console.error("ORG CAMPAIGN BUILDER REQUESTS ERROR", error); res.status(500).send("Unable to load campaign requests."); }
  });
}

module.exports = { registerMarketplaceCampaignBuilderRoutes };
