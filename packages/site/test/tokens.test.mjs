// tokens.css must match the pi.dev oracle verbatim (values, not formatting).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(siteDir, "tokens.css"), "utf8");
const oracle = JSON.parse(
  readFileSync(join(siteDir, "vendor", "pi-web-tokens.json"), "utf8"),
);

function block(selectorStart) {
  const start = css.indexOf(selectorStart);
  assert.notEqual(start, -1, `missing block ${selectorStart}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

test("dark block matches oracle values", () => {
  const dark = block(":root {");
  for (const [name, value] of Object.entries(oracle.dark)) {
    assert.match(dark, new RegExp(`--${name}:\\s*${escapeReg(value)};`), name);
  }
});

test("light block matches oracle values", () => {
  const light = block(':root[data-theme="light"] {');
  for (const [name, value] of Object.entries(oracle.light)) {
    assert.match(light, new RegExp(`--${name}:\\s*${escapeReg(value)};`), name);
  }
});

test("font stacks match oracle", () => {
  const flat = css.replace(/\s+/g, " ");
  for (const [name, value] of Object.entries(oracle.fonts)) {
    const want = value.replace(/\s+/g, " ");
    assert.ok(
      flat.includes(`--${name}:`) && flat.includes(want),
      name,
    );
  }
});

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
