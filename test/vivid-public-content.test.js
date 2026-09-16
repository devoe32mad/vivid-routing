"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { markdownToHtml } = require("../vivid-public-content");

test("renders headings, lists, links, and safe inline markup", () => {
  const html = markdownToHtml("## Test\n\n- One\n- Two\n\n[Source](https://example.com)\n\n<script>alert(1)</script>");
  assert.match(html, /<h2>Test<\/h2>/);
  assert.match(html, /<ul>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /<script>/);
});
