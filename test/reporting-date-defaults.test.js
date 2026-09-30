"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const {reportingDateRange} = require('../reporting-date-range');
const {install} = require('../install-reporting-date-defaults');
const now = new Date('2026-09-30T20:00:00Z');
test('defaults to 30 inclusive calendar days across month, year and leap boundaries', () => {
  for (const [date,from,to] of [['2026-09-30','2026-09-01','2026-09-30'],['2026-01-10','2025-12-12','2026-01-10'],['2024-03-01','2024-02-01','2024-03-01']]) {
    assert.deepEqual(reportingDateRange({},new Date(date)),{from,to});
  }
});
test('every reporting query naming convention preserves explicit dates', () => {
  for (const [start,end] of [['from','to'],['startDate','endDate'],['start_date','end_date'],['start','end']]) {
    assert.deepEqual(reportingDateRange({[start]:'2025-01-01',[end]:'2025-12-31'},now),{from:'2025-01-01',to:'2025-12-31'});
    assert.deepEqual(reportingDateRange({[start]:'',[end]:''},now),{from:'2026-09-01',to:'2026-09-30'});
  }
  assert.deepEqual(reportingDateRange({from:'2026-08-01'},now),{from:'2026-08-01',to:'2026-09-30'});
  for (const query of [{from:'2026-02-30'},{from:['2026-01-01']},{from:'2026-10-01'},{to:'bad'}]) assert.throws(()=>reportingDateRange(query,now));
});
test('installer sets reporting dates before calculations and preserves campaign schedule source', () => {
  const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
  const installed=install(source);
  assert.equal(install(installed),installed);
  new vm.Script(installed);
  for (const route of ['/admin/ai-insights','/reports','/reports-qr','/reports-campaign','/reports-location','/admin/reports','/dashboard','/export/report.xlsx','/export/report.pdf','/export/events.csv']) {
    const start=installed.search(new RegExp('app.get\\(\\s*"'+route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"'));
    assert.ok(start>=0,route);
    const head=installed.slice(start,start+1700);
    assert.match(head,/reportingDateRange\(req.query\)/,route);
  }
  assert.equal((installed.match(/type="date"/g)||[]).length,(source.match(/type="date"/g)||[]).length);
  assert.match(installed,/e.created_at < \(\$\$\{params.length\}::date \+ interval '1 day'\)/);
});
test('production startup applies defaults after other server installers', () => {
  const start=require('../package.json').scripts.start;
  assert.match(start,/install-pool-error-handler.js && node install-reporting-date-defaults.js && node mca-marketplace-concept.js/);
});
