import Link from "next/link";
import type { Metadata } from "next";
import { Inbox, Mail, Phone } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { getRequestsForOwner } from "@/server/services/request-service";
import { formatDate, formatPaise } from "@/lib/format";
import { RespondControls } from "./respond-controls";
import { OwnerNav } from "../owner-nav";

export const metadata: Metadata = {
  title: "Availability requests",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  REQUESTED: "bg-brand-subtle text-brand",
  VIEWED: "bg-warning-subtle text-warning",
  CONFIRMED: "bg-success-subtle text-success",
  DECLINED: "bg-danger-subtle text-danger",
  WITHDRAWN: "bg-surface-sunken text-muted-foreground",
  COMPLETED: "bg-surface-sunken text-muted-foreground",
};

/** Days since a request arrived, for the "waiting N days" prompt. */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export default async function OwnerRequestsPage() {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) return <OwnerAccessNotice error={ownerAuth.error} />;

  const { owner } = ownerAuth;
  const requests = await getRequestsForOwner(owner.id);

  const open = requests.filter(
    (request) => request.status === "REQUESTED" || request.status === "VIEWED",
  );

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <OwnerNav />

        <h1 className="text-2xl font-semibold tracking-tight">
          Availability requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Advertisers registering interest in your media. Confirm only after
          checking your own records — ZuperGo does not know what you have sold
          elsewhere. Amounts shown are indicative; you agree the final price
          with the advertiser directly.
        </p>

        {open.length > 0 && (
          <div className="mt-5 rounded-card border border-brand/30 bg-brand-subtle p-4">
            <p className="text-sm font-medium text-brand">
              {open.length} {open.length === 1 ? "request needs" : "requests need"} a
              response
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Advertisers are waiting to hear from you. A quick decline is more
              useful to them than silence.
            </p>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <Inbox
              className="mx-auto mb-3 size-7 text-subtle-foreground"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold">No requests yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              When advertisers find your verified media, their availability
              requests appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {requests.map((request) => {
              const item = request.items[0];
              const isOpen =
                request.status === "REQUESTED" || request.status === "VIEWED";
              const waiting = daysSince(request.createdAt);

              return (
                <li
                  key={request.id}
                  className="rounded-card border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/assets/${item?.asset.slug ?? ""}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {item?.asset.title ?? "Asset"}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            STATUS_TONE[request.status] ??
                            "bg-surface-sunken text-muted-foreground"
                          }`}
                        >
                          {request.status.toLowerCase()}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {item ? (
                          <>
                            {formatDate(item.startAt)} — {formatDate(item.endAt)}
                            {item.slotCount ? ` · ${item.slotCount} slots` : ""}
                          </>
                        ) : null}
                        <span className="mx-1.5">·</span>
                        {request.reference}
                      </p>

                      <p className="mt-1.5 text-sm">
                        {request.advertiser.name ?? request.advertiser.email}
                        {request.notes && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {request.notes}
                          </span>
                        )}
                      </p>

                      {/* The owner confirms off-platform, so contact details
                          are the most actionable thing on this row. */}
                      {isOpen && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {request.contactEmail && (
                            <a
                              href={`mailto:${request.contactEmail}?subject=${encodeURIComponent(
                                `Your ZuperGo request ${request.reference}`,
                              )}`}
                              className="flex items-center gap-1 underline underline-offset-4"
                            >
                              <Mail className="size-3" aria-hidden="true" />
                              {request.contactEmail}
                            </a>
                          )}
                          {request.contactPhone && (
                            <a
                              href={`tel:${request.contactPhone}`}
                              className="flex items-center gap-1 underline underline-offset-4"
                            >
                              <Phone className="size-3" aria-hidden="true" />
                              {request.contactPhone}
                            </a>
                          )}
                        </div>
                      )}

                      {isOpen && waiting >= 2 && (
                        <p className="mt-1.5 text-xs text-warning">
                          Waiting {waiting} days for your response
                        </p>
                      )}

                      {request.declineReason && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          You said: {request.declineReason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-medium tabular-nums">
                        {formatPaise(request.totalAmount)}
                      </p>
                      <p className="text-[11px] text-subtle-foreground">
                        estimated
                      </p>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 border-t border-border pt-3">
                      <RespondControls reference={request.reference} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
