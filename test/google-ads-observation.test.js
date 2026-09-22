"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeCustomerId,formatCustomerId,validateConnectionInput,normalizeDailyEvidence,evidenceSummary,safeConnectionState}=require("../google-ads-observation");
const {renderGoogleAdsObservation}=require("../google-ads-observation-routes");
test("validates and formats Google Ads customer IDs",()=>{assert.equal(normalizeCustomerId("123-456-7890"),"1234567890");assert.equal(formatCustomerId("1234567890"),"123-456-7890");assert.equal(validateConnectionInput({customer_id:"123",account_name:"A"}).valid,false);});
test("normalizes non-negative read-only evidence",()=>{const row=normalizeDailyEvidence({date:"2026-09-20",campaign_id:"9",campaign_name:"Search",impressions:"100",clicks:"8",cost_micros:"2500000",conversions:"2",conversion_value:"20"});assert.deepEqual(evidenceSummary([row]),{impressions:100,clicks:8,costMicros:2500000,conversions:2,conversionValue:20,spend:2.5,ctr:8,costPerConversion:1.25});});
test("renders explicit observation boundary and tenant identity",()=>{const html=renderGoogleAdsObservation({organization:{id:2,name:"Enterprise A"},advertiser:{id:7,name:"Advertiser B"},connection:null});assert.match(html,/cannot create campaigns, alter bids, or spend money/);assert.match(html,/Advertiser B/);assert.match(html,/Enterprise A/);assert.doesNotMatch(html,/bearer|refresh_token|client_secret/i);});
test("rejects unknown connection states",()=>assert.equal(safeConnectionState("owner"),"not_connected"));
