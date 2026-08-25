import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "./client";

/**
 * The only module in the codebase that writes raw SQL.
 *
 * Two reasons it has to exist:
 *
 *   1. Prisma cannot read or write `Unsupported()` geography columns, and any
 *      model with a required one loses typed create/update entirely.
 *   2. Spatial predicates (ST_Intersects, ST_DWithin) have no Prisma equivalent.
 *
 * Two rules for everything in here:
 *
 *   - Interpolate ONLY through Prisma.sql / ${} tagged templates. Bounds and
 *     filter values arrive from the query string, so string concatenation would
 *     be an injection vector.
 *   - Parse every result through Zod before returning. `$queryRaw<T>` is an
 *     unchecked assertion, not a guarantee — the database can return nulls and
 *     numeric strings that the declared type quietly lies about.
 */

// ---------------------------------------------------------------------------
// Result schemas
// ---------------------------------------------------------------------------

/**
 * Postgres returns bigint for COUNT(), which the pg driver hands back as a
 * string to avoid precision loss. Coerce defensively — it may arrive as either.
 */
const countValue = z.coerce.number().int();

const searchRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  city: z.string().nullable(),
  locality: z.string().nullable(),
  areaLabel: z.string().nullable(),
  categorySlug: z.string(),
  categoryName: z.string(),
  typeSlug: z.string(),
  typeName: z.string(),
  locationMode: z.string(),
  bookingModel: z.string(),
  isDigital: z.boolean(),
  isMobile: z.boolean(),
  verificationStatus: z.string(),
  dailyImpressions: z.number().int().nullable(),
  ratingAverage: z.number(),
  ratingCount: z.number().int(),
  isFeatured: z.boolean(),
  ownerName: z.string(),
  priceAmount: z.number().int().nullable(),
  priceUnit: z.string().nullable(),
  currency: z.string().nullable(),
  imageUrl: z.string().nullable(),
  specs: z.unknown(),
  distanceMeters: z.number().nullable().optional(),
});

export type SpatialSearchRow = z.infer<typeof searchRowSchema>;

const clusterRowSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  count: countValue,
  minPrice: z.number().int().nullable(),
});

export type SpatialCluster = z.infer<typeof clusterRowSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface SpatialSearchFilters {
  bbox?: BoundingBox;
  center?: { lat: number; lng: number; radiusMeters: number };
  categorySlugs?: string[];
  typeSlugs?: string[];
  locationModes?: string[];
  city?: string;
  query?: string;
  priceMin?: number;
  priceMax?: number;
  isDigital?: boolean;
  isMobile?: boolean;
  verifiedOnly?: boolean;
  availableFrom?: Date;
  availableTo?: Date;
  minImpressions?: number;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating" | "impressions";
}

/**
 * Only ACTIVE + VERIFIED listings are ever visible to advertisers. Matches the
 * partial index `Asset_searchable_idx`.
 */
const searchableAsset = Prisma.sql`
  a."status" = 'ACTIVE' AND a."verificationStatus" = 'VERIFIED'
`;

/**
 * Geometry match across all three location representations.
 *
 * A single point column is not enough: a mobile billboard van has no meaningful
 * fixed point, and must surface when its operating area (polygon or centre +
 * radius) or its route intersects the viewport.
 */
function geometryMatches(envelope: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(
    l."geog" IS NOT NULL AND ST_Intersects(l."geog", ${envelope})
    OR EXISTS (
      SELECT 1 FROM "OperatingArea" oa
       WHERE oa."assetId" = a."id"
         AND (
           (oa."area" IS NOT NULL AND ST_Intersects(oa."area", ${envelope}))
           OR (
             oa."centerLat" IS NOT NULL
             AND oa."centerLng" IS NOT NULL
             AND oa."radiusMeters" IS NOT NULL
             AND ST_DWithin(
               ST_SetSRID(ST_MakePoint(oa."centerLng", oa."centerLat"), 4326)::geography,
               ${envelope},
               oa."radiusMeters"
             )
           )
         )
    )
    OR EXISTS (
      SELECT 1 FROM "Route" r
       WHERE r."assetId" = a."id"
         AND r."path" IS NOT NULL
         AND ST_Intersects(r."path", ${envelope})
    )
  )`;
}

function envelopeFor(filters: SpatialSearchFilters): Prisma.Sql | null {
  if (filters.bbox) {
    const { minLng, minLat, maxLng, maxLat } = filters.bbox;
    return Prisma.sql`ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography`;
  }
  if (filters.center) {
    // A buffered point, so the same intersection logic serves radius search.
    const { lat, lng, radiusMeters } = filters.center;
    return Prisma.sql`ST_Buffer(
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )`;
  }
  return null;
}

/** Builds the shared WHERE clause for both the row and count queries. */
function buildConditions(filters: SpatialSearchFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [searchableAsset];

  const envelope = envelopeFor(filters);
  if (envelope) conditions.push(geometryMatches(envelope));

  if (filters.categorySlugs?.length) {
    conditions.push(
      Prisma.sql`c."slug" IN (${Prisma.join(filters.categorySlugs)})`,
    );
  }
  if (filters.typeSlugs?.length) {
    conditions.push(Prisma.sql`t."slug" IN (${Prisma.join(filters.typeSlugs)})`);
  }
  if (filters.locationModes?.length) {
    conditions.push(
      Prisma.sql`a."locationMode"::text IN (${Prisma.join(filters.locationModes)})`,
    );
  }
  if (filters.city) {
    conditions.push(Prisma.sql`l."city" ILIKE ${filters.city}`);
  }
  if (filters.query) {
    const like = `%${filters.query}%`;
    conditions.push(
      Prisma.sql`(
        a."title" ILIKE ${like}
        OR l."locality" ILIKE ${like}
        OR l."city" ILIKE ${like}
        OR l."areaLabel" ILIKE ${like}
        OR t."name" ILIKE ${like}
      )`,
    );
  }
  if (filters.isDigital !== undefined) {
    conditions.push(Prisma.sql`t."isDigital" = ${filters.isDigital}`);
  }
  if (filters.isMobile !== undefined) {
    conditions.push(Prisma.sql`t."isMobile" = ${filters.isMobile}`);
  }
  if (filters.minImpressions !== undefined) {
    conditions.push(
      Prisma.sql`a."dailyImpressions" >= ${filters.minImpressions}`,
    );
  }

  // `verifiedOnly` is a no-op against the base predicate (unverified assets are
  // never searchable), but is accepted so the UI filter has a real binding.
  if (filters.verifiedOnly) {
    conditions.push(Prisma.sql`a."verificationStatus" = 'VERIFIED'`);
  }

  if (filters.priceMin !== undefined) {
    conditions.push(Prisma.sql`price."amount" >= ${filters.priceMin}`);
  }
  if (filters.priceMax !== undefined) {
    conditions.push(Prisma.sql`price."amount" <= ${filters.priceMax}`);
  }

  // Availability: exclude assets already holding inventory over the requested
  // window, or blocked by the owner. Mirrors the exclusion constraint's logic
  // so search never surfaces something the booking step would reject.
  if (filters.availableFrom && filters.availableTo) {
    const from = filters.availableFrom;
    const to = filters.availableTo;
    conditions.push(Prisma.sql`
      NOT EXISTS (
        SELECT 1 FROM "BookingItem" bi
         WHERE bi."assetId" = a."id"
           AND bi."holdsInventory" = true
           AND bi."bookingModel" <> 'DIGITAL_SLOT'
           AND bi."period" && tstzrange(${from}, ${to}, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AssetAvailability" av
         WHERE av."assetId" = a."id"
           AND av."kind" IN ('BLOCKED', 'MAINTENANCE')
           AND av."startDate" < ${to}
           AND av."endDate" > ${from}
      )
    `);
  }

  return conditions;
}

/**
 * Joins the default price row. LATERAL so each asset contributes at most one
 * price even when several pricing units exist, keeping row counts honest.
 */
const priceJoin = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT p."amount", p."unit"::text AS "unit", p."currency"
      FROM "AssetPricing" p
     WHERE p."assetId" = a."id"
     ORDER BY p."isDefault" DESC, p."amount" ASC
     LIMIT 1
  ) price ON true
`;

const imageJoin = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT img."url"
      FROM "AssetImage" img
     WHERE img."assetId" = a."id"
     ORDER BY img."isPrimary" DESC, img."sortOrder" ASC
     LIMIT 1
  ) image ON true
`;

const baseJoins = Prisma.sql`
  FROM "Asset" a
  JOIN "AssetCategory" c ON c."id" = a."categoryId"
  JOIN "AssetType" t ON t."id" = a."typeId"
  JOIN "MediaOwner" o ON o."id" = a."ownerId"
  LEFT JOIN "AssetLocation" l ON l."assetId" = a."id"
  ${priceJoin}
  ${imageJoin}
`;

function orderBy(filters: SpatialSearchFilters): Prisma.Sql {
  switch (filters.sort) {
    case "price_asc":
      return Prisma.sql`ORDER BY price."amount" ASC NULLS LAST`;
    case "price_desc":
      return Prisma.sql`ORDER BY price."amount" DESC NULLS LAST`;
    case "rating":
      return Prisma.sql`ORDER BY a."ratingAverage" DESC, a."ratingCount" DESC`;
    case "impressions":
      return Prisma.sql`ORDER BY a."dailyImpressions" DESC NULLS LAST`;
    default:
      return Prisma.sql`ORDER BY a."isFeatured" DESC, a."ratingAverage" DESC, a."createdAt" DESC`;
  }
}

/** Individual assets matching the viewport and filters. */
export async function searchAssets(
  filters: SpatialSearchFilters,
): Promise<SpatialSearchRow[]> {
  const conditions = buildConditions(filters);
  const limit = Math.min(filters.limit ?? 60, 250);
  const offset = filters.offset ?? 0;

  const distanceSelect = filters.center
    ? Prisma.sql`, ST_Distance(
        l."geog",
        ST_SetSRID(ST_MakePoint(${filters.center.lng}, ${filters.center.lat}), 4326)::geography
      ) AS "distanceMeters"`
    : Prisma.sql`, NULL::float AS "distanceMeters"`;

  const rows = await prisma.$queryRaw`
    SELECT
      a."id", a."slug", a."title",
      l."lat", l."lng", l."city", l."locality", l."areaLabel",
      c."slug" AS "categorySlug", c."name" AS "categoryName",
      t."slug" AS "typeSlug", t."name" AS "typeName",
      t."isDigital", t."isMobile",
      a."locationMode"::text AS "locationMode",
      a."bookingModel"::text AS "bookingModel",
      a."verificationStatus"::text AS "verificationStatus",
      a."dailyImpressions", a."ratingAverage", a."ratingCount", a."isFeatured",
      a."specs",
      o."companyName" AS "ownerName",
      price."amount" AS "priceAmount",
      price."unit" AS "priceUnit",
      price."currency",
      image."url" AS "imageUrl"
      ${distanceSelect}
    ${baseJoins}
    WHERE ${Prisma.join(conditions, " AND ")}
    ${orderBy(filters)}
    LIMIT ${limit} OFFSET ${offset}
  `;

  return z.array(searchRowSchema).parse(rows);
}

/** Total matching the filters, for "N results in this area". */
export async function countAssets(
  filters: SpatialSearchFilters,
): Promise<number> {
  const conditions = buildConditions(filters);

  const rows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT a."id") AS "count"
    ${baseJoins}
    WHERE ${Prisma.join(conditions, " AND ")}
  `;

  const parsed = z.array(z.object({ count: countValue })).parse(rows);
  return parsed[0]?.count ?? 0;
}

/**
 * Server-side clustering via ST_SnapToGrid.
 *
 * Deliberately not client-side: Supercluster would require shipping every pin
 * to the browser. That is fine for 50 seeded assets and wrong at real scale,
 * and the API shape is identical either way — so it is built correctly now.
 *
 * Grid size is derived from zoom so clusters stay visually even as the user
 * zooms.
 */
export async function clusterAssets(
  filters: SpatialSearchFilters,
  zoom: number,
): Promise<SpatialCluster[]> {
  const conditions = buildConditions(filters);

  // Roughly one cluster cell per ~60px at the given zoom.
  const gridSize = Math.max(360 / 2 ** (zoom + 2), 0.0005);

  const rows = await prisma.$queryRaw`
    SELECT
      ST_Y(ST_Centroid(ST_Collect(pt))) AS "lat",
      ST_X(ST_Centroid(ST_Collect(pt))) AS "lng",
      COUNT(*) AS "count",
      MIN("amount")::int AS "minPrice"
    FROM (
      SELECT
        ST_SetSRID(ST_MakePoint(l."lng", l."lat"), 4326) AS pt,
        ST_SnapToGrid(ST_SetSRID(ST_MakePoint(l."lng", l."lat"), 4326), ${gridSize}) AS cell,
        price."amount"
      ${baseJoins}
      WHERE ${Prisma.join(conditions, " AND ")}
        AND l."lat" IS NOT NULL AND l."lng" IS NOT NULL
    ) grid
    GROUP BY cell
  `;

  return z.array(clusterRowSchema).parse(rows);
}

// ---------------------------------------------------------------------------
// Writes — geography columns are unreachable through the typed client
// ---------------------------------------------------------------------------

/**
 * Sets an asset's point location, keeping `geog` and the denormalised lat/lng
 * in a single statement so they cannot drift.
 */
export async function setAssetPoint(
  assetId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "AssetLocation"
       SET "geog" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
           "lat" = ${lat},
           "lng" = ${lng},
           "updatedAt" = NOW()
     WHERE "assetId" = ${assetId}
  `;
}

/** Sets a polygon service area from an ordered ring of [lng, lat] pairs. */
export async function setOperatingAreaPolygon(
  operatingAreaId: string,
  ring: Array<[number, number]>,
): Promise<void> {
  // Close the ring if the caller did not — PostGIS rejects open polygons.
  const closed = [...ring];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    closed.push(first);
  }

  const wkt = `POLYGON((${closed.map(([lng, lat]) => `${lng} ${lat}`).join(", ")}))`;

  await prisma.$executeRaw`
    UPDATE "OperatingArea"
       SET "area" = ST_GeogFromText(${`SRID=4326;${wkt}`})
     WHERE "id" = ${operatingAreaId}
  `;
}

/** Sets a route path from an ordered list of [lng, lat] pairs. */
export async function setRoutePath(
  routeId: string,
  points: Array<[number, number]>,
): Promise<void> {
  const wkt = `LINESTRING(${points.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`;

  await prisma.$executeRaw`
    UPDATE "Route"
       SET "path" = ST_GeogFromText(${`SRID=4326;${wkt}`}),
           "lengthKm" = ST_Length(ST_GeogFromText(${`SRID=4326;${wkt}`})) / 1000.0
     WHERE "id" = ${routeId}
  `;
}

// ---------------------------------------------------------------------------
// Sale listings — parallel functions, not shared with the advertising side
//
// searchAssets/countAssets/clusterAssets above are built around a single
// invariant ("only ACTIVE + VERIFIED are visible to advertisers") and a fixed
// advertising-shaped projection. Parameterising them to also serve sale
// listings would turn that invariant into something no longer enforceable by
// reading the code, and would need a branching SELECT list.
//
// The decisive reason for separate functions, though, is privacy: an
// APPROXIMATE sale listing must never emit exact coordinates, which is a
// PROJECTION difference with no advertising-side analogue. A shared function
// would carry a "should I lie about the coordinates" flag through a code path
// where forgetting it is a privacy breach with no test to catch it. These
// functions instead have exactly one coordinate expression each, and it is
// always the pre-computed public point — never AssetLocation.geog/lat/lng.
// ---------------------------------------------------------------------------

const saleSearchRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  city: z.string().nullable(),
  locality: z.string().nullable(),
  areaLabel: z.string().nullable(),
  locationPrecision: z.string(),
  categorySlug: z.string(),
  categoryName: z.string(),
  typeSlug: z.string(),
  typeName: z.string(),
  ownershipType: z.string(),
  askingPriceAmount: z.number().int(),
  currency: z.string(),
  negotiable: z.boolean(),
  currentAnnualRevenue: z.number().int().nullable(),
  expectedRoiPercent: z.number().int().nullable(),
  ownerName: z.string(),
  imageUrl: z.string().nullable(),
  createdAt: z.date(),
  distanceMeters: z.number().nullable().optional(),
});

export type SaleSpatialSearchRow = z.infer<typeof saleSearchRowSchema>;

const saleClusterRowSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  count: countValue,
  minPrice: z.number().int().nullable(),
});

export type SaleSpatialCluster = z.infer<typeof saleClusterRowSchema>;

export interface SaleSpatialSearchFilters {
  bbox?: BoundingBox;
  center?: { lat: number; lng: number; radiusMeters: number };
  categorySlugs?: string[];
  typeSlugs?: string[];
  city?: string;
  query?: string;
  priceMin?: number;
  priceMax?: number;
  ownershipTypes?: string[];
  inclusions?: string[];
  negotiableOnly?: boolean;
  revenueDisclosedOnly?: boolean;
  roiDisclosedOnly?: boolean;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
}

/** Only PUBLISHED listings are ever visible publicly. Matches SaleListing_searchable_idx. */
const searchableSaleListing = Prisma.sql`sl."status" = 'PUBLISHED'`;

/**
 * The bbox/radius envelope, matched against the asset's TRUE location.
 *
 * Filter on truth, project approximation: an APPROXIMATE listing must still
 * appear in a search that covers its real location — hiding it would harm
 * the seller for no privacy gain, since the buyer already knows what they
 * searched. Only the coordinates returned to the client are ever snapped;
 * this WHERE clause is not public output.
 */
function saleEnvelopeFor(filters: SaleSpatialSearchFilters): Prisma.Sql | null {
  if (filters.bbox) {
    const { minLng, minLat, maxLng, maxLat } = filters.bbox;
    return Prisma.sql`ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography`;
  }
  if (filters.center) {
    const { lat, lng, radiusMeters } = filters.center;
    return Prisma.sql`ST_Buffer(
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )`;
  }
  return null;
}

function buildSaleConditions(filters: SaleSpatialSearchFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [searchableSaleListing];

  const envelope = saleEnvelopeFor(filters);
  if (envelope) {
    conditions.push(Prisma.sql`l."geog" IS NOT NULL AND ST_Intersects(l."geog", ${envelope})`);
  }

  if (filters.categorySlugs?.length) {
    conditions.push(
      Prisma.sql`c."slug" IN (${Prisma.join(filters.categorySlugs)})`,
    );
  }
  if (filters.typeSlugs?.length) {
    conditions.push(Prisma.sql`t."slug" IN (${Prisma.join(filters.typeSlugs)})`);
  }
  if (filters.city) {
    conditions.push(Prisma.sql`sl."publicCity" ILIKE ${filters.city}`);
  }
  if (filters.query) {
    const like = `%${filters.query}%`;
    conditions.push(
      Prisma.sql`(
        a."title" ILIKE ${like}
        OR sl."publicLocality" ILIKE ${like}
        OR sl."publicCity" ILIKE ${like}
        OR t."name" ILIKE ${like}
      )`,
    );
  }
  if (filters.priceMin !== undefined) {
    conditions.push(Prisma.sql`sl."askingPriceAmount" >= ${filters.priceMin}`);
  }
  if (filters.priceMax !== undefined) {
    conditions.push(Prisma.sql`sl."askingPriceAmount" <= ${filters.priceMax}`);
  }
  if (filters.ownershipTypes?.length) {
    conditions.push(
      Prisma.sql`sl."ownershipType"::text IN (${Prisma.join(filters.ownershipTypes)})`,
    );
  }
  if (filters.inclusions?.length) {
    conditions.push(
      Prisma.sql`sl."inclusions" && ARRAY[${Prisma.join(filters.inclusions)}]::"SaleInclusion"[]`,
    );
  }
  if (filters.negotiableOnly) {
    conditions.push(Prisma.sql`sl."negotiable" = true`);
  }
  if (filters.revenueDisclosedOnly) {
    conditions.push(Prisma.sql`sl."currentAnnualRevenue" IS NOT NULL`);
  }
  if (filters.roiDisclosedOnly) {
    conditions.push(Prisma.sql`sl."expectedRoiPercent" IS NOT NULL`);
  }

  return conditions;
}

const saleImageJoin = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT img."url"
      FROM "AssetImage" img
     WHERE img."assetId" = a."id"
     ORDER BY img."isPrimary" DESC, img."sortOrder" ASC
     LIMIT 1
  ) image ON true
`;

const saleBaseJoins = Prisma.sql`
  FROM "SaleListing" sl
  JOIN "Asset" a ON a."id" = sl."assetId"
  JOIN "AssetCategory" c ON c."id" = a."categoryId"
  JOIN "AssetType" t ON t."id" = a."typeId"
  JOIN "MediaOwner" o ON o."id" = sl."ownerId"
  LEFT JOIN "AssetLocation" l ON l."assetId" = a."id"
  ${saleImageJoin}
`;

function saleOrderBy(filters: SaleSpatialSearchFilters): Prisma.Sql {
  switch (filters.sort) {
    case "price_asc":
      return Prisma.sql`ORDER BY sl."askingPriceAmount" ASC`;
    case "price_desc":
      return Prisma.sql`ORDER BY sl."askingPriceAmount" DESC`;
    case "newest":
      return Prisma.sql`ORDER BY sl."publishedAt" DESC`;
    default:
      return Prisma.sql`ORDER BY sl."publishedAt" DESC`;
  }
}

/**
 * Individual sale listings matching the viewport and filters.
 *
 * The ONLY coordinate expression here is the pre-computed public point
 * (sl."publicLat"/sl."publicLng") — never the asset's true location. For an
 * EXACT-precision listing those are copies of the true point, written once
 * at publish by publishSaleListingLocation below; for APPROXIMATE they are a
 * deterministic grid-cell centre. Either way this function cannot leak
 * anything beyond what publish already committed to.
 */
export async function searchSaleListings(
  filters: SaleSpatialSearchFilters,
): Promise<SaleSpatialSearchRow[]> {
  const conditions = buildSaleConditions(filters);
  const limit = Math.min(filters.limit ?? 60, 250);
  const offset = filters.offset ?? 0;

  const distanceSelect = filters.center
    ? Prisma.sql`, ST_Distance(
        l."geog",
        ST_SetSRID(ST_MakePoint(${filters.center.lng}, ${filters.center.lat}), 4326)::geography
      ) AS "distanceMeters"`
    : Prisma.sql`, NULL::float AS "distanceMeters"`;

  const rows = await prisma.$queryRaw`
    SELECT
      sl."id", sl."slug", a."title",
      sl."publicLat" AS "lat", sl."publicLng" AS "lng",
      sl."publicCity" AS "city", sl."publicLocality" AS "locality",
      sl."publicAreaLabel" AS "areaLabel",
      sl."locationPrecision"::text AS "locationPrecision",
      c."slug" AS "categorySlug", c."name" AS "categoryName",
      t."slug" AS "typeSlug", t."name" AS "typeName",
      sl."ownershipType"::text AS "ownershipType",
      sl."askingPriceAmount", sl."currency", sl."negotiable",
      sl."currentAnnualRevenue", sl."expectedRoiPercent",
      o."companyName" AS "ownerName",
      image."url" AS "imageUrl",
      sl."createdAt"
      ${distanceSelect}
    ${saleBaseJoins}
    WHERE ${Prisma.join(conditions, " AND ")}
    ${saleOrderBy(filters)}
    LIMIT ${limit} OFFSET ${offset}
  `;

  return z.array(saleSearchRowSchema).parse(rows);
}

/** Total matching the filters, for "N results in this area". */
export async function countSaleListings(
  filters: SaleSpatialSearchFilters,
): Promise<number> {
  const conditions = buildSaleConditions(filters);

  const rows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT sl."id") AS "count"
    ${saleBaseJoins}
    WHERE ${Prisma.join(conditions, " AND ")}
  `;

  const parsed = z.array(z.object({ count: countValue })).parse(rows);
  return parsed[0]?.count ?? 0;
}

/** Server-side clustering for the sale map, mirroring clusterAssets. */
export async function clusterSaleListings(
  filters: SaleSpatialSearchFilters,
  zoom: number,
): Promise<SaleSpatialCluster[]> {
  const conditions = buildSaleConditions(filters);

  const gridSize = Math.max(360 / 2 ** (zoom + 2), 0.0005);

  const rows = await prisma.$queryRaw`
    SELECT
      ST_Y(ST_Centroid(ST_Collect(pt))) AS "lat",
      ST_X(ST_Centroid(ST_Collect(pt))) AS "lng",
      COUNT(*) AS "count",
      MIN("askingPriceAmount")::int AS "minPrice"
    FROM (
      SELECT
        ST_SetSRID(ST_MakePoint(sl."publicLng", sl."publicLat"), 4326) AS pt,
        ST_SnapToGrid(ST_SetSRID(ST_MakePoint(sl."publicLng", sl."publicLat"), 4326), ${gridSize}) AS cell,
        sl."askingPriceAmount"
      ${saleBaseJoins}
      WHERE ${Prisma.join(conditions, " AND ")}
        AND sl."publicLat" IS NOT NULL AND sl."publicLng" IS NOT NULL
    ) grid
    GROUP BY cell
  `;

  return z.array(saleClusterRowSchema).parse(rows);
}

/**
 * Derives and persists a sale listing's public point from its asset's true
 * location. Called exactly once, at publish — never per request.
 *
 * Per-request jitter with zero mean converges on the true point at
 * O(1/sqrt(N)) over repeated API calls: ~100 samples recover the position to
 * a tenth of the jitter radius. A persisted, deterministic point instead
 * means N requests reveal exactly what 1 reveals. For EXACT precision the
 * true point is copied through unchanged; for APPROXIMATE it is snapped to a
 * ~1.1km grid CELL CENTRE (the 0.005 offset before flooring — a corner-snapped
 * point is systematically biased toward the origin, which would give away
 * half a cell for free).
 */
export async function publishSaleListingLocation(
  saleListingId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "SaleListing" sl
       SET "publicGeog" = CASE
             WHEN sl."locationPrecision" = 'EXACT' THEN al."geog"
             ELSE ST_SetSRID(
                    ST_SnapToGrid(al."geog"::geometry, 0.005, 0.005, 0.01, 0.01),
                    4326
                  )::geography
           END,
           "publicLat" = CASE
             WHEN sl."locationPrecision" = 'EXACT' THEN al."lat"
             ELSE ROUND((FLOOR(al."lat" / 0.01) * 0.01 + 0.005)::numeric, 6)::float8
           END,
           "publicLng" = CASE
             WHEN sl."locationPrecision" = 'EXACT' THEN al."lng"
             ELSE ROUND((FLOOR(al."lng" / 0.01) * 0.01 + 0.005)::numeric, 6)::float8
           END,
           -- Address granularity follows the same rule: leaking a street
           -- address for an APPROXIMATE listing would defeat the coordinate
           -- snapping entirely, so it is never copied through for one.
           "publicLocality" = CASE
             WHEN sl."locationPrecision" = 'EXACT' THEN al."locality"
             ELSE NULL
           END,
           "publicCity" = al."city",
           "publicState" = al."state",
           "publicAreaLabel" = al."areaLabel",
           "updatedAt" = NOW()
      FROM "AssetLocation" al
     WHERE al."assetId" = sl."assetId"
       AND sl."id" = ${saleListingId}
  `;
}
