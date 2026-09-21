"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUrl,renderDraftReview,validateDraftPublish}=require("../ai-campaign-draft");

test("validates explicit campaign publication",()=>{const r=validateDraftPublish({name:"Game Night",advertiser:"Publix",campaignUrl:"publix.com/offer",conversionUrl:"https://publix.com/thanks",averageCustomerValue:42,confirmed:"yes"});assert.equal(r.valid,true);assert.equal(r.value.campaignUrl,"https://publix.com/offer");});
test("rejects publication without destination and confirmation",()=>{const r=validateDraftPublish({name:"Game Night",advertiser:"Publix"});assert.equal(r.valid,false);assert.match(r.errors.join(" "),/destination URL/);assert.match(r.errors.join(" "),/Confirm/);});
test("draft review keeps approval separate from publication",()=>{const html=renderDraftReview({id:3,name:"Plan",status:"draft",placement_id:9,brief_json:{name:"Game Night",audience:"Families",offer:"Offer",startDate:"2026-10-01",endDate:"2026-10-31"},plan_json:{placement:"Stadium",schedule:"October",headline:"Offer"}});assert.match(html,/Nothing becomes active until Publish Campaign/);assert.match(html,/Publish Campaign/);assert.match(html,/required/);});
test("published draft links to source campaign",()=>{const html=renderDraftReview({id:3,status:"published",campaign_id:44,placement_id:9,brief_json:{},plan_json:{}},{enterprise:true,organizationId:23});assert.match(html,/\/org-campaign\/44\?organization_id=23&amp;qr_id=9/);});
test("draft review prefills a known advertiser",()=>{const html=renderDraftReview({id:3,status:"draft",placement_id:9,brief_json:{},plan_json:{}},{advertiserName:"Coca-Cola"});assert.match(html,/name="advertiser" required value="Coca-Cola"/);});
test("unsafe draft content is escaped",()=>{const html=renderDraftReview({id:3,name:"x",status:"draft",placement_id:9,brief_json:{name:'<script>x</script>'},plan_json:{placement:'<img src=x>'}});assert.doesNotMatch(html,/<script>|<img/);});
