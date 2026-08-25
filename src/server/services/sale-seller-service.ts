import { createHash } from "node:crypto";
import { prisma } from "@/server/db/client";
import { publishSaleListingLocation } from "@/server/db/spatial";
import { isReservedCollectionSlug } from "@/lib/sale-routes";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CreateSaleListingForm,
  UpdateSaleListingForm,
} from "@/lib/sale-schema";

/**
 * Seller-side sale listing services.
 *
 * Every function here takes an ownerId and scopes its query by it, matching
 * owner-service.ts: ownership is enforced at the data layer, never trusted
 * from the caller.
 *
 * The scope for this pass ends at DRAFT -> SUBMITTED -> PUBLISHED with
 * auto-publish (no admin gate) — see createSaleListing. Admin review,
 * offers and the map are out of scope; the schema supports them, the
 * service layer does not yet expose them.
 */

export type SaleListingFailure =
  | { kind: "asset_not_found" }
  | { kind: "asset_already_listed" }
  | { kind: "slug_conflict" }
  | { kind: "not_found" }
  | { kind: "invalid_transition"; message: string }
  | { kind: "error"; message: string };

export type SaleListingOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; failure: SaleListingFailure };

/** An owner's own assets eligible to be put up for sale: ACTIVE or PAUSED, and not already listed. */
export async function getEligibleAssetsForSale(ownerId: string) {
  return prisma.asset.findMany({
    where: {
      ownerId,
      status: { in: ["ACTIVE", "PAUSED"] },
      saleListings: {
        none: {
          status: {
            notIn: ["WITHDRAWN", "REJECTED", "EXPIRED", "SOLD"],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      type: { select: { name: true, slug: true } },
      location: { select: { city: true, locality: true } },
      images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}

/** An owner's own sale listings, newest first. */
export async function getOwnerSaleListings(ownerId: string) {
  return prisma.saleListing.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      asset: {
        select: {
          title: true,
          images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      },
      _count: { select: { enquiries: true, offers: true } },
    },
  });
}

/** A single listing for the owner's own edit view, scoped by ownership. */
export async function getOwnerSaleListing(ownerId: string, saleListingId: string) {
  return prisma.saleListing.findFirst({
    where: { id: saleListingId, ownerId },
    include: {
      asset: {
        select: {
          id: true,
          title: true,
          description: true,
          specs: true,
          dailyImpressions: true,
          type: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          location: true,
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        },
      },
      propertyDetails: true,
      permits: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

/** URL-safe slug with a short random suffix, matching buildSlug in owner-service.ts. */
function buildSaleSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/**
 * Rejects a candidate listing slug that would collide with an AssetType slug
 * — the single invariant the catch-all resolver depends on. Lives here
 * rather than in sale-routes.ts because that module is imported from client
 * components (for citySlug()) and must stay free of Prisma/server imports.
 */
async function isReservedByAssetType(slug: string): Promise<boolean> {
  const match = await prisma.assetType.findUnique({
    where: { slug },
    select: { id: true },
  });
  return match !== null;
}

/**
 * Generates a slug guaranteed not to collide with an AssetType slug or a
 * curated collection slug — the single invariant the public catch-all route
 * resolver (sale-routes.ts) depends on to stay unambiguous. Retries with a
 * fresh random suffix on the (very unlikely) collision.
 */
async function buildUniqueSaleSlug(title: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildSaleSlug(title);
    if (isReservedCollectionSlug(candidate)) continue;
    if (await isReservedByAssetType(candidate)) continue;

    const existing = await prisma.saleListing.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw new Error("Could not generate a unique sale listing slug.");
}

/**
 * Creates a DRAFT sale listing for an existing asset the owner controls.
 *
 * Pre-populates from the asset (title, specs, location, images) but does not
 * write the snapshot yet — the snapshot is committed at publish, matching
 * the plan's "snapshot at publish, not at draft time": whatever the asset
 * looks like when the listing finally goes live is what the buyer evaluates.
 */
export async function createSaleListing(
  ownerId: string,
  input: CreateSaleListingForm,
): Promise<SaleListingOutcome<{ id: string; slug: string }>> {
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, ownerId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, title: true },
  });

  if (!asset) return { ok: false, failure: { kind: "asset_not_found" } };

  const alreadyListed = await prisma.saleListing.findFirst({
    where: {
      assetId: asset.id,
      status: { notIn: ["WITHDRAWN", "REJECTED", "EXPIRED", "SOLD"] },
    },
    select: { id: true },
  });
  if (alreadyListed) {
    return { ok: false, failure: { kind: "asset_already_listed" } };
  }

  const slug = await buildUniqueSaleSlug(asset.title);

  const listing = await prisma.saleListing.create({
    data: {
      assetId: asset.id,
      ownerId,
      slug,
      status: "DRAFT",
      askingPriceAmount: input.askingPrice,
      negotiable: input.negotiable,
      locationPrecision: input.locationPrecision,

      ownershipType: input.ownership.ownershipType,
      inclusions: input.ownership.inclusions as Prisma.SaleListingCreateInput["inclusions"],
      inclusionsNote: input.ownership.inclusionsNote,
      leaseStartDate: input.ownership.leaseStartDate
        ? new Date(input.ownership.leaseStartDate)
        : undefined,
      leaseEndDate: input.ownership.leaseEndDate
        ? new Date(input.ownership.leaseEndDate)
        : undefined,
      leaseRenewalTerms: input.ownership.leaseRenewalTerms,
      rightsTransferable: input.ownership.rightsTransferable,

      currentMonthlyRevenue: input.financials.currentMonthlyRevenue,
      currentAnnualRevenue: input.financials.currentAnnualRevenue,
      averageOccupancyPercent: input.financials.averageOccupancyPercent,
      averageMonthlyAdIncome: input.financials.averageMonthlyAdIncome,
      operatingExpensesAnnual: input.financials.operatingExpensesAnnual,
      annualMaintenanceCost: input.financials.annualMaintenanceCost,
      landRentAnnual: input.financials.landRentAnnual,
      permitFeesAnnual: input.financials.permitFeesAnnual,
      netAnnualIncome: input.financials.netAnnualIncome,
      expectedRoiPercent: input.financials.expectedRoiPercent,
      existingAdvertiserContracts: input.financials.existingAdvertiserContracts,
      remainingContractMonths: input.financials.remainingContractMonths,

      ...(input.property
        ? {
            propertyDetails: {
              create: {
                propertyOwnershipType: input.property.propertyOwnershipType,
                landOwnerRelationship: input.property.landOwnerRelationship,
                landOwnerName: input.property.landOwnerName,
                propertyAddress: input.property.propertyAddress,
                surveyNumber: input.property.surveyNumber,
                buildingName: input.property.buildingName,
                floorLocation: input.property.floorLocation,
                propertyType: input.property.propertyType,
                leaseStartDate: input.property.leaseStartDate
                  ? new Date(input.property.leaseStartDate)
                  : undefined,
                leaseEndDate: input.property.leaseEndDate
                  ? new Date(input.property.leaseEndDate)
                  : undefined,
                monthlyLandRent: input.property.monthlyLandRent,
                annualLandRent: input.property.annualLandRent,
                revenueSharePercent: input.property.revenueSharePercent,
                renewalTerms: input.property.renewalTerms,
              },
            },
          }
        : {}),

      ...(input.permits?.length
        ? {
            permits: {
              create: input.permits.map((permit) => ({
                permitType: permit.permitType,
                permitTypeOther: permit.permitTypeOther,
                documentNumber: permit.documentNumber,
                issuingAuthority: permit.issuingAuthority,
                issueDate: permit.issueDate ? new Date(permit.issueDate) : undefined,
                expiryDate: permit.expiryDate ? new Date(permit.expiryDate) : undefined,
                status: permit.status,
                notes: permit.notes,
              })),
            },
          }
        : {}),

      ...(input.documents?.length
        ? {
            documents: {
              create: input.documents.map((document) => ({
                category: document.category,
                documentType: document.documentType,
                title: document.title,
                documentNumber: document.documentNumber,
                issuingAuthority: document.issuingAuthority,
                issueDate: document.issueDate ? new Date(document.issueDate) : undefined,
                expiryDate: document.expiryDate ? new Date(document.expiryDate) : undefined,
                visibility: document.visibility,
              })),
            },
          }
        : {}),

      events: {
        create: { eventType: "CREATED" },
      },
    },
  });

  return { ok: true, value: { id: listing.id, slug: listing.slug } };
}

/**
 * Updates the seller-editable fields of a listing the owner controls.
 *
 * Deliberately never touches the Asset itself or the listing's snapshot
 * columns — this is the sale-side terms (price, ownership, rights,
 * financials, property, permits, documents), not the underlying asset. A
 * PUBLISHED listing's public-facing snapshot is unaffected by this call: if
 * the seller wants the published page itself to reflect a changed asking
 * price, they still see the new price immediately since askingPriceAmount
 * is read live rather than snapshotted, but a fresh publish is required to
 * re-freeze snapshot-only fields like title/specs.
 *
 * Child collections (permits, documents) are replaced wholesale, matching
 * updateAsset in owner-service.ts — they are small enough that a full
 * replace inside one transaction is simpler and safer than diffing rows
 * that may have been reordered or removed by the seller.
 */
export async function updateSaleListing(
  ownerId: string,
  saleListingId: string,
  input: UpdateSaleListingForm,
): Promise<SaleListingOutcome<{ id: string }>> {
  const existing = await prisma.saleListing.findFirst({
    where: { id: saleListingId, ownerId },
    select: { id: true, askingPriceAmount: true },
  });

  if (!existing) return { ok: false, failure: { kind: "not_found" } };

  await prisma.$transaction(async (tx) => {
    await tx.salePermit.deleteMany({ where: { saleListingId } });
    await tx.saleDocument.deleteMany({ where: { saleListingId } });

    await tx.saleListing.update({
      where: { id: saleListingId },
      data: {
        askingPriceAmount: input.askingPrice,
        negotiable: input.negotiable,
        locationPrecision: input.locationPrecision,

        ownershipType: input.ownership.ownershipType,
        inclusions: input.ownership.inclusions as Prisma.SaleListingUpdateInput["inclusions"],
        inclusionsNote: input.ownership.inclusionsNote,
        leaseStartDate: input.ownership.leaseStartDate
          ? new Date(input.ownership.leaseStartDate)
          : null,
        leaseEndDate: input.ownership.leaseEndDate
          ? new Date(input.ownership.leaseEndDate)
          : null,
        leaseRenewalTerms: input.ownership.leaseRenewalTerms,
        rightsTransferable: input.ownership.rightsTransferable,

        currentMonthlyRevenue: input.financials.currentMonthlyRevenue,
        currentAnnualRevenue: input.financials.currentAnnualRevenue,
        averageOccupancyPercent: input.financials.averageOccupancyPercent,
        averageMonthlyAdIncome: input.financials.averageMonthlyAdIncome,
        operatingExpensesAnnual: input.financials.operatingExpensesAnnual,
        annualMaintenanceCost: input.financials.annualMaintenanceCost,
        landRentAnnual: input.financials.landRentAnnual,
        permitFeesAnnual: input.financials.permitFeesAnnual,
        netAnnualIncome: input.financials.netAnnualIncome,
        expectedRoiPercent: input.financials.expectedRoiPercent,
        existingAdvertiserContracts: input.financials.existingAdvertiserContracts,
        remainingContractMonths: input.financials.remainingContractMonths,

        propertyDetails: input.property
          ? {
              upsert: {
                create: {
                  propertyOwnershipType: input.property.propertyOwnershipType,
                  landOwnerRelationship: input.property.landOwnerRelationship,
                  landOwnerName: input.property.landOwnerName,
                  propertyAddress: input.property.propertyAddress,
                  surveyNumber: input.property.surveyNumber,
                  buildingName: input.property.buildingName,
                  floorLocation: input.property.floorLocation,
                  propertyType: input.property.propertyType,
                  leaseStartDate: input.property.leaseStartDate
                    ? new Date(input.property.leaseStartDate)
                    : undefined,
                  leaseEndDate: input.property.leaseEndDate
                    ? new Date(input.property.leaseEndDate)
                    : undefined,
                  monthlyLandRent: input.property.monthlyLandRent,
                  annualLandRent: input.property.annualLandRent,
                  revenueSharePercent: input.property.revenueSharePercent,
                  renewalTerms: input.property.renewalTerms,
                },
                update: {
                  propertyOwnershipType: input.property.propertyOwnershipType,
                  landOwnerRelationship: input.property.landOwnerRelationship,
                  landOwnerName: input.property.landOwnerName,
                  propertyAddress: input.property.propertyAddress,
                  surveyNumber: input.property.surveyNumber,
                  buildingName: input.property.buildingName,
                  floorLocation: input.property.floorLocation,
                  propertyType: input.property.propertyType,
                  leaseStartDate: input.property.leaseStartDate
                    ? new Date(input.property.leaseStartDate)
                    : null,
                  leaseEndDate: input.property.leaseEndDate
                    ? new Date(input.property.leaseEndDate)
                    : null,
                  monthlyLandRent: input.property.monthlyLandRent,
                  annualLandRent: input.property.annualLandRent,
                  revenueSharePercent: input.property.revenueSharePercent,
                  renewalTerms: input.property.renewalTerms,
                },
              },
            }
          : undefined,

        permits: input.permits?.length
          ? {
              create: input.permits.map((permit) => ({
                permitType: permit.permitType,
                permitTypeOther: permit.permitTypeOther,
                documentNumber: permit.documentNumber,
                issuingAuthority: permit.issuingAuthority,
                issueDate: permit.issueDate ? new Date(permit.issueDate) : undefined,
                expiryDate: permit.expiryDate ? new Date(permit.expiryDate) : undefined,
                status: permit.status,
                notes: permit.notes,
              })),
            }
          : undefined,

        documents: input.documents?.length
          ? {
              create: input.documents.map((document) => ({
                category: document.category,
                documentType: document.documentType,
                title: document.title,
                documentNumber: document.documentNumber,
                issuingAuthority: document.issuingAuthority,
                issueDate: document.issueDate ? new Date(document.issueDate) : undefined,
                expiryDate: document.expiryDate ? new Date(document.expiryDate) : undefined,
                visibility: document.visibility,
              })),
            }
          : undefined,

        events: input.askingPrice !== existing.askingPriceAmount
          ? {
              create: {
                eventType: "PRICE_CHANGED",
                fromValue: String(existing.askingPriceAmount),
                toValue: String(input.askingPrice),
              },
            }
          : undefined,
      },
    });
  });

  return { ok: true, value: { id: saleListingId } };
}

/** Canonicalises the snapshot payload so key reordering never registers as drift. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, canonicalize(val)]),
    );
  }
  return value;
}

function hashSnapshot(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

/**
 * Publishes a DRAFT/SUBMITTED listing: freezes the snapshot from the current
 * Asset, derives the public location point, and flips status to PUBLISHED.
 *
 * This pass auto-publishes on submit rather than gating on admin review — see
 * the "auto-publish, no badges" decision. Nothing here sets a verified badge;
 * TrustLevel stays SELLER_DECLARED until admin review ships.
 */
export async function publishSaleListing(
  ownerId: string,
  saleListingId: string,
): Promise<SaleListingOutcome<{ id: string }>> {
  const listing = await prisma.saleListing.findFirst({
    where: { id: saleListingId, ownerId },
    include: {
      asset: {
        select: {
          title: true,
          description: true,
          categoryId: true,
          typeId: true,
          specs: true,
          dailyImpressions: true,
          type: { select: { name: true } },
          location: { select: { city: true, state: true, locality: true } },
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            select: { url: true },
          },
        },
      },
    },
  });

  if (!listing) return { ok: false, failure: { kind: "not_found" } };

  // PUBLISHED is allowed here specifically so resolveSaleListingDrift's
  // "accept" path can re-snapshot a live, drifted listing without a status
  // round-trip. Every other in-flight status (OFFER_RECEIVED,
  // UNDER_NEGOTIATION, SALE_AGREED) also stays open to re-snapshot for the
  // same reason: those are all "still selling" states where a buyer benefits
  // from an up-to-date listing. Only SOLD/WITHDRAWN — checked by the caller
  // in resolveSaleListingDrift — are excluded, because the snapshot there is
  // the historical record of what was actually transacted.
  if (
    !["DRAFT", "SUBMITTED", "PAUSED", "PUBLISHED", "OFFER_RECEIVED", "UNDER_NEGOTIATION", "SALE_AGREED"].includes(
      listing.status,
    )
  ) {
    return {
      ok: false,
      failure: {
        kind: "invalid_transition",
        message: `Cannot publish a listing in ${listing.status} status.`,
      },
    };
  }

  const snapshotPayload = {
    title: listing.asset.title,
    description: listing.asset.description,
    categoryId: listing.asset.categoryId,
    typeId: listing.asset.typeId,
    specs: listing.asset.specs,
    dailyImpressions: listing.asset.dailyImpressions,
  };

  await prisma.saleListing.update({
    where: { id: saleListingId },
    data: {
      status: "PUBLISHED",
      snapshotTitle: listing.asset.title,
      snapshotDescription: listing.asset.description,
      snapshotCategoryId: listing.asset.categoryId,
      snapshotTypeId: listing.asset.typeId,
      snapshotTypeName: listing.asset.type.name,
      snapshotSpecs: listing.asset.specs as Prisma.InputJsonValue,
      snapshotCity: listing.asset.location?.city,
      snapshotState: listing.asset.location?.state,
      snapshotLocality: listing.asset.location?.locality,
      snapshotImageUrls: listing.asset.images.map((image) => image.url),
      snapshotDailyImpressions: listing.asset.dailyImpressions,
      snapshotHash: hashSnapshot(snapshotPayload),
      snapshotAt: new Date(),
      syncState: "IN_SYNC",
      driftedFields: [],
      driftDetectedAt: null,
      publishedAt: listing.publishedAt ?? new Date(),
      events: { create: { eventType: "PUBLISHED" } },
    },
  });

  // Derives and persists the public point from the asset's true location.
  // Computed once, here, at publish — never per request. See the doc comment
  // on publishSaleListingLocation for why that matters.
  await publishSaleListingLocation(saleListingId);

  return { ok: true, value: { id: saleListingId } };
}

const WITHDRAWABLE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "OFFER_RECEIVED",
  "UNDER_NEGOTIATION",
];

/** Owner-initiated status change: pause, resume, or withdraw. Scoped by ownerId. */
export async function updateSaleListingStatus(
  ownerId: string,
  saleListingId: string,
  status: "PAUSED" | "PUBLISHED" | "WITHDRAWN",
): Promise<SaleListingOutcome<{ id: string }>> {
  const listing = await prisma.saleListing.findFirst({
    where: { id: saleListingId, ownerId },
    select: { id: true, status: true },
  });

  if (!listing) return { ok: false, failure: { kind: "not_found" } };

  if (status === "WITHDRAWN" && !WITHDRAWABLE_STATUSES.includes(listing.status)) {
    return {
      ok: false,
      failure: {
        kind: "invalid_transition",
        message: `Cannot withdraw a listing in ${listing.status} status.`,
      },
    };
  }

  if (status === "PUBLISHED") {
    // Resuming a paused listing does not re-freeze the snapshot — only a
    // fresh publish (or an explicit drift accept) does that.
    if (listing.status !== "PAUSED") {
      return {
        ok: false,
        failure: {
          kind: "invalid_transition",
          message: `Cannot resume a listing in ${listing.status} status.`,
        },
      };
    }
  }

  await prisma.saleListing.update({
    where: { id: saleListingId },
    data: {
      status,
      withdrawnAt: status === "WITHDRAWN" ? new Date() : undefined,
      events: {
        create: {
          eventType: status === "WITHDRAWN" ? "WITHDRAWN" : "STATUS_CHANGED",
          fromValue: listing.status,
          toValue: status,
        },
      },
    },
  });

  return { ok: true, value: { id: saleListingId } };
}

/**
 * Resolves a drift flag on a published listing.
 *
 * "accept" re-snapshots from the current Asset (same freeze logic as
 * publish). "dismiss" clears the flag without touching the snapshot — the
 * seller may have edited the asset for an unrelated (usually advertising)
 * reason, and the published listing legitimately stays as it was.
 */
export async function resolveSaleListingDrift(
  ownerId: string,
  saleListingId: string,
  resolution: "accept" | "dismiss",
): Promise<SaleListingOutcome<{ id: string }>> {
  const listing = await prisma.saleListing.findFirst({
    where: { id: saleListingId, ownerId },
    select: { id: true, syncState: true, status: true },
  });

  if (!listing) return { ok: false, failure: { kind: "not_found" } };

  if (listing.syncState !== "DRIFTED") {
    return { ok: true, value: { id: saleListingId } };
  }

  if (resolution === "accept") {
    // SOLD/WITHDRAWN listings never re-snapshot — the snapshot is the
    // historical record of what was actually sold or offered.
    if (["SOLD", "WITHDRAWN"].includes(listing.status)) {
      return {
        ok: false,
        failure: {
          kind: "invalid_transition",
          message: `Cannot update the snapshot of a ${listing.status} listing.`,
        },
      };
    }
    return publishSaleListing(ownerId, saleListingId);
  }

  await prisma.saleListing.update({
    where: { id: saleListingId },
    data: {
      syncState: "IN_SYNC",
      driftedFields: [],
      events: { create: { eventType: "DRIFT_DISMISSED" } },
    },
  });

  return { ok: true, value: { id: saleListingId } };
}
