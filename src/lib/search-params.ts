import { z } from "zod";

/**
 * The single source of truth for search filters.
 *
 * The same schema validates the API route's query string and drives the client
 * filter state, so a filter cannot exist in the UI without the API understanding
 * it. URL params are the canonical state: every search is shareable, bookmarkable
 * and back-button-correct.
 */

/** Comma-separated list -> string[]. Empty values collapse to undefined. */
const csv = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : undefined,
  );

const numeric = z.coerce.number().optional();

/** Rupees in the URL (human-readable) -> paise internally (storage unit). */
const rupeesToPaise = z.coerce
  .number()
  .nonnegative()
  .optional()
  .transform((value) => (value === undefined ? undefined : Math.round(value * 100)));

export const SORT_OPTIONS = [
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "impressions",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Most relevant",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Highest rated",
  impressions: "Most impressions",
};

export const searchParamsSchema = z.object({
  q: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),

  // Viewport. All four must be present to form a valid bounding box.
  minLng: numeric,
  minLat: numeric,
  maxLng: numeric,
  maxLat: numeric,

  // Radius search, an alternative to bounds.
  lat: numeric,
  lng: numeric,
  radius: numeric, // kilometres in the URL, metres internally

  categories: csv,
  types: csv,
  modes: csv,

  priceMin: rupeesToPaise,
  priceMax: rupeesToPaise,

  from: z.string().optional(),
  to: z.string().optional(),

  digital: z.enum(["true", "false"]).optional(),
  mobile: z.enum(["true", "false"]).optional(),
  verified: z.enum(["true", "false"]).optional(),

  minImpressions: numeric,

  sort: z.enum(SORT_OPTIONS).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),

  // Present only for the cluster endpoint.
  zoom: z.coerce.number().min(0).max(24).optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

/** Parses a URLSearchParams (or plain record) into validated filters. */
export function parseSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): SearchParams {
  const record: Record<string, string> = {};

  if (input instanceof URLSearchParams) {
    for (const [key, value] of input.entries()) {
      if (value !== "") record[key] = value;
    }
  } else {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      const resolved = Array.isArray(value) ? value[0] : value;
      if (resolved) record[key] = resolved;
    }
  }

  return searchParamsSchema.parse(record);
}

/**
 * Converts validated params into the shape the spatial layer expects.
 *
 * Kept separate from the schema so the transport format (URL-friendly, human
 * units) stays decoupled from the query format (metres, paise, Dates).
 */
export function toSpatialFilters(params: SearchParams) {
  const hasBounds =
    params.minLng !== undefined &&
    params.minLat !== undefined &&
    params.maxLng !== undefined &&
    params.maxLat !== undefined;

  const hasCenter =
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radius !== undefined;

  const availableFrom = params.from ? new Date(params.from) : undefined;
  const availableTo = params.to ? new Date(params.to) : undefined;

  // Guard against `new Date("garbage")` silently producing Invalid Date, which
  // Postgres would reject with an opaque error.
  const validRange =
    availableFrom &&
    availableTo &&
    !Number.isNaN(availableFrom.getTime()) &&
    !Number.isNaN(availableTo.getTime()) &&
    availableFrom < availableTo;

  return {
    bbox: hasBounds
      ? {
          minLng: params.minLng!,
          minLat: params.minLat!,
          maxLng: params.maxLng!,
          maxLat: params.maxLat!,
        }
      : undefined,
    center: hasCenter
      ? {
          lat: params.lat!,
          lng: params.lng!,
          radiusMeters: params.radius! * 1000,
        }
      : undefined,
    query: params.q,
    city: params.city,
    categorySlugs: params.categories,
    typeSlugs: params.types,
    locationModes: params.modes,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    isDigital: params.digital === undefined ? undefined : params.digital === "true",
    isMobile: params.mobile === undefined ? undefined : params.mobile === "true",
    verifiedOnly: params.verified === "true",
    minImpressions: params.minImpressions,
    availableFrom: validRange ? availableFrom : undefined,
    availableTo: validRange ? availableTo : undefined,
    sort: params.sort,
    limit: params.perPage,
    offset: (params.page - 1) * params.perPage,
  };
}

/**
 * Serialises filters back to a query string, dropping defaults so shared URLs
 * stay short and readable.
 */
export function buildSearchQuery(
  params: Partial<Record<string, string | number | boolean | string[] | undefined>>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(","));
      continue;
    }
    search.set(key, String(value));
  }

  return search.toString();
}
