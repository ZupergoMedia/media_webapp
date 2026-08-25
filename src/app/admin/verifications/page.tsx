import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { CheckCircle2, MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth/admin-guard";
import { getVerificationQueue } from "@/server/services/admin-service";
import { formatDate, formatLocation, formatPaise, pricingUnitSuffix } from "@/lib/format";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = {
  title: "Verification queue",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Status = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

const FILTERS: Array<{ value: Status; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const params = await searchParams;
  const status = (FILTERS.find((f) => f.value === params.status)?.value ??
    "PENDING") as Status;

  const queue = await getVerificationQueue(status);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Verification queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listings are invisible to advertisers until approved.
        </p>

        <AdminNav />

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={`/admin/verifications?status=${filter.value}`}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                status === filter.value
                  ? "bg-foreground text-background"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {queue.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <CheckCircle2
              className="mx-auto mb-3 size-7 text-success"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold">
              {status === "PENDING" ? "Queue is clear" : `No ${status.toLowerCase()} listings`}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {status === "PENDING"
                ? "Every submitted listing has been reviewed."
                : "Nothing to show for this filter."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {queue.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-wrap items-start gap-4 rounded-card border border-border bg-surface p-4"
              >
                <div className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                  {asset.images[0] ? (
                    <Image
                      src={asset.images[0].url}
                      alt=""
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-subtle-foreground">
                      No photo
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">{asset.title}</h2>

                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    {formatLocation({
                      locality: asset.location?.locality,
                      city: asset.location?.city,
                      areaLabel: asset.location?.areaLabel,
                    })}
                    <span className="mx-1">·</span>
                    {asset.type.name}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {asset.owner.companyName}
                    {asset.owner.verificationStatus !== "VERIFIED" && (
                      <span className="ml-1.5 rounded bg-warning-subtle px-1.5 py-0.5 text-[11px] text-warning">
                        owner unverified
                      </span>
                    )}
                  </p>

                  <p className="mt-1.5 text-sm font-medium tabular-nums">
                    {asset.pricing[0]
                      ? `${formatPaise(asset.pricing[0].amount)}${pricingUnitSuffix(asset.pricing[0].unit)}`
                      : "No pricing"}
                  </p>

                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    Submitted {formatDate(asset.createdAt)} ·{" "}
                    {asset.images.length}{" "}
                    {asset.images.length === 1 ? "photo" : "photos"}
                    {asset.location?.lat == null && (
                      <span className="ml-1.5 text-warning">· no coordinates</span>
                    )}
                  </p>
                </div>

                <Button asChild variant="secondary" size="sm">
                  <Link href={`/admin/verifications/${asset.id}`}>Inspect</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
