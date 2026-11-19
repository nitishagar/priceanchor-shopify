// The demo must run the exact shipped engine — byte parity, no forks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");

test("vendored engine is byte-identical to the theme extension source", () => {
  const shipped = readFileSync(
    join(siteDir, "..", "..", "extensions", "priceanchor", "assets", "priceanchor.js"),
    "utf8",
  );
  const vendored = readFileSync(join(siteDir, "engine", "priceanchor.js"), "utf8");
  assert.equal(vendored, shipped);
});
