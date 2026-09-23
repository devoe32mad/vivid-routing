/* Vivid attributed website visits. Install on the landing and tracked pages. */
(function () {
  "use strict";
  try {
    var script = document.currentScript;
    if (!script) return;
    var campaign = script.getAttribute("data-vivid-campaign");
    var pages = JSON.parse(script.getAttribute("data-vivid-pages") || "[]");
    if (!/^[1-9]\d*$/.test(campaign || "") || !Array.isArray(pages) || !pages.length || pages.length > 50) return;
    var key = "vivid:website:" + campaign;
    window.__vividWebsite = window.__vividWebsite || {};
    if (window.__vividWebsite[key]) return;
    window.__vividWebsite[key] = true;
    var now = Date.now(), maxAge = 24 * 60 * 60 * 1000;
    var validId = function (id) { return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); };
    var queryId = new URLSearchParams(window.location.search).get("vivid_click_id");
    var attribution = null;
    if (validId(queryId)) {
      attribution = { id: queryId, at: now };
      try { sessionStorage.setItem(key, JSON.stringify(attribution)); } catch (_) { /* Direct arrival can still be measured. */ }
    } else {
      try { attribution = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) { return; }
    }
    if (!attribution || !validId(attribution.id) || !Number.isFinite(attribution.at) || attribution.at > now || now - attribution.at >= maxAge) return;
    var normalize = function (path) { return path.replace(/\/+$/, "") || "/"; };
    var match = pages.find(function (p) { return p && typeof p.path === "string" && normalize(p.path) === normalize(window.location.pathname); });
    if (!match) return;
    // Never transmit query strings, fragments, page contents, or form fields.
    var endpoint = new URL("/website/page-visit", script.src).href;
    fetch(endpoint, {
      method: "POST", mode: "no-cors", credentials: "omit", keepalive: true,
      referrerPolicy: "no-referrer", headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        campaign_id: Number(campaign), vivid_click_id: attribution.id,
        page_url: window.location.origin + normalize(window.location.pathname),
        page_name: typeof match.label === "string" ? match.label.slice(0, 100) : normalize(window.location.pathname)
      })
    }).catch(function () { /* Analytics must not interrupt the advertiser site. */ });
  } catch (_) { /* Fail closed on malformed configuration. */ }
})();
