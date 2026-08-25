import { prisma } from "@/server/db/client";

/**
 * Platform administration.
 *
 * Admin actions are privileged in a way owner actions are not: approving a
 * listing makes it publicly bookable, and suspending one removes it from the
 * market. Every mutation here therefore records who acted and why, so the
 * verification history is auditable rather than a bare status flag.
 */

/** Headline metrics for the admin dashboard. */
export async function getAdminMetrics() {
  const [
    totalAssets,
    verifiedAssets,
    pendingAssets,
    rejectedAssets,
    activeBookings,
    gmvAggregate,
    owners,
    pendingOwners,
    advertisers,
  ] = await Promise.all([
    prisma.asset.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.asset.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.asset.count({ where: { verificationStatus: "PENDING" } }),
    prisma.asset.count({ where: { verificationStatus: "REJECTED" } }),
    // "Active" now means an enquiry still in play: awaiting a response, or
    // confirmed by the owner.
    prisma.booking.count({
      where: { status: { in: ["REQUESTED", "VIEWED", "CONFIRMED"] } },
    }),
    // GMV counts only owner-confirmed business. Pending requests are excluded:
    // ZuperGo does not control the inventory, so an unanswered request may
    // never become a sale and counting it would inflate the figure.
    prisma.booking.aggregate({
      where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { totalAmount: true },
    }),
    prisma.mediaOwner.count(),
    prisma.mediaOwner.count({ where: { verificationStatus: "PENDING" } }),
    prisma.user.count({ where: { role: "ADVERTISER" } }),
  ]);

  return {
    totalAssets,
    verifiedAssets,
    pendingAssets,
    rejectedAssets,
    activeBookings,
    gmv: gmvAggregate._sum.totalAmount ?? 0,
    owners,
    pendingOwners,
    advertisers,
  };
}

/**
 * The verification queue.
 *
 * Oldest first: an owner who submitted three days ago should not be overtaken
 * by one who submitted this morning.
 */
export async function getVerificationQueue(
  status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" = "PENDING",
) {
  return prisma.asset.findMany({
    where: { verificationStatus: status },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      type: { select: { name: true, isDigital: true, isMobile: true } },
      category: { select: { name: true } },
      location: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      pricing: { orderBy: [{ isDefault: "desc" }, { amount: "asc" }] },
      owner: {
        select: {
          id: true,
          companyName: true,
          verificationStatus: true,
          contactEmail: true,
          city: true,
          createdAt: true,
        },
      },
    },
  });
}

/** Everything an admin needs to judge a single listing. */
export async function getAssetForReview(assetId: string) {
  return prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      type: true,
      category: true,
      location: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      pricing: { orderBy: [{ isDefault: "desc" }, { amount: "asc" }] },
      digitalInventory: true,
      operatingAreas: true,
      routes: true,
      availability: { orderBy: { startDate: "asc" } },
      owner: {
        select: {
          id: true,
          slug: true,
          companyName: true,
          description: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          gstNumber: true,
          panNumber: true,
          city: true,
          state: true,
          verificationStatus: true,
          ratingAverage: true,
          ratingCount: true,
          createdAt: true,
          _count: { select: { assets: true } },
        },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  });
}

export type AssetForReview = NonNullable<
  Awaited<ReturnType<typeof getAssetForReview>>
>;

export type ReviewDecision = "VERIFIED" | "REJECTED" | "SUSPENDED";

/**
 * Records an admin decision on a listing.
 *
 * Runs in a transaction because three things must move together: the asset's
 * verification status, its listing status, and the audit record. A partial
 * write here would leave an approved asset that is not actually live, or a live
 * asset with no record of who approved it.
 *
 * Approval sets `status: ACTIVE`, which is the moment the listing becomes
 * searchable — see the partial index `Asset_searchable_idx`.
 */
export async function reviewAsset(input: {
  assetId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    select: { id: true, status: true, verificationStatus: true, ownerId: true },
  });

  if (!asset) return { ok: false, reason: "not_found" };

  // A rejection or suspension must say why: the owner receives this text, and
  // "rejected" with no reason is not actionable feedback.
  if (input.decision !== "VERIFIED" && !input.notes?.trim()) {
    return { ok: false, reason: "reason_required" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: input.assetId },
      data: {
        verificationStatus: input.decision,
        // Approval publishes the listing. Rejection and suspension pull it out
        // of the market but preserve the record for the owner to correct.
        status:
          input.decision === "VERIFIED"
            ? "ACTIVE"
            : input.decision === "SUSPENDED"
              ? "PAUSED"
              : asset.status,
        publishedAt:
          input.decision === "VERIFIED" ? new Date() : undefined,
      },
    });

    await tx.verification.create({
      data: {
        assetId: input.assetId,
        reviewerId: input.reviewerId,
        status: input.decision,
        notes: input.notes?.trim(),
        reviewedAt: new Date(),
      },
    });

    // Notifications are persisted now and delivered when the notification
    // service lands; the owner-facing record should not wait on transport.
    const owner = await tx.mediaOwner.findUnique({
      where: { id: asset.ownerId },
      select: { userId: true },
    });

    if (owner) {
      await tx.notification.create({
        data: {
          userId: owner.userId,
          type: input.decision === "VERIFIED" ? "ASSET_VERIFIED" : "ASSET_REJECTED",
          title:
            input.decision === "VERIFIED"
              ? "Your listing is now live"
              : input.decision === "REJECTED"
                ? "Your listing needs changes"
                : "Your listing has been suspended",
          body: input.notes?.trim(),
          linkUrl: `/owner/assets`,
        },
      });
    }
  });

  return { ok: true };
}

/** Media owner accounts, for the users view. */
export async function getOwnersForAdmin() {
  return prisma.mediaOwner.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      companyName: true,
      slug: true,
      city: true,
      contactEmail: true,
      verificationStatus: true,
      ratingAverage: true,
      ratingCount: true,
      createdAt: true,
      _count: { select: { assets: true } },
    },
  });
}

/** Advertiser accounts, with their booking activity. */
export async function getAdvertisersForAdmin() {
  return prisma.user.findMany({
    where: { role: "ADVERTISER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { bookings: true, campaigns: true } },
    },
  });
}

/** Recent bookings across the platform. */
export async function getBookingsForAdmin() {
  return prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      advertiser: { select: { name: true, email: true } },
      items: {
        include: {
          asset: {
            select: {
              title: true,
              slug: true,
              owner: { select: { companyName: true } },
            },
          },
        },
      },
    },
  });
}

/** Approves or rejects a media owner account. */
export async function reviewOwner(input: {
  ownerId: string;
  reviewerId: string;
  decision: ReviewDecision;
  notes?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const owner = await prisma.mediaOwner.findUnique({
    where: { id: input.ownerId },
    select: { id: true, userId: true },
  });

  if (!owner) return { ok: false, reason: "not_found" };

  if (input.decision !== "VERIFIED" && !input.notes?.trim()) {
    return { ok: false, reason: "reason_required" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaOwner.update({
      where: { id: input.ownerId },
      data: {
        verificationStatus: input.decision,
        verifiedAt: input.decision === "VERIFIED" ? new Date() : null,
      },
    });

    await tx.verification.create({
      data: {
        ownerId: input.ownerId,
        reviewerId: input.reviewerId,
        status: input.decision,
        notes: input.notes?.trim(),
        reviewedAt: new Date(),
      },
    });

    // Suspending an owner must also pull their inventory. Leaving verified
    // listings bookable under a suspended account would defeat the suspension.
    if (input.decision === "SUSPENDED") {
      await tx.asset.updateMany({
        where: { ownerId: input.ownerId, status: "ACTIVE" },
        data: { status: "PAUSED" },
      });
    }
  });

  return { ok: true };
}
