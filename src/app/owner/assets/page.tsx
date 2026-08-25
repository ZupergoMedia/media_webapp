import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { MapPin, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getOwnerAssets } from "@/server/services/owner-service";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { formatPaise, formatLocation, pricingUnitSuffix } from "@/lib/format";
import { OwnerNav } from "../owner-nav";
import { AssetStatusControls } from "./asset-status-controls";

export const metadata: Metadata = {
  title: "Manage assets",
  robots: { index: false, follow: false },
};


/** Status pill colours — verification and listing status are separate concerns. */
function statusTone(status: string, verification: string): string {
  if (verification === "REJECTED" || verification === "SUSPENDED") {
    return "bg-danger-subtle text-danger";
  }
  if (verification === "PENDING") return "bg-warning-subtle text-warning";
  if (status === "ACTIVE") return "bg-success-subtle text-success";
  return "bg-surface-sunken text-muted-foreground";
}

function statusLabel(status: string, verification: string): string {
  if (verification === "PENDING") return "Pending verification";
  if (verification === "REJECTED") return "Rejected";
  if (verification === "SUSPENDED") return "Suspended";
  if (status === "ACTIVE") return "Live";
  if (status === "PAUSED") return "Paused";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Never prerendered.
 *
 * This page shows data scoped to the signed-in media partner. Static generation
 * would bake one account's figures into the build output and serve them to
 * everyone — a correctness bug now, and a data-leak once authentication lands.
 */
export const dynamic = "force-dynamic";

export default async function OwnerAssetsPage() {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) {
    return <OwnerAccessNotice error={ownerAuth.error} />;
  }

  const { owner } = ownerAuth;
  const assets = await getOwnerAssets(owner.id);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <OwnerNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your assets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {assets.length} {assets.length === 1 ? "listing" : "listings"}
            </p>
          </div>
          <Button asChild>
            <Link href="/owner/assets/new">
              <Plus className="size-4" />
              Add asset
            </Link>
          </Button>
        </div>

        {assets.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <h2 className="text-base font-semibold">No listings yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add your first asset to start receiving booking requests.
            </p>
            <Button asChild className="mt-4">
              <Link href="/owner/assets/new">Add your first asset</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-wrap items-start gap-4 rounded-card border border-border bg-surface p-4"
              >
                <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                  {asset.images[0] ? (
                    <Image
                      src={asset.images[0].url}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-subtle-foreground">
                      No photo
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{asset.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(
                        asset.status,
                        asset.verificationStatus,
                      )}`}
                    >
                      {statusLabel(asset.status, asset.verificationStatus)}
                    </span>
                  </div>

                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    {formatLocation({
                      locality: asset.location?.locality,
                      city: asset.location?.city,
                    })}
                    <span className="mx-1">·</span>
                    {asset.type.name}
                  </p>

                  <p className="mt-1.5 text-sm font-medium tabular-nums">
                    {asset.pricing[0]
                      ? `${formatPaise(asset.pricing[0].amount)}${pricingUnitSuffix(asset.pricing[0].unit)}`
                      : "No pricing set"}
                  </p>

                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    {asset._count.bookingItems}{" "}
                    {asset._count.bookingItems === 1 ? "booking" : "bookings"}
                  </p>
                </div>

                <AssetStatusControls
                  assetId={asset.id}
                  slug={asset.slug}
                  status={asset.status}
                  verificationStatus={asset.verificationStatus}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
