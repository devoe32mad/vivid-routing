"use strict";

// OpenAI Ads Pixel IDs are public browser identifiers, not API secrets.
// The environment override keeps the production account configurable without
// ever placing a Conversions API credential in client-visible code.
const DEFAULT_PIXEL_ID = "M4nGtoum4Sa558StMasb4d";

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pixelId(env = process.env) {
  return String(env.OPENAI_ADS_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
}

function renderOpenAiAdsPixel({ eventName = "page_viewed", data, env = process.env } = {}) {
  const id = pixelId(env);
  if (!id) return "";
  const eventData = data || (eventName === "page_viewed"
    ? { type: "contents", contents: [{ id: "vivid-campaign-builder", name: "Vivid campaign builder", content_type: "page" }] }
    : { type: "customer_action" });

  return `<script>
  (function(w,d,s,u){
    try {
      if(!w.oaiq){
        var q=function(){q.q.push(arguments);};
        q.q=[];w.oaiq=q;
        var js=d.createElement(s);js.async=true;js.src=u;
        var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(js,f);
      }
      w.oaiq("init",{pixelId:${safeJson(id)}});
      w.oaiq("measure",${safeJson(eventName)},${safeJson(eventData)});
    } catch (_) {}
  })(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");
  </script>`;
}

module.exports = { DEFAULT_PIXEL_ID, pixelId, renderOpenAiAdsPixel };
