/**
 * Owner flow test:  pnpm test:owner
 *
 * Covers listing creation and the invariants that protect the marketplace:
 * new assets must not be publicly visible before verification, ownership must
 * be enforced at the data layer, and type-specific specs must be validated from
 * the database descriptors rather than hardcoded rules.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  createAsset,
  getOwnerDashboard,
  updateAssetStatus,
} from "../src/server/services/owner-service";
import { countAssets } from "../src/server/db/spatial";
import { buildSpecValidator, parseSpecSchema } from "../src/lib/specs";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const TEST_TITLE_PREFIX = "ZZ Owner Test";

async function cleanup() {
  await prisma.asset.deleteMany({
    where: { title: { startsWith: TEST_TITLE_PREFIX } },
  });
}

async function main() {
  console.log("\nZuperGo owner flow test\n");

  await cleanup();

  const owners = await prisma.mediaOwner.findMany({
    take: 2,
    orderBy: { createdAt: "asc" },
    select: { id: true, companyName: true },
  });
  const [owner, otherOwner] = owners;
  if (!owner || !otherOwner) throw new Error("Need two seeded media owners.");

  const billboardType = await prisma.assetType.findUniqueOrThrow({
    where: { slug: "billboard" },
  });
  const screenType = await prisma.assetType.findUniqueOrThrow({
    where: { slug: "led-billboard" },
  });
  const vanType = await prisma.assetType.findUniqueOrThrow({
    where: { slug: "van" },
  });

  const searchableBefore = await countAssets({});

  // --- Creation -----------------------------------------------------------
  const created = await createAsset({
    ownerId: owner.id,
    typeId: billboardType.id,
    title: `${TEST_TITLE_PREFIX} Billboard`,
    specs: {
      widthFt: 30,
      heightFt: 15,
      illumination: "Backlit",
      orientation: "Landscape",
    },
    location: {
      city: "Mumbai",
      state: "Maharashtra",
      locality: "Test Locality",
      lat: 19.05,
      lng: 72.85,
    },
    images: [{ url: "https://picsum.photos/seed/owner-test/1200/800" }],
    pricing: [{ unit: "PER_MONTH", amount: 12_500_000 }],
  });

  check("Creates an asset", Boolean(created.id), created.slug);
  check("New asset is DRAFT", created.status === "DRAFT", created.status);
  check(
    "New asset is PENDING verification",
    created.verificationStatus === "PENDING",
    created.verificationStatus,
  );

  // The single most important invariant in this step: an unverified listing
  // must be invisible to buyers no matter how it was created.
  const searchableAfter = await countAssets({});
  check(
    "Unverified asset is NOT searchable",
    searchableAfter === searchableBefore,
    `${searchableBefore} before, ${searchableAfter} after`,
  );

  const verificationRecord = await prisma.verification.findFirst({
    where: { assetId: created.id },
  });
  check(
    "Opens an admin review record",
    verificationRecord?.status === "PENDING",
    verificationRecord?.status ?? "none",
  );

  // Geography must be written separately; without it the asset can never be
  // found by a bounds or radius query even once verified.
  const [geo] = await prisma.$queryRaw<Array<{ has_geog: boolean }>>`
    SELECT ("geog" IS NOT NULL) AS has_geog
      FROM "AssetLocation" WHERE "assetId" = ${created.id}
  `;
  check("Geography point written", geo?.has_geog === true, `geog=${geo?.has_geog}`);

  // --- Verification makes it visible --------------------------------------
  await prisma.asset.update({
    where: { id: created.id },
    data: { status: "ACTIVE", verificationStatus: "VERIFIED" },
  });

  const afterVerify = await countAssets({});
  check(
    "Verified asset becomes searchable",
    afterVerify === searchableBefore + 1,
    `${afterVerify} searchable`,
  );

  // Confirms the point is genuinely usable for spatial search, not just present.
  const nearby = await countAssets({
    center: { lat: 19.05, lng: 72.85, radiusMeters: 1000 },
  });
  check("Findable by radius search", nearby > 0, `${nearby} within 1km`);

  // --- Ownership scoping --------------------------------------------------
  const wrongOwner = await updateAssetStatus(otherOwner.id, created.id, "PAUSED");
  check(
    "Another owner cannot change status",
    wrongOwner === false,
    "update affected 0 rows",
  );

  const stillActive = await prisma.asset.findUniqueOrThrow({
    where: { id: created.id },
    select: { status: true },
  });
  check("Asset unchanged by foreign owner", stillActive.status === "ACTIVE", stillActive.status);

  const rightOwner = await updateAssetStatus(owner.id, created.id, "PAUSED");
  check("Real owner can pause", rightOwner === true, "paused");

  const pausedCount = await countAssets({});
  check(
    "Paused asset leaves search",
    pausedCount === searchableBefore,
    `${pausedCount} searchable`,
  );

  // --- Digital and mobile extras -----------------------------------------
  const digital = await createAsset({
    ownerId: owner.id,
    typeId: screenType.id,
    title: `${TEST_TITLE_PREFIX} Screen`,
    specs: {
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
    },
    location: { city: "Mumbai", state: "Maharashtra", lat: 19.06, lng: 72.86 },
    images: [{ url: "https://picsum.photos/seed/owner-screen/1200/800" }],
    pricing: [{ unit: "PER_SLOT", amount: 400_000 }],
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      operatingHoursStart: 6,
      operatingHoursEnd: 23,
    },
  });

  const inventory = await prisma.digitalInventory.findUnique({
    where: { assetId: digital.id },
  });
  check(
    "Digital asset stores slot inventory",
    inventory?.slotsPerLoop === 12,
    `${inventory?.slotsPerLoop} slots, ${inventory?.estimatedPlaysPerDay} plays/day`,
  );
  check(
    "Digital asset uses DIGITAL_SLOT booking",
    digital.bookingModel === "DIGITAL_SLOT",
    digital.bookingModel,
  );

  const mobile = await createAsset({
    ownerId: owner.id,
    typeId: vanType.id,
    title: `${TEST_TITLE_PREFIX} Van`,
    specs: { vehicleType: "LED Van" },
    location: { city: "Mumbai", state: "Maharashtra", lat: 19.11, lng: 72.87 },
    images: [{ url: "https://picsum.photos/seed/owner-van/1200/800" }],
    pricing: [{ unit: "PER_DAY", amount: 1_500_000 }],
    operatingAreas: [
      {
        name: "Test Coverage Area",
        city: "Mumbai",
        centerLat: 19.11,
        centerLng: 72.87,
        radiusMeters: 8000,
      },
    ],
  });

  const areas = await prisma.operatingArea.count({ where: { assetId: mobile.id } });
  check("Mobile asset stores operating areas", areas === 1, `${areas} area`);
  check(
    "Mobile asset uses MOBILE location mode",
    mobile.locationMode === "MOBILE",
    mobile.locationMode,
  );

  // --- Blackouts ----------------------------------------------------------
  const withBlackout = await createAsset({
    ownerId: owner.id,
    typeId: billboardType.id,
    title: `${TEST_TITLE_PREFIX} Blackout`,
    specs: { widthFt: 20, heightFt: 10, illumination: "None" },
    location: { city: "Mumbai", state: "Maharashtra", lat: 19.02, lng: 72.84 },
    images: [{ url: "https://picsum.photos/seed/owner-blackout/1200/800" }],
    pricing: [{ unit: "PER_MONTH", amount: 5_000_000 }],
    blackouts: [
      { startDate: "2031-05-01", endDate: "2031-05-31", note: "Maintenance" },
    ],
  });

  const blackouts = await prisma.assetAvailability.count({
    where: { assetId: withBlackout.id, kind: "BLOCKED" },
  });
  check("Blackout windows saved", blackouts === 1, `${blackouts} blocked window`);

  // --- Descriptor-driven validation --------------------------------------
  // The property that makes ~70 types tractable: validation rules come from the
  // database, so no asset type is named anywhere in application code.
  const billboardValidator = buildSpecValidator(billboardType.specSchema);
  const missingRequired = billboardValidator.safeParse({ widthFt: 30 });
  check(
    "Missing required spec rejected",
    !missingRequired.success,
    missingRequired.success
      ? "accepted"
      : `${missingRequired.error.issues.length} issues`,
  );

  const badEnum = billboardValidator.safeParse({
    widthFt: 30,
    heightFt: 15,
    illumination: "Neon",
  });
  check(
    "Invalid select option rejected",
    !badEnum.success,
    badEnum.success ? "accepted" : "rejected",
  );

  const goodSpecs = billboardValidator.safeParse({
    widthFt: 30,
    heightFt: 15,
    illumination: "Backlit",
  });
  check("Valid specs accepted", goodSpecs.success, "parsed");

  // Error text must be readable by a media owner, not a developer.
  const messages = missingRequired.success
    ? []
    : missingRequired.error.issues.map((issue) => issue.message);
  check(
    "Validation messages are owner-facing",
    messages.every((message) => !message.includes("NaN")),
    messages[0] ?? "none",
  );

  // Every seeded type must produce a usable validator — a malformed specSchema
  // anywhere would silently break that type's wizard step.
  const allTypes = await prisma.assetType.findMany({
    select: { slug: true, specSchema: true },
  });
  const emptySchemas = allTypes.filter(
    (type) => parseSpecSchema(type.specSchema).length === 0,
  );
  check(
    "All asset types have parseable descriptors",
    emptySchemas.length === 0,
    `${allTypes.length - emptySchemas.length}/${allTypes.length} types`,
  );

  // --- Dashboard ----------------------------------------------------------
  const dashboard = await getOwnerDashboard(owner.id);
  check(
    "Dashboard counts assets",
    dashboard.totalAssets >= 4,
    `${dashboard.totalAssets} total, ${dashboard.activeAssets} active`,
  );
  check(
    "Dashboard counts pending verification",
    dashboard.pendingVerification >= 3,
    `${dashboard.pendingVerification} pending`,
  );
  check(
    "Occupancy is a sane percentage",
    dashboard.occupancyRate >= 0 && dashboard.occupancyRate <= 100,
    `${dashboard.occupancyRate}%`,
  );

  await cleanup();

  const finalCount = await countAssets({});
  check(
    "Cleanup restores baseline",
    finalCount === searchableBefore,
    `${finalCount} searchable`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Owner test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
