"use strict";

const crypto = require("crypto");

const CONNECTION_STATES = new Set(["not_connected", "pending_authorization", "connected", "attention_required", "disconnected"]);

function normalizeCustomerId(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : "";
}

function formatCustomerId(value) {
  const id = normalizeCustomerId(value);
  return id ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : "";
}

function validateConnectionInput(input = {}) {
  const customerId = normalizeCustomerId(input.customer_id);
  const accountName = String(input.account_name || "").trim().slice(0, 160);
  const errors = [];
  if (!customerId) errors.push("Enter a valid 10-digit Google Ads customer ID.");
  if (!accountName) errors.push("Enter an account name.");
  return { valid: errors.length === 0, errors, value: { customerId, accountName } };
}

function normalizeDailyEvidence(row = {}) {
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  return {
    date: String(row.date || "").slice(0, 10),
    externalCampaignId: String(row.externalCampaignId || row.campaign_id || "").trim(),
    campaignName: String(row.campaignName || row.campaign_name || "Unnamed campaign").trim().slice(0, 240),
    status: String(row.status || "UNKNOWN").trim().toUpperCase().slice(0, 40),
    currencyCode: String(row.currencyCode || row.currency_code || "USD").trim().toUpperCase().slice(0, 3),
    impressions: Math.max(0, Math.trunc(number(row.impressions))),
    clicks: Math.max(0, Math.trunc(number(row.clicks))),
    costMicros: Math.max(0, Math.trunc(number(row.costMicros ?? row.cost_micros))),
    conversions: Math.max(0, number(row.conversions)),
    conversionValue: Math.max(0, number(row.conversionValue ?? row.conversion_value))
  };
}

function evidenceSummary(rows = []) {
  const totals = rows.reduce((sum, row) => {
    const item = normalizeDailyEvidence(row);
    sum.impressions += item.impressions; sum.clicks += item.clicks; sum.costMicros += item.costMicros;
    sum.conversions += item.conversions; sum.conversionValue += item.conversionValue;
    return sum;
  }, { impressions:0, clicks:0, costMicros:0, conversions:0, conversionValue:0 });
  return { ...totals, spend: totals.costMicros / 1000000, ctr: totals.impressions ? totals.clicks / totals.impressions * 100 : 0, costPerConversion: totals.conversions ? totals.costMicros / 1000000 / totals.conversions : null };
}

function createStateToken() { return crypto.randomBytes(24).toString("hex"); }

function safeConnectionState(value) { return CONNECTION_STATES.has(value) ? value : "not_connected"; }

module.exports = { normalizeCustomerId, formatCustomerId, validateConnectionInput, normalizeDailyEvidence, evidenceSummary, createStateToken, safeConnectionState };
