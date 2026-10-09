"use strict";

module.exports = function installOrgInventoryHierarchy(
  app,
  {
    q,
    getOrganizationScope,
    marketplacePage,
    escapeHtml,
    money,
    statusBadge
  }
) {
  app.get("/org-marketplace", async (req, res) => {
    try {
      const scope = await getOrganizationScope(req);
      const organizationId = scope.organizationId;
      const allowedLocationIds = scope.allowedLocationIds;

      const orgResult = await q(
        "SELECT id,name,slug FROM organizations WHERE id=$1 AND COALESCE(is_active,true)=true LIMIT 1",
        [organizationId]
      );

      const organization = orgResult.rows[0];
      if (!organization) {
        return res.status(404).send("Organization not found.");
      }

      const programsResult = await q(
        "SELECT id,name FROM organization_programs WHERE organization_id=$1 AND COALESCE(is_active,true)=true ORDER BY display_order,name",
        [organizationId]
      );

      const programs = programsResult.rows;
      const requestedProgramId = Number(req.query.program_id);
      const selectedProgramId =
        Number.isInteger(requestedProgramId) &&
        requestedProgramId > 0 &&
        programs.some(p => Number(p.id) === requestedProgramId)
          ? requestedProgramId
          : null;

      const requestedLocationId = Number(req.query.location_id);
      const locationsResult = await q(
        "SELECT id,name,location,live_date FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false AND id=ANY($2::int[]) ORDER BY COALESCE(live_date,'9999-12-31'::date),name",
        [organizationId, allowedLocationIds]
      );
      const locations = locationsResult.rows;
      const selectedLocationId =
        Number.isInteger(requestedLocationId) &&
        requestedLocationId > 0 &&
        locations.some(l => Number(l.id) === requestedLocationId)
          ? requestedLocationId
          : null;

      const allowedStatuses = ["All","Available","Pending","Sold","Approved","Rejected","Closed"];
      const requestedStatus = String(req.query.status || "All").trim();
      const selectedStatus = allowedStatuses.includes(requestedStatus)
        ? requestedStatus
        : "All";

      // HFHS sold inventory follows placements activated through the marketplace.
      const inventoryStatus = organization.slug === "henry-ford-health-demo"
        ? `CASE WHEN LOWER(TRIM(oo.status)) IN ('sold','approved','closed') OR EXISTS (
            SELECT 1 FROM organization_advertising_requests ar
            JOIN qr_campaigns qc ON qc.qr_id=ar.created_qr_id
              AND qc.campaign_id=ar.created_campaign_id
              AND COALESCE(qc.is_active,true)=true
            JOIN campaigns c ON c.id=qc.campaign_id
              AND c.organization_id=ar.organization_id
              AND COALESCE(c.is_archived,false)=false
            JOIN qr_codes qr ON qr.id=qc.qr_id
              AND qr.space_id=oo.space_id
              AND COALESCE(qr.is_active,true)=true
              AND COALESCE(qr.is_archived,false)=false
            WHERE ar.organization_id=oo.organization_id
              AND ar.opportunity_id=oo.id
              AND ar.location_id=oo.space_id
              AND ar.status='Approved'
          ) THEN 'Sold' ELSE oo.status END`
        : "oo.status";

      const params = [organizationId, allowedLocationIds];
      let where = "";

      if (selectedProgramId) {
        params.push(selectedProgramId);
        where += " AND oo.program_id=$" + params.length;
      }

      if (selectedLocationId) {
        params.push(selectedLocationId);
        where += " AND oo.space_id=$" + params.length;
      }

      if (selectedStatus !== "All") {
        params.push(selectedStatus);
        where += " AND (" + inventoryStatus + ")=$" + params.length;
      }

      const opportunityResult = await q(
        "SELECT oo.id,oo.space_id,oo.program_id,oo.title,oo.description,oo.category,oo.price,oo.annual_price,oo.pricing_unit," + inventoryStatus + " AS status,oo.display_order,oo.photo_data IS NOT NULL AS has_photo,p.name AS program_name,s.name AS event_name,s.location AS event_location,s.live_date AS event_date FROM organization_opportunities oo JOIN spaces s ON s.id=oo.space_id AND s.organization_id=oo.organization_id LEFT JOIN organization_programs p ON p.id=oo.program_id AND p.organization_id=oo.organization_id WHERE oo.organization_id=$1 AND oo.space_id=ANY($2::int[]) AND COALESCE(oo.is_active,true)=true AND COALESCE(s.is_archived,false)=false" + where + " ORDER BY p.display_order,p.name,COALESCE(s.live_date,'9999-12-31'::date),s.name,oo.display_order,oo.title",
        params
      );

      const opportunities = opportunityResult.rows;

      const badge = status => {
        const value = String(status || "Available");
        const key = value.toLowerCase();
        let bg = "#DCFCE7";
        let color = "#166534";
        if (key === "pending") {
          bg = "#FEF3C7";
          color = "#92400E";
        } else if (key === "sold" || key === "approved" || key === "closed") {
          bg = "#FEE2E2";
          color = "#991B1B";
        }
        return '<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:' +
          bg + ';color:' + color + ';font-size:11px;font-weight:800;">' +
          escapeHtml(value) + '</span>';
      };

      const counts = items => {
        const out = {available:0,pending:0,sold:0};
        items.forEach(item => {
          const key = String(item.status || "Available").toLowerCase();
          if (key === "available") out.available += 1;
          else if (key === "pending") out.pending += 1;
          else if (key === "sold" || key === "approved" || key === "closed") out.sold += 1;
        });
        return out;
      };

      const revenueTotals = items => {
        const out = {
          available:0,
          pending:0,
          sold:0,
          total:0
        };

        items.forEach(item => {
          const value = Number(
            item.price ??
            item.annual_price ??
            0
          ) || 0;

          out.total += value;

          const key =
            String(
              item.status || "Available"
            )
              .trim()
              .toLowerCase();

          if (key === "available") {
            out.available += value;
          } else if (key === "pending") {
            out.pending += value;
          } else if (
            key === "sold" ||
            key === "approved" ||
            key === "closed"
          ) {
            out.sold += value;
          }
        });

        return out;
      };

      const statusSummary = c =>
        '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;">' +
        '<span style="background:#DCFCE7;color:#166534;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:bold;">' + c.available + ' Available</span>' +
        '<span style="background:#FEF3C7;color:#92400E;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:bold;">' + c.pending + ' Pending</span>' +
        '<span style="background:#FEE2E2;color:#991B1B;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:bold;">' + c.sold + ' Sold</span>' +
        '</div>';

      const revenueSummary = totals =>
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px;">' +
        '<div style="background:#f7faf6;border:1px solid #e4ece4;border-radius:10px;padding:9px;">' +
        '<div style="font-size:10px;color:#65776b;">Available Revenue</div>' +
        '<div style="font-size:14px;font-weight:bold;color:#166534;margin-top:3px;">' + money(totals.available) + '</div>' +
        '</div>' +
        '<div style="background:#fffaf0;border:1px solid #f4e4ba;border-radius:10px;padding:9px;">' +
        '<div style="font-size:10px;color:#65776b;">Pending Revenue</div>' +
        '<div style="font-size:14px;font-weight:bold;color:#92400E;margin-top:3px;">' + money(totals.pending) + '</div>' +
        '</div>' +
        '<div style="background:#fff5f5;border:1px solid #f3d6d6;border-radius:10px;padding:9px;">' +
        '<div style="font-size:10px;color:#65776b;">Sold Revenue</div>' +
        '<div style="font-size:14px;font-weight:bold;color:#991B1B;margin-top:3px;">' + money(totals.sold) + '</div>' +
        '</div>' +
        '<div style="background:#f4f7fa;border:1px solid #dfe4ea;border-radius:10px;padding:9px;">' +
        '<div style="font-size:10px;color:#65776b;">Total Inventory Value</div>' +
        '<div style="font-size:14px;font-weight:bold;color:#173f64;margin-top:3px;">' + money(totals.total) + '</div>' +
        '</div>' +
        '</div>';

      const queryStatus =
        selectedStatus !== "All"
          ? "&status=" + encodeURIComponent(selectedStatus)
          : "";

      const overallCounts =
        counts(opportunities);

      const overallRevenue =
        revenueTotals(opportunities);

      const topSummary =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:22px;">' +
        '<div class="marketplace-card" style="margin:0;border:1px solid #dfe8e0;">' +
        '<div style="font-size:11px;color:#65776b;">Available Revenue</div>' +
        '<div style="font-size:26px;font-weight:bold;color:#166534;margin-top:6px;">' + money(overallRevenue.available) + '</div>' +
        '<div style="font-size:12px;color:#65776b;margin-top:5px;">' + overallCounts.available + ' opportunities</div>' +
        '</div>' +
        '<div class="marketplace-card" style="margin:0;border:1px solid #eadfbd;">' +
        '<div style="font-size:11px;color:#65776b;">Pending Revenue</div>' +
        '<div style="font-size:26px;font-weight:bold;color:#92400E;margin-top:6px;">' + money(overallRevenue.pending) + '</div>' +
        '<div style="font-size:12px;color:#65776b;margin-top:5px;">' + overallCounts.pending + ' opportunities</div>' +
        '</div>' +
        '<div class="marketplace-card" style="margin:0;border:1px solid #ecd5d5;">' +
        '<div style="font-size:11px;color:#65776b;">Sold Revenue</div>' +
        '<div style="font-size:26px;font-weight:bold;color:#991B1B;margin-top:6px;">' + money(overallRevenue.sold) + '</div>' +
        '<div style="font-size:12px;color:#65776b;margin-top:5px;">' + overallCounts.sold + ' opportunities</div>' +
        '</div>' +
        '<div class="marketplace-card" style="margin:0;border:1px solid #dfe4ea;">' +
        '<div style="font-size:11px;color:#65776b;">Total Inventory Value</div>' +
        '<div style="font-size:26px;font-weight:bold;color:#173f64;margin-top:6px;">' + money(overallRevenue.total) + '</div>' +
        '<div style="font-size:12px;color:#65776b;margin-top:5px;">Current filtered view</div>' +
        '</div>' +
        '</div>';

      let heading = "Event Types";
      let subheading = "Choose a type of event to manage its events and sponsorship inventory.";
      let breadcrumb =
        '<strong style="color:#073b22;">Advertising Inventory</strong>';
      let cards = "";

      if (!selectedProgramId) {
        const groups = new Map();

        opportunities.forEach(item => {
          const key = Number(item.program_id || 0);
          if (!key) return;
          if (!groups.has(key)) {
            groups.set(key,{
              id:key,
              name:item.program_name || "Other",
              items:[]
            });
          }
          groups.get(key).items.push(item);
        });

        cards = Array.from(groups.values()).map(group => {
          const c = counts(group.items);
          const r = revenueTotals(group.items);
          const eventCount = new Set(group.items.map(x => Number(x.space_id))).size;
          const href =
            "/org-marketplace?organization_id=" +
            organizationId +
            "&program_id=" +
            group.id +
            queryStatus;

          return '<a href="' + href + '" style="text-decoration:none;color:inherit;">' +
            '<div class="marketplace-card" style="height:100%;border:1px solid #e1e9e2;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#65776b;font-weight:bold;">Event Type</div>' +
            '<h3 style="font-size:22px;margin:7px 0 8px;">' + escapeHtml(group.name) + '</h3>' +
            '<div style="color:#65776b;font-size:13px;">' +
            eventCount + ' event' + (eventCount === 1 ? '' : 's') +
            ' · ' + group.items.length + ' opportunit' + (group.items.length === 1 ? 'y' : 'ies') +
            '</div>' +
            statusSummary(c) +
            '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7a8b98;font-weight:bold;margin-top:14px;">Revenue Summary</div>' +
            revenueSummary(r) +
            '<div style="margin-top:18px;padding-top:13px;border-top:1px solid #e7eee7;color:#176b3a;font-size:12px;font-weight:bold;">View Events →</div>' +
            '</div></a>';
        }).join("");
      } else if (!selectedLocationId) {
        const selectedProgram = programs.find(p => Number(p.id) === selectedProgramId);
        heading = selectedProgram ? selectedProgram.name : "Events";
        subheading = "Choose an actual event to manage the sponsorship opportunities inside it.";
        breadcrumb =
          '<a href="/org-marketplace?organization_id=' + organizationId + '" style="color:#176b3a;text-decoration:none;font-weight:bold;">Advertising Inventory</a>' +
          '<span>›</span><strong style="color:#073b22;">' + escapeHtml(heading) + '</strong>';

        const groups = new Map();
        opportunities.forEach(item => {
          const key = Number(item.space_id || 0);
          if (!key) return;
          if (!groups.has(key)) {
            groups.set(key,{
              id:key,
              name:item.event_name || "Event",
              location:item.event_location || "",
              date:item.event_date || null,
              items:[]
            });
          }
          groups.get(key).items.push(item);
        });

        cards = Array.from(groups.values()).map(event => {
          const c = counts(event.items);
          const r = revenueTotals(event.items);
          const date = event.date
            ? new Date(event.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})
            : "";
          const href =
            "/org-marketplace?organization_id=" +
            organizationId +
            "&program_id=" +
            selectedProgramId +
            "&location_id=" +
            event.id +
            queryStatus;

          return '<a href="' + href + '" style="text-decoration:none;color:inherit;">' +
            '<div class="marketplace-card" style="height:100%;border:1px solid #e1e9e2;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#65776b;font-weight:bold;">Event</div>' +
            '<h3 style="font-size:22px;margin:7px 0 8px;">' + escapeHtml(event.name) + '</h3>' +
            (date ? '<div style="font-size:13px;color:#4f667b;margin-bottom:4px;">' + escapeHtml(date) + '</div>' : '') +
            (event.location ? '<div style="font-size:13px;color:#65776b;">' + escapeHtml(event.location) + '</div>' : '') +
            '<div style="color:#65776b;font-size:13px;margin-top:8px;">' + event.items.length + ' sponsorship opportunit' + (event.items.length === 1 ? 'y' : 'ies') + '</div>' +
            statusSummary(c) +
            '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7a8b98;font-weight:bold;margin-top:14px;">Revenue Summary</div>' +
            revenueSummary(r) +
            '<div style="margin-top:18px;padding-top:13px;border-top:1px solid #e7eee7;color:#176b3a;font-size:12px;font-weight:bold;">Manage Opportunities →</div>' +
            '</div></a>';
        }).join("");
      } else {
        const selectedProgram = programs.find(p => Number(p.id) === selectedProgramId);
        const selectedEvent = locations.find(l => Number(l.id) === selectedLocationId);
        heading = selectedEvent ? selectedEvent.name : "Sponsorship Opportunities";
        subheading = "Manage the sponsorship opportunities available for this event.";
        breadcrumb =
          '<a href="/org-marketplace?organization_id=' + organizationId + '" style="color:#176b3a;text-decoration:none;font-weight:bold;">Advertising Inventory</a>' +
          '<span>›</span>' +
          '<a href="/org-marketplace?organization_id=' + organizationId + '&program_id=' + selectedProgramId + '" style="color:#176b3a;text-decoration:none;font-weight:bold;">' +
          escapeHtml(selectedProgram ? selectedProgram.name : "Event Type") +
          '</a><span>›</span><strong style="color:#073b22;">' + escapeHtml(heading) + '</strong>';

        cards = opportunities.map(item => {
          const priceValue = Number(item.price ?? item.annual_price ?? 0);
          const priceText =
            priceValue > 0
              ? money(priceValue)
              : (item.pricing_unit || "Custom");

          return '<div class="marketplace-card" style="height:100%;">' +
            (item.has_photo
              ? '<img src="/org-opportunity/' + item.id + '/photo" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:16px;">'
              : '') +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#65776b;font-weight:bold;">Sponsorship Opportunity</div>' +
            '<h3 style="font-size:21px;margin:7px 0 9px;">' + escapeHtml(item.title) + '</h3>' +
            '<div style="font-size:14px;color:#65776b;line-height:1.5;min-height:42px;">' + escapeHtml(item.category || "") + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;">' +
            '<strong>' + escapeHtml(priceText) + '</strong>' + badge(item.status) +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid #e7eee7;">' +
            '<a class="marketplace-btn" href="/org-opportunity/edit/' + item.id + '?organization_id=' + organizationId + '" style="margin:0;padding:8px 12px;font-size:12px;">Edit Opportunity</a>' +
            '<form method="POST" action="/org-opportunity/duplicate/' + item.id + '" style="margin:0;" onsubmit="return confirm(\'Duplicate this opportunity?\');">' +
            '<input type="hidden" name="organization_id" value="' + organizationId + '">' +
            '<button class="marketplace-btn secondary" type="submit" style="margin:0;padding:8px 12px;font-size:12px;">Duplicate</button>' +
            '</form></div>' +
            '</div>';
        }).join("");
      }

      if (!cards) {
        cards =
          '<div class="marketplace-card"><h3 style="margin-top:0;">No Inventory</h3>' +
          '<p style="color:#65776b;margin-bottom:0;">No sponsorship inventory is available in this view.</p></div>';
      }

      const statusFilter = selectedLocationId
        ? '<nav aria-label="Filter sponsorship opportunities by status" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">' +
          ["All", "Available", "Pending", "Sold"].map(status => {
            const active = selectedStatus === status;
            const href = "/org-marketplace?organization_id=" + organizationId +
              (selectedProgramId ? "&program_id=" + selectedProgramId : "") +
              "&location_id=" + selectedLocationId +
              (status === "All" ? "" : "&status=" + encodeURIComponent(status));
            return '<a class="marketplace-btn' + (active ? '' : ' secondary') +
              '" href="' + escapeHtml(href) + '"' + (active ? ' aria-current="page"' : '') +
              ' style="margin:0;padding:8px 16px;">' + status + '</a>';
          }).join("") + '</nav>'
        : '';

      const publicLink = organization.slug
        ? '<a class="marketplace-btn secondary" target="_blank" rel="noopener noreferrer" href="/advertise/' +
          encodeURIComponent(organization.slug) +
          '">View Public Marketplace</a>'
        : '';

      const body =
        '<div class="marketplace-topbar">' +
        '<div class="marketplace-brand">Vivid Organizations</div>' +
        '<h1>Advertising Inventory</h1>' +
        '<p class="marketplace-subtitle">Manage inventory by event type, actual event, and sponsorship opportunity.</p>' +
        '</div>' +
        '<div class="marketplace-wrap">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:22px;">' +
        '<div><span class="marketplace-preview">Internal Management</span>' +
        '<h2 style="margin:0 0 6px;">' + escapeHtml(organization.name) + ' Advertising Inventory</h2></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<a class="marketplace-btn" href="/org-opportunity/new?organization_id=' + organizationId + '">+ Add Sponsorship</a>' +
        '<a class="marketplace-btn" href="/org-advertising-requests?organization_id=' + organizationId + '">Advertising Requests</a>' +
        publicLink +
        '<a class="marketplace-btn secondary" href="/org-organization/' + organizationId + '?organization_id=' + organizationId + '">Back to Overview</a>' +
        '</div></div>' +
        topSummary +
        '<div class="marketplace-card" style="margin-bottom:24px;">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px;">' + breadcrumb + '</div>' +
        '<h2 style="margin:0 0 6px;">' + escapeHtml(heading) + '</h2>' +
        '<div style="color:#65776b;line-height:1.5;margin-bottom:18px;">' + escapeHtml(subheading) + '</div>' +
        statusFilter +
        '<div class="marketplace-grid" style="margin:0;">' + cards + '</div>' +
        '</div>' +
        '<div class="marketplace-card">' +
        '<h2 style="margin:0 0 8px;">Inventory Status</h2>' +
        '<p style="color:#65776b;line-height:1.5;margin-top:0;">The same Available, Pending, and Sold status language is used internally and in the sponsor-facing marketplace.</p>' +
        '<div class="workflow-grid">' +
        '<div class="workflow-step">Event Type</div>' +
        '<div class="workflow-step">Actual Event</div>' +
        '<div class="workflow-step">Sponsorship Opportunity</div>' +
        '<div class="workflow-step">Sponsor Request</div>' +
        '<div class="workflow-step">Fulfillment</div>' +
        '<div class="workflow-step">Performance</div>' +
        '</div></div></div>';

      return res.send(
        marketplacePage(
          organization.name + " Advertising Inventory",
          body
        )
      );
    } catch (err) {
      console.error("ORG INVENTORY HIERARCHY ERROR:", err);
      return res.status(500).send(
        "Unable to load Advertising Inventory: " +
        err.message
      );
    }
  });
};
