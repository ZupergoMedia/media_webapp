import Link from "next/link";
import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarCheck,
  CircleAlert,
  IndianRupee,
  LayoutGrid,
  Store,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { Button } from "@/components/ui/button";
import { getAdminMetrics } from "@/server/services/admin-service";
import { requireAdmin } from "@/server/auth/admin-guard";
import { formatPaise } from "@/lib/format";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Admin views are per-session and must never be prerendered or cached. */
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const metrics = await getAdminMetrics();

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Platform overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {auth.admin.email}
            </p>
          </div>

          {metrics.pendingAssets > 0 && (
            <Button asChild>
              <Link href="/admin/verifications">
                Review {metrics.pendingAssets} pending{" "}
                {metrics.pendingAssets === 1 ? "listing" : "listings"}
              </Link>
            </Button>
          )}
        </div>

        <AdminNav />

        {/* The queue is the admin's job, so it leads. */}
        {metrics.pendingAssets > 0 && (
          <Link
            href="/admin/verifications"
            className="mt-2 flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning-subtle p-4 transition-colors hover:border-warning/50"
          >
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-warning">
                {metrics.pendingAssets}{" "}
                {metrics.pendingAssets === 1 ? "listing is" : "listings are"}{" "}
                waiting for verification
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Listings stay invisible to advertisers until approved.
              </p>
            </div>
          </Link>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={LayoutGrid}
            label="Total assets"
            value={String(metrics.totalAssets)}
            hint={`${metrics.verifiedAssets} verified`}
          />
          <Metric
            icon={BadgeCheck}
            label="Pending verification"
            value={String(metrics.pendingAssets)}
            hint={metrics.rejectedAssets > 0 ? `${metrics.rejectedAssets} rejected` : "Queue clear"}
            tone={metrics.pendingAssets > 0 ? "warning" : undefined}
          />
          <Metric
            icon={CalendarCheck}
            label="Active bookings"
            value={String(metrics.activeBookings)}
            hint="Held and confirmed"
          />
          <Metric
            icon={IndianRupee}
            label="GMV"
            value={formatPaise(metrics.gmv)}
            hint="Confirmed bookings"
          />
          <Metric
            icon={Store}
            label="Media partners"
            value={String(metrics.owners)}
            hint={
              metrics.pendingOwners > 0
                ? `${metrics.pendingOwners} awaiting review`
                : "All reviewed"
            }
          />
          <Metric
            icon={Users}
            label="Advertisers"
            value={String(metrics.advertisers)}
            hint="Registered buyers"
          />
        </section>
      </main>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: "warning";
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        tone === "warning"
          ? "border-warning/30 bg-warning-subtle"
          : "border-border bg-surface"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-subtle-foreground">{hint}</p>
    </div>
  );
}
