"use strict";

const fs = require("fs");
const path = require("path");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdownToHtml(markdown) {
  const body = markdown
    .replace(/^# .*\n+/, "")
    .replace(/^\*\*Suggested URL:\*\*.*\n+/m, "")
    .replace(/^\*\*Meta title:\*\*.*\n+/m, "")
    .replace(/^\*\*Meta description:\*\*.*\n+/m, "");
  const lines = body.split(/\r?\n/);
  const output = [];
  let list = null;

  function closeList() {
    if (list) output.push(`</${list}>`);
    list = null;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      closeList();
      output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (/^\d+\. /.test(line)) {
      if (list !== "ol") { closeList(); list = "ol"; output.push("<ol>"); }
      output.push(`<li>${inlineMarkdown(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (line.startsWith("- ")) {
      if (list !== "ul") { closeList(); list = "ul"; output.push("<ul>"); }
      output.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else {
      closeList();
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  closeList();
  return output.join("\n");
}

function registerVividContentRoutes(app) {
  app.get("/insights/offline-advertising-attribution", (req, res) => {
    const source = fs.readFileSync(
      path.join(__dirname, "from-placement-to-revenue.md"),
      "utf8"
    );
    const article = markdownToHtml(source);
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline Advertising Attribution: From Placement to Revenue | Vivid Spots</title>
<meta name="description" content="Learn how to measure physical advertising from placement and QR scan through engagement, conversion, attributed value, ROI, and renewal.">
<link rel="canonical" href="https://vivid-routing-production.up.railway.app/insights/offline-advertising-attribution">
<style>body{margin:0;background:#f5f7fb;color:#17243a;font-family:Arial,sans-serif;line-height:1.65}.hero{background:#102b50;color:#fff;padding:64px 22px}.hero div,main{max-width:900px;margin:auto}.eyebrow{font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9dc0ee}.hero h1{font-size:clamp(36px,6vw,62px);line-height:1.08;margin:12px 0}.hero p{font-size:20px;color:#dce8f8}main{background:#fff;padding:46px clamp(22px,6vw,70px);margin-top:-24px;border-radius:18px;box-shadow:0 10px 40px #173b6b18}h2{margin-top:42px;color:#102b50;font-size:30px}h3{color:#173b6b;margin-top:28px}a{color:#165fad;font-weight:700}li{margin:7px 0}.cta{margin-top:46px;padding:25px;background:#eef5ff;border-radius:14px}.footer{text-align:center;padding:32px;color:#617086}@media(max-width:600px){.hero{padding:42px 18px}main{border-radius:0;padding:30px 20px;margin-top:0}}</style>
</head><body><header class="hero"><div><div class="eyebrow">Vivid Insights</div><h1>From Placement to Revenue</h1><p>A practical guide to offline advertising attribution</p></div></header><main>${article}</main><div class="footer">Vivid Spots · Physical advertising made measurable</div></body></html>`);
  });
}

module.exports = { markdownToHtml, registerVividContentRoutes };
