import { API_BASE } from "@/lib/api";
import { currentClinic } from "@/lib/clinic";

/**
 * Proxies the clinic's change stream to the browser.
 *
 * It exists because every other call in this app is made server-side: the API
 * requires a loopback `Host` and sends no CORS headers, so a browser cannot
 * reach it directly. A stream is the one thing a Server Component cannot
 * deliver — it has to stay open — so this route holds the connection and pipes
 * it through.
 *
 * The clinic comes from the session, never from the query string. That is the
 * same rule every page follows, and here it is what stops a browser asking for
 * another clinic's change stream by editing a URL.
 *
 * Nothing is buffered or transformed. `fetch` gives a `ReadableStream` and it
 * is returned as-is, so a notice reaches the browser as soon as the API emits
 * it rather than when a buffer fills.
 */
export const dynamic = "force-dynamic";

/** No timeout: the stream is meant to stay open, and the heartbeat keeps it so. */
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const clinic = await currentClinic();

  const upstream = new URL("/review/live", API_BASE);
  upstream.searchParams.set("clinic_id", clinic.id);

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: { Accept: "text/event-stream" },
      // Tied to the browser's connection: when the tab closes, this aborts and
      // the API discards the listener. Without it the backend would accumulate
      // queues nobody reads.
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    // The API is down or restarting. 503 rather than 500: the client's
    // EventSource will back off and retry, and the fallback refresh covers the
    // gap in the meantime.
    return new Response("upstream unavailable", { status: 503 });
  }

  if (!response.ok || response.body === null) {
    return new Response("upstream unavailable", { status: 503 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      // Repeated here because this response is the one a reverse proxy in
      // front of Next.js will see, and buffering it would hold every notice.
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
