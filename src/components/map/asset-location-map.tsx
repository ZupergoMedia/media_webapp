"use client";

import { useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import { getMapStyle } from "@/lib/map/config";

/**
 * Single-asset location map for the detail page.
 *
 * Interaction is deliberately minimal — this answers "where is it?", not
 * "what else is nearby?", so scroll-zoom is disabled to avoid hijacking page
 * scroll as the reader passes over it.
 */
export function AssetLocationMap({
  lat,
  lng,
  label,
  /** Draws the service area for radius-based mobile assets. */
  radiusMeters,
}: {
  lat: number;
  lng: number;
  label: string;
  radiusMeters?: number | null;
}) {
  const mapStyle = useMemo(() => getMapStyle(), []);

  // Zoom out for wide service areas so the whole coverage circle is visible.
  const zoom = radiusMeters
    ? Math.max(9, 14 - Math.log2(radiusMeters / 500))
    : 14;

  return (
    <div className="h-72 overflow-hidden rounded-card border border-border">
      <Map
        initialViewState={{ longitude: lng, latitude: lat, zoom }}
        mapStyle={mapStyle}
        scrollZoom={false}
        dragRotate={false}
        touchZoomRotate={false}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {radiusMeters ? (
          /*
           * Approximate coverage disc.
           *
           * Rendered as a scaled DOM circle rather than a GeoJSON polygon: at a
           * fixed zoom the visual error is negligible, and it avoids shipping a
           * turf.js dependency for one decorative shape. The authoritative
           * radius still lives in PostGIS and drives search matching.
           */
          <Marker longitude={lng} latitude={lat}>
            <div
              aria-hidden="true"
              className="rounded-full border-2 border-brand/40 bg-brand/15"
              style={{
                width: `${Math.min(radiusMeters / 60, 220)}px`,
                height: `${Math.min(radiusMeters / 60, 220)}px`,
              }}
            />
          </Marker>
        ) : null}

        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <span
            aria-label={label}
            className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md"
          >
            <MapPin className="size-4" aria-hidden="true" />
          </span>
        </Marker>
      </Map>
    </div>
  );
}
