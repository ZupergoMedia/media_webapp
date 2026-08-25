import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { MapPin, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getOwnerSaleListings } from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { formatPaise } from "@/lib/format";
import { OwnerNav } from "../owner-nav";
import { SaleStatusControls } from "./sale-status-controls";

export const metadata: Metadata = {
  title: "My assets for sale",
  robots: { index: false, follow: false },
};

function statusTone(status: string): string {
  if (status === "PUBLISHED" || status === "SALE_AGREED" || status === "SOLD") {
    return "bg-success-subtle text-success";
  }
  if (status === "REJECTED" || status === "WITHDRAWN") {
    return "bg-danger-subtle text-danger";
  }
  if (status === "PAUSED") return "bg-warning-subtle text-warning";
  return "bg-surface-sunken text-muted-foreground";
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

/** Never prerendered — scoped to the signed-in partner. See asset pages for the same reasoning. */
export const dynamic = "force-dynamic";

export default async function OwnerSalesPage() {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) {
    return <OwnerAccessNotice error={ownerAuth.error} />;
  }

  const { owner } = ownerAuth;
  const listings = await getOwnerSaleListings(owner.id);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <OwnerNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My assets for sale</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {listings.length} {listings.length === 1 ? "listing" : "listings"}
            </p>
          </div>
          <Button asChild>
            <Link href="/owner/sales/new">
              <Plus className="size-4" />
              Put an asset up for sale
            </Link>
          </Button>
        </div>

        {listings.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <h2 className="text-base font-semibold">No sale listings yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Choose one of your existing assets and put it up for sale to reach
              investors, media companies and other buyers.
            </p>
            <Button asChild className="mt-4">
              <Link href="/owner/sales/new">Put an asset up for sale</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-start gap-4 rounded-card border border-border bg-surface p-4"
              >
                <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                  {listing.asset.images[0] ? (
                    <Image
                      src={listing.asset.images[0].url}
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
                    <h2 className="text-sm font-semibold">{listing.asset.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(listing.status)}`}
                    >
                      {statusLabel(listing.status)}
                    </span>
                  </div>

                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    {listing.publicCity ?? "Location not set"}
                  </p>

                  <p className="mt-1.5 text-sm font-medium tabular-nums">
                    {formatPaise(listing.askingPriceAmount)}
                    {listing.negotiable && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        Negotiable
                      </span>
                    )}
                  </p>

                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    {listing._count.enquiries} {listing._count.enquiries === 1 ? "enquiry" : "enquiries"}
                    {" · "}
                    {listing._count.offers} {listing._count.offers === 1 ? "offer" : "offers"}
                  </p>
                </div>

                <SaleStatusControls
                  saleListingId={listing.id}
                  slug={listing.slug}
                  status={listing.status}
                  syncState={listing.syncState}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
