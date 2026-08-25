/**
 * Search-layer test:  pnpm test:search
 *
 * Exercises the spatial query layer directly (no HTTP), covering the filter
 * combinations the Explore page depends on and the invariants that are easy to
 * regress silently.
 */
// dotenv MUST load before anything that reads process.env at module scope —
// src/server/db/client.ts throws on a missing DATABASE_URL during import.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { searchAssets, countAssets, clusterAssets } from "../src/server/db/spatial";
import { parseSearchParams, toSpatialFilters } from "../src/lib/search-params";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const MUMBAI_BBOX = {
  minLng: 72.7,
  minLat: 18.8,
  maxLng: 73.1,
  maxLat: 19.4,
};

async function main() {
  console.log("\nZuperGo search-layer test\n");

  // --- Baseline -----------------------------------------------------------
  const all = await countAssets({});
  check("Unfiltered search", all === 50, `${all} searchable assets`);

  // --- Bounds -------------------------------------------------------------
  const inBounds = await countAssets({ bbox: MUMBAI_BBOX });
  check("Bounds query covers Mumbai", inBounds === 50, `${inBounds} in bbox`);

  // A bbox over open sea must return nothing — proves the predicate actually
  // constrains rather than being ignored.
  const empty = await countAssets({
    bbox: { minLng: 60, minLat: 5, maxLng: 61, maxLat: 6 },
  });
  check("Bounds excludes elsewhere", empty === 0, `${empty} in Arabian Sea bbox`);

  // --- Category / type filters -------------------------------------------
  const digital = await countAssets({ isDigital: true });
  const mobile = await countAssets({ isMobile: true });
  check("Digital filter", digital === 10, `${digital} digital assets`);
  check("Mobile filter", mobile === 10, `${mobile} mobile assets`);

  const byCategory = await countAssets({ categorySlugs: ["fixed-outdoor"] });
  check("Category filter", byCategory === 20, `${byCategory} fixed-outdoor`);

  const byType = await countAssets({ typeSlugs: ["billboard"] });
  check("Type filter", byType > 0 && byType < 20, `${byType} billboards`);

  // --- Price --------------------------------------------------------------
  const cheap = await searchAssets({ priceMax: 5_000_000, sort: "price_asc" });
  const overPriced = cheap.filter(
    (a) => a.priceAmount !== null && a.priceAmount > 5_000_000,
  );
  check(
    "Price ceiling respected",
    overPriced.length === 0,
    `${cheap.length} under ₹50,000, ${overPriced.length} violations`,
  );

  const ascending = cheap
    .map((a) => a.priceAmount ?? 0)
    .every((v, i, arr) => i === 0 || arr[i - 1] <= v);
  check("Price sort ascending", ascending, `${cheap.length} rows ordered`);

  // --- Text search --------------------------------------------------------
  const textHits = await searchAssets({ query: "BKC" });
  check("Text search finds BKC", textHits.length > 0, `${textHits.length} matches`);

  // --- Radius + the mobile-distance invariant ----------------------------
  const bkc = { lat: 19.0662, lng: 72.8686, radiusMeters: 3000 };
  const nearBkc = await searchAssets({ center: bkc });
  check("Radius search returns results", nearBkc.length > 0, `${nearBkc.length} within 3km`);

  // Mobile assets legitimately match via operating area even when their base
  // point is far away, so a fixed asset outside the radius would be a real bug.
  const fixedOutside = nearBkc.filter(
    (a) => !a.isMobile && a.distanceMeters != null && a.distanceMeters > 3100,
  );
  check(
    "No fixed asset outside the radius",
    fixedOutside.length === 0,
    `${fixedOutside.length} violations`,
  );

  const mobileMatched = nearBkc.filter((a) => a.isMobile);
  check(
    "Mobile assets match via operating area",
    mobileMatched.length > 0,
    `${mobileMatched.length} mobile assets serve BKC`,
  );

  // --- Availability -------------------------------------------------------
  const from = new Date("2027-06-01");
  const to = new Date("2027-06-30");
  const available = await countAssets({ availableFrom: from, availableTo: to });
  check("Availability filter runs", available > 0, `${available} free in Jun 2027`);

  // --- Clustering ---------------------------------------------------------
  const clusters = await clusterAssets({ bbox: MUMBAI_BBOX }, 10);
  const clustered = clusters.reduce((sum, c) => sum + c.count, 0);
  check(
    "Clusters account for every asset",
    clustered === 50,
    `${clusters.length} clusters, ${clustered} assets`,
  );

  const tighter = await clusterAssets({ bbox: MUMBAI_BBOX }, 13);
  check(
    "Higher zoom splits clusters",
    tighter.length >= clusters.length,
    `zoom10=${clusters.length} -> zoom13=${tighter.length}`,
  );

  // --- Pagination ---------------------------------------------------------
  const page1 = await searchAssets({ limit: 10, offset: 0, sort: "price_asc" });
  const page2 = await searchAssets({ limit: 10, offset: 10, sort: "price_asc" });
  const overlap = page1.filter((a) => page2.some((b) => b.id === a.id));
  check("Pagination does not repeat rows", overlap.length === 0, `${overlap.length} duplicates`);

  // --- URL param plumbing -------------------------------------------------
  const parsed = parseSearchParams(
    new URLSearchParams(
      "q=billboard&categories=fixed-outdoor,digital-dooh&priceMax=100000&digital=true&sort=price_asc&page=2",
    ),
  );
  const filters = toSpatialFilters(parsed);
  check(
    "URL params map to filters",
    filters.categorySlugs?.length === 2 &&
      filters.priceMax === 10_000_000 &&
      filters.isDigital === true &&
      filters.offset === 24,
    `categories=${filters.categorySlugs?.length}, priceMax=${filters.priceMax}p, offset=${filters.offset}`,
  );

  // Combined filters must narrow, never widen.
  const combined = await countAssets({
    bbox: MUMBAI_BBOX,
    isDigital: true,
    priceMax: 500_000,
  });
  check(
    "Combined filters narrow results",
    combined <= digital,
    `${combined} <= ${digital} digital`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Search test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
