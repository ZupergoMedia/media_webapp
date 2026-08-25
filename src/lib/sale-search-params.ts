import { z } from "zod";

/**
 * The single source of truth for sale-listing search filters.
 *
 * Kept separate from search-params.ts rather than extending it: the sale
 * filters (asking price, ownership/rights, negotiable, revenue disclosed) and
 * the advertising filters (availability window, booking model, impressions)
 * barely overlap, and the sort options differ entirely. Sharing one schema
 * would mean every field is optional on both sides for no shared meaning.
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

export const SALE_SORT_OPTIONS = [
  "relevance",
  "price_asc",
  "price_desc",
  "newest",
] as const;

export type SaleSortOption = (typeof SALE_SORT_OPTIONS)[number];

export const SALE_SORT_LABELS: Record<SaleSortOption, string> = {
  relevance: "Most relevant",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  newest: "Newest listings",
};

export const saleSearchParamsSchema = z.object({
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

  priceMin: rupeesToPaise,
  priceMax: rupeesToPaise,

  /** SaleOwnershipType values, comma-separated. */
  ownershipTypes: csv,
  /** SaleInclusion values, comma-separated — matched with hasSome. */
  inclusions: csv,

  negotiable: z.enum(["true", "false"]).optional(),
  revenueDisclosed: z.enum(["true", "false"]).optional(),
  roiDisclosed: z.enum(["true", "false"]).optional(),

  sort: z.enum(SALE_SORT_OPTIONS).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),

  // Present only for the cluster endpoint.
  zoom: z.coerce.number().min(0).max(24).optional(),
});

export type SaleSearchParams = z.infer<typeof saleSearchParamsSchema>;

/** Parses a URLSearchParams (or plain record) into validated filters. */
export function parseSaleSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): SaleSearchParams {
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

  return saleSearchParamsSchema.parse(record);
}

/**
 * Converts validated params into the shape the sale spatial layer expects.
 *
 * Kept separate from the schema so the transport format (URL-friendly, human
 * units) stays decoupled from the query format (metres, paise).
 */
export function toSaleSpatialFilters(params: SaleSearchParams) {
  const hasBounds =
    params.minLng !== undefined &&
    params.minLat !== undefined &&
    params.maxLng !== undefined &&
    params.maxLat !== undefined;

  const hasCenter =
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radius !== undefined;

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
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    ownershipTypes: params.ownershipTypes,
    inclusions: params.inclusions,
    negotiableOnly: params.negotiable === "true",
    revenueDisclosedOnly: params.revenueDisclosed === "true",
    roiDisclosedOnly: params.roiDisclosed === "true",
    sort: params.sort,
    limit: params.perPage,
    offset: (params.page - 1) * params.perPage,
  };
}

/**
 * Serialises filters back to a query string, dropping defaults so shared URLs
 * stay short and readable.
 */
export function buildSaleSearchQuery(
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
