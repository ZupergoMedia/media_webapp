import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { SaleListingSummary } from "@/server/services/sale-listing-service";
import { formatPaise } from "@/lib/format";
import { SALE_OWNERSHIP_TYPE_LABELS } from "@/lib/sale-schema";
import { citySlug } from "@/lib/sale-routes";
import { cn } from "@/lib/utils";
import { SellerDeclaredBadge } from "./seller-declared-badge";

/**
 * Sale marketplace card, mirroring asset-card.tsx's structure.
 *
 * No "Verified" badge appears here or anywhere on the sale surface — this
 * pass auto-publishes with no admin review, so nothing has actually been
 * verified yet. See sale-trust.ts.
 */
export function SaleListingCard({
  listing,
  className,
  priority = false,
}: {
  listing: SaleListingSummary;
  className?: string;
  priority?: boolean;
}) {
  const href = listing.city
    ? `/assets-for-sale/${citySlug(listing.city)}/${listing.slug}`
    : `/assets-for-sale/listing/${listing.slug}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-subtle-foreground">
            No image
          </div>
        )}

        <SellerDeclaredBadge
          size="sm"
          className="absolute left-3 top-3 bg-surface/95 shadow-sm backdrop-blur-[2px]"
        />

        {listing.negotiable && (
          <span className="absolute right-3 top-3 rounded-full bg-highlight px-2 py-0.5 text-[11px] font-medium text-white">
            Negotiable
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          <Link href={href} className="after:absolute after:inset-0">
            {listing.title}
          </Link>
        </h3>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {listing.locality ? `${listing.locality}, ` : ""}
            {listing.city ?? "Location on request"}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-medium text-foreground">
            {listing.typeName}
          </span>
          <span>
            {SALE_OWNERSHIP_TYPE_LABELS[
              listing.ownershipType as keyof typeof SALE_OWNERSHIP_TYPE_LABELS
            ] ?? listing.ownershipType}
          </span>
        </div>

        <div className="mt-auto pt-2">
          <p className="text-base font-semibold tabular-nums text-foreground">
            {formatPaise(listing.askingPriceAmount)}
          </p>
          {listing.currentAnnualRevenue !== null ? (
            <p className="text-xs text-muted-foreground">
              {formatPaise(listing.currentAnnualRevenue)}/year revenue
            </p>
          ) : (
            <p className="text-xs text-subtle-foreground">Revenue not disclosed by seller</p>
          )}
        </div>
      </div>
    </article>
  );
}

/** Matching skeleton, mirroring AssetCardSkeleton. */
export function SaleListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="aspect-[4/3] animate-pulse bg-surface-sunken" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-sunken" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-sunken" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-surface-sunken" />
      </div>
    </div>
  );
}
