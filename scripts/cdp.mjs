#!/usr/bin/env node
// cdp.mjs — minimal Chrome DevTools Protocol client for the Chromium submit
// playbook (thoughts/shared/chromium-submit-playbook.md §2).
// Node 22+: global fetch/WebSocket, zero deps.
// Usage: node cdp.mjs <op> [args...]   (CDP_PORT env overrides 9222)
//   tabs                          list page/iframe targets
//   newtab <url>                  open URL in a new tab
//   nav <ref> <url>              navigate target
//   shot <ref> <png>             screenshot to file (1.5s settle first)
//   eval <ref> <js...>            evaluate JS, print JSON result
//   tree <ref>                    frame tree (ids + urls)
//   frameval <ref> <frameId> <js...>  evaluate inside a nested frame
//   upload <ref> <idx> <files...> set files on file input #idx
//   win <ref> <w> <h>            exact window bounds
//   front <ref>                   bring tab to front
// <ref> = numeric index into `tabs`, or id/url substring.
const PORT = process.env.CDP_PORT || 9222;
const BASE = `http://127.0.0.1:${PORT}`;

async function targets() {
  const list = await (await fetch(`${BASE}/json/list`)).json();
  return list.filter((t) => t.type === "page" || t.type === "iframe");
}

async function resolve(ref) {
  const ts = await targets();
  if (/^\d+$/.test(ref)) {
    const t = ts[Number(ref)];
    if (!t) throw new Error(`no target #${ref} (${ts.length} known)`);
    return t;
  }
  const t = ts.find((x) => x.id.includes(ref) || x.url.includes(ref));
  if (!t) throw new Error(`no target matching ${ref}`);
  return t;
}

function connect(url) {
  return new Promise((resolveWs, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolveWs(ws);
    ws.onerror = (e) => reject(new Error(`ws connect failed: ${e.message || e.type}`));
  });
}

async function send(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1e9);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 60000);
    const onMsg = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        if (msg.error) reject(new Error(`CDP ${method}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", onMsg);
  });
  ws.send(JSON.stringify({ id, method, params }));
  return done;
}

async function withTarget(ref, fn) {
  const t = await resolve(ref);
  const ws = await connect(t.webSocketDebuggerUrl);
  try {
    return await fn(ws, t);
  } finally {
    ws.close();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { writeFileSync } = await import("node:fs");

const [op, ...args] = process.argv.slice(2);
if (!op) {
  console.error("usage: node cdp.mjs <op> [args...]  (tabs|newtab|nav|shot|eval|tree|frameval|upload|win|front)");
  process.exit(2);
}

switch (op) {
  case "tabs": {
    const ts = await targets();
    ts.forEach((t, i) =>
      console.log(`${i} ${t.id.slice(0, 8)} ${t.type} ${(t.title || "").slice(0, 50)} :: ${t.url.slice(0, 120)}`),
    );
    break;
  }
  case "newtab": {
    const r = await fetch(`${BASE}/json/new?${encodeURIComponent(args[0])}`, { method: "PUT" });
    console.log(JSON.stringify(await r.json(), null, 1).slice(0, 500));
    break;
  }
  case "nav": {
    await withTarget(args[0], (ws) => send(ws, "Page.navigate", { url: args[1] }));
    console.log("navigated");
    break;
  }
  case "shot": {
    await sleep(1500);
    await withTarget(args[0], async (ws) => {
      const r = await send(ws, "Page.captureScreenshot", { format: "png" });
      writeFileSync(args[1], Buffer.from(r.data, "base64"));
      console.log(`wrote ${args[1]} (${r.data.length} b64 chars)`);
    });
    break;
  }
  case "eval": {
    await withTarget(args[0], async (ws) => {
      const r = await send(ws, "Runtime.evaluate", {
        expression: args.slice(1).join(" "),
        returnByValue: true,
        awaitPromise: true,
      });
      console.log(JSON.stringify(r.result?.value ?? r.result ?? r, null, 1).slice(0, 8000));
    });
    break;
  }
  case "tree": {
    await withTarget(args[0], async (ws) => {
      const r = await send(ws, "Page.getFrameTree");
      const walk = (f, d) => {
        console.log(`${" ".repeat(d)}${f.id.slice(0, 12)} ${f.mimeType || ""} ${(f.url || "").slice(0, 130)}`);
        (f.childFrames || []).forEach((c) => walk(c, d + 2));
      };
      walk(r.frameTree.frame, 0);
    });
    break;
  }
  case "frameval": {
    const [ref, frameId, ...js] = args;
    await withTarget(ref, async (ws) => {
      const world = await send(ws, "Page.createIsolatedWorld", {
        frameId,
        worldName: "cdp-mjs",
        grantUniversalAccess: true,
      });
      const r = await send(ws, "Runtime.evaluate", {
        expression: js.join(" "),
        contextId: world.executionContextId,
        returnByValue: true,
        awaitPromise: true,
      });
      console.log(JSON.stringify(r.result?.value ?? r.result ?? r, null, 1).slice(0, 8000));
    });
    break;
  }
  case "upload": {
    const [ref, idx, ...files] = args;
    await withTarget(ref, async (ws) => {
      const found = await send(ws, "Runtime.evaluate", {
        expression: `(() => { const els = [...document.querySelectorAll('input[type=file]')]; return els.length; })()`,
        returnByValue: true,
      });
      if (Number(found.result?.value || 0) <= Number(idx)) {
        throw new Error(`only ${found.result?.value} file inputs, wanted #${idx}`);
      }
      const obj = await send(ws, "Runtime.evaluate", {
        expression: `[...document.querySelectorAll('input[type=file]')][${idx}]`,
      });
      const desc = await send(ws, "DOM.describeNode", { objectId: obj.result.objectId });
      await send(ws, "DOM.setFileInputFiles", { nodeId: desc.node.nodeId, files });
      console.log(`set ${files.length} file(s) on input #${idx}`);
    });
    break;
  }
  case "win": {
    await withTarget(args[0], async (ws, t) => {
      const w = await send(ws, "Browser.getWindowForTarget", { targetId: t.id });
      await send(ws, "Browser.setWindowBounds", {
        windowId: w.windowId,
        bounds: { width: Number(args[1]), height: Number(args[2]) },
      });
      console.log(`window ${w.windowId} -> ${args[1]}x${args[2]}`);
    });
    break;
  }
  case "front": {
    await withTarget(args[0], (ws) => send(ws, "Page.bringToFront"));
    console.log("front");
    break;
  }
  default:
    console.error(`unknown op: ${op}`);
    process.exit(2);
}
