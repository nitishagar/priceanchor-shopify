// Site build: vendor the exact storefront engine + stamp the version.
// The demo must run the shipped file, never a fork — byte parity is enforced
// here and re-checked by test/engine-parity.test.mjs.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineSrc = join(siteDir, "..", "..", "extensions", "priceanchor", "assets", "priceanchor.js");
const engineDst = join(siteDir, "engine", "priceanchor.js");

copyFileSync(engineSrc, engineDst);

const bytes = readFileSync(engineDst);
const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
const pkg = JSON.parse(readFileSync(join(siteDir, "package.json"), "utf8"));
writeFileSync(
  join(siteDir, "version.json"),
  JSON.stringify({ site: pkg.version, engine_sha12: sha }, null, 2) + "\n",
);
console.log(`site build: engine vendored (${bytes.length} bytes, sha12 ${sha})`);
