"use strict";
const fs = require("fs");
const path = require("path");
function install(source) {
  const marker = '// Shared last-30-days reporting defaults.';
  if (source.includes(marker)) return source;
  function replace(before, after, expected = 1) {
    const count = source.split(before).length - 1;
    if (count !== expected) throw Error(`Reporting date anchor count ${count}, expected ${expected}: ${before}`);
    source = source.split(before).join(after);
  }
  replace('const crypto = require("crypto");', 'const crypto = require("crypto");\n' + marker + '\nconst { reportingDateRange } = require("./reporting-date-range");');
  replace('  const fromDate = String(req.query.from || "").trim();\n  const toDate = String(req.query.to || "").trim();', '  let range;\n  try { range = reportingDateRange(req.query); } catch { return {error: "Invalid date range."}; }\n  const {from: fromDate, to: toDate} = range;');
  replace('    const start = req.query.start || req.query.start_date || "";\n    const end = req.query.end || req.query.end_date || "";', '    const {from: start, to: end} = reportingDateRange(req.query);');
  replace('    const start = req.query.start || "";\n    const end = req.query.end || "";', '    const {from: start, to: end} = reportingDateRange(req.query);');
  replace('    const startDate = req.query.start_date || today;\n    const endDate = req.query.end_date || today;', '    const {from: startDate, to: endDate} = reportingDateRange(req.query);', 4);
  replace('    const startDate = req.query.start_date || "";\n    const endDate = req.query.end_date || "";', '    const {from: startDate, to: endDate} = reportingDateRange(req.query);');
  replace(' const startDate =\n  String(req.query.startDate || "").trim() || null;\n\nconst endDate =\n  String(req.query.endDate || "").trim() || null;', ' const {from: startDate, to: endDate} = reportingDateRange(req.query);');
  replace('  const startDate = req.query.startDate || req.query.start || req.query.from;\nconst endDate = req.query.endDate || req.query.end || req.query.to;', '  let range;\n  try { range = reportingDateRange(req.query); } catch { return res.status(400).send("Choose valid reporting dates."); }\n  const {from: startDate, to: endDate} = range;');
  replace('where.push(`e.created_at <= $${params.length}`);', 'where.push(`e.created_at < ($${params.length}::date + interval \'1 day\')`);');
  replace(`      const startDate =
        req.query.start_date ||
        req.query.startDate ||
        req.query.start ||
        req.query.from ||
        today;

      const endDate =
        req.query.end_date ||
        req.query.endDate ||
        req.query.end ||
        req.query.to ||
        today;`, '      const {from: startDate, to: endDate} = reportingDateRange(req.query);', 2);
  return source;
}
if (require.main === module) {
  const target = process.env.VIVID_SERVER_FILE || path.join(__dirname, "server.js");
  fs.writeFileSync(target, install(fs.readFileSync(target, "utf8")));
}
module.exports = {install};
