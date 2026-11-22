# PriceAnchor submission ledger (remaining steps + Chromium execution)

Captured 2026-11-22. Companion to [SUBMISSION.md](SUBMISSION.md) (checklist)
and [LISTING.md](listing/LISTING.md) (submitted copy). The generic flow lives in
the Chromium submit playbook at `/home/nitish/repos/learn/thoughts/shared/chromium-submit-playbook.md`;
this file records the PriceAnchor-specific remainder and the exact CDP
techniques that worked here.

## 1. State snapshot

- Repo: `nitishagar/priceanchor-shopify`, branch `main` (see `git log` tip).
- App: PriceAnchor, client `98dff8002e6a1ba54876b421716e6958`, org SKI
  Developers (166941565 / partners 4284699), app id 449229455361.
- Extension: priceanchor-4 ★ active. Worker: latest Deploy green.
- Listing submission id `98dff8002e6a1ba54876b421716e6958` (== client_id):
  zero issues, automated checks PASSED, capabilities declared (none),
  AI self-review marked done.
- Managed Pricing: `standard` $3.99/mo + `unlimited` $5.99/mo, 7-day trials,
  dev-free. Handles match `app/services/billing/plan-mapping.ts`.
- Dev store: seo-generator, storefront password `owstem` (also in the
  listing's testing instructions). "Lowest price" block sits below Price on
  the Default product template; live line verified with hand-checked math.
- Org gate: DualUnit is Submitted (in review) → PriceAnchor shows
  "Submission limited". Submit for review is a verified no-op until that
  clears. Checked 3 consecutive turns.

## 2. Remaining steps (in order)

1. **Wait for the gate.** DualUnit's review must resolve (approved,
   published, or withdrawn). Nothing in this repo can clear it.
2. **Recheck the gate.** Partners → Apps → PriceAnchor → Distribution →
   App Store review. Proceed only when "Submission limited" is gone.
3. **Click Submit for review** on that page. Confirm any dialog. Record the
   resulting status (Submitted + timestamp) here and in SUBMISSION.md.
4. **Post-submit (same day).** Watch for reviewer messages; automated checks
   expire after 30 days — re-run if review drags past that.
5. **Post-publish.** Fill `APP_STORE_URL`-style store CTAs if any exist
   (pricing page links), per SUBMISSION.md §3.

## 3. Chromium execution guide

### 3.1 Launch (once per machine boot)

```bash
export DISPLAY=:0
setsid -f google-chrome --remote-debugging-port=9222 \
  --user-data-dir=/home/nitish/.config/google-chrome-priceanchor-submit \
  --no-first-run --new-window https://partners.shopify.com/organizations \
  </dev/null >>/tmp/chrome.log 2>&1
curl -s http://127.0.0.1:9222/json/version   # must return Browser JSON
```

- Login persists in the profile; Partners auth survived reboots here.
- `priceanchor-submit` tmux session holds Shopify CLI auth (keychain,
  `nitishagar@gmail.com`): `tmux capture-pane -p -t priceanchor-submit`.
- `gh` needs `export TMPDIR=<repo>/.tmp-gh` (sandbox /tmp quota workaround).

### 3.2 CDP client (`scripts/cdp.mjs`)

Ops (usage: `node scripts/cdp.mjs <op> [args...]`, `CDP_PORT` overrides 9222):

| op | use |
|---|---|
| `tabs` | list page + iframe targets; ALWAYS re-run before indexed ops |
| `nav <ref> <url>` | navigate (tab keeps id across navs; index may not) |
| `shot <ref> <png>` | 1.5s settle + screenshot; verify size with PIL after |
| `eval <ref> <js>` | single JS expression; prints JSON (see gotchas) |
| `tree <ref>` | frame tree for nested OOPIFs (theme preview) |
| `frameval <ref> <frameId> <js>` | eval inside a nested frame |
| `upload <ref> <idx> <files...>` | set files on file input (DOM-resolved; fixed Nov 22) |
| `win <ref> <w> <h>` | exact window bounds; `1624 1012` ⇒ 1600×900 viewport |
| `winpos <ref>` | window bounds JSON (for capture offsets) |
| `front <ref>` | bring tab to front (also shows the window to the user) |
| `type <ref> <text>` | trusted text into the FOCUSED element (see §3.4) |
| `key <ref> <Enter\|Tab\|Escape\|Arrows\|Space\|F11>` | trusted key (proper key codes) |
| `click <ref> <x> <y>` | trusted mouse click at viewport coords |
| `drag <ref> <x1> <y1> <x2> <y2>` | trusted drag (buttons:1 on moves) |
| `burst <ref> <frames> <ms> <dir>` | N JPEG viewport captures back-to-back |
| `cast <ref> <secs> <dir>` | Page.screencast frames (paint-gated; sparse on static pages) |

`<ref>` = numeric index into `tabs`, or id/URL substring. Pure-digit refs
are treated as indices — prefer id prefixes (stable) over indices (shift on
every tab open/close). Re-list after every nav/open.

### 3.3 eval gotchas (learned the hard way)

- Return the value as the LAST expression; a trailing `var`/`;` yields
  `undefined`. `var x=...; x` works, `var x=...;` alone does not.
- Attribute selectors with dots need quotes or filter form:
  `input[name="a.b.c"]` inside single-quoted shell breaks on `\"` — use
  `[...document.querySelectorAll("input")].filter(i=>i.name.includes("b.c"))`.
- React-ignored synthetic events: this portal's Polaris forms require
  `InputEvent`, NOT `new Event("input")`. Text/textarea pattern that
  persists (verified across reload):
  ```js
  var S = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value").set;   // HTMLTextAreaElement for <textarea>
  S.call(el, "value");
  el.dispatchEvent(new InputEvent("input",
    {bubbles: true, data: "value", inputType: "insertText"}));
  ```
- ALWAYS verify persistence: read back the field's character counter
  (React-state-backed, e.g. `8/18`) — DOM `.value` lies. Save, reload,
  re-read. That loop caught every silent loss in this submission.
- Comboboxes (Languages): the input may report a 0×0 rect and ignore all
  synthetic events. Coordinate-click the visible box to mount the popover,
  then click the option's checkbox via DOM (`input[type=checkbox]` found by
  ancestor text). Verify the chip, not the dropdown text.
- Coordinate clicks: screenshot pixels == viewport coords when the shot is
  viewport-sized (1600×900 shots ⇒ 1:1 mapping).
- Shopify admin price inputs: focus → native set → `input` + `change` →
  blur, then assert the "Unsaved changes" indicator BEFORE clicking Submit;
  fresh-reload and re-read the value after (direct `.value=` never persists).
- Multiple Chrome windows can exist (newtab may open a second window);
  `win`/`winpos` report per-window state — confirm which window a tab is in
  before coordinate work.

### 3.4 Trusted typing flow (complicated widgets)

1. `eval` to scroll + focus + select the field.
2. `type <ref> <text>` (trusted `Input.insertText`).
3. Screenshot to confirm the widget reacted (dropdown/filter/chips).
4. `click`/`key Enter` to commit; screenshot to confirm.

### 3.5 Recording (review screencast recipe)

- x11grab sees BLACK in this environment (no compositor capture) — do not
  waste time on it again. CDP `burst` is the working path.
- `burst <tab> <frames> <500> <dir>` ≈ 1.7fps effective; 420 frames ≈ 4 min
  wall. Start it with a SHORT `yield_time_ms` so it backgrounds, THEN drive
  the flow on that tab (a long yield blocks driving until it finishes).
- Assemble: `ffmpeg -framerate 2 -i frame-%04d.jpg -vf scale=1280:720
  -c:v libx264 -crf 24 -pix_fmt yuv420p out.mp4` (≈2fps, house spec).
- Verify with `-ss <t>` frame extracts at each scene before publishing.
- Publish: `public/videos/*.mp4` is copied to `build/client` by
  `react-router build` and served by Worker assets — verify with
  `curl -o /dev/null -w "%{http_code} %{content_type} %{size_download}"`.

### 3.6 The submit run (when the gate clears)

1. `tabs`, resolve the Partners tab (or `nav` one there).
2. Open `.../apps/449229455361/distribution/app-store`, confirm the
   "Submission limited" banner is GONE.
3. Click the "Submit for review" button; screenshot whatever dialog opens;
   confirm explicitly and record the new status + timestamp here.
4. Immediately verify the apps list row flips to Submitted.
