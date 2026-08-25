import { prisma } from "@/server/db/client";
import {
  clusterSaleListings,
  countSaleListings,
  searchSaleListings,
  type SaleSpatialSearchRow,
} from "@/server/db/spatial";
import type { SaleSearchParams } from "@/lib/sale-search-params";
import { toSaleSpatialFilters } from "@/lib/sale-search-params";

/**
 * Public sale-listing read services.
 *
 * Everything a signed-out visitor can see. As with asset-service.ts, nothing
 * outside src/server touches Prisma or SQL directly — routes and pages call
 * these functions only.
 *
 * Every function here reads PUBLISHED listings and the public/snapshot
 * columns only. None of them may select SalePropertyDetails, AssetLocation's
 * true geog/lat/lng, or a SaleDocument's private fields — that is not an
 * inline reminder to future edits, it is enforced by these functions simply
 * never naming those columns.
 */

/** Shape consumed by cards, list rows and map popups. */
export interface SaleListingSummary {
  id: string;
  slug: string;
  title: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  locality: string | null;
  areaLabel: string | null;
  locationPrecision: string;
  categorySlug: string;
  categoryName: string;
  typeSlug: string;
  typeName: string;
  ownershipType: string;
  askingPriceAmount: number;
  currency: string;
  negotiable: boolean;
  /** Null means "not disclosed by seller" — never coerced to 0. */
  currentAnnualRevenue: number | null;
  expectedRoiPercent: number | null;
  ownerName: string;
  imageUrl: string | null;
  createdAt: Date;
  distanceMeters: number | null;
}

function toSummary(row: SaleSpatialSearchRow): SaleListingSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    lat: row.lat,
    lng: row.lng,
    city: row.city,
    locality: row.locality,
    areaLabel: row.areaLabel,
    locationPrecision: row.locationPrecision,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    typeSlug: row.typeSlug,
    typeName: row.typeName,
    ownershipType: row.ownershipType,
    askingPriceAmount: row.askingPriceAmount,
    currency: row.currency,
    negotiable: row.negotiable,
    currentAnnualRevenue: row.currentAnnualRevenue,
    expectedRoiPercent: row.expectedRoiPercent,
    ownerName: row.ownerName,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    distanceMeters: row.distanceMeters ?? null,
  };
}

export interface SaleSearchResult {
  listings: SaleListingSummary[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/** Paginated public search. Rows and total run concurrently. */
export async function searchSaleListingSummaries(
  params: SaleSearchParams,
): Promise<SaleSearchResult> {
  const filters = toSaleSpatialFilters(params);

  const [rows, total] = await Promise.all([
    searchSaleListings(filters),
    countSaleListings(filters),
  ]);

  return {
    listings: rows.map(toSummary),
    total,
    page: params.page,
    perPage: params.perPage,
    hasMore: params.page * params.perPage < total,
  };
}

export interface SaleMapCluster {
  lat: number;
  lng: number;
  count: number;
  minPrice: number | null;
}

/** Map markers for the current viewport, clustered server-side below the zoom threshold. */
export async function getSaleMapMarkers(
  params: SaleSearchParams,
): Promise<
  | { kind: "clusters"; clusters: SaleMapCluster[] }
  | { kind: "listings"; listings: SaleListingSummary[] }
> {
  const zoom = params.zoom ?? 11;
  const filters = toSaleSpatialFilters(params);

  const CLUSTER_BELOW_ZOOM = 13;

  if (zoom < CLUSTER_BELOW_ZOOM) {
    const clusters = await clusterSaleListings(filters, zoom);
    return { kind: "clusters", clusters };
  }

  const rows = await searchSaleListings({ ...filters, limit: 250, offset: 0 });
  return { kind: "listings", listings: rows.map(toSummary) };
}

/**
 * Full public detail for one listing, by slug. Returns null when missing or
 * not PUBLISHED.
 *
 * The `include` here is the enforcement point for every privacy rule in this
 * module: it never selects `salePropertyDetails`, and `location`/`documents`
 * are shaped by the caller (see getVisibleSaleDocuments) rather than
 * returned raw.
 */
export async function getSaleListingBySlug(slug: string) {
  const listing = await prisma.saleListing.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      asset: {
        select: {
          id: true,
          slug: true,
          specs: true,
          dailyImpressions: true,
          type: {
            select: { slug: true, name: true, isDigital: true, isMobile: true, specSchema: true },
          },
          category: { select: { slug: true, name: true } },
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      },
      owner: {
        select: {
          id: true,
          slug: true,
          companyName: true,
          logoUrl: true,
          saleVerificationStatus: true,
        },
      },
      permits: { orderBy: { createdAt: "asc" } },
      documents: {
        orderBy: { createdAt: "asc" },
        // Never select documentNumber/issuingAuthority here — see
        // getVisibleSaleDocuments for the field-level allow-list that governs
        // what a given viewer may see.
      },
    },
  });

  return listing;
}

export type SaleListingDetail = NonNullable<
  Awaited<ReturnType<typeof getSaleListingBySlug>>
>;

/** Distinct cities with at least one published listing, for the location filter. */
export async function getSaleCities(): Promise<
  Array<{ city: string; count: number }>
> {
  const rows = await prisma.saleListing.groupBy({
    by: ["publicCity"],
    where: { status: "PUBLISHED", publicCity: { not: null } },
    _count: { publicCity: true },
    orderBy: { _count: { publicCity: "desc" } },
  });

  return rows
    .filter((row) => row.publicCity !== null)
    .map((row) => ({ city: row.publicCity as string, count: row._count.publicCity }));
}

/**
 * Listings for an SEO landing page — city, city+type, or a curated
 * collection spanning several type slugs with no city filter.
 */
export async function getSaleLandingListings(
  city?: string,
  typeSlugs?: string[],
  limit = 24,
): Promise<SaleListingSummary[]> {
  const rows = await searchSaleListings({
    city,
    typeSlugs,
    limit,
    offset: 0,
    sort: "newest",
  });

  return rows.map(toSummary);
}

/** A document as it may safely appear to an anonymous public visitor. */
export interface PublicSaleDocument {
  category: string;
  documentType: string;
  title: string | null;
  status: "valid" | "expiring_soon" | "expired" | "unspecified";
  expiryDate: Date | null;
}

/**
 * Filters and projects a listing's declared documents for public display.
 *
 * This is the single place the field-level visibility rule lives, so no
 * route or component has to reimplement it. Built by ALLOW-LISTING fields
 * onto a fresh object, never by deleting keys from the full row — that is
 * the difference between "this can't leak a new private field later" and
 * "it won't, as long as nobody forgets".
 *
 * PUBLIC documents show type, title and expiry validity. Everything else
 * (documentNumber, issuingAuthority, issueDate, and the existence of any
 * BUYER_ON_REQUEST/VERIFIED_BUYER_ONLY/ADMIN_ONLY document) stays hidden —
 * `hiddenCount` lets the UI say "N further documents available on request"
 * honestly, without naming what they are.
 */
export function getVisibleSaleDocuments(
  documents: Array<{
    category: string;
    documentType: string;
    title: string | null;
    visibility: string;
    expiryDate: Date | null;
  }>,
): { visible: PublicSaleDocument[]; hiddenCount: number } {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const visible: PublicSaleDocument[] = [];
  let hiddenCount = 0;

  for (const doc of documents) {
    if (doc.visibility !== "PUBLIC") {
      hiddenCount += 1;
      continue;
    }

    let status: PublicSaleDocument["status"] = "unspecified";
    if (doc.expiryDate) {
      const expiresAt = doc.expiryDate.getTime();
      if (expiresAt < now) status = "expired";
      else if (expiresAt - now < THIRTY_DAYS_MS) status = "expiring_soon";
      else status = "valid";
    }

    visible.push({
      category: doc.category,
      documentType: doc.documentType,
      title: doc.title,
      status,
      expiryDate: doc.expiryDate,
    });
  }

  return { visible, hiddenCount };
}
