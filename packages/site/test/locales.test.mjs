// Extension locales: all 8 required languages ship the 4 phrasing keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(siteDir, "..", "..", "extensions", "priceanchor", "locales");
const REQUIRED_KEYS = [
  "lowest_price_label",
  "previously_label",
  "sentence_prefix",
  "sentence_infix",
];

for (const file of [
  "en.default.json",
  "de.json",
  "fr.json",
  "es.json",
  "it.json",
  "nl.json",
  "pl.json",
  "sv.json",
]) {
  test(`locale ${file} has all phrasing keys`, () => {
    const parsed = JSON.parse(readFileSync(join(localesDir, file), "utf8"));
    assert.ok(parsed.priceanchor, `${file}: priceanchor section`);
    for (const key of REQUIRED_KEYS) {
      const value = parsed.priceanchor[key];
      assert.equal(typeof value, "string", `${file}: ${key} is a string`);
      assert.ok(value.length > 0, `${file}: ${key} non-empty`);
    }
  });
}
