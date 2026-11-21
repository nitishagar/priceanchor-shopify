import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

// Web-stream server entry: runs identically in Node 20+ (`npm run build`)
// and Cloudflare Workers (no node:stream dependency). Mirrors the DualUnit
// entry: React Router's default entry defers part of the render into
// post-</html> chunks using the <template>/$RC pattern, and the $RC marker
// rewrite leaves a stray "$" text glyph in the live DOM (it overwrites a
// whitespace text node when the post-</html> markers are reparented).
// Rendering the whole tree through renderToReadableStream here keeps every
// chunk inline (<!--$--> markers) with no $RC splicing.
export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadContext: AppLoadContext,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  // Always wait for the full render (not just bots): React Router wraps the
  // server-handoff stream in <Suspense>, and any chunk that resolves after
  // the shell flush is emitted as a post-</html> <template>/$RC splice. The
  // $RC marker rewrite can land on a whitespace text node (Cloudflare
  // injects its beacon script before </body>), leaving a stray "$" glyph in
  // the live DOM. Loaders already ran before render, so allReady is ~free.
  const waitForAll = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), streamTimeout + 1000);

  try {
    const body = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    // Always buffer the full render (see above) before responding.
    if (waitForAll) {
      await (body as ReadableStream & { allReady?: Promise<void> }).allReady;
    }

    responseHeaders.set("Content-Type", "text/html");
    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
