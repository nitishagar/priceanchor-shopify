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
  console.error("usage: node cdp.mjs <op> [args...]  (tabs|newtab|nav|shot|eval|tree|frameval|upload|win|front|type|key)");
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
      await send(ws, "DOM.enable");
      const doc = await send(ws, "DOM.getDocument", { depth: 0 });
      const q = await send(ws, "DOM.querySelectorAll", {
        nodeId: doc.root.nodeId,
        selector: "input[type=file]",
      });
      if ((q.nodeIds || []).length <= Number(idx)) {
        throw new Error(`only ${(q.nodeIds || []).length} file inputs, wanted #${idx}`);
      }
      await send(ws, "DOM.setFileInputFiles", { nodeId: q.nodeIds[Number(idx)], files });
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
  case "winpos": {
    await withTarget(args[0], async (ws, t) => {
      const w = await send(ws, "Browser.getWindowForTarget", { targetId: t.id });
      console.log(JSON.stringify(w));
    });
    break;
  }
  case "front": {
    await withTarget(args[0], (ws) => send(ws, "Page.bringToFront"));
    console.log("front");
    break;
  }
  case "type": {
    const [ref, ...text] = args;
    await withTarget(ref, async (ws) => {
      await send(ws, "Input.insertText", { text: text.join(" ") });
      console.log("typed");
    });
    break;
  }
  case "click": {
    const [ref, x, y] = args;
    await withTarget(ref, async (ws) => {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send(ws, "Input.dispatchMouseEvent", {
          type,
          x: Number(x),
          y: Number(y),
          button: "left",
          clickCount: 1,
        });
      }
      console.log(`clicked ${x},${y}`);
    });
    break;
  }
  case "drag": {
    const [ref, x1, y1, x2, y2] = args;
    await withTarget(ref, async (ws) => {
      await send(ws, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: Number(x1),
        y: Number(y1),
        button: "left",
        clickCount: 1,
      });
      for (let i = 1; i <= 8; i += 1) {
        await send(ws, "Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: Number(x1) + ((Number(x2) - Number(x1)) * i) / 8,
          y: Number(y1) + ((Number(y2) - Number(y1)) * i) / 8,
          button: "left",
          buttons: 1,
        });
      }
      await send(ws, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: Number(x2),
        y: Number(y2),
        button: "left",
        clickCount: 1,
      });
      console.log(`dragged ${x1},${y1} -> ${x2},${y2}`);
    });
    break;
  }
  case "cast": {
    // cast <ref> <seconds> <outdir> — record JPEG frames via Page.screencast.
    const [ref, secs, outdir] = args;
    const { mkdirSync } = await import("node:fs");
    mkdirSync(outdir, { recursive: true });
    await withTarget(ref, async (ws) => {
      let n = 0;
      const onFrame = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.method === "Page.screencastFrame") {
          n += 1;
          writeFileSync(
            `${outdir}/frame-${String(n).padStart(4, "0")}.jpg`,
            Buffer.from(msg.params.data, "base64"),
          );
          ws.send(
            JSON.stringify({
              id: Math.floor(Math.random() * 1e9),
              method: "Page.screencastFrameAck",
              params: { sessionId: msg.params.sessionId },
            }),
          );
        }
      };
      ws.addEventListener("message", onFrame);
      await send(ws, "Page.startScreencast", {
        format: "jpeg",
        quality: 70,
        maxWidth: 1280,
        maxHeight: 720,
      });
      await sleep(Number(secs) * 1000);
      await send(ws, "Page.stopScreencast");
      ws.removeEventListener("message", onFrame);
      console.log(`cast: ${n} frames in ${outdir}`);
    });
    break;
  }
  case "burst": {
    // burst <ref> <frames> <intervalMs> <outdir> — N viewport captures back to back.
    const [ref, frames, intervalMs, outdir] = args;
    const { mkdirSync } = await import("node:fs");
    mkdirSync(outdir, { recursive: true });
    await withTarget(ref, async (ws) => {
      for (let i = 1; i <= Number(frames); i += 1) {
        const r = await send(ws, "Page.captureScreenshot", { format: "jpeg", quality: 75 });
        writeFileSync(
          `${outdir}/frame-${String(i).padStart(4, "0")}.jpg`,
          Buffer.from(r.data, "base64"),
        );
        await sleep(Number(intervalMs));
      }
      console.log(`burst: ${frames} frames in ${outdir}`);
    });
    break;
  }
  case "key": {
    const [ref, key] = args;
    const codes = {
      Enter: ["Enter", 13],
      Tab: ["Tab", 9],
      Escape: ["Escape", 27],
      F11: ["F11", 122],
      ArrowDown: ["ArrowDown", 40],
      ArrowUp: ["ArrowUp", 38],
      ArrowLeft: ["ArrowLeft", 37],
      ArrowRight: ["ArrowRight", 39],
      " ": ["Space", 32],
    };
    const [code, windowsVirtualKeyCode] = codes[key] || [key, 0];
    await withTarget(ref, async (ws) => {
      for (const type of ["rawKeyDown", "keyUp"]) {
        await send(ws, "Input.dispatchKeyEvent", {
          type,
          key,
          code,
          windowsVirtualKeyCode,
        });
      }
      console.log(`key ${key}`);
    });
    break;
  }
  default:
    console.error(`unknown op: ${op}`);
    process.exit(2);
}
