/**
 * Resolver for the public `/assets-for-sale/[...segments]` catch-all.
 *
 * Deliberately free of any server-only import (Prisma, the db client): this
 * module is imported from client components (e.g. sale-listing-card.tsx, for
 * citySlug()), and a single server-only import anywhere in this file would
 * drag Prisma's Node dependencies (pg, tls, ...) into the browser bundle. The
 * one function that genuinely needs a database lookup — checking whether a
 * candidate listing slug collides with an AssetType slug — lives in
 * sale-seller-service.ts instead, next to the only place that calls it.
 *
 * `/assets-for-sale/[slug]` and `/assets-for-sale/[city]` cannot be sibling
 * dynamic segments in the App Router, so both are folded into one catch-all
 * and disambiguated by segment COUNT, which needs no database lookup for the
 * ambiguous cases:
 *
 *   /assets-for-sale/mumbai                    -> city landing        (1 segment)
 *   /assets-for-sale/digital-billboards         -> curated collection  (1 segment)
 *   /assets-for-sale/mumbai/hoardings           -> city + type landing (2 segments)
 *   /assets-for-sale/mumbai/40x20-billboard-x   -> listing detail      (2 segments)
 *
 * The one invariant this depends on: a SaleListing.slug may never collide
 * with an AssetType.slug. Enforce that at slug generation time (see
 * sale-seller-service.ts) — with it, segment 2 under a city is either a known
 * type slug (a landing page) or a listing slug, and never ambiguous.
 */

/**
 * Closed set of curated single-segment collection pages we control.
 *
 * Each names the AssetType slugs it covers explicitly, rather than deriving
 * them from the collection slug by string transform — a heuristic like
 * stripping "-billboards" from "digital-billboards" is exactly the kind of
 * fragile guess that silently stops matching the moment either slug changes.
 */
export const SALE_COLLECTIONS = [
  {
    slug: "digital-billboards",
    label: "Digital billboards for sale",
    typeSlugs: ["led-billboard", "digital-roadside-screen"],
  },
  { slug: "hoardings", label: "Hoardings for sale", typeSlugs: ["hoarding", "billboard"] },
  { slug: "bus-shelters", label: "Bus shelters for sale", typeSlugs: ["bus-shelter"] },
] as const;

export type SaleCollectionSlug = (typeof SALE_COLLECTIONS)[number]["slug"];

export function findSaleCollection(slug: string) {
  return SALE_COLLECTIONS.find((collection) => collection.slug === slug);
}

export type SaleRouteResolution =
  | { kind: "national" }
  | { kind: "city"; city: string }
  | { kind: "collection"; collection: SaleCollectionSlug }
  | { kind: "city_type"; city: string; typeSlug: string }
  | { kind: "listing"; city: string; listingSlug: string }
  | { kind: "not_found" };

/**
 * Resolves the catch-all segments to what should render.
 *
 * Two lookups happen here, both against small, cacheable, closed sets: the
 * list of cities with live sale inventory, and the AssetType taxonomy. Both
 * are already fetched by the calling page for its own filter UI, so this
 * function accepts them rather than re-querying — see the page's
 * `generateMetadata` and body, which must resolve identically without a
 * second round trip.
 */
export function resolveSaleRoute(
  segments: string[] | undefined,
  knownCities: string[],
  knownTypeSlugs: string[],
): SaleRouteResolution {
  if (!segments || segments.length === 0) {
    return { kind: "national" };
  }

  if (segments.length === 1) {
    const [only] = segments;
    const collection = findSaleCollection(only);
    if (collection) return { kind: "collection", collection: collection.slug };

    if (knownCities.some((city) => citySlug(city) === only)) {
      return { kind: "city", city: only };
    }

    return { kind: "not_found" };
  }

  if (segments.length === 2) {
    const [city, second] = segments;
    if (!knownCities.some((c) => citySlug(c) === city)) {
      return { kind: "not_found" };
    }

    if (knownTypeSlugs.includes(second)) {
      return { kind: "city_type", city, typeSlug: second };
    }

    return { kind: "listing", city, listingSlug: second };
  }

  return { kind: "not_found" };
}

/** Normalises a city name to the slug form used in URLs. */
export function citySlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Also reserve the curated collection slugs — a listing must not shadow one. */
export function isReservedCollectionSlug(slug: string): boolean {
  return findSaleCollection(slug) !== undefined;
}
