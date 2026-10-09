"use strict";
// Current inventory is independent of the historical reporting date window.
async function load(q, scope) {
  return q(
    `
      SELECT
        s.id AS space_id,
        s.name AS location_name,
        s.location AS market,

        qr.id AS qr_id,
        qr.name AS qr_name,

        COALESCE(
          qr.total_cost,
          qr.annual_cost,
          0
        )::numeric AS placement_value,

        c.id AS campaign_id,
        c.name AS campaign_name,
        c.advertiser,
        c.start_date,
        c.end_date,

        qc.started_at,
        qc.assigned_at,

        COUNT(e.id) FILTER (
          WHERE e.type = 'scan'
        )::int AS scans,

        COUNT(e.id) FILTER (
          WHERE e.type IN (
            'offer',
            'maps',
            'waze',
            'destination_click'
          )
        )::int AS intent,

        COUNT(e.id) FILTER (
          WHERE e.type = 'conversion'
        )::int AS conversions,

        COALESCE(
          SUM(e.value) FILTER (
            WHERE e.type = 'conversion'
          ),
          0
        )::numeric AS conversion_value

      FROM spaces s

      JOIN qr_codes qr
        ON qr.space_id = s.id
       AND COALESCE(
             qr.is_archived,
             false
           ) = false
       AND COALESCE(
             qr.is_active,
             true
           ) = true

JOIN (SELECT qr_id, campaign_id, MIN(started_at) AS started_at, MIN(assigned_at) AS assigned_at FROM qr_campaigns WHERE COALESCE(is_active, true) = true GROUP BY qr_id, campaign_id) qc
  ON qc.qr_id = qr.id

      JOIN campaigns c
        ON c.id = qc.campaign_id
       AND COALESCE(
             c.is_archived,
             false
           ) = false

      LEFT JOIN events e
        ON e.qr_id = qr.id
       AND e.campaign_id = c.id

      WHERE s.organization_id = $1
        AND s.id = ANY($2::int[])
        AND ($3::int IS NULL OR s.id = $3)

        AND COALESCE(
              s.is_archived,
              false
            ) = false

      

      GROUP BY
        s.id,
        s.name,
        s.location,

        qr.id,
        qr.name,
        qr.total_cost,
        qr.annual_cost,

        c.id,
        c.name,
        c.advertiser,
        c.start_date,
        c.end_date,

        qc.started_at,
        qc.assigned_at

      ORDER BY
        s.name,
        qr.name,
        c.name
    `,
    [scope.organizationId, scope.allowedLocationIds, scope.selectedLocationId]
  );

}
function summarize(rows) {
 const placements = new Map(rows.map(r => [Number(r.qr_id), Number(r.placement_value || 0)]));
 return {placements: placements.size, campaigns: new Set(rows.map(r => Number(r.campaign_id))).size, value: [...placements.values()].reduce((a,b)=>a+b,0)};
}
module.exports = {load, summarize};
