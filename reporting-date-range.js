"use strict";
// Inclusive calendar dates: today and the preceding 29 days. Reporting uses UTC.
function reportingDateRange(query = {}, now = new Date()) {
  const from = query.from || query.startDate || query.start_date || query.start || new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const to = query.to || query.endDate || query.end_date || query.end || now.toISOString().slice(0, 10);
  const valid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to) throw Error("Choose a valid reporting date range.");
  return {from, to};
}
module.exports = {reportingDateRange};
