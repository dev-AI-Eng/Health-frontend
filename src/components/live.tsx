"use client";

/**
 * Keeping a screen current without the receptionist pressing anything.
 *
 * Two mechanisms, deliberately both:
 *
 * **Server-sent events** are the real one. The server pushes a notice saying a
 * topic changed, and this asks Next.js to re-render the route — which re-reads
 * through the ordinary audited API route, so the notice never carries patient
 * data and never needs to.
 *
 * **A timed refresh** is the fallback, and it is not redundant. A corporate
 * proxy that strips `text/event-stream`, a browser tab the OS has throttled, a
 * network that drops the connection between heartbeats: in all of those the
 * stream is silently dead, and a screen that has quietly stopped updating is
 * worse than one that reloads every half minute. The fallback runs at a
 * deliberately slow interval so the two together cost little.
 *
 * `router.refresh()` rather than `location.reload()`: it re-runs the server
 * components and swaps the result in, so filters, scroll position and any open
 * dialog survive. A full reload would throw away a receptionist's place in a
 * list of ninety appointments every thirty seconds.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "cn";

/**
 * How long between fallback refreshes.
 *
 * 45 seconds, not 5. The API allows 60 requests a minute per client in
 * production and one dashboard render makes several, so a fast poll across a
 * clinic's open screens would spend that budget on requests where nothing
 * changed. When the stream is working this almost never fires.
 */
const FALLBACK_MS = 45_000;

/** Backoff after the stream drops, so a dead endpoint is not hammered. */
const RECONNECT_MS = 10_000;

export interface LiveLabels {
  live: string;
  polling: string;
  updated: string;
}

/**
 * Subscribes to the clinic's change stream and refreshes the route.
 *
 * Renders a small indicator rather than nothing, because a receptionist who
 * cannot tell whether the screen is current will refresh it herself — and then
 * the feature has not helped. Showing "live" or "checking every 45s" answers
 * the question before she asks it.
 */
export function LiveUpdates({ labels }: { labels: LiveLabels }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    let source: EventSource | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function open() {
      if (closed) return;
      // Same-origin: the Next.js route proxies to the API, so the browser
      // never talks to the backend directly and no CORS or token handling is
      // needed here.
      source = new EventSource("/api/live");

      source.addEventListener("ready", () => setConnected(true));
      source.addEventListener("changed", () => {
        setUpdatedAt(new Date());
        router.refresh();
      });
      source.onerror = () => {
        // EventSource retries on its own, but a server that is gone produces a
        // reconnect storm. Closing and backing off is calmer, and the fallback
        // refresh covers the gap.
        setConnected(false);
        source?.close();
        source = null;
        if (!closed) reconnect = setTimeout(open, RECONNECT_MS);
      };
    }

    open();
    const timer = setInterval(() => {
      router.refresh();
      setUpdatedAt(new Date());
    }, FALLBACK_MS);

    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      clearInterval(timer);
      source?.close();
    };
    // `router` is stable in the App Router, so this does not reopen the
    // stream on every render. An earlier version held it in a ref written
    // during render, which eslint correctly refused.
  }, [router]);

  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
      /* Announced politely: a status that interrupts a screen reader every
         time an appointment changes is a status that gets turned off. */
      aria-live="polite"
    >
      {connected ? (
        <Wifi className="size-3 shrink-0" />
      ) : (
        <WifiOff className="size-3 shrink-0" />
      )}
      <span className={cn(connected && "text-foreground")}>
        {connected ? labels.live : labels.polling}
      </span>
      {updatedAt ? (
        <>
          <RefreshCw className="size-3 shrink-0" />
          <span className="tabular-nums">
            {labels.updated} {updatedAt.toLocaleTimeString()}
          </span>
        </>
      ) : null}
    </span>
  );
}
