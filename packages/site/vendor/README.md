# Vendored pi.dev oracles (fetched 2026-11-13, via mcp-audit-platform)

- `pi-dark.json` / `pi-light.json`: pi TUI theme JSONs (motif oracle: `$`
  prompts, terminal chrome). Source:
  `https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/{dark,light}.json`
- `pi-web-tokens.json`: pi.dev WEBSITE CSS variables, verbatim. `tokens.css`
  must match these exactly (see `test/tokens.test.mjs`). Source:
  `https://pi.dev/style.css`.

Why the website values, not the TUI `okhsl()` values? `okhsl()` is not valid
CSS — browsers cannot parse it. The website variables are the same brand
system in browser-valid form.
