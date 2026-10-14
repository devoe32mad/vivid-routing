# HEXPOL careers: ADP integration

Vivid campaign 88, Online Job Listings. Main QR 125 at Hexpol Career Site (location 148).

The main QR continues to send visitors to:
https://myjobs.adp.com/hexpolexternalcareersite/cx/job-listing

Vivid has 27 job Customer Actions, each labeled with job title, location and requisition number. The existing Visit Website action measures entry to the job board separately. Job actions measure redirects to individual jobs, not completed applications.

## ADP installation

1. Load this helper on the HEXPOL careers pages, including the first job-listing page:

```html
<script defer src="https://vivid-routing-production.up.railway.app/hexpol-careers/integration.js"></script>
```

2. At the beginning of ADP's existing job-title/job-card selection handler, call the helper with the job's internal reqId (or displayed requisition number):

```js
if (window.VividHexpolCareers &&
    window.VividHexpolCareers.openJob(job.reqId)) {
  event.preventDefault();
  return; // Stop the existing inline-detail handler for this click.
}
// Otherwise continue ADP's existing job-opening behavior.
```

ADP must adapt this example to its actual event handler. Loading the helper alone does not track clicks. Do not wire it to page rendering, hover, or both parent and child click handlers. Do not wire it to Apply: this setup measures job selection, not applications. Use trackingUrl(reqId) if ADP needs an href instead; it returns null for an unmapped job or an unattributed visitor. Call after the helper has loaded.

The helper remembers the vivid_click_id provided on the incoming URL in sessionStorage for up to 24 hours in the same tab. It sends an attributed job selection through Vivid, which records the Customer Action and redirects to that job's verified ADP share URL. Visitors without a valid Vivid click ID keep ADP's normal flow. ADP must permit this script in its content security policy and preserve the incoming vivid_click_id until the helper reads it. No applicant names, resumes, email addresses or application fields are sent.

If ADP implements this server-side, preserve vivid_click_id in the visitor's session and append it to the matching trackingUrl from the mapping. Do not request the tracking URL server-side or preload it: that would count a click. Navigate the browser only after the visitor selects that job.

## Mapping and verification

All 27 job URLs, public requisition numbers, internal reqIds, and Vivid tracking URLs:
https://vivid-routing-production.up.railway.app/hexpol-careers/jobs.json

Before release, ADP should test an actual QR visit, select one job, confirm the correct job detail opens, and confirm one click appears for that Customer Action in Vivid. Check a second selection retains attribution. Verify ordinary non-QR traffic remains unchanged. Test back navigation and a duplicated job title in another location. Testing real tracking links generates real events; do not bulk-open all links as a health check.

Vivid-side setup does not mean ADP installation is complete. ADP must install and verify its handler before QR-attributed job-selection reporting is operational. Completed applications require separate ADP integration. New or retired jobs require a mapping update; this is the set of 27 openings verified on October 14, 2026.
