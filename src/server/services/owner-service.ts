import { prisma } from "@/server/db/client";
import { setAssetPoint } from "@/server/db/spatial";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Media owner services.
 *
 * Everything an owner does to their own inventory. Every function here takes an
 * ownerId and scopes its query by it — ownership is enforced at the data layer
 * rather than trusted from the caller, so a route that forgets to check cannot
 * leak or mutate another owner's assets.
 */

/** Resolves the MediaOwner record for a user, or null if they are not one. */
export async function getOwnerForUser(userId: string) {
  return prisma.mediaOwner.findUnique({
    where: { userId },
    select: {
      id: true,
      slug: true,
      companyName: true,
      verificationStatus: true,
      city: true,
      ratingAverage: true,
      ratingCount: true,
    },
  });
}

/**
 * Dashboard metrics.
 *
 * Computed in parallel because none depend on each other, and revenue is
 * derived from confirmed bookings only — counting held or cancelled bookings
 * would overstate what the owner has actually earned.
 */
export async function getOwnerDashboard(ownerId: string) {
  const now = new Date();

  const [
    totalAssets,
    activeAssets,
    pendingVerification,
    upcomingBookings,
    revenueAggregate,
    occupancyRows,
  ] = await Promise.all([
    prisma.asset.count({ where: { ownerId, status: { not: "ARCHIVED" } } }),
    prisma.asset.count({
      where: { ownerId, status: "ACTIVE", verificationStatus: "VERIFIED" },
    }),
    prisma.asset.count({ where: { ownerId, verificationStatus: "PENDING" } }),
    // Only owner-confirmed windows count. A pending request is an enquiry,
    // not committed business.
    prisma.bookingItem.count({
      where: {
        asset: { ownerId },
        holdsInventory: true,
        startAt: { gte: now },
      },
    }),
    prisma.bookingItem.aggregate({
      where: {
        asset: { ownerId },
        booking: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      },
      _sum: { lineTotal: true },
    }),
    // Days claimed over the next 90 days, used for a coarse occupancy figure.
    prisma.bookingItem.findMany({
      where: {
        asset: { ownerId },
        holdsInventory: true,
        endAt: { gte: now },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const HORIZON_DAYS = 90;
  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  // Sum booked days inside the horizon, clipping ranges that extend past it.
  const bookedDays = occupancyRows.reduce((sum, item) => {
    const start = item.startAt > now ? item.startAt : now;
    const end = item.endAt < horizonEnd ? item.endAt : horizonEnd;
    if (end <= start) return sum;
    return sum + (end.getTime() - start.getTime()) / 86_400_000;
  }, 0);

  const capacity = activeAssets * HORIZON_DAYS;
  const occupancyRate =
    capacity > 0 ? Math.min(100, Math.round((bookedDays / capacity) * 100)) : 0;

  return {
    totalAssets,
    activeAssets,
    pendingVerification,
    upcomingBookings,
    revenue: revenueAggregate._sum.lineTotal ?? 0,
    occupancyRate,
  };
}

/** An owner's assets, newest first. */
export async function getOwnerAssets(ownerId: string) {
  return prisma.asset.findMany({
    where: { ownerId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: {
      type: { select: { name: true, slug: true } },
      category: { select: { name: true } },
      location: { select: { city: true, locality: true } },
      images: {
        take: 1,
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      pricing: {
        take: 1,
        orderBy: [{ isDefault: "desc" }, { amount: "asc" }],
      },
      _count: { select: { bookingItems: true } },
    },
  });
}

/** Bookings across an owner's inventory. */
export async function getOwnerBookings(ownerId: string) {
  return prisma.bookingItem.findMany({
    where: { asset: { ownerId } },
    orderBy: { startAt: "desc" },
    take: 50,
    include: {
      booking: {
        select: {
          reference: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          advertiser: { select: { name: true, email: true } },
        },
      },
      asset: { select: { title: true, slug: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Asset creation
// ---------------------------------------------------------------------------

export interface CreateAssetInput {
  ownerId: string;
  typeId: string;
  title: string;
  description?: string;
  specs: Record<string, unknown>;
  dailyImpressions?: number;
  audienceProfile?: string;

  location: {
    addressLine?: string;
    landmark?: string;
    locality?: string;
    city: string;
    state: string;
    pincode?: string;
    lat?: number;
    lng?: number;
    areaLabel?: string;
  };

  images: Array<{ url: string; alt?: string }>;

  pricing: Array<{
    unit: string;
    amount: number;
    minDuration?: number;
    discountThreshold?: number;
    discountPercent?: number;
  }>;

  /** Owner-declared blackout windows, applied at creation. */
  blackouts?: Array<{ startDate: string; endDate: string; note?: string }>;

  digital?: {
    slotDurationSeconds: number;
    loopDurationSeconds: number;
    slotsPerLoop: number;
    operatingHoursStart: number;
    operatingHoursEnd: number;
    screenWidthPx?: number;
    screenHeightPx?: number;
  };

  operatingAreas?: Array<{
    name: string;
    city?: string;
    centerLat?: number;
    centerLng?: number;
    radiusMeters?: number;
  }>;
}

/** URL-safe slug with a short random suffix to avoid collisions. */
function buildSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/**
 * Creates an asset in PENDING verification.
 *
 * New listings are never immediately searchable: `status: DRAFT` plus
 * `verificationStatus: PENDING` keeps them out of every buyer-facing query
 * until an admin approves them. That is the whole point of the verification
 * workflow, so it is enforced here rather than left to the caller.
 */
export async function createAsset(input: CreateAssetInput) {
  const type = await prisma.assetType.findUnique({
    where: { id: input.typeId },
    select: {
      id: true,
      categoryId: true,
      isDigital: true,
      isMobile: true,
      defaultLocationMode: true,
      supportedBookingModels: true,
    },
  });

  if (!type) throw new Error(`Unknown asset type: ${input.typeId}`);

  const bookingModel = type.isDigital
    ? "DIGITAL_SLOT"
    : type.supportedBookingModels[0] ?? "DATE_RANGE";

  const asset = await prisma.asset.create({
    data: {
      slug: buildSlug(input.title),
      title: input.title,
      description: input.description,
      ownerId: input.ownerId,
      categoryId: type.categoryId,
      typeId: type.id,
      locationMode: type.defaultLocationMode,
      bookingModel,
      status: "DRAFT",
      verificationStatus: "PENDING",
      specs: input.specs as Prisma.InputJsonValue,
      dailyImpressions: input.dailyImpressions,
      audienceProfile: input.audienceProfile,

      location: {
        create: {
          addressLine: input.location.addressLine,
          landmark: input.location.landmark,
          locality: input.location.locality,
          city: input.location.city,
          state: input.location.state,
          pincode: input.location.pincode,
          lat: input.location.lat,
          lng: input.location.lng,
          areaLabel: input.location.areaLabel,
        },
      },

      images: {
        create: input.images.map((image, index) => ({
          url: image.url,
          alt: image.alt ?? input.title,
          sortOrder: index,
          isPrimary: index === 0,
        })),
      },

      pricing: {
        create: input.pricing.map((price, index) => ({
          unit: price.unit as Prisma.AssetPricingCreateManyAssetInput["unit"],
          amount: price.amount,
          currency: "INR",
          isDefault: index === 0,
          minDuration: price.minDuration,
          discountThreshold: price.discountThreshold,
          discountPercent: price.discountPercent,
        })),
      },

      ...(input.blackouts?.length
        ? {
            availability: {
              create: input.blackouts.map((window) => ({
                kind: "BLOCKED" as const,
                startDate: new Date(window.startDate),
                endDate: new Date(window.endDate),
                note: window.note,
              })),
            },
          }
        : {}),

      ...(input.digital
        ? {
            digitalInventory: {
              create: {
                slotDurationSeconds: input.digital.slotDurationSeconds,
                loopDurationSeconds: input.digital.loopDurationSeconds,
                slotsPerLoop: input.digital.slotsPerLoop,
                operatingHoursStart: input.digital.operatingHoursStart,
                operatingHoursEnd: input.digital.operatingHoursEnd,
                screenWidthPx: input.digital.screenWidthPx,
                screenHeightPx: input.digital.screenHeightPx,
                estimatedPlaysPerDay: Math.round(
                  ((input.digital.operatingHoursEnd -
                    input.digital.operatingHoursStart) *
                    3600) /
                    input.digital.loopDurationSeconds,
                ),
              },
            },
          }
        : {}),

      ...(input.operatingAreas?.length
        ? {
            operatingAreas: {
              create: input.operatingAreas.map((area) => ({
                name: area.name,
                city: area.city,
                centerLat: area.centerLat,
                centerLng: area.centerLng,
                radiusMeters: area.radiusMeters,
              })),
            },
          }
        : {}),
    },
  });

  // The geography column is unreachable through the typed client, so the point
  // is written separately. Without this the asset would never appear on the map
  // or match a bounds query, even once verified.
  if (input.location.lat !== undefined && input.location.lng !== undefined) {
    await setAssetPoint(asset.id, input.location.lat, input.location.lng);
  }

  // Opens the admin review queue entry alongside the asset.
  await prisma.verification.create({
    data: {
      assetId: asset.id,
      status: "PENDING",
      notes: "Submitted by owner for review.",
    },
  });

  return asset;
}

/**
 * Owner-initiated status change.
 *
 * Scoped by ownerId so one owner cannot pause or archive another's listing.
 * Verification status is deliberately not settable here — only admins change it.
 */
export async function updateAssetStatus(
  ownerId: string,
  assetId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
): Promise<boolean> {
  const result = await prisma.asset.updateMany({
    where: { id: assetId, ownerId },
    data: { status },
  });

  return result.count > 0;
}

/** Asset detail for the owner's own editing views, scoped by ownership. */
export async function getOwnerAsset(ownerId: string, assetId: string) {
  return prisma.asset.findFirst({
    where: { id: assetId, ownerId },
    include: {
      type: true,
      category: true,
      location: true,
      images: { orderBy: { sortOrder: "asc" } },
      pricing: true,
      availability: { orderBy: { startDate: "asc" } },
      digitalInventory: true,
      operatingAreas: true,
      verifications: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

/**
 * Fields a partner may change on an existing listing.
 *
 * Deliberately narrower than CreateAssetInput: `typeId` is absent because the
 * asset type determines the spec schema, the booking model, and which extra
 * tables exist. Changing it would invalidate stored specs and could orphan a
 * DigitalInventory row, so a partner who picked the wrong type should archive
 * and relist rather than mutate.
 */
export interface UpdateAssetInput {
  title: string;
  description?: string;
  specs: Record<string, unknown>;
  dailyImpressions?: number;
  audienceProfile?: string;

  location: {
    addressLine?: string;
    landmark?: string;
    locality?: string;
    city: string;
    state: string;
    pincode?: string;
    lat?: number;
    lng?: number;
    areaLabel?: string;
  };

  images: Array<{ url: string; alt?: string }>;

  pricing: Array<{
    unit: string;
    amount: number;
    minDuration?: number;
    discountThreshold?: number;
    discountPercent?: number;
  }>;

  blackouts?: Array<{ startDate: string; endDate: string; note?: string }>;

  digital?: {
    slotDurationSeconds: number;
    loopDurationSeconds: number;
    slotsPerLoop: number;
    operatingHoursStart: number;
    operatingHoursEnd: number;
    screenWidthPx?: number;
    screenHeightPx?: number;
  };

  operatingAreas?: Array<{
    name: string;
    city?: string;
    centerLat?: number;
    centerLng?: number;
    radiusMeters?: number;
  }>;
}

export type UpdateAssetResult =
  | { ok: true; requiresReverification: boolean }
  | { ok: false; reason: "not_found" };

/**
 * Whether an edit materially alters what advertisers were shown.
 *
 * Moving a billboard or swapping its photographs is effectively a different
 * listing and warrants a fresh admin check. A price change or a clearer
 * description is not. Re-verifying everything would make partners avoid
 * editing; re-verifying nothing would let a verified listing quietly become
 * something else.
 */
function needsReverification(
  before: {
    title: string;
    specs: unknown;
    lat: number | null;
    lng: number | null;
    imageUrls: string[];
  },
  after: UpdateAssetInput,
): boolean {
  if (before.title !== after.title) return true;

  // Any coordinate movement: a listing that moves is a different site.
  if (
    before.lat !== (after.location.lat ?? null) ||
    before.lng !== (after.location.lng ?? null)
  ) {
    return true;
  }

  const afterUrls = after.images.map((image) => image.url);
  if (
    afterUrls.length !== before.imageUrls.length ||
    afterUrls.some((url, index) => url !== before.imageUrls[index])
  ) {
    return true;
  }

  return specsDiffer(before.specs, after.specs);
}

/**
 * Compares two spec objects by value.
 *
 * Not `JSON.stringify`: that is key-order sensitive, and the Zod validator
 * rebuilds the object in descriptor order rather than the order it was stored.
 * Comparing serialised strings therefore reported every edit as a spec change
 * — sending unchanged listings back for verification while a genuine title
 * change slipped through.
 *
 * Values are compared as strings so `20` and `"20"` match: numbers arrive from
 * form inputs as strings and are coerced on the way in, so a round trip can
 * legitimately change the type without changing the meaning.
 */
function specsDiffer(before: unknown, after: unknown): boolean {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;

  const meaningful = (record: Record<string, unknown>) =>
    Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    );

  const beforeEntries = meaningful(a);
  const afterEntries = meaningful(b);

  if (beforeEntries.length !== afterEntries.length) return true;

  return beforeEntries.some(
    ([key, value]) => String(b[key]) !== String(value),
  );
}

/**
 * Updates a listing the partner owns.
 *
 * Scoped by ownerId at every step, so a mismatched id finds no asset rather
 * than touching someone else's listing.
 *
 * Child collections are replaced wholesale rather than diffed. Diffing would
 * need stable client-side ids for rows the partner may have reordered or
 * removed, and these collections are small enough that a replace inside one
 * transaction is both simpler and safer.
 */
export async function updateAsset(
  ownerId: string,
  assetId: string,
  input: UpdateAssetInput,
): Promise<UpdateAssetResult> {
  const existing = await prisma.asset.findFirst({
    where: { id: assetId, ownerId },
    select: {
      id: true,
      title: true,
      specs: true,
      verificationStatus: true,
      location: { select: { lat: true, lng: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  if (!existing) return { ok: false, reason: "not_found" };

  const materialChange = needsReverification(
    {
      title: existing.title,
      specs: existing.specs,
      lat: existing.location?.lat ?? null,
      lng: existing.location?.lng ?? null,
      imageUrls: existing.images.map((image) => image.url),
    },
    input,
  );

  // Only a currently-verified listing can lose its badge. Editing a rejected or
  // pending one leaves it pending, which is already correct.
  const requiresReverification =
    materialChange && existing.verificationStatus === "VERIFIED";

  await prisma.$transaction(async (tx) => {
    await tx.assetImage.deleteMany({ where: { assetId } });
    await tx.assetPricing.deleteMany({ where: { assetId } });
    await tx.operatingArea.deleteMany({ where: { assetId } });
    // Only owner-declared blackouts are replaced. BOOKED rows are derived from
    // confirmed requests and must survive an edit.
    await tx.assetAvailability.deleteMany({
      where: { assetId, kind: { in: ["BLOCKED", "MAINTENANCE"] } },
    });

    await tx.asset.update({
      where: { id: assetId },
      data: {
        title: input.title,
        description: input.description,
        specs: input.specs as Prisma.InputJsonValue,
        dailyImpressions: input.dailyImpressions,
        audienceProfile: input.audienceProfile,

        ...(requiresReverification
          ? {
              // Back to the queue, and out of search until re-approved.
              verificationStatus: "PENDING" as const,
              status: "DRAFT" as const,
            }
          : {}),

        location: {
          update: {
            addressLine: input.location.addressLine,
            landmark: input.location.landmark,
            locality: input.location.locality,
            city: input.location.city,
            state: input.location.state,
            pincode: input.location.pincode,
            lat: input.location.lat,
            lng: input.location.lng,
            areaLabel: input.location.areaLabel,
          },
        },

        images: {
          create: input.images.map((image, index) => ({
            url: image.url,
            alt: image.alt ?? input.title,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },

        pricing: {
          create: input.pricing.map((price, index) => ({
            unit: price.unit as Prisma.AssetPricingCreateManyAssetInput["unit"],
            amount: price.amount,
            currency: "INR",
            isDefault: index === 0,
            minDuration: price.minDuration,
            discountThreshold: price.discountThreshold,
            discountPercent: price.discountPercent,
          })),
        },

        ...(input.blackouts?.length
          ? {
              availability: {
                create: input.blackouts.map((window) => ({
                  kind: "BLOCKED" as const,
                  startDate: new Date(window.startDate),
                  endDate: new Date(window.endDate),
                  note: window.note,
                })),
              },
            }
          : {}),

        ...(input.operatingAreas?.length
          ? {
              operatingAreas: {
                create: input.operatingAreas.map((area) => ({
                  name: area.name,
                  city: area.city,
                  centerLat: area.centerLat,
                  centerLng: area.centerLng,
                  radiusMeters: area.radiusMeters,
                })),
              },
            }
          : {}),
      },
    });

    if (input.digital) {
      const activeHours =
        input.digital.operatingHoursEnd - input.digital.operatingHoursStart;
      const estimatedPlaysPerDay = Math.round(
        (activeHours * 3600) / input.digital.loopDurationSeconds,
      );
      await tx.digitalInventory.upsert({
        where: { assetId },
        create: { assetId, ...input.digital, estimatedPlaysPerDay },
        update: { ...input.digital, estimatedPlaysPerDay },
      });
    }

    if (requiresReverification) {
      await tx.verification.create({
        data: {
          assetId,
          status: "PENDING",
          notes: "Resubmitted by partner after edit.",
        },
      });
    }
  });

  // Geography is unreachable through the typed client, so the point is written
  // separately — exactly as on create. Missing this leaves an edited asset off
  // the map.
  if (input.location.lat !== undefined && input.location.lng !== undefined) {
    await setAssetPoint(assetId, input.location.lat, input.location.lng);
  }

  return { ok: true, requiresReverification };
}

/** Asset types with their spec descriptors, for the creation wizard. */
export async function getAssetTypesForWizard() {
  return prisma.assetCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      assetTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          isDigital: true,
          isMobile: true,
          defaultLocationMode: true,
          supportedBookingModels: true,
          specSchema: true,
        },
      },
    },
  });
}

export type WizardTaxonomy = Awaited<ReturnType<typeof getAssetTypesForWizard>>;
