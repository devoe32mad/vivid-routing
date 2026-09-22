"use strict";

const assert = require("assert");
const { validateCampaignRequest, renderCampaignBuilder, renderConfirmation, renderEnterpriseQueue, renderVividCampaignBuilder, renderVividConfirmation } = require("../marketplace-campaign-builder");

const valid = validateCampaignRequest({ company_name:"Naples Coffee", contact_name:"Alex Smith", email:"alex@example.com", objective:"visits", audience:"Local families", geography:"Naples, FL", offer:"Free pastry with purchase", monthly_budget:"1500", approval_required:"yes" });
assert.equal(valid.valid, true);
assert.equal(valid.value.monthlyBudget, 1500);
assert.equal(valid.value.approvalRequired, true);

const invalid = validateCampaignRequest({ email:"bad", monthly_budget:"0" });
assert.equal(invalid.valid, false);
assert(invalid.errors.length >= 5);

const organization = { id:23, name:"Example School", slug:"example-school" };
const form = renderCampaignBuilder({ organization });
assert(form.includes("Build My Campaign"));
assert(form.includes("before anything runs"));
assert(form.includes("Browse Placements"));

const confirmation = renderConfirmation({ organization, reference:"VIVID-1234" });
assert(confirmation.includes("VIVID-1234"));
assert(confirmation.includes("not an automatic launch"));

const queue = renderEnterpriseQueue({ organization, requests:[{ reference:"VIVID-1234", status:"Awaiting Review", company_name:"Naples Coffee", objective:"visits", monthly_budget:1500, audience:"Families", geography:"Naples", offer:"Free pastry", contact_name:"Alex", email:"alex@example.com", created_at:"2026-09-22T12:00:00Z" }] });
assert(queue.includes("Prepare Recommendation"));
assert(queue.includes("Check Evidence Passport"));
assert(queue.includes("Naples Coffee"));

const crossChannel = validateCampaignRequest({ company_name:"Naples Coffee", contact_name:"Alex Smith", email:"alex@example.com", objective:"sales", audience:"Local families", geography:"Naples, FL", offer:"Free pastry", monthly_budget:"2500", campaign_scope:"vivid_selects", channels:["digital","physical","vivid","owned"] });
assert.equal(crossChannel.valid, true);
assert.deepEqual(crossChannel.value.channels, ["digital","physical","vivid","owned"]);
assert.equal(crossChannel.value.campaignScope, "vivid_selects");

const vividForm = renderVividCampaignBuilder({});
assert(vividForm.includes("Run My Marketing"));
assert(vividForm.includes("Valpak"));
assert(vividForm.includes("Vivid Marketplace"));
assert(vividForm.includes("Owned Channels"));
assert(vividForm.includes("Vivid Selects"));

const vividConfirmation = renderVividConfirmation({ reference:"VIVID-WIDE" });
assert(vividConfirmation.includes("VIVID-WIDE"));
assert(vividConfirmation.includes("No campaign has launched"));

console.log("marketplace-campaign-builder tests passed");
