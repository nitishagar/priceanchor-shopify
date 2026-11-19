// Engine behavior: runs the shipped priceanchor.js in a minimal DOM stub
// (node:vm) and asserts EU/US rendering, localization parts, and hiding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineSrc = readFileSync(
  join(siteDir, "engine", "priceanchor.js"),
  "utf8",
);

function makeRoot(attrs) {
  const line = { textContent: "" };
  return {
    attrs: { ...attrs },
    line,
    querySelector(sel) {
      return sel === "[data-priceanchor-line]" ? line : null;
    },
    getAttribute(name) {
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
}

function runEngine(root) {
  const listeners = {};
  const documentStub = {
    readyState: "complete",
    querySelectorAll() {
      return [root];
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };
  const sandbox = { document: documentStub, Intl };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(engineSrc, sandbox, { filename: "priceanchor.js" });
  // init() runs synchronously (readyState complete). Re-render path:
  return { root, fireVariant: listeners["priceanchor:variant"] };
}

const PRIOR = JSON.stringify({
  lowestMinor: 1999,
  currency: "EUR",
  capturedAt: "2026-11-10T10:00:00.000Z",
  windowDays: 30,
});
const FORMER = JSON.stringify({
  lowestMinor: 1999,
  currency: "USD",
  lastOfferedAt: "2026-10-04T10:00:00.000Z",
  windowDays: 90,
});

test("EU mode renders the localized sentence with Aldi-rule percent", () => {
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-country": "DE",
      "data-price-minor": "1499",
      "data-currency": "EUR",
      "data-show-percent": "true",
      "data-l10n-prefix": "Lowest price in the last",
      "data-l10n-infix": "days",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "ready");
  assert.match(root.line.textContent, /Lowest price in the last 30 days:/);
  assert.match(root.line.textContent, /25%/);
});

test("EU mode honors translated sentence parts (German)", () => {
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-country": "DE",
      "data-price-minor": "1499",
      "data-currency": "EUR",
      "data-show-percent": "false",
      "data-l10n-prefix": "Niedrigster Preis der letzten",
      "data-l10n-infix": "Tage",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "ready");
  assert.match(root.line.textContent, /Niedrigster Preis der letzten 30 Tage:/);
  assert.doesNotMatch(root.line.textContent, /%/);
});

test("US mode renders Previously framing with last-offered month", () => {
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-former": FORMER,
      "data-country": "US",
      "data-price-minor": "1499",
      "data-currency": "USD",
      "data-show-percent": "true",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "ready");
  assert.match(root.line.textContent, /^Previously /);
  assert.match(root.line.textContent, /last offered Oct 2026/);
});

test("US mode omits the date clause when lastOfferedAt is missing", () => {
  const noDate = JSON.stringify({
    lowestMinor: 1999,
    currency: "USD",
    lastOfferedAt: null,
    windowDays: 90,
  });
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-former": noDate,
      "data-country": "us",
      "data-price-minor": "1499",
      "data-currency": "USD",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "ready");
  assert.match(root.line.textContent, /^Previously /);
  assert.doesNotMatch(root.line.textContent, /last offered/);
});

test("block hides when current price is not below the reference", () => {
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-country": "DE",
      "data-price-minor": "1999",
      "data-currency": "EUR",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "missing");
  assert.equal(root.line.textContent, "");
});

test("US block hides when no former-price payload exists", () => {
  const { root } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-country": "US",
      "data-price-minor": "1499",
      "data-currency": "USD",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "missing");
});

test("variant event updates the price and re-renders", () => {
  const { root, fireVariant } = runEngine(
    makeRoot({
      "data-prior": PRIOR,
      "data-country": "DE",
      "data-price-minor": "1999",
      "data-currency": "EUR",
      "data-l10n-prefix": "Lowest price in the last",
      "data-l10n-infix": "days",
    }),
  );
  assert.equal(root.attrs["data-priceanchor-state"], "missing");
  fireVariant({ detail: { priceMinor: 1499 } });
  assert.equal(root.attrs["data-priceanchor-state"], "ready");
  assert.match(root.line.textContent, /Lowest price in the last 30 days:/);
});
