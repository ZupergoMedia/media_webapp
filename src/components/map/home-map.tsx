"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowRight, Maximize2, X } from "lucide-react";
import type { AssetSummary } from "@/server/services/asset-service";
import { formatPaiseCompact, formatLocation } from "@/lib/format";
import { DEFAULT_CENTER, getMapStyle } from "@/lib/map/config";
import { cn } from "@/lib/utils";

/**
 * Homepage inventory map.
 *
 * Genuinely interactive — pan, zoom, click a marker for a preview — but
 * deliberately not the Explore map. It receives a fixed set of assets rendered
 * on the server rather than querying as the viewport moves, because the job
 * here is to convey "there is real inventory, and here is roughly where it is",
 * not to be a search tool. Search lives one click away on /explore.
 *
 * That distinction also keeps the homepage cheap: no bounds queries fire while
 * someone is idly dragging the map around above the fold.
 */
export function HomeMap({
  assets,
  totalAssets,
  cities,
}: {
  assets: AssetSummary[];
  totalAssets: number;
  cities: Array<{ city: string; count: number }>;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<AssetSummary | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * Whether the visitor has deliberately engaged with the map.
   *
   * Set on pointer-down or when the pointer settles over the map; cleared when
   * it leaves. Gates wheel-zoom so the map never hijacks page scroll for
   * someone who is only scrolling past it.
   */
  const [engaged, setEngaged] = useState(false);

  const mapStyle = useMemo(() => getMapStyle(), []);

  // Only assets with a real point can be drawn. Mobile inventory is represented
  // by its operating area, which this overview map does not attempt to show.
  const pins = useMemo(
    () => assets.filter((asset) => asset.lat !== null && asset.lng !== null),
    [assets],
  );

  const focus = useCallback((asset: AssetSummary) => {
    setSelected(asset);
    if (asset.lat === null || asset.lng === null) return;
    mapRef.current?.easeTo({
      center: [asset.lng, asset.lat],
      zoom: Math.max(mapRef.current.getZoom() ?? 11, 12),
      duration: 500,
    });
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-card border border-border bg-surface-sunken shadow-sm"
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
    >
      <div className="h-[420px] w-full lg:h-[520px]">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: DEFAULT_CENTER.longitude,
            latitude: DEFAULT_CENTER.latitude,
            zoom: 10.4,
          }}
          mapStyle={mapStyle}
          onLoad={() => setReady(true)}
          /*
           * Scroll wheel zooms the map, but only once it has been clicked or
           * hovered into focus — see `engaged` below.
           *
           * Enabling it unconditionally means a visitor scrolling down the page
           * gets trapped: the pointer crosses the map and the page stops
           * moving. Requiring a deliberate interaction first gives full
           * wheel-zoom to anyone actually using the map, while someone just
           * passing by scrolls on as normal.
           */
          scrollZoom={engaged}
          dragRotate={false}
          touchZoomRotate={false}
          attributionControl={{ compact: true }}
          style={{ width: "100%", height: "100%" }}
          onClick={() => setSelected(null)}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          {pins.map((asset) => {
            const isSelected = selected?.id === asset.id;
            return (
              <Marker
                key={asset.id}
                longitude={asset.lng!}
                latitude={asset.lat!}
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  focus(asset);
                }}
              >
                <button
                  type="button"
                  aria-label={`${asset.title}, ${formatPaiseCompact(asset.priceAmount)}`}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs font-semibold shadow-sm transition-all",
                    isSelected
                      ? "z-10 scale-110 border-brand bg-brand text-brand-foreground"
                      : asset.isFeatured
                        ? "border-highlight bg-highlight text-white hover:scale-105"
                        : "border-border-strong bg-surface text-foreground hover:border-brand hover:shadow-md",
                  )}
                >
                  {formatPaiseCompact(asset.priceAmount)}
                </button>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Live inventory strip */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-[2px]">
          <span
            className="size-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
          {totalAssets} live assets
        </span>
        {cities.slice(0, 3).map((city) => (
          <span
            key={city.city}
            className="pointer-events-auto hidden rounded-full bg-surface/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-[2px] sm:inline"
          >
            {city.city} · {city.count}
          </span>
        ))}
      </div>

      <Link
        href="/explore"
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-hover"
      >
        <Maximize2 className="size-3.5" aria-hidden="true" />
        Open full map
      </Link>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px]">
        <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 shadow-sm backdrop-blur-[2px]">
          <span className="size-2 rounded-full bg-highlight" aria-hidden="true" />
          Featured
        </span>
        <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 shadow-sm backdrop-blur-[2px]">
          <span
            className="size-2 rounded-full border border-border-strong bg-surface"
            aria-hidden="true"
          />
          Available
        </span>
      </div>

      {/* Selected asset preview */}
      {selected && (
        <div className="absolute bottom-3 right-3 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-lg">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close preview"
            className="absolute right-2 top-2 z-10 rounded-full bg-surface/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>

          {selected.imageUrl && (
            <div className="relative aspect-[16/9] bg-surface-sunken">
              <Image
                src={selected.imageUrl}
                alt=""
                fill
                sizes="256px"
                className="object-cover"
              />
            </div>
          )}

          <div className="p-3">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">
              {selected.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatLocation(selected)} · {selected.typeName}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {formatPaiseCompact(selected.priceAmount)}
              </span>
              <Link
                href={`/assets/${selected.slug}`}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                View
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {ready && !engaged && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
          <span className="rounded-full bg-foreground/75 px-3 py-1 text-[11px] font-medium text-background">
            Scroll to zoom · drag to pan
          </span>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      )}
    </div>
  );
}
