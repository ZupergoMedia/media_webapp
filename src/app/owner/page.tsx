import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  IndianRupee,
  LayoutGrid,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getOwnerAssets, getOwnerDashboard } from "@/server/services/owner-service";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { formatLocation, formatPaise, pricingUnitSuffix } from "@/lib/format";
import { OwnerNav } from "./owner-nav";

export const metadata: Metadata = {
  title: "Partner dashboard",
  robots: { index: false, follow: false },
};


/**
 * Never prerendered.
 *
 * This page shows data scoped to the signed-in media partner. Static generation
 * would bake one account's figures into the build output and serve them to
 * everyone — a correctness bug now, and a data-leak once authentication lands.
 */
export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const ownerAuth = await requireOwner();

  if (!ownerAuth.ok) {
    return <OwnerAccessNotice error={ownerAuth.error} />;
  }

  const { owner } = ownerAuth;
  const [metrics, assets] = await Promise.all([
    getOwnerDashboard(owner.id),
    getOwnerAssets(owner.id),
  ]);

  // The dashboard is the hub, so listings appear here rather than behind
  // another click. Capped, with a link through to the full list.
  const recentAssets = assets.slice(0, 6);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <OwnerNav />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {owner.companyName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {owner.verificationStatus === "VERIFIED" ? (
                <>
                  <BadgeCheck className="size-4 text-success" aria-hidden="true" />
                  Verified media partner
                </>
              ) : (
                "Verification pending"
              )}
            </p>
          </div>

          {/*
            The partner's three jobs, together and above the fold. These were
            previously stranded below the listings, where a partner had to
            scroll past their own inventory to find them.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/owner/assets">Manage all media</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/owner/requests">
                View requests
                {metrics.upcomingBookings > 0
                  ? ` (${metrics.upcomingBookings})`
                  : ""}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/owner/assets/new">
                <Plus className="size-4" />
                Add asset
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/owner/sales">Assets for sale</Link>
            </Button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={LayoutGrid}
            label="Total assets"
            value={String(metrics.totalAssets)}
            hint={`${metrics.activeAssets} live in search`}
          />
          <MetricCard
            icon={BadgeCheck}
            label="Pending verification"
            value={String(metrics.pendingVerification)}
            hint={
              metrics.pendingVerification > 0
                ? "Awaiting admin review"
                : "Nothing waiting"
            }
          />
          <MetricCard
            icon={CalendarClock}
            label="Confirmed campaigns"
            value={String(metrics.upcomingBookings)}
            hint="Dates you have confirmed"
          />
          <MetricCard
            icon={IndianRupee}
            label="Revenue"
            value={formatPaise(metrics.revenue)}
            hint="From confirmed bookings"
          />
          <MetricCard
            icon={TrendingUp}
            label="Occupancy"
            value={`${metrics.occupancyRate}%`}
            hint="Next 90 days"
          />
        </section>

        {metrics.totalAssets === 0 && (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-10 text-center">
            <h2 className="text-base font-semibold">List your first asset</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add a billboard, screen, vehicle or venue space and reach
              advertisers searching for inventory like yours.
            </p>
            <Button asChild className="mt-4">
              <Link href="/owner/assets/new">Add your first asset</Link>
            </Button>
          </div>
        )}

        {/* Listings, inline — managing media is why a partner is here. */}
        {assets.length > 0 && (
          <section className="mt-8" aria-labelledby="listings-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2
                id="listings-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Your media
              </h2>
              {assets.length > recentAssets.length && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/owner/assets">
                    View all {assets.length}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>

            <ul className="space-y-2">
              {recentAssets.map((asset) => (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3"
                >
                  <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                    {asset.images[0] ? (
                      <Image
                        src={asset.images[0].url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-subtle-foreground">
                        No photo
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{asset.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(
                          asset.status,
                          asset.verificationStatus,
                        )}`}
                      >
                        {statusLabel(asset.status, asset.verificationStatus)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLocation({
                        locality: asset.location?.locality,
                        city: asset.location?.city,
                      })}
                      <span className="mx-1.5">·</span>
                      {asset.type.name}
                      {asset.pricing[0] && (
                        <>
                          <span className="mx-1.5">·</span>
                          {formatPaise(asset.pricing[0].amount)}
                          {pricingUnitSuffix(asset.pricing[0].unit)}
                        </>
                      )}
                    </p>
                  </div>

                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/owner/assets/${asset.id}/edit`}>Edit</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

      </main>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-subtle-foreground">{hint}</p>
    </div>
  );
}

/** Verification and listing status are separate concerns; this merges them. */
function statusTone(status: string, verification: string): string {
  if (verification === "REJECTED" || verification === "SUSPENDED") {
    return "bg-danger-subtle text-danger";
  }
  if (verification === "PENDING") return "bg-warning-subtle text-warning";
  if (status === "ACTIVE") return "bg-success-subtle text-success";
  return "bg-surface-sunken text-muted-foreground";
}

function statusLabel(status: string, verification: string): string {
  if (verification === "PENDING") return "Pending review";
  if (verification === "REJECTED") return "Rejected";
  if (verification === "SUSPENDED") return "Suspended";
  if (status === "ACTIVE") return "Live";
  if (status === "PAUSED") return "Paused";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
