"use strict";
const {AsyncLocalStorage} = require("node:async_hooks");
const {addMarketingReturn} = require("./marketing-return-navigation");
const previewContext = new AsyncLocalStorage();
const PREVIEW_EMAIL = "testtest@test.com";

// Use the authenticated login, never its display name, advertiser/customer ID,
// organization role, request parameters, or a saved platform-switch identity.
function canPreviewAiActor(actor) {
  return Boolean(actor?.id && (actor.role === "super_admin" ||
    String(actor.email || "").trim().toLowerCase() === PREVIEW_EMAIL));
}
function canPreviewAi(session, request = {}) {
  const actor = session?.orgUser || session?.user;
  // Opening an enterprise from Platform Admin keeps the admin session. Treat
  // that portal as a customer view, not as the private admin AI workspace.
  const enterpriseView = /^\/org-/i.test(String(request.path || ""));
  if (enterpriseView) {
    return Boolean(actor?.id &&
      String(actor.email || "").trim().toLowerCase() === PREVIEW_EMAIL);
  }
  return canPreviewAiActor(actor);
}
function aiPreviewEnabled() {
  return previewContext.getStore() === true;
}
function previewRenderer(render) {
  return function (...args) { return aiPreviewEnabled() ? render.apply(this, args) : ""; };
}
function isAiOnlyPath(value) {
  let path = String(value || "").split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { return false; }
  return /^\/(?:admin\/(?:ai-(?:readiness|campaign-operator|approval-center|campaign-draft)|weekly-ai-report)|org-(?:ai-(?:readiness|campaign-operator|approval-center|campaign-draft)|weekly-ai-report)|ai-priority-feedback)(?:\/|$)/i.test(path);
}
function withoutAiLinks(html) {
  // Shared legacy navigation is server-rendered. Remove whole anchors, including
  // nested icon/label spans, while retaining performance/reporting links.
  return html.replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/a\s*>/gi,
    (anchor, quote, href) => isAiOnlyPath(href) ? "" : anchor);
}
function aiPreviewMiddleware(req, res, next) {
  const allowed = canPreviewAi(req.session, req);
  if (!allowed && isAiOnlyPath(req.path)) return res.status(404).send("Not found.");
  res.locals.aiPreview = allowed;
  {
    const send = res.send;
    res.send = function(body) {
      const type = this.getHeader("Content-Type");
      if (typeof body === "string" && (!type || String(type).includes("text/html"))) {
        body = allowed ? addMarketingReturn(body, req) : withoutAiLinks(body);
      }
      return send.call(this, body);
    };
  }
  return previewContext.run(allowed, next);
}
module.exports = {PREVIEW_EMAIL,canPreviewAiActor,canPreviewAi,aiPreviewEnabled,previewRenderer,isAiOnlyPath,withoutAiLinks,aiPreviewMiddleware};
