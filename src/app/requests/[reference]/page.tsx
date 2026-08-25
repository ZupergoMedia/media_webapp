import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Send,
  XCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import {
  countCompetingRequests,
  getRequestByReference,
} from "@/server/services/request-service";
import { getCurrentUser } from "@/server/auth";
import { formatDate, formatLocation, formatPaise } from "@/lib/format";
import { PricingDisclosure } from "@/components/marketplace/pricing-disclosure";
import { WithdrawRequestButton } from "./withdraw-button";

/** Contains buyer and owner contact details — never indexed. */
export const metadata: Metadata = {
  title: "Your request",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ reference: string }>;
}

export default async function RequestStatusPage({ params }: PageProps) {
  const { reference } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=/requests/${reference}`);

  const request = await getRequestByReference(reference, user);

  // A request that exists but belongs to someone else is reported as missing
  // rather than forbidden: confirming a reference is real would let an attacker
  // probe for valid ones.
  if (!request) notFound();

  const item = request.items[0];
  const owner = item?.asset.owner;

  const competing = item
    ? await countCompetingRequests(
        item.assetId,
        item.startAt,
        item.endAt,
        request.id,
      )
    : 0;

  const isOpen = request.status === "REQUESTED" || request.status === "VIEWED";
  const isMine = request.advertiserId === user.id;

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <StatusHeader status={request.status} reference={request.reference} />

        {/*
          The most important block on the page. An advertiser who leaves
          believing they have secured a billboard — when they have only asked
          about one — is the failure this whole redesign exists to prevent.
        */}
        {isOpen && (
          <div className="mt-6 rounded-card border border-border bg-surface-muted p-4">
            <p className="text-sm font-medium">What happens next</p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>
                1. {owner?.companyName ?? "The media partner"} checks whether these
                dates are genuinely free — they may have sold them through their
                own sales channels.
              </li>
              <li>
                2. They contact you directly by phone or email to confirm, or to
                suggest alternatives.
              </li>
              <li>
                3. Nothing is reserved and no payment is due until they confirm.
              </li>
            </ol>

            {competing > 0 && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {competing} other {competing === 1 ? "advertiser has" : "advertisers have"}{" "}
                asked about these dates. The owner decides who gets them.
              </p>
            )}
          </div>
        )}

        {request.status === "DECLINED" && request.declineReason && (
          <div className="mt-6 rounded-card border border-border bg-surface p-4">
            <p className="text-sm font-medium">
              Why {owner?.companyName ?? "the owner"} declined
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.declineReason}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/explore">Find similar media</Link>
            </Button>
          </div>
        )}

        {request.status === "CONFIRMED" && (
          <div className="mt-6 rounded-card border border-success/30 bg-success-subtle p-4">
            <p className="text-sm font-medium text-success">
              Confirmed by {owner?.companyName ?? "the media partner"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              These dates are now held for your campaign. The owner will be in
              touch about creative deadlines and payment.
            </p>
          </div>
        )}

        {/* Requested inventory */}
        <section className="mt-6 space-y-3">
          {request.items.map((line) => (
            <article
              key={line.id}
              className="flex gap-4 rounded-card border border-border bg-surface p-4"
            >
              {line.asset.images[0] && (
                <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                  <Image
                    src={line.asset.images[0].url}
                    alt={line.asset.title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <Link
                  href={`/assets/${line.asset.slug}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {line.asset.title}
                </Link>

                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden="true" />
                  {formatLocation({
                    locality: line.asset.location?.locality,
                    city: line.asset.location?.city,
                    areaLabel: line.asset.location?.areaLabel,
                  })}
                </p>

                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" aria-hidden="true" />
                  {formatDate(line.startAt)} — {formatDate(line.endAt)}
                  {line.slotCount ? ` · ${line.slotCount} slots per loop` : ""}
                </p>
              </div>
            </article>
          ))}
        </section>

        {/* Owner contact — the actual next step for the advertiser. */}
        {owner && isMine && (
          <section className="mt-6 rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">
              Contact {owner.companyName}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You can reach out directly rather than waiting.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {owner.contactEmail && (
                <a
                  href={`mailto:${owner.contactEmail}?subject=${encodeURIComponent(
                    `ZuperGo request ${request.reference}`,
                  )}`}
                  className="flex items-center gap-1.5 underline underline-offset-4"
                >
                  <Mail className="size-3.5" aria-hidden="true" />
                  {owner.contactEmail}
                </a>
              )}
              {owner.contactPhone && (
                <a
                  href={`tel:${owner.contactPhone}`}
                  className="flex items-center gap-1.5 underline underline-offset-4"
                >
                  <Phone className="size-3.5" aria-hidden="true" />
                  {owner.contactPhone}
                </a>
              )}
            </div>
          </section>
        )}

        {/* Estimate, never presented as a total due. */}
        <dl className="mt-6 space-y-1.5 rounded-card border border-border bg-surface p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Estimated subtotal</dt>
            <dd className="tabular-nums">{formatPaise(request.subtotalAmount)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>GST (estimated)</dt>
            <dd className="tabular-nums">{formatPaise(request.taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd className="tabular-nums">{formatPaise(request.totalAmount)}</dd>
          </div>
          <PricingDisclosure variant="compact" className="pt-1" />
        </dl>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/explore">Continue browsing</Link>
          </Button>
          {isMine && isOpen && (
            <WithdrawRequestButton reference={request.reference} />
          )}
        </div>
      </main>
    </>
  );
}

function StatusHeader({
  status,
  reference,
}: {
  status: string;
  reference: string;
}) {
  const config: Record<
    string,
    { icon: typeof Send; tone: string; title: string; subtitle: string }
  > = {
    REQUESTED: {
      icon: Send,
      tone: "bg-brand-subtle text-brand",
      title: "Request sent",
      subtitle: "Waiting for the media partner to respond.",
    },
    VIEWED: {
      icon: Clock,
      tone: "bg-warning-subtle text-warning",
      title: "Request seen",
      subtitle: "The owner has opened your request.",
    },
    CONFIRMED: {
      icon: CheckCircle2,
      tone: "bg-success-subtle text-success",
      title: "Availability confirmed",
      subtitle: "The owner has confirmed these dates.",
    },
    DECLINED: {
      icon: XCircle,
      tone: "bg-danger-subtle text-danger",
      title: "Request declined",
      subtitle: "The owner cannot fulfil these dates.",
    },
    WITHDRAWN: {
      icon: XCircle,
      tone: "bg-surface-sunken text-muted-foreground",
      title: "Request withdrawn",
      subtitle: "You cancelled this request.",
    },
    COMPLETED: {
      icon: CheckCircle2,
      tone: "bg-success-subtle text-success",
      title: "Campaign complete",
      subtitle: "This campaign has run.",
    },
  };

  const entry = config[status] ?? config.REQUESTED;
  const Icon = entry.icon;

  return (
    <div className="text-center">
      <span
        className={`mx-auto flex size-12 items-center justify-center rounded-full ${entry.tone}`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {entry.title}
      </h1>
      <p className="mt-1.5 text-muted-foreground">{entry.subtitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Reference <span className="font-medium text-foreground">{reference}</span>
      </p>
    </div>
  );
}
