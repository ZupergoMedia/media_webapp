"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AssetSummary, MapCluster } from "@/server/services/asset-service";
import { formatPaiseCompact } from "@/lib/format";
import { DEFAULT_CENTER, DEFAULT_ZOOM, getMapStyle } from "@/lib/map/config";
import { cn } from "@/lib/utils";
import { MapAssetPreview } from "./map-asset-preview";

export interface MapBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

interface MapViewProps {
  clusters?: MapCluster[];
  assets?: AssetSummary[];
  selectedAssetId?: string | null;
  isLoading?: boolean;
  /** Fires after the user stops panning/zooming, debounced by the caller. */
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  onSelectAsset?: (asset: AssetSummary | null) => void;
  onClusterClick?: (cluster: MapCluster) => void;
  className?: string;
}

/**
 * The marketplace map.
 *
 * Renders through MapLibre GL — see src/lib/map/config.ts, which resolves the
 * tile provider and falls back to token-free OSM tiles when no key is set.
 *
 * Deliberately a controlled-ish component: it owns camera state internally (so
 * panning stays smooth at 60fps without a React round-trip per frame) but
 * reports settled bounds upward, letting the parent drive data fetching. Mixing
 * those concerns is what makes map UIs feel laggy.
 */
export function MapView({
  clusters,
  assets,
  selectedAssetId,
  isLoading,
  onBoundsChange,
  onSelectAsset,
  onClusterClick,
  className,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isStyleLoaded, setStyleLoaded] = useState(false);

  const mapStyle = useMemo(() => getMapStyle(), []);

  const selectedAsset =
    selectedAssetId && assets
      ? (assets.find((asset) => asset.id === selectedAssetId) ?? null)
      : null;

  /** Reports the current viewport upward. */
  const emitBounds = useCallback(
    (event: ViewStateChangeEvent) => {
      if (!onBoundsChange) return;
      const bounds = event.target.getBounds();
      onBoundsChange(
        {
          minLng: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLng: bounds.getEast(),
          maxLat: bounds.getNorth(),
        },
        event.viewState.zoom,
      );
    },
    [onBoundsChange],
  );

  // Emit once on load so the first fetch matches what the user actually sees,
  // rather than a hardcoded default viewport.
  const handleLoad = useCallback(() => {
    setStyleLoaded(true);
    const map = mapRef.current;
    if (!map || !onBoundsChange) return;
    const bounds = map.getBounds();
    onBoundsChange(
      {
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
      },
      map.getZoom(),
    );
  }, [onBoundsChange]);

  // Pan the selected asset into view when selection comes from the list.
  useEffect(() => {
    if (!selectedAssetId || !assets?.length) return;
    const target = assets.find((a) => a.id === selectedAssetId);
    if (!target?.lat || !target?.lng) return;

    mapRef.current?.easeTo({
      center: [target.lng, target.lat],
      duration: 420,
    });
  }, [selectedAssetId, assets]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: DEFAULT_CENTER.longitude,
          latitude: DEFAULT_CENTER.latitude,
          zoom: DEFAULT_ZOOM,
        }}
        mapStyle={mapStyle}
        onLoad={handleLoad}
        onMoveEnd={emitBounds}
        // Pitch/rotate add nothing to a 2D inventory map and make the camera
        // harder to recover from on touch devices.
        dragRotate={false}
        touchZoomRotate={false}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Clusters — shown when zoomed out. */}
        {clusters?.map((cluster) => (
          <Marker
            key={`cluster-${cluster.lat.toFixed(5)}-${cluster.lng.toFixed(5)}`}
            longitude={cluster.lng}
            latitude={cluster.lat}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onClusterClick?.(cluster);
              mapRef.current?.easeTo({
                center: [cluster.lng, cluster.lat],
                zoom: Math.min((mapRef.current.getZoom() ?? 11) + 2.5, 16),
                duration: 500,
              });
            }}
          >
            <button
              type="button"
              aria-label={`${cluster.count} assets in this area. Zoom in.`}
              className="flex items-center justify-center rounded-full border-2 border-surface bg-brand font-semibold text-brand-foreground shadow-md transition-transform hover:scale-110"
              style={{
                // Area scales with count so dense regions read as denser,
                // clamped so a big cluster never swallows the viewport.
                width: `${Math.min(30 + Math.log2(cluster.count + 1) * 8, 56)}px`,
                height: `${Math.min(30 + Math.log2(cluster.count + 1) * 8, 56)}px`,
                fontSize: cluster.count > 99 ? "11px" : "13px",
              }}
            >
              {cluster.count}
            </button>
          </Marker>
        ))}

        {/* Individual assets — shown when zoomed in. */}
        {assets?.map((asset) => {
          if (asset.lat === null || asset.lng === null) return null;
          const isSelected = asset.id === selectedAssetId;

          return (
            <Marker
              key={asset.id}
              longitude={asset.lng}
              latitude={asset.lat}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelectAsset?.(asset);
              }}
            >
              <button
                type="button"
                aria-label={`${asset.title}. ${formatPaiseCompact(asset.priceAmount)}`}
                aria-pressed={isSelected}
                className={cn(
                  "rounded-full border px-2 py-1 text-xs font-semibold shadow-sm transition-all",
                  isSelected
                    ? "z-10 scale-110 border-foreground bg-foreground text-background"
                    : "border-border-strong bg-surface text-foreground hover:border-foreground hover:shadow-md",
                )}
              >
                {formatPaiseCompact(asset.priceAmount)}
              </button>
            </Marker>
          );
        })}

        {/* Anchored to the clicked marker's own coordinates — via Popup, not
            a fixed screen position — so it appears where the click actually
            happened and stays pinned to that marker through pan/zoom. */}
        {selectedAsset?.lat !== undefined &&
          selectedAsset?.lat !== null &&
          selectedAsset?.lng !== undefined &&
          selectedAsset?.lng !== null && (
            <Popup
              longitude={selectedAsset.lng}
              latitude={selectedAsset.lat}
              anchor="bottom"
              offset={14}
              closeButton={false}
              closeOnClick={false}
              maxWidth="320px"
              className="map-asset-popup"
            >
              <MapAssetPreview
                asset={selectedAsset}
                onClose={() => onSelectAsset?.(null)}
              />
            </Popup>
          )}
      </Map>

      {/* Tile loading is separate from data loading; this covers data. */}
      {isLoading && isStyleLoaded && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background shadow-lg">
          Updating results…
        </div>
      )}

      {!isStyleLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      )}
    </div>
  );
}
