import { setWorkerUrl } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";

/**
 * Map provider configuration.
 *
 * The map renders through MapLibre GL, the open-source fork of Mapbox GL JS.
 * Any provider publishing an open style-spec URL is a configuration change
 * only — it never touches the map components, the bounds API, or clustering.
 *
 * Default is `maplibre`, which needs no account or token. Adding a MapTiler key
 * upgrades the cartography to vector tiles with no code change.
 */

/**
 * Points MapLibre at a self-hosted copy of its worker script, rather than
 * letting it resolve one automatically.
 *
 * MapLibre GL v6 ships its worker as a separate ES module
 * (dist/maplibre-gl-worker.mjs) that the app must resolve a URL to at
 * runtime. Turbopack's asset handling does not carry along the worker's own
 * import of maplibre-gl-shared.mjs when resolving a bundler-relative
 * `new URL(..., import.meta.url)`, so the default resolution silently
 * breaks — in production this surfaced as the browser trying to load a
 * Worker from the page's own URL ("disallowed MIME type text/html"), which
 * throws during map initialisation and can leave the rest of the page
 * un-hydrated along with it.
 *
 * scripts/copy-maplibre-worker.mjs copies the worker and its sibling shared
 * chunk into public/maplibre/ (run via predev/prebuild in package.json) so
 * they are served untouched by any bundler. Guarded for `window` because
 * this module's client components also render once during SSR, where
 * `setWorkerUrl` — a MapLibre API that assumes a browser — must not run.
 */
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

/**
 * Providers the MapLibre renderer can serve directly.
 *
 * Mapbox is deliberately absent: `mapbox://` styles require Mapbox's own
 * proprietary SDK and access token, which means a different renderer entry
 * point (`react-map-gl/mapbox`), not merely a different style URL. Listing it
 * here would be a promise the map cannot keep. To adopt Mapbox later, swap the
 * import in map-view.tsx and add the token prop there — everything else in the
 * app is provider-agnostic.
 */
export type MapProvider = "maplibre" | "maptiler";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

/**
 * Resolves the provider from env, falling back to token-free MapLibre whenever
 * the requested provider has no key. Without this, a missing key would render a
 * blank grey rectangle with no explanation — the failure mode that makes maps
 * feel broken rather than unconfigured.
 */
export function resolveProvider(): MapProvider {
  const requested = (
    process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "maplibre"
  ).toLowerCase() as MapProvider;

  if (requested === "maptiler" && !MAPTILER_KEY) return "maplibre";
  if (requested !== "maplibre" && requested !== "maptiler") return "maplibre";
  return requested;
}

/**
 * Token-free raster style built on OpenStreetMap tiles.
 *
 * Raster rather than vector because no vector source is available without an
 * account. Attribution is required by the OSM licence and is rendered by the
 * map's AttributionControl — do not remove it.
 *
 * Note: OSM's public tile servers are fine for development but their usage
 * policy prohibits heavy production traffic. Set NEXT_PUBLIC_MAPTILER_KEY
 * before launch.
 */
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        // Slight desaturation so inventory markers read as the foreground and
        // the basemap stays context rather than competing for attention.
        "raster-saturation": -0.35,
        "raster-contrast": -0.05,
      },
    },
  ],
};

/**
 * Style URL or inline style spec for the active provider.
 *
 * Both supported providers are served through the MapLibre renderer, which
 * speaks the open style-spec. MapTiler publishes a plain HTTPS style URL, so it
 * needs no proprietary SDK.
 */
export function getMapStyle(): string | StyleSpecification {
  switch (resolveProvider()) {
    case "maptiler":
      return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
    default:
      return OSM_RASTER_STYLE;
  }
}

/** True when running on free OSM tiles, so the UI can note the dev-only limit. */
export function isUsingFallbackTiles(): boolean {
  return resolveProvider() === "maplibre";
}

// ---------------------------------------------------------------------------
// Map defaults
// ---------------------------------------------------------------------------

/** Mumbai — the launch city, and where all seeded inventory lives. */
export const DEFAULT_CENTER = { longitude: 72.8777, latitude: 19.076 } as const;
export const DEFAULT_ZOOM = 11;

/** Bounds generous enough to cover Mumbai, Thane and Navi Mumbai. */
export const MUMBAI_BOUNDS = {
  minLng: 72.75,
  minLat: 18.87,
  maxLng: 73.05,
  maxLat: 19.32,
} as const;

/** Below this zoom the API returns clusters; at or above it, individual pins. */
export const CLUSTER_ZOOM_THRESHOLD = 13;
