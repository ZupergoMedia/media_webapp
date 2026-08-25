import { prisma } from "@/server/db/client";
import {
  clusterAssets,
  countAssets,
  searchAssets,
  type SpatialSearchRow,
} from "@/server/db/spatial";
import type { SearchParams } from "@/lib/search-params";
import { toSpatialFilters } from "@/lib/search-params";

/**
 * Asset read services.
 *
 * The boundary between the database and everything above it. Routes and pages
 * call these functions; nothing outside `src/server` touches Prisma or SQL, so
 * storage details stay swappable and the UI never grows a query.
 */

/** Shape consumed by cards, list rows and map popups. */
export interface AssetSummary {
  id: string;
  slug: string;
  title: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  locality: string | null;
  areaLabel: string | null;
  categorySlug: string;
  categoryName: string;
  typeSlug: string;
  typeName: string;
  locationMode: string;
  bookingModel: string;
  isDigital: boolean;
  isMobile: boolean;
  isVerified: boolean;
  dailyImpressions: number | null;
  ratingAverage: number;
  ratingCount: number;
  isFeatured: boolean;
  ownerName: string;
  priceAmount: number | null;
  priceUnit: string | null;
  currency: string | null;
  imageUrl: string | null;
  specs: Record<string, unknown>;
  distanceMeters: number | null;
}

function toSummary(row: SpatialSearchRow): AssetSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    lat: row.lat,
    lng: row.lng,
    city: row.city,
    locality: row.locality,
    areaLabel: row.areaLabel,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    typeSlug: row.typeSlug,
    typeName: row.typeName,
    locationMode: row.locationMode,
    bookingModel: row.bookingModel,
    isDigital: row.isDigital,
    isMobile: row.isMobile,
    isVerified: row.verificationStatus === "VERIFIED",
    dailyImpressions: row.dailyImpressions,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    isFeatured: row.isFeatured,
    ownerName: row.ownerName,
    priceAmount: row.priceAmount,
    priceUnit: row.priceUnit,
    currency: row.currency,
    imageUrl: row.imageUrl,
    specs:
      row.specs && typeof row.specs === "object"
        ? (row.specs as Record<string, unknown>)
        : {},
    // Distance is measured to the asset's base point, which is only meaningful
    // for assets that stay put. A mobile asset matches a radius search via its
    // operating area, so its base point may sit well outside the circle —
    // reporting "5.3 km away" for a van that actively serves the area would be
    // misleading. Mobile assets surface as area coverage instead.
    distanceMeters: row.isMobile ? null : (row.distanceMeters ?? null),
  };
}

export interface SearchResult {
  assets: AssetSummary[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/** Paginated search. Rows and total run concurrently — neither depends on the other. */
export async function searchAssetSummaries(
  params: SearchParams,
): Promise<SearchResult> {
  const filters = toSpatialFilters(params);

  const [rows, total] = await Promise.all([
    searchAssets(filters),
    countAssets(filters),
  ]);

  return {
    assets: rows.map(toSummary),
    total,
    page: params.page,
    perPage: params.perPage,
    hasMore: params.page * params.perPage < total,
  };
}

export interface MapCluster {
  lat: number;
  lng: number;
  count: number;
  minPrice: number | null;
}

/**
 * Map markers for the current viewport.
 *
 * Below the zoom threshold the database returns grid-aggregated clusters; at or
 * above it, individual assets. Either way the browser receives a bounded
 * payload rather than the whole inventory.
 */
export async function getMapMarkers(
  params: SearchParams,
): Promise<
  | { kind: "clusters"; clusters: MapCluster[] }
  | { kind: "assets"; assets: AssetSummary[] }
> {
  const zoom = params.zoom ?? 11;
  const filters = toSpatialFilters(params);

  const CLUSTER_BELOW_ZOOM = 13;

  if (zoom < CLUSTER_BELOW_ZOOM) {
    const clusters = await clusterAssets(filters, zoom);
    return { kind: "clusters", clusters };
  }

  // Pin cap is higher than the list page size: the map shows everything in view,
  // while the list paginates.
  const rows = await searchAssets({ ...filters, limit: 250, offset: 0 });
  return { kind: "assets", assets: rows.map(toSummary) };
}

/** Full detail for one asset. Returns null when missing or not publicly visible. */
export async function getAssetBySlug(slug: string) {
  const asset = await prisma.asset.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    include: {
      category: true,
      type: true,
      location: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      pricing: { orderBy: [{ isDefault: "desc" }, { amount: "asc" }] },
      digitalInventory: true,
      operatingAreas: true,
      routes: true,
      availability: {
        where: { endDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
      },
      owner: {
        select: {
          id: true,
          slug: true,
          companyName: true,
          description: true,
          logoUrl: true,
          city: true,
          verificationStatus: true,
          ratingAverage: true,
          ratingCount: true,
          createdAt: true,
        },
      },
      reviews: {
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { name: true, image: true } },
        },
      },
      _count: { select: { reviews: true } },
    },
  });

  return asset;
}

export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAssetBySlug>>>;

/** Assets of the same type nearby, for the detail page's "similar" rail. */
export async function getSimilarAssets(
  assetId: string,
  typeId: string,
  city: string | null,
  limit = 4,
): Promise<AssetSummary[]> {
  const rows = await prisma.asset.findMany({
    where: {
      id: { not: assetId },
      typeId,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      ...(city ? { location: { city } } : {}),
    },
    take: limit,
    orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }],
    include: {
      category: { select: { slug: true, name: true } },
      type: { select: { slug: true, name: true, isDigital: true, isMobile: true } },
      location: true,
      owner: { select: { companyName: true } },
      images: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      pricing: {
        take: 1,
        orderBy: [{ isDefault: "desc" }, { amount: "asc" }],
      },
    },
  });

  return rows.map((asset) => ({
    id: asset.id,
    slug: asset.slug,
    title: asset.title,
    lat: asset.location?.lat ?? null,
    lng: asset.location?.lng ?? null,
    city: asset.location?.city ?? null,
    locality: asset.location?.locality ?? null,
    areaLabel: asset.location?.areaLabel ?? null,
    categorySlug: asset.category.slug,
    categoryName: asset.category.name,
    typeSlug: asset.type.slug,
    typeName: asset.type.name,
    locationMode: asset.locationMode,
    bookingModel: asset.bookingModel,
    isDigital: asset.type.isDigital,
    isMobile: asset.type.isMobile,
    isVerified: asset.verificationStatus === "VERIFIED",
    dailyImpressions: asset.dailyImpressions,
    ratingAverage: asset.ratingAverage,
    ratingCount: asset.ratingCount,
    isFeatured: asset.isFeatured,
    ownerName: asset.owner.companyName,
    priceAmount: asset.pricing[0]?.amount ?? null,
    priceUnit: asset.pricing[0]?.unit ?? null,
    currency: asset.pricing[0]?.currency ?? null,
    imageUrl: asset.images[0]?.url ?? null,
    specs:
      asset.specs && typeof asset.specs === "object"
        ? (asset.specs as Record<string, unknown>)
        : {},
    distanceMeters: null,
  }));
}

/** Featured inventory for the homepage. */
export async function getFeaturedAssets(limit = 6): Promise<AssetSummary[]> {
  const rows = await searchAssets({
    limit,
    offset: 0,
    sort: "relevance",
  });
  return rows.map(toSummary);
}

/** Category and type taxonomy, database-driven so the UI never hardcodes it. */
export async function getTaxonomy() {
  return prisma.assetCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      assetTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          isDigital: true,
          isMobile: true,
        },
      },
      _count: {
        select: {
          assets: { where: { status: "ACTIVE", verificationStatus: "VERIFIED" } },
        },
      },
    },
  });
}

export type Taxonomy = Awaited<ReturnType<typeof getTaxonomy>>;

/** Distinct cities with live inventory, for the location filter. */
export async function getCitiesWithInventory(): Promise<
  Array<{ city: string; count: number }>
> {
  const rows = await prisma.assetLocation.groupBy({
    by: ["city"],
    where: {
      asset: { status: "ACTIVE", verificationStatus: "VERIFIED" },
    },
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
  });

  return rows.map((row) => ({ city: row.city, count: row._count.city }));
}
