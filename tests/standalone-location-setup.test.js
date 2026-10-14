const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../server.js'), 'utf8');
const start = source.indexOf('app.get(\n  "/admin/qr-setup-choice"');
const end = source.indexOf('app.get("/admin/import-qr"', start);
async function run(query, allowed) {
  let handler, calls = [];
  vm.runInNewContext(source.slice(start, end), {
    app: { get: (path, login, fn) => { handler = fn; } }, requireLogin() {},
    q: async (sql, params) => { calls.push({ sql, params }); return { rows: allowed ? [{ id: 22 }] : [] }; },
    page: (title, html) => html, console, escapeHtml: String
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, send(body) { this.body = body; return this; } };
  await handler({ query, session: { user: { id: 9, role: 'org_admin' } } }, res);
  return { res, calls };
}
test('owned standalone location accepts current and older redirect URLs', async () => {
  for (const id of [undefined, 'NaN', '0']) {
    const { res, calls } = await run({ space_id: '22', marketplace_request_id: id }, true);
    assert.equal(res.code, 200);
    assert.match(res.body, /new-qr\?space_id=22/);
    assert.match(res.body, /import-qr\?space_id=22/);
    assert.match(calls[0].sql, /user_id = \$2/);
    assert.equal(calls[0].params[1], 9);
    assert.equal(calls[0].params[2], false);
  }
});
test('other users locations remain inaccessible', async () => {
  assert.equal((await run({ space_id: '22' }, false)).res.code, 403);
});
test('real marketplace requests still require approved request authorization', async () => {
  const { res, calls } = await run({ space_id: '22', marketplace_request_id: '52' }, false);
  assert.equal(res.code, 403);
  assert.match(calls[0].sql, /ar.created_vivid_user_id = \$1/);
  assert.match(calls[0].sql, /ar.status = 'Approved'/);
});
test('invalid request and location identifiers are rejected', async () => {
  assert.equal((await run({ space_id: '22', marketplace_request_id: 'bad' }, true)).res.code, 400);
  assert.equal((await run({ space_id: '-1' }, true)).res.code, 400);
});
