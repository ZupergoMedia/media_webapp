import { prisma } from "@/server/db/client";
import { isBookingConflictError, describeDbError } from "@/server/db/errors";
import { quotePrice, type PricingOption } from "@/lib/pricing";

/**
 * Availability requests.
 *
 * ZuperGo lists inventory it does not own. A billboard can be sold through the
 * media owner's own sales channel at any moment, so nothing submitted here is a
 * confirmed booking — it is a request the owner answers out-of-band, usually by
 * phone or email.
 *
 * Two consequences shape this module:
 *
 *   1. Submitting a request reserves nothing. Competing advertisers may request
 *      the same asset and window; the owner chooses between them. Blocking
 *      dates on an unconfirmed request would sterilise inventory ZuperGo cannot
 *      actually hold, and would turn away a second advertiser for nothing.
 *
 *   2. Only owner confirmation claims a window. At that point the exclusion
 *      constraint applies, preventing the one thing that is physically
 *      impossible: two confirmed campaigns on one billboard at once.
 *
 * Prices are therefore estimates, and availability is indicative.
 */

export type RequestFailure =
  | { kind: "asset_not_found" }
  | { kind: "invalid_dates"; message: string }
  | { kind: "no_pricing" }
  | { kind: "unavailable"; message: string }
  | { kind: "duplicate"; message: string }
  | { kind: "error"; message: string };

export type RequestOutcome =
  | { ok: true; bookingId: string; reference: string; estimatedTotal: number }
  | { ok: false; failure: RequestFailure };

export interface CreateRequestInput {
  assetSlug: string;
  advertiserId: string;
  from: string;
  to: string;
  slotCount?: number;
  campaignName?: string;
  brandName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  creativeNotes?: string;
}

/**
 * Human-friendly reference.
 *
 * Random rather than sequential so references do not leak enquiry volume, and
 * prefixed by year so support can date one at a glance. Ambiguous characters
 * are omitted because these get read aloud on the phone.
 */
function generateReference(): string {
  const year = new Date().getUTCFullYear();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `ZG-${year}-${suffix}`;
}

function parseWindow(from: string, to: string):
  | { ok: true; startAt: Date; endAt: Date }
  | { ok: false; message: string } {
  const startAt = new Date(from);
  const endAt = new Date(to);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { ok: false, message: "Those dates could not be understood." };
  }
  if (endAt <= startAt) {
    return { ok: false, message: "The end date must be after the start date." };
  }

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (startAt.getTime() < todayUtc) {
    return { ok: false, message: "Campaign dates cannot start in the past." };
  }

  return { ok: true, startAt, endAt };
}

/**
 * Submits an availability request.
 *
 * Deliberately does not check whether other advertisers have requested the same
 * window — they may, and the owner decides. It does check owner-declared
 * blackouts and already-confirmed bookings, because requesting a window the
 * owner has committed wastes everyone's time.
 */
export async function createRequest(
  input: CreateRequestInput,
): Promise<RequestOutcome> {
  const asset = await prisma.asset.findFirst({
    where: {
      slug: input.assetSlug,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    include: {
      pricing: { orderBy: [{ isDefault: "desc" }, { amount: "asc" }] },
      digitalInventory: true,
      owner: { select: { id: true, userId: true, companyName: true } },
    },
  });

  if (!asset) return { ok: false, failure: { kind: "asset_not_found" } };
  if (asset.pricing.length === 0) {
    return { ok: false, failure: { kind: "no_pricing" } };
  }

  const window = parseWindow(input.from, input.to);
  if (!window.ok) {
    return {
      ok: false,
      failure: { kind: "invalid_dates", message: window.message },
    };
  }
  const { startAt, endAt } = window;

  const isDigital = asset.bookingModel === "DIGITAL_SLOT";
  const slotCount = isDigital ? Math.max(1, input.slotCount ?? 1) : undefined;

  /**
   * Estimate only.
   *
   * Priced server-side from the stored rate card so a client cannot forge a
   * figure — but presented to both parties as an estimate, since the owner may
   * quote differently when they confirm.
   */
  const quote = quotePrice({
    pricing: asset.pricing as PricingOption[],
    from: startAt,
    to: endAt,
    slotCount,
  });

  if (!quote) {
    return {
      ok: false,
      failure: { kind: "invalid_dates", message: "Could not price those dates." },
    };
  }

  // Windows the owner has genuinely committed. Confirmed bookings and declared
  // blackouts are real unavailability, unlike a pending request.
  const [confirmed, blocked] = await Promise.all([
    prisma.bookingItem.findFirst({
      where: {
        assetId: asset.id,
        holdsInventory: true,
        bookingModel: { not: "DIGITAL_SLOT" },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    }),
    prisma.assetAvailability.findFirst({
      where: {
        assetId: asset.id,
        kind: { in: ["BLOCKED", "MAINTENANCE"] },
        startDate: { lt: endAt },
        endDate: { gt: startAt },
      },
    }),
  ]);

  if (confirmed || blocked) {
    return {
      ok: false,
      failure: {
        kind: "unavailable",
        message: confirmed
          ? "Those dates are already confirmed for another campaign. Try a different window."
          : "The owner has marked part of that window unavailable.",
      },
    };
  }

  // One open request per advertiser per asset per window. Re-submitting the
  // same enquiry adds no information and clutters the owner's queue.
  const existing = await prisma.booking.findFirst({
    where: {
      advertiserId: input.advertiserId,
      status: { in: ["REQUESTED", "VIEWED"] },
      items: {
        some: {
          assetId: asset.id,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      },
    },
    select: { reference: true },
  });

  if (existing) {
    return {
      ok: false,
      failure: {
        kind: "duplicate",
        message: `You already have an open request for these dates (${existing.reference}).`,
      },
    };
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          reference: generateReference(),
          advertiserId: input.advertiserId,
          status: "REQUESTED",
          subtotalAmount: quote.subtotal - quote.discountAmount,
          taxAmount: quote.tax,
          totalAmount: quote.total,
          currency: quote.currency,
          notes: input.notes,
          creativeNotes: input.creativeNotes,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
        },
      });

      await tx.bookingItem.create({
        data: {
          bookingId: created.id,
          assetId: asset.id,
          bookingModel: isDigital ? "DIGITAL_SLOT" : "DATE_RANGE",
          startAt,
          endAt,
          slotCount,
          unitPrice: quote.unitPrice,
          quantity: quote.quantity,
          lineTotal: quote.subtotal,
          currency: quote.currency,
        },
      });

      // The owner's prompt to act. Confirmation happens off-platform, so this
      // notification is the handover point.
      await tx.notification.create({
        data: {
          userId: asset.owner.userId,
          type: "BOOKING_REQUESTED",
          title: "New availability request",
          body: `${input.campaignName ?? "An advertiser"} has requested ${asset.title}.`,
          linkUrl: "/owner/requests",
        },
      });

      return created;
    });

    return {
      ok: true,
      bookingId: booking.id,
      reference: booking.reference,
      estimatedTotal: booking.totalAmount,
    };
  } catch (error) {
    // Only reachable if a confirmation landed between the check above and this
    // write.
    if (isBookingConflictError(error)) {
      return {
        ok: false,
        failure: {
          kind: "unavailable",
          message:
            "Those dates were just confirmed for another campaign. Please choose another window.",
        },
      };
    }

    console.error("[request] create failed:", describeDbError(error));
    return {
      ok: false,
      failure: {
        kind: "error",
        message: "Could not send your request. Please try again.",
      },
    };
  }
}

/**
 * The request, scoped to a viewer.
 *
 * A reference is short and readable so it can be given over the phone — which
 * also makes it guessable, so it must never be sufficient on its own to read
 * someone's enquiry, contact details and spend.
 */
export async function getRequestByReference(
  reference: string,
  viewer: { id: string; role: "ADVERTISER" | "MEDIA_PARTNER" | "ADMIN" },
) {
  return prisma.booking.findFirst({
    where: {
      reference,
      ...(viewer.role === "ADMIN"
        ? {}
        : {
            OR: [
              { advertiserId: viewer.id },
              { items: { some: { asset: { owner: { userId: viewer.id } } } } },
            ],
          }),
    },
    include: {
      advertiser: { select: { name: true, email: true } },
      items: {
        include: {
          asset: {
            include: {
              location: true,
              type: { select: { name: true, isDigital: true } },
              images: {
                take: 1,
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              },
              owner: {
                select: {
                  companyName: true,
                  contactEmail: true,
                  contactPhone: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

/** Requests an advertiser has made. */
export async function getRequestsForAdvertiser(advertiserId: string) {
  return prisma.booking.findMany({
    where: { advertiserId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          asset: {
            select: {
              title: true,
              slug: true,
              images: {
                take: 1,
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              },
              owner: { select: { companyName: true } },
            },
          },
        },
      },
    },
  });
}

/** Requests against an owner's inventory, unanswered ones first. */
export async function getRequestsForOwner(ownerId: string) {
  const requests = await prisma.booking.findMany({
    where: { items: { some: { asset: { ownerId } } } },
    orderBy: { createdAt: "asc" },
    include: {
      advertiser: { select: { name: true, email: true } },
      items: {
        include: {
          asset: { select: { title: true, slug: true, ownerId: true } },
        },
      },
    },
  });

  // Sorted in code rather than SQL: "needs a response" is not the enum's
  // declaration order, and an owner opening this page wants those first.
  const priority: Record<string, number> = {
    REQUESTED: 0,
    VIEWED: 1,
    CONFIRMED: 2,
    DECLINED: 3,
    WITHDRAWN: 4,
    COMPLETED: 5,
    DRAFT: 6,
  };

  return requests.sort(
    (a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9),
  );
}

export type OwnerResponse = "CONFIRMED" | "DECLINED";

/**
 * Records the owner's decision.
 *
 * Confirmation is the moment the window is actually claimed — the exclusion
 * constraint starts applying to this row, so a competing confirmation for the
 * same dates is rejected by the database.
 */
export async function respondToRequest(input: {
  reference: string;
  ownerUserId: string;
  response: OwnerResponse;
  message?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  // Scoped by ownership: an owner may only answer requests against their own
  // inventory.
  const booking = await prisma.booking.findFirst({
    where: {
      reference: input.reference,
      items: { some: { asset: { owner: { userId: input.ownerUserId } } } },
    },
    select: { id: true, status: true, advertiserId: true },
  });

  if (!booking) return { ok: false, reason: "not_found" };

  if (booking.status === "CONFIRMED" || booking.status === "DECLINED") {
    return { ok: false, reason: "already_answered" };
  }

  // A decline must say why. "Already sold" and "dates unavailable" lead the
  // advertiser to very different next steps.
  if (input.response === "DECLINED" && !input.message?.trim()) {
    return { ok: false, reason: "reason_required" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: input.response,
          respondedAt: new Date(),
          confirmedAt: input.response === "CONFIRMED" ? new Date() : undefined,
          declinedAt: input.response === "DECLINED" ? new Date() : undefined,
          declineReason:
            input.response === "DECLINED" ? input.message?.trim() : undefined,
        },
      });

      await tx.notification.create({
        data: {
          userId: booking.advertiserId,
          type:
            input.response === "CONFIRMED"
              ? "BOOKING_CONFIRMED"
              : "BOOKING_CANCELLED",
          title:
            input.response === "CONFIRMED"
              ? "Your request was confirmed"
              : "Your request could not be fulfilled",
          body: input.message?.trim(),
          linkUrl: `/requests/${input.reference}`,
        },
      });
    });

    return { ok: true };
  } catch (error) {
    // Another confirmation claimed this window first.
    if (isBookingConflictError(error)) {
      return { ok: false, reason: "already_confirmed_elsewhere" };
    }
    console.error("[request] respond failed:", describeDbError(error));
    return { ok: false, reason: "error" };
  }
}

/** Marks a request as seen, so the advertiser knows it reached the owner. */
export async function markRequestViewed(
  reference: string,
  ownerUserId: string,
): Promise<void> {
  await prisma.booking.updateMany({
    where: {
      reference,
      status: "REQUESTED",
      items: { some: { asset: { owner: { userId: ownerUserId } } } },
    },
    data: { status: "VIEWED" },
  });
}

/** Advertiser withdraws their own request. */
export async function withdrawRequest(
  reference: string,
  advertiserId: string,
): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      reference,
      advertiserId,
      status: { in: ["REQUESTED", "VIEWED"] },
    },
    data: { status: "WITHDRAWN" },
  });

  return result.count > 0;
}

/**
 * Other open requests competing for the same window.
 *
 * Shown to the owner as context when deciding, and counted for the advertiser
 * so they understand the asset is contested. Deliberately does not expose who
 * the competitors are.
 */
export async function countCompetingRequests(
  assetId: string,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string,
): Promise<number> {
  return prisma.booking.count({
    where: {
      status: { in: ["REQUESTED", "VIEWED"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      items: {
        some: {
          assetId,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      },
    },
  });
}

/**
 * Dates genuinely unavailable on an asset.
 *
 * Only confirmed bookings and owner blackouts. Pending requests are excluded
 * deliberately: they reserve nothing, and greying them out would hide bookable
 * inventory from other advertisers.
 */
export async function getUnavailableRanges(assetId: string) {
  const [confirmed, blocked] = await Promise.all([
    prisma.bookingItem.findMany({
      where: {
        assetId,
        holdsInventory: true,
        bookingModel: { not: "DIGITAL_SLOT" },
        endAt: { gte: new Date() },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.assetAvailability.findMany({
      where: {
        assetId,
        kind: { in: ["BLOCKED", "MAINTENANCE"] },
        endDate: { gte: new Date() },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  return [
    ...confirmed.map((item) => ({
      start: item.startAt,
      end: item.endAt,
      reason: "confirmed" as const,
    })),
    ...blocked.map((window) => ({
      start: window.startDate,
      end: window.endDate,
      reason: "blocked" as const,
    })),
  ];
}
