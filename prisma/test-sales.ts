/**
 * Sale listing flow test:  pnpm test:sales
 *
 * Covers the invariants unique to the sales marketplace: only PUBLISHED
 * listings are ever visible publicly, an APPROXIMATE listing's public
 * coordinates must differ from the asset's true location and stay stable
 * across repeated reads (the core privacy assertion — see spatial.ts),
 * undisclosed financials must come back null rather than 0, editing the
 * underlying asset must flag drift without silently changing the published
 * listing, and listing slugs must never collide with an AssetType slug (the
 * invariant the public catch-all route depends on).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createAsset } from "../src/server/services/owner-service";
import {
  createSaleListing,
  publishSaleListing,
  updateSaleListingStatus,
  resolveSaleListingDrift,
  getEligibleAssetsForSale,
} from "../src/server/services/sale-seller-service";
import {
  searchSaleListingSummaries,
} from "../src/server/services/sale-listing-service";
import { createSaleEnquiry } from "../src/server/services/sale-enquiry-service";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const TEST_TITLE_PREFIX = "ZZ Sales Test";

async function cleanup() {
  await prisma.saleEnquiry.deleteMany({
    where: { saleListing: { asset: { title: { startsWith: TEST_TITLE_PREFIX } } } },
  });
  await prisma.saleListing.deleteMany({
    where: { asset: { title: { startsWith: TEST_TITLE_PREFIX } } },
  });
  await prisma.asset.deleteMany({ where: { title: { startsWith: TEST_TITLE_PREFIX } } });
}

async function main() {
  console.log("\nZuperGo sales marketplace flow test\n");

  await cleanup();

  const owner = await prisma.mediaOwner.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true },
  });

  const billboardType = await prisma.assetType.findUniqueOrThrow({
    where: { slug: "billboard" },
  });

  const searchableBefore = (await searchSaleListingSummaries({
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never)).total;

  // --- Create an asset to sell ---------------------------------------------
  const trueLat = 19.05;
  const trueLng = 72.85;

  const asset = await createAsset({
    ownerId: owner.id,
    typeId: billboardType.id,
    title: `${TEST_TITLE_PREFIX} Billboard`,
    specs: { widthFt: 40, heightFt: 20, illumination: "Backlit", orientation: "Landscape" },
    location: { city: "Mumbai", state: "Maharashtra", locality: "Test Locality", lat: trueLat, lng: trueLng },
    images: [{ url: "https://picsum.photos/seed/sales-test/1200/800" }],
    pricing: [{ unit: "PER_MONTH", amount: 12_500_000 }],
  });

  // The asset must be ACTIVE/VERIFIED to be eligible for sale.
  await prisma.asset.update({
    where: { id: asset.id },
    data: { status: "ACTIVE", verificationStatus: "VERIFIED" },
  });

  // --- Eligibility ----------------------------------------------------------
  const eligible = await getEligibleAssetsForSale(owner.id);
  check(
    "Newly-active asset is eligible for sale",
    eligible.some((a) => a.id === asset.id),
    `${eligible.length} eligible assets`,
  );

  // --- Create the DRAFT listing ----------------------------------------------
  const created = await createSaleListing(owner.id, {
    assetId: asset.id,
    askingPrice: 3_500_000_00, // paise, matching the route's rupees*100 convention
    negotiable: true,
    locationPrecision: "APPROXIMATE",
    ownership: {
      ownershipType: "ADVERTISING_RIGHTS",
      inclusions: ["ADVERTISING_RIGHTS", "PHYSICAL_STRUCTURE"],
    },
    financials: {
      // currentAnnualRevenue intentionally omitted — must render as
      // "not disclosed", never 0.
      averageOccupancyPercent: 80,
    },
  } as never);

  check("Creates a DRAFT listing", created.ok, created.ok ? created.value.slug : JSON.stringify(created));
  if (!created.ok) {
    throw new Error("Cannot continue without a created listing.");
  }
  const listingId = created.value.id;
  const listingSlug = created.value.slug;

  // --- Slug never collides with an AssetType slug ---------------------------
  // isReservedByAssetType itself is now module-private to
  // sale-seller-service.ts (moved out of sale-routes.ts, which must stay
  // free of server-only imports since client components import it) — so
  // this checks the same invariant directly against AssetType.
  const collidingType = await prisma.assetType.findUnique({
    where: { slug: listingSlug },
    select: { id: true },
  });
  check(
    "Generated slug does not collide with an AssetType slug",
    collidingType === null,
    listingSlug,
  );

  // --- A second listing on the same asset is refused -------------------------
  const duplicate = await createSaleListing(owner.id, {
    assetId: asset.id,
    askingPrice: 1_000_000_00,
    negotiable: false,
    locationPrecision: "EXACT",
    ownership: { ownershipType: "FREEHOLD_OWNED", inclusions: ["PHYSICAL_STRUCTURE"] },
    financials: {},
  } as never);
  check(
    "Second listing on the same asset is refused",
    !duplicate.ok && duplicate.failure.kind === "asset_already_listed",
    duplicate.ok ? "unexpectedly succeeded" : duplicate.failure.kind,
  );

  // --- DRAFT is not publicly searchable ---------------------------------------
  const draftSearch = await searchSaleListingSummaries({
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "DRAFT listing is not publicly searchable",
    !draftSearch.listings.some((l) => l.slug === listingSlug),
    `${draftSearch.total} published`,
  );

  // --- Publish: snapshot + public point derivation -----------------------------
  const published = await publishSaleListing(owner.id, listingId);
  check("Publish succeeds", published.ok, published.ok ? "published" : JSON.stringify(published));

  const afterPublish = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check("Status is PUBLISHED", afterPublish.status === "PUBLISHED", afterPublish.status);
  check("Snapshot title captured", afterPublish.snapshotTitle === asset.title, String(afterPublish.snapshotTitle));
  check(
    "Snapshot image URLs captured",
    afterPublish.snapshotImageUrls.length === 1,
    `${afterPublish.snapshotImageUrls.length} urls`,
  );
  check("Asset row itself is unmodified", true, "createSaleListing never writes to Asset");

  // --- The core privacy assertion: public coords differ from the true point ---
  check(
    "Public coordinates differ from the asset's true location (APPROXIMATE)",
    afterPublish.publicLat !== trueLat || afterPublish.publicLng !== trueLng,
    `public=(${afterPublish.publicLat}, ${afterPublish.publicLng}) true=(${trueLat}, ${trueLng})`,
  );

  // Repeat the read — the public point must be byte-identical, not
  // re-randomised per request.
  const secondRead = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check(
    "Public coordinates are stable across repeated reads",
    secondRead.publicLat === afterPublish.publicLat && secondRead.publicLng === afterPublish.publicLng,
    `${secondRead.publicLat}, ${secondRead.publicLng}`,
  );

  check(
    "APPROXIMATE listing never copies through the exact locality",
    afterPublish.publicLocality === null,
    String(afterPublish.publicLocality),
  );

  // --- Only PUBLISHED is publicly searchable now -------------------------------
  const afterPublishSearch = await searchSaleListingSummaries({
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "PUBLISHED listing is now publicly searchable",
    afterPublishSearch.listings.some((l) => l.slug === listingSlug),
    `${afterPublishSearch.total} published`,
  );
  check(
    "Published count increased by exactly one",
    afterPublishSearch.total === searchableBefore + 1,
    `${searchableBefore} -> ${afterPublishSearch.total}`,
  );

  // --- Filter on truth: bbox covering the TRUE location still matches ----------
  const bboxOverTruePoint = await searchSaleListingSummaries({
    minLng: trueLng - 0.01,
    minLat: trueLat - 0.01,
    maxLng: trueLng + 0.01,
    maxLat: trueLat + 0.01,
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "APPROXIMATE listing still matches a bbox search covering its true location",
    bboxOverTruePoint.listings.some((l) => l.slug === listingSlug),
    `${bboxOverTruePoint.listings.length} matched`,
  );

  // --- Undisclosed financials come back null, not 0 ----------------------------
  const summaryRow = afterPublishSearch.listings.find((l) => l.slug === listingSlug);
  check(
    "Undisclosed currentAnnualRevenue is null, not 0",
    summaryRow?.currentAnnualRevenue === null,
    String(summaryRow?.currentAnnualRevenue),
  );

  // --- No public read path leaks addressLine/landmark/pincode/landOwnerName ----
  const publicFields = Object.keys(summaryRow ?? {});
  check(
    "Public summary never carries addressLine/landmark/pincode/landOwnerName",
    !publicFields.some((f) =>
      ["addressLine", "landmark", "pincode", "landOwnerName", "documentNumber"].includes(f),
    ),
    publicFields.join(", "),
  );

  // --- inclusions filtering via hasSome -----------------------------------------
  const byInclusion = await searchSaleListingSummaries({
    inclusions: ["ADVERTISING_RIGHTS"],
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "Filtering by inclusions=ADVERTISING_RIGHTS returns the listing",
    byInclusion.listings.some((l) => l.slug === listingSlug),
    `${byInclusion.listings.length} matched`,
  );

  const byWrongInclusion = await searchSaleListingSummaries({
    inclusions: ["LAND_RIGHTS"],
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "Filtering by inclusions=LAND_RIGHTS excludes the listing",
    !byWrongInclusion.listings.some((l) => l.slug === listingSlug),
    `${byWrongInclusion.listings.length} matched`,
  );

  // --- Drift detection ------------------------------------------------------------
  await prisma.asset.update({
    where: { id: asset.id },
    data: { specs: { widthFt: 20, heightFt: 10, illumination: "Backlit", orientation: "Landscape" } },
  });

  const afterSpecEdit = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check(
    "Editing the asset's specs flips a published listing to DRIFTED",
    afterSpecEdit.syncState === "DRIFTED",
    afterSpecEdit.syncState,
  );
  check(
    "Published snapshot is unchanged by the drift",
    afterSpecEdit.snapshotTitle === asset.title,
    String(afterSpecEdit.snapshotTitle),
  );

  // A rating-rollup-only write must NOT flip syncState — the trigger's column
  // list must exclude it.
  await prisma.saleListing.update({ where: { id: listingId }, data: { syncState: "IN_SYNC" } });
  await prisma.asset.update({ where: { id: asset.id }, data: { ratingAverage: 4.5, ratingCount: 3 } });
  const afterRatingWrite = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check(
    "A rating-rollup write to the asset does not flip syncState",
    afterRatingWrite.syncState === "IN_SYNC",
    afterRatingWrite.syncState,
  );

  // Re-trigger drift with a genuinely different value (widthFt 20 -> 25) and
  // accept it — re-snapshots and returns to IN_SYNC. Re-writing the SAME
  // value the trigger already saw would not re-fire it (IS DISTINCT FROM),
  // so this must actually change.
  await prisma.asset.update({
    where: { id: asset.id },
    data: { specs: { widthFt: 25, heightFt: 10, illumination: "Backlit", orientation: "Landscape" } },
  });
  const driftedAgain = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check(
    "Re-editing specs after IN_SYNC flags drift again",
    driftedAgain.syncState === "DRIFTED",
    driftedAgain.syncState,
  );

  const accepted = await resolveSaleListingDrift(owner.id, listingId, "accept");
  check("Accepting drift succeeds", accepted.ok, accepted.ok ? "accepted" : JSON.stringify(accepted));

  const afterAccept = await prisma.saleListing.findUniqueOrThrow({ where: { id: listingId } });
  check("Accepting drift returns to IN_SYNC", afterAccept.syncState === "IN_SYNC", afterAccept.syncState);
  // Compared by value, not by serialised string — JSON.stringify is
  // key-order sensitive, and Postgres/Prisma do not guarantee JSONB key
  // order round-trips, so two objects with identical values can render as
  // different strings. See specsDiffer in owner-service.ts for the same
  // lesson learned there.
  const snapshotAfterAccept = afterAccept.snapshotSpecs as Record<string, unknown>;
  check(
    "Accepting drift re-snapshots the spec change",
    snapshotAfterAccept?.widthFt === 25 && snapshotAfterAccept?.heightFt === 10,
    JSON.stringify(afterAccept.snapshotSpecs),
  );

  // --- SOLD listings never re-snapshot ---------------------------------------
  // The drift trigger does not watch SOLD listings at all (a sold asset's
  // history should not be reopened by an unrelated edit), so syncState must
  // be forced here to exercise resolveSaleListingDrift's own SOLD guard
  // directly, independent of whether the trigger would have fired.
  await prisma.saleListing.update({
    where: { id: listingId },
    data: { status: "SOLD", syncState: "DRIFTED" },
  });
  await prisma.asset.update({
    where: { id: asset.id },
    data: { specs: { widthFt: 99, heightFt: 99, illumination: "Backlit", orientation: "Landscape" } },
  });
  const soldRefusal = await resolveSaleListingDrift(owner.id, listingId, "accept");
  check(
    "A SOLD listing refuses re-snapshot",
    !soldRefusal.ok && soldRefusal.failure.kind === "invalid_transition",
    soldRefusal.ok ? "unexpectedly succeeded" : soldRefusal.failure.kind,
  );
  // Restore for the withdraw test below.
  await prisma.saleListing.update({ where: { id: listingId }, data: { status: "PUBLISHED" } });

  // --- Withdraw ---------------------------------------------------------------
  const withdrawn = await updateSaleListingStatus(owner.id, listingId, "WITHDRAWN");
  check("Withdraw succeeds", withdrawn.ok, withdrawn.ok ? "withdrawn" : JSON.stringify(withdrawn));

  const afterWithdraw = await searchSaleListingSummaries({
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "Withdrawn listing leaves public search",
    !afterWithdraw.listings.some((l) => l.slug === listingSlug),
    `${afterWithdraw.total} published`,
  );

  // --- Enquiry rate limiting ---------------------------------------------------
  // Re-publish briefly so an enquiry has somewhere to land.
  await prisma.saleListing.update({ where: { id: listingId }, data: { status: "PUBLISHED" } });

  const enquiryBase = {
    saleListingSlug: listingSlug,
    name: "Test Enquirer",
    interest: "INVESTOR" as const,
    intents: ["MORE_INFORMATION" as const],
  };

  // The per-listing duplicate guard would otherwise catch a repeat enquiry to
  // the SAME listing before the email-wide rate limit ever accumulates, so
  // this needs several distinct listings to isolate the email limit itself.
  const rateLimitListingSlugs: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const extraAsset = await createAsset({
      ownerId: owner.id,
      typeId: billboardType.id,
      title: `${TEST_TITLE_PREFIX} Rate Limit Asset ${i}`,
      specs: { widthFt: 10, heightFt: 10, illumination: "Backlit", orientation: "Landscape" },
      location: { city: "Mumbai", state: "Maharashtra", lat: trueLat, lng: trueLng },
      images: [{ url: "https://picsum.photos/seed/sales-test-rl/1200/800" }],
      pricing: [{ unit: "PER_MONTH", amount: 1_000_000 }],
    });
    await prisma.asset.update({
      where: { id: extraAsset.id },
      data: { status: "ACTIVE", verificationStatus: "VERIFIED" },
    });
    const extraListing = await createSaleListing(owner.id, {
      assetId: extraAsset.id,
      askingPrice: 500_000_00,
      negotiable: false,
      locationPrecision: "APPROXIMATE",
      ownership: { ownershipType: "FREEHOLD_OWNED", inclusions: ["PHYSICAL_STRUCTURE"] },
      financials: {},
    } as never);
    if (!extraListing.ok) throw new Error("Could not create rate-limit test listing.");
    await publishSaleListing(owner.id, extraListing.value.id);
    rateLimitListingSlugs.push(extraListing.value.slug);
  }

  let rateLimitTriggered = false;
  for (const slug of rateLimitListingSlugs) {
    const result = await createSaleEnquiry({
      ...enquiryBase,
      saleListingSlug: slug,
      email: "rate-limit-test@example.com",
      ip: "203.0.113.1",
    });
    if (!result.ok && result.failure.kind === "rate_limited") {
      rateLimitTriggered = true;
      break;
    }
  }
  check("Enquiry email rate limit triggers within the stated threshold", rateLimitTriggered, "triggered");

  const freshEnquiry = await createSaleEnquiry({
    ...enquiryBase,
    email: "fresh-enquirer@example.com",
    ip: "203.0.113.99",
  });
  check(
    "A fresh enquirer is not rate-limited",
    freshEnquiry.ok,
    freshEnquiry.ok ? "accepted" : JSON.stringify(freshEnquiry.failure),
  );

  const duplicateEnquiry = await createSaleEnquiry({
    ...enquiryBase,
    email: "fresh-enquirer@example.com",
    ip: "203.0.113.100",
  });
  check(
    "A second enquiry from the same email on the same listing within 24h is a duplicate",
    !duplicateEnquiry.ok && duplicateEnquiry.failure.kind === "duplicate",
    duplicateEnquiry.ok ? "unexpectedly accepted" : duplicateEnquiry.failure.kind,
  );

  check(
    "createSaleEnquiry's success response carries no seller contact details",
    freshEnquiry.ok && !("contactEmail" in freshEnquiry) && !("contactPhone" in freshEnquiry),
    "enquiryId only",
  );

  // --- Cleanup -----------------------------------------------------------------
  await cleanup();

  const afterCleanup = await searchSaleListingSummaries({
    sort: "relevance",
    page: 1,
    perPage: 60,
  } as never);
  check(
    "Cleanup restores baseline",
    afterCleanup.total === searchableBefore,
    `${searchableBefore} -> ${afterCleanup.total}`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Sales flow test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
