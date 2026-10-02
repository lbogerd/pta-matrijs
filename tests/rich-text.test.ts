import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRichText } from "../src/server/rich-text";

test("plain pasted text and browser div paragraphs become numbered-ready paragraphs", () => {
  assert.equal(
    normalizeRichText("First paragraph\n\nSecond paragraph"),
    "<p>First paragraph</p><p>Second paragraph</p>",
  );
  assert.equal(
    normalizeRichText("First<div>Second</div><div>Third<br>line</div>"),
    "<p>First</p><p>Second</p><p>Third<br />line</p>",
  );
  assert.equal(
    normalizeRichText("<div>Outer<div>Inner</div></div>"),
    "<p>Outer</p><p>Inner</p><p></p>",
  );
});
test("formatting, private images and lists survive and normalization is stable", () => {
  const input =
    '<p><b>Bold</b> and <i>italic</i></p><ul><li>First</li><li>Second</li></ul><img src="/api/files/abc-123" alt="A &amp; B">';
  const normalized = normalizeRichText(input);
  assert.match(normalized, /<strong>Bold<\/strong> and <em>italic<\/em>/);
  assert.match(normalized, /<ul><li>First<\/li><li>Second<\/li><\/ul>/);
  assert.match(normalized, /src="\/api\/files\/abc-123" alt="A &amp; B"/);
  assert.equal(normalizeRichText(normalized), normalized);
});
test("sanitization removes executable content, handlers and external image sources", () => {
  const normalized = normalizeRichText(
    '<div onclick="alert(1)">Safe<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><img src="https://evil.invalid/tracker"></div>',
  );
  assert.equal(normalized, '<p>Safe<img alt="" /><img alt="" /></p>');
  assert.equal(
    normalizeRichText("2 < 3 & 4 > 1"),
    "<p>2 &lt; 3 &amp; 4 &gt; 1</p>",
  );
});
