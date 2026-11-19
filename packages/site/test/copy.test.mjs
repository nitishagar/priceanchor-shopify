// Required copy per page + internal link integrity + no inline scripts (CSP).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "pricing.html", "support.html", "privacy.html"];
const bodies = Object.fromEntries(
  pages.map((p) => [p, readFileSync(join(siteDir, p), "utf8")]),
);

test("every page declares lang, viewport, title, and description", () => {
  for (const [page, html] of Object.entries(bodies)) {
    assert.ok(html.includes('<html lang="en"'), `${page}: lang`);
    assert.ok(html.includes('name="viewport"'), `${page}: viewport`);
    assert.ok(html.includes("<title>") && html.includes("PriceAnchor"), `${page}: title`);
    assert.ok(html.includes('name="description"'), `${page}: description`);
  }
});

test("index carries the pitch, demo, tiers, and honest constraints", () => {
  const html = bodies["index.html"];
  for (const needle of [
    "lowest price of the last 30 days",
    "demo-out",
    "engine/priceanchor.js",
    "demo-block",
    "$3.99",
    "$5.99",
    "compare-at",
    "per market",
  ]) {
    assert.ok(html.includes(needle), `index: ${needle}`);
  }
});

test("pricing tiers match the app billing ($3.99 Standard / $5.99 Unlimited)", () => {
  const html = bodies["pricing.html"];
  assert.ok(html.includes("Standard") && html.includes("$3.99"));
  assert.ok(html.includes("Unlimited") && html.includes("$5.99"));
  assert.ok(html.includes("7-day free trial"));
});

test("support page has setup steps, contact, and repo link", () => {
  const html = bodies["support.html"];
  assert.ok(html.includes("Lowest price"));
  assert.ok(html.includes("support@applair.in"));
  assert.ok(html.includes("github.com/nitishagar/priceanchor-shopify/issues"));
});

test("privacy page covers collection, retention, rights, and contact", () => {
  const html = bodies["privacy.html"];
  for (const needle of [
    "do not collect any customer data",
    "Retention",
    "Your rights",
    "privacy@applair.in",
  ]) {
    assert.ok(html.includes(needle), `privacy: ${needle}`);
  }
});

test("internal links and assets resolve to real files", () => {
  for (const [page, html] of Object.entries(bodies)) {
    const refs = [
      ...html.matchAll(/(?:href|src)="(\/[^"#"]*)"/g),
    ].map((m) => m[1]);
    assert.ok(refs.length > 0, `${page}: has refs`);
    for (const ref of refs) {
      const local = ref === "/" ? "/index.html" : ref;
      assert.ok(
        existsSync(join(siteDir, local)),
        `${page}: ${ref} resolves`,
      );
    }
  }
});

test("no inline scripts (CSP script-src 'self')", () => {
  for (const [page, html] of Object.entries(bodies)) {
    assert.ok(!html.includes("<script>"), `${page}: no inline <script>`);
    assert.ok(!html.includes("onclick="), `${page}: no inline handlers`);
  }
});
