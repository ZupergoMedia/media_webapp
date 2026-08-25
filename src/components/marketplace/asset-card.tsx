import Image from "next/image";
import Link from "next/link";
import { Eye, MapPin, Star } from "lucide-react";
import type { AssetSummary } from "@/server/services/asset-service";
import {
  formatCompact,
  formatDimensions,
  formatLocation,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriceDisplay } from "./price-display";
import { VerificationBadge } from "./verification-badge";

/**
 * Inventory card — the unit of browsing across search, the homepage and
 * "similar assets".
 *
 * Type-agnostic by design: it renders whatever the taxonomy provides rather
 * than branching on asset type, so a new medium needs no change here. The one
 * concession is `formatDimensions`, which reads whichever spec keys exist.
 */
export function AssetCard({
  asset,
  className,
  priority = false,
  compact = false,
}: {
  asset: AssetSummary;
  className?: string;
  /** Set on above-the-fold cards so LCP imagery is not lazy-loaded. */
  priority?: boolean;
  compact?: boolean;
}) {
  const dimensions = formatDimensions(asset.specs);
  const location = formatLocation(asset);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {asset.imageUrl ? (
          <Image
            src={asset.imageUrl}
            alt={asset.title}
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

        {asset.isVerified && (
          <VerificationBadge
            size="sm"
            className="absolute left-3 top-3 bg-surface/95 shadow-sm backdrop-blur-[2px]"
          />
        )}

        {asset.isFeatured && (
          <span className="absolute right-3 top-3 rounded-full bg-highlight px-2 py-0.5 text-[11px] font-medium text-white">
            Featured
          </span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-2", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {/*
              The whole card is clickable via this stretched link, which keeps a
              single focusable target for keyboard and screen-reader users
              rather than nesting interactive elements.
            */}
            <Link href={`/assets/${asset.slug}`} className="after:absolute after:inset-0">
              {asset.title}
            </Link>
          </h3>
          {asset.ratingCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="size-3 fill-current" aria-hidden="true" />
              {asset.ratingAverage.toFixed(1)}
            </span>
          )}
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-medium text-foreground">
            {asset.typeName}
          </span>
          {dimensions && <span>{dimensions}</span>}
        </div>

        {asset.dailyImpressions !== null && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="size-3 shrink-0" aria-hidden="true" />
            {formatCompact(asset.dailyImpressions)} daily impressions
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceDisplay amount={asset.priceAmount} unit={asset.priceUnit} />
          {/*
            Distance is null for mobile assets — they match a radius search
            through their operating area, so a base-point distance would
            misrepresent their coverage.
          */}
          {asset.distanceMeters !== null ? (
            <span className="text-xs text-subtle-foreground">
              {(asset.distanceMeters / 1000).toFixed(1)} km
            </span>
          ) : asset.isMobile ? (
            <span className="text-xs text-subtle-foreground">Area coverage</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Matching skeleton, so loading states preserve layout instead of collapsing. */
export function AssetCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="aspect-[4/3] animate-pulse bg-surface-sunken" />
      <div className={cn("space-y-2", compact ? "p-3" : "p-4")}>
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-sunken" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-sunken" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-surface-sunken" />
      </div>
    </div>
  );
}
