import { createHash } from "node:crypto";
import { prisma } from "@/server/db/client";
import { serverEnv } from "@/lib/env";
import type { SaleEnquiryForm } from "@/lib/sale-schema";

/**
 * Anonymous public enquiries about a sale listing.
 *
 * This codebase has no rate limiter, no captcha, no email verification, and
 * no queue — a public unauthenticated POST that writes a row and notifies a
 * seller is an open spam relay, and a zod schema does not solve that. The
 * mitigations below stop casual and accidental abuse, not a determined
 * actor:
 *
 *   1. Contact details are never returned by createSaleEnquiry — that is the
 *      single most important mitigation, since it removes the incentive to
 *      enumerate listings for contact scraping.
 *   2. The message is bounded and URL-free (enforced in sale-schema.ts).
 *   3. A DB-backed sliding window below, no new infrastructure.
 *
 * TODO(phase-2): replace the sliding window with real rate limiting
 * (Upstash/Redis or a platform rate limiter) and add Turnstile/hCaptcha to
 * the enquiry form before any marketing push drives traffic here.
 */

export type SaleEnquiryFailure =
  | { kind: "listing_not_found" }
  | { kind: "rate_limited"; message: string }
  | { kind: "duplicate"; message: string };

export type SaleEnquiryOutcome =
  | { ok: true; enquiryId: string }
  | { ok: false; failure: SaleEnquiryFailure };

/** Salted so this table is never a plaintext IP log — see SALE_ENQUIRY_IP_SALT. */
function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${serverEnv.SALE_ENQUIRY_IP_SALT}`)
    .digest("hex");
}

const EMAIL_HOURLY_LIMIT = 3;
const IP_HOURLY_LIMIT = 10;
const DUPLICATE_WINDOW_HOURS = 24;

export interface CreateSaleEnquiryInput extends SaleEnquiryForm {
  /** From `request.headers.get("x-forwarded-for")`; null when unavailable (e.g. local dev). */
  ip: string | null;
}

export async function createSaleEnquiry(
  input: CreateSaleEnquiryInput,
): Promise<SaleEnquiryOutcome> {
  const listing = await prisma.saleListing.findFirst({
    where: { slug: input.saleListingSlug, status: "PUBLISHED" },
    select: { id: true, ownerId: true, owner: { select: { userId: true } } },
  });

  if (!listing) return { ok: false, failure: { kind: "listing_not_found" } };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const email = input.email.trim().toLowerCase();
  const ipHash = input.ip ? hashIp(input.ip) : null;

  const [emailCount, ipCount, duplicate] = await Promise.all([
    prisma.saleEnquiry.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    }),
    ipHash
      ? prisma.saleEnquiry.count({
          where: { ipHash, createdAt: { gte: oneHourAgo } },
        })
      : Promise.resolve(0),
    prisma.saleEnquiry.findFirst({
      where: {
        saleListingId: listing.id,
        email,
        createdAt: {
          gte: new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    }),
  ]);

  if (emailCount >= EMAIL_HOURLY_LIMIT || ipCount >= IP_HOURLY_LIMIT) {
    return {
      ok: false,
      failure: {
        kind: "rate_limited",
        message: "Too many enquiries submitted recently. Try again later.",
      },
    };
  }

  if (duplicate) {
    return {
      ok: false,
      failure: {
        kind: "duplicate",
        message: "An enquiry from this email for this listing is already pending.",
      },
    };
  }

  const enquiry = await prisma.$transaction(async (tx) => {
    const created = await tx.saleEnquiry.create({
      data: {
        saleListingId: listing.id,
        name: input.name,
        email,
        phone: input.phone,
        company: input.company,
        interest: input.interest,
        intents: input.intents,
        message: input.message,
        ipHash,
      },
    });

    await tx.saleListingEvent.create({
      data: { saleListingId: listing.id, eventType: "ENQUIRY_RECEIVED" },
    });

    // The seller's prompt to act. Their contact details are never handed to
    // the enquirer — the seller chooses whether to respond, matching the
    // advertising side's off-platform handover.
    await tx.notification.create({
      data: {
        userId: listing.owner.userId,
        type: "SYSTEM",
        title: "New enquiry on your sale listing",
        body: `${input.name} is interested as ${input.interest.toLowerCase().replace(/_/g, " ")}.`,
        linkUrl: "/owner/sales/enquiries",
      },
    });

    return created;
  });

  return { ok: true, enquiryId: enquiry.id };
}

/** A seller's own enquiry inbox, scoped by ownerId. */
export async function getOwnerSaleEnquiries(ownerId: string) {
  return prisma.saleEnquiry.findMany({
    where: { saleListing: { ownerId } },
    orderBy: { createdAt: "desc" },
    include: {
      saleListing: {
        select: { slug: true, asset: { select: { title: true } } },
      },
    },
  });
}

/** Marks an enquiry viewed. Scoped by ownerId. */
export async function markSaleEnquiryViewed(
  ownerId: string,
  enquiryId: string,
): Promise<boolean> {
  const result = await prisma.saleEnquiry.updateMany({
    where: { id: enquiryId, status: "NEW", saleListing: { ownerId } },
    data: { status: "VIEWED" },
  });

  return result.count > 0;
}
