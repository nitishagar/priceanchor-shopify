import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
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

  const userAgent = request.headers.get("user-agent");
  const waitForAll =
    (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

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

    // Bots and SPA mode wait for all content before responding.
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
