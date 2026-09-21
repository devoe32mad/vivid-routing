function isInternalMarketplaceSession(session = {}) {
  const role = String(session.user?.role || "").trim().toLowerCase();
  return ["super_admin", "admin"].includes(role) ||
    Number.isInteger(Number(session.orgUser?.organization_id));
}

async function resolvePublicMarketplaceRedirect(req, q) {
  if (isInternalMarketplaceSession(req.session)) return null;

  const organizationId = Number(req.query?.organization_id);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return { status: 400, message: "A valid organization is required." };
  }

  const organizationResult = await q(
    `SELECT slug FROM organizations
     WHERE id=$1 AND COALESCE(is_active,true)=true
     LIMIT 1`,
    [organizationId]
  );
  const slug = String(organizationResult.rows[0]?.slug || "").trim();
  if (!slug) {
    return { status: 404, message: "Advertising portal not found." };
  }

  let locationPath = "";
  const locationId = Number(req.query?.location_id);
  if (Number.isInteger(locationId) && locationId > 0) {
    const locationResult = await q(
      `SELECT id FROM spaces
       WHERE id=$1 AND organization_id=$2
         AND COALESCE(is_archived,false)=false
       LIMIT 1`,
      [locationId, organizationId]
    );
    if (locationResult.rows[0]) locationPath = `/location/${locationId}`;
  }

  const programId = Number(req.query?.program_id);
  const programQuery = locationPath && Number.isInteger(programId) && programId > 0
    ? `?program_id=${programId}`
    : "";

  return {
    status: 302,
    location: `/advertise/${encodeURIComponent(slug)}${locationPath}${programQuery}`
  };
}

module.exports = { isInternalMarketplaceSession, resolvePublicMarketplaceRedirect };
