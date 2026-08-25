import Image from "next/image";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import type { AssetSummary } from "@/server/services/asset-service";
import { formatLocation, formatPaise, pricingUnitSuffix } from "@/lib/format";
import { VerificationBadge } from "@/components/marketplace/verification-badge";

/**
 * The "short asset card" the map spec calls for: clicking a marker surfaces
 * this rather than only highlighting the pin.
 *
 * Rendered inside a react-map-gl `Popup` anchored to the marker's own
 * coordinates (see map-view.tsx), so it appears right where the click
 * happened and tracks that marker through pan/zoom, rather than sitting at a
 * fixed screen position disconnected from whichever pin was clicked.
 */
export function MapAssetPreview({
  asset,
  onClose,
}: {
  asset: AssetSummary;
  onClose: () => void;
}) {
  const location = formatLocation({
    locality: asset.locality,
    city: asset.city,
    areaLabel: asset.areaLabel,
  });

  return (
    <div className="w-72 max-w-[80vw] overflow-hidden rounded-card border border-border bg-surface shadow-xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-sm backdrop-blur-[2px] hover:bg-surface"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <Link href={`/assets/${asset.slug}`} className="flex gap-3 p-3">
        <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
          {asset.imageUrl ? (
            <Image
              src={asset.imageUrl}
              alt={asset.title}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-subtle-foreground">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {asset.title}
            </h3>
            {asset.isVerified && <VerificationBadge size="sm" className="mt-0.5 shrink-0" />}
          </div>

          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{location}</span>
          </p>

          <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
            {asset.priceAmount === null ? (
              "On request"
            ) : (
              <>
                {formatPaise(asset.priceAmount)}
                <span className="text-xs font-normal text-muted-foreground">
                  {pricingUnitSuffix(asset.priceUnit)}
                </span>
              </>
            )}
          </p>
        </div>
      </Link>
    </div>
  );
}
