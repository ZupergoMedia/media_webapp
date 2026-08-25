/**
 * Data-layer smoke test:  pnpm db:smoke
 *
 * Verifies the things that are easy to get quietly wrong — PostGIS presence,
 * geog/lat/lng agreement, radius and bounds queries, and the three geometry
 * sources the search query unions across.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { LOCALITIES } from "./mumbai";
import "dotenv/config";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;

function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

async function main() {
  console.log("\nZuperGo data-layer smoke test\n");

  const [{ postgis_version: version }] = await prisma.$queryRaw<
    Array<{ postgis_version: string }>
  >`SELECT postgis_version()`;
  check("PostGIS installed", Boolean(version), version);

  const assets = await prisma.asset.count();
  const searchable = await prisma.asset.count({
    where: { status: "ACTIVE", verificationStatus: "VERIFIED" },
  });
  check("Assets seeded", assets === 50, `${assets} total, ${searchable} searchable`);

  // Every fixed/venue asset must have a geography point, or it can never appear
  // on the map regardless of how correct the query is.
  const [{ count: missingGeog }] = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*) AS count FROM "AssetLocation" WHERE "geog" IS NULL`;
  check("All locations have geog", Number(missingGeog) === 0, `${missingGeog} missing`);

  // The denormalised lat/lng must agree with geog, since list rendering trusts
  // them while spatial queries trust geog. Drift here shows as pins that do not
  // match their own search results.
  const [{ count: drifted }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
      FROM "AssetLocation"
     WHERE "geog" IS NOT NULL
       AND (ABS(ST_Y("geog"::geometry) - "lat") > 0.000001
         OR ABS(ST_X("geog"::geometry) - "lng") > 0.000001)
  `;
  check("lat/lng agree with geog", Number(drifted) === 0, `${drifted} rows drifted`);

  // Radius search around BKC — the plan's stated verification.
  const bkc = LOCALITIES.bkc;
  const nearby = await prisma.$queryRaw<Array<{ title: string; m: number }>>`
    SELECT a."title",
           ST_Distance(l."geog", ST_SetSRID(ST_MakePoint(${bkc.lng}, ${bkc.lat}), 4326)::geography) AS m
      FROM "Asset" a
      JOIN "AssetLocation" l ON l."assetId" = a."id"
     WHERE ST_DWithin(l."geog", ST_SetSRID(ST_MakePoint(${bkc.lng}, ${bkc.lat}), 4326)::geography, 5000)
     ORDER BY m ASC
  `;
  check("ST_DWithin 5km of BKC", nearby.length > 0, `${nearby.length} assets`);
  if (nearby[0]) {
    console.log(`        nearest: ${nearby[0].title} (${Math.round(nearby[0].m)}m)`);
  }

  // Bounds query over greater Mumbai.
  const inBounds = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
      FROM "Asset" a
      JOIN "AssetLocation" l ON l."assetId" = a."id"
     WHERE ST_Intersects(l."geog", ST_MakeEnvelope(72.75, 18.90, 73.05, 19.30, 4326)::geography)
  `;
  check(
    "ST_MakeEnvelope over Mumbai",
    Number(inBounds[0].count) > 40,
    `${inBounds[0].count} assets in bounds`,
  );

  // Mobile assets must be reachable via operating area, not just a point —
  // this is the case a point-only schema would silently drop.
  const areas = await prisma.operatingArea.count();
  const routes = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "Route" WHERE "path" IS NOT NULL
  `;
  check("Operating areas seeded", areas > 0, `${areas} areas`);
  check("Route paths seeded", Number(routes[0].count) > 0, `${routes[0].count} routes with geometry`);

  const [{ km }] = await prisma.$queryRaw<Array<{ km: number | null }>>`
    SELECT ROUND("lengthKm"::numeric, 1)::float AS km FROM "Route" WHERE "path" IS NOT NULL LIMIT 1
  `;
  check("Route length computed", km !== null && km > 0, `${km} km`);

  const digital = await prisma.digitalInventory.count();
  check("Digital inventory seeded", digital > 0, `${digital} screens with slot economics`);

  const types = await prisma.assetType.count();
  const withSpecs = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "AssetType" WHERE jsonb_array_length("specSchema") > 0
  `;
  check(
    "Asset types carry spec schemas",
    Number(withSpecs[0].count) === types,
    `${withSpecs[0].count}/${types} types`,
  );

  console.log(
    failures === 0
      ? "\nAll checks passed.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Smoke test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
