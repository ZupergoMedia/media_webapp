"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Live countdown for a booking hold.
 *
 * Client-side for two reasons: reading the clock during a server render is
 * impure, and a server-computed figure would be frozen at render time — telling
 * someone "held for 28 more minutes" twenty minutes later is worse than showing
 * nothing. This ticks, and reports expiry when it reaches zero.
 */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  // null until mounted, so server and client HTML agree on first paint.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const tick = () => setRemainingMs(target - Date.now());
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (remainingMs === null) {
    return (
      <Panel tone="warning">
        <p className="text-sm font-medium text-warning">Inventory reserved</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The media partner is reviewing your request.
        </p>
      </Panel>
    );
  }

  if (remainingMs <= 0) {
    return (
      <Panel tone="danger">
        <p className="text-sm font-medium text-danger">This hold has expired</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The dates have been released back to the marketplace. You can book
          them again if they are still free.
        </p>
      </Panel>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <Panel tone="warning">
      <p className="text-sm font-medium text-warning">
        Held for{" "}
        <span className="tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        The media partner is reviewing your request. Inventory stays reserved
        until then, and is released automatically if the booking is not
        confirmed.
      </p>
    </Panel>
  );
}

function Panel({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "mt-6 flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning-subtle p-4"
          : "mt-6 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-4"
      }
    >
      <Clock
        className={
          tone === "warning"
            ? "mt-0.5 size-4 shrink-0 text-warning"
            : "mt-0.5 size-4 shrink-0 text-danger"
        }
        aria-hidden="true"
      />
      <div aria-live="polite">{children}</div>
    </div>
  );
}
