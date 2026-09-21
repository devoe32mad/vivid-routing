const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isInternalMarketplaceSession,
  resolvePublicMarketplaceRedirect
} = require("./public-marketplace-redirect");
const { install } = require("./install-public-marketplace-redirect");

test("installer is repeatable", () => {
  const source = 'const crypto = require("crypto");\napp.get(\n  "/org-marketplace",\n  async (req, res) => {\n    try {\n    }\n  }\n);';
  const once = install(source);
  assert.equal(install(once), once);
  assert.match(once, /resolvePublicMarketplaceRedirect/);
});

test("keeps organization and admin users on the internal marketplace", async () => {
  assert.equal(isInternalMarketplaceSession({ orgUser: { organization_id: 23 } }), true);
  assert.equal(isInternalMarketplaceSession({ user: { role: "super_admin" } }), true);
  const result = await resolvePublicMarketplaceRedirect(
    { session: { orgUser: { organization_id: 23 } }, query: {} },
    async () => { throw new Error("database should not be queried"); }
  );
  assert.equal(result, null);
});

test("redirects a public organization and location link to the safe advertiser view", async () => {
  const calls = [];
  const q = async (sql, params) => {
    calls.push(params);
    return calls.length === 1
      ? { rows: [{ slug: "saint-john-neumann-high-school-23" }] }
      : { rows: [{ id: 44 }] };
  };
  const result = await resolvePublicMarketplaceRedirect(
    { session: {}, query: { organization_id: "23", location_id: "44" } },
    q
  );
  assert.deepEqual(result, {
    status: 302,
    location: "/advertise/saint-john-neumann-high-school-23/location/44"
  });
  assert.deepEqual(calls, [[23], [44, 23]]);
});

test("never redirects a location that belongs to another organization", async () => {
  let call = 0;
  const q = async () => ++call === 1
    ? { rows: [{ slug: "school-23" }] }
    : { rows: [] };
  const result = await resolvePublicMarketplaceRedirect(
    { session: {}, query: { organization_id: "23", location_id: "99" } },
    q
  );
  assert.equal(result.location, "/advertise/school-23");
});

test("rejects missing or inactive organizations without querying unsafe IDs", async () => {
  const invalid = await resolvePublicMarketplaceRedirect(
    { session: {}, query: { organization_id: "nope" } },
    async () => { throw new Error("database should not be queried"); }
  );
  assert.equal(invalid.status, 400);

  const missing = await resolvePublicMarketplaceRedirect(
    { session: {}, query: { organization_id: "23" } },
    async () => ({ rows: [] })
  );
  assert.equal(missing.status, 404);
});
