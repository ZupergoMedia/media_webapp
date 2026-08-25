/**
 * Availability request test:  pnpm test:requests
 *
 * ZuperGo does not own the inventory it lists, so a request reserves nothing
 * and competing requests are legal. These tests pin down that behaviour, plus
 * the one guarantee that still holds: two campaigns cannot both be confirmed on
 * the same asset and window.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  countCompetingRequests,
  createRequest,
  getUnavailableRanges,
  markRequestViewed,
  respondToRequest,
  withdrawRequest,
} from "../src/server/services/request-service";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const YEAR = 2033;
const win = (m: number, d1: number, d2: number) => ({
  from: `${YEAR}-${String(m).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
  to: `${YEAR}-${String(m).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
});

async function cleanup() {
  await prisma.booking.deleteMany({
    where: { items: { some: { startAt: { gte: new Date(`${YEAR}-01-01`) } } } },
  });
}

async function main() {
  console.log("\nZuperGo availability request test\n");

  await cleanup();

  // Three distinct advertisers, so per-advertiser duplicate rules do not mask
  // the competing-request behaviour being tested.
  const advertisers = await Promise.all(
    ["a", "b", "c"].map((suffix) =>
      prisma.user.upsert({
        where: { email: `req-${suffix}@demo.zupergo.test` },
        create: {
          email: `req-${suffix}@demo.zupergo.test`,
          name: `Request Tester ${suffix.toUpperCase()}`,
          role: "ADVERTISER",
        },
        update: {},
      }),
    ),
  );

  const asset = await prisma.asset.findFirstOrThrow({
    where: { bookingModel: "DATE_RANGE", status: "ACTIVE" },
    include: { owner: { select: { userId: true } }, pricing: true },
  });

  const otherOwner = await prisma.mediaOwner.findFirstOrThrow({
    where: { userId: { not: asset.owner.userId } },
    select: { userId: true },
  });

  const base = {
    campaignName: "Request Test",
    brandName: "Demo",
    contactEmail: "tester@demo.zupergo.test",
    contactPhone: "+91 90000 00000",
  };

  // --- A request is not a booking ----------------------------------------
  const contested = win(4, 1, 30);

  const first = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[0].id,
    ...contested,
  });
  check("Creates a request", first.ok, first.ok ? first.reference : JSON.stringify(first));

  if (first.ok) {
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: first.bookingId },
      include: { items: true },
    });
    check("Request status is REQUESTED", stored.status === "REQUESTED", stored.status);
    check(
      "Request reserves nothing",
      stored.items[0]?.holdsInventory === false,
      `holdsInventory=${stored.items[0]?.holdsInventory}`,
    );
    check(
      "Contact details captured for off-platform reply",
      stored.contactEmail !== null && stored.contactPhone !== null,
      `${stored.contactEmail} / ${stored.contactPhone}`,
    );
  }

  // --- Competing requests are legal --------------------------------------
  // The core of the model: ZuperGo cannot reserve inventory it does not own, so
  // it must not turn a second advertiser away over unconfirmed dates.
  const second = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[1].id,
    ...contested,
  });
  const third = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[2].id,
    from: `${YEAR}-04-15`,
    to: `${YEAR}-05-15`,
  });

  check("A second advertiser may request the same window", second.ok, "accepted");
  check("A third may request an overlapping window", third.ok, "accepted");

  const openCount = await prisma.booking.count({
    where: {
      status: { in: ["REQUESTED", "VIEWED"] },
      items: { some: { assetId: asset.id, startAt: { gte: new Date(`${YEAR}-01-01`) } } },
    },
  });
  check("Three requests coexist on one asset", openCount === 3, `${openCount} open`);

  // Requested dates must stay bookable-looking: greying them out would hide
  // inventory that is still genuinely available.
  const unavailableBefore = await getUnavailableRanges(asset.id);
  const blockedByRequests = unavailableBefore.filter(
    (range) => range.start >= new Date(`${YEAR}-01-01`),
  );
  check(
    "Pending requests do not block the calendar",
    blockedByRequests.length === 0,
    `${blockedByRequests.length} blocked ranges`,
  );

  if (first.ok) {
    const competing = await countCompetingRequests(
      asset.id,
      new Date(contested.from),
      new Date(contested.to),
      first.bookingId,
    );
    check("Competing requests are counted", competing === 2, `${competing} others`);
  }

  // --- Duplicate guard ----------------------------------------------------
  const duplicate = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[0].id,
    ...contested,
  });
  check(
    "Same advertiser cannot duplicate their own request",
    !duplicate.ok && duplicate.failure.kind === "duplicate",
    !duplicate.ok ? duplicate.failure.kind : "accepted",
  );

  // --- Owner response -----------------------------------------------------
  if (first.ok) {
    await markRequestViewed(first.reference, asset.owner.userId);
    const viewed = await prisma.booking.findUniqueOrThrow({
      where: { id: first.bookingId },
      select: { status: true },
    });
    check("Owner viewing marks the request seen", viewed.status === "VIEWED", viewed.status);

    // Ownership scoping: an unrelated owner must not be able to answer.
    const wrongOwner = await respondToRequest({
      reference: first.reference,
      ownerUserId: otherOwner.userId,
      response: "CONFIRMED",
    });
    check(
      "Unrelated owner cannot respond",
      !wrongOwner.ok && wrongOwner.reason === "not_found",
      wrongOwner.reason ?? "allowed",
    );

    const noReason = await respondToRequest({
      reference: first.reference,
      ownerUserId: asset.owner.userId,
      response: "DECLINED",
    });
    check(
      "Declining requires a reason",
      !noReason.ok && noReason.reason === "reason_required",
      noReason.reason ?? "allowed",
    );

    const confirmed = await respondToRequest({
      reference: first.reference,
      ownerUserId: asset.owner.userId,
      response: "CONFIRMED",
      message: "Dates are free, will send the contract.",
    });
    check("Owner can confirm", confirmed.ok, "confirmed");

    const afterConfirm = await prisma.booking.findUniqueOrThrow({
      where: { id: first.bookingId },
      include: { items: true },
    });
    check(
      "Confirmation claims the window",
      afterConfirm.items[0]?.holdsInventory === true,
      `holdsInventory=${afterConfirm.items[0]?.holdsInventory}`,
    );
    check(
      "Confirmation is timestamped",
      afterConfirm.confirmedAt !== null && afterConfirm.respondedAt !== null,
      "confirmedAt + respondedAt set",
    );

    // Now — and only now — the dates are genuinely unavailable.
    const unavailableAfter = await getUnavailableRanges(asset.id);
    const nowBlocked = unavailableAfter.filter(
      (range) => range.reason === "confirmed" && range.start >= new Date(`${YEAR}-01-01`),
    );
    check(
      "Confirmed dates block the calendar",
      nowBlocked.length === 1,
      `${nowBlocked.length} confirmed range`,
    );

    // --- The one remaining guarantee -------------------------------------
    // One billboard cannot show two campaigns at once, so a second
    // confirmation over the same window must be impossible.
    if (second.ok) {
      const doubleConfirm = await respondToRequest({
        reference: second.reference,
        ownerUserId: asset.owner.userId,
        response: "CONFIRMED",
        message: "Also confirming",
      });
      check(
        "A second confirmation on the same window is refused",
        !doubleConfirm.ok,
        doubleConfirm.reason ?? "allowed — DOUBLE BOOKED",
      );
    }

    // A declined request must not keep the dates tied up.
    if (third.ok) {
      const declined = await respondToRequest({
        reference: third.reference,
        ownerUserId: asset.owner.userId,
        response: "DECLINED",
        message: "Already sold to another client for that period.",
      });
      check("Owner can decline with a reason", declined.ok, "declined");

      const declinedRow = await prisma.booking.findUniqueOrThrow({
        where: { reference: third.reference },
        include: { items: true },
      });
      check(
        "Declined request holds nothing",
        declinedRow.items[0]?.holdsInventory === false,
        `holdsInventory=${declinedRow.items[0]?.holdsInventory}`,
      );
      check(
        "Decline reason is recorded for the advertiser",
        declinedRow.declineReason?.includes("Already sold") === true,
        declinedRow.declineReason ?? "none",
      );
    }

    const reConfirm = await respondToRequest({
      reference: first.reference,
      ownerUserId: asset.owner.userId,
      response: "DECLINED",
      message: "Changed my mind",
    });
    check(
      "An answered request cannot be answered twice",
      !reConfirm.ok && reConfirm.reason === "already_answered",
      reConfirm.reason ?? "allowed",
    );
  }

  // --- Requesting an already-confirmed window ----------------------------
  const afterConfirmRequest = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[2].id,
    ...contested,
  });
  check(
    "Confirmed dates cannot be requested",
    !afterConfirmRequest.ok && afterConfirmRequest.failure.kind === "unavailable",
    !afterConfirmRequest.ok ? afterConfirmRequest.failure.kind : "accepted",
  );

  // --- Withdrawal ---------------------------------------------------------
  const withdrawable = await createRequest({
    ...base,
    assetSlug: asset.slug,
    advertiserId: advertisers[0].id,
    ...win(6, 1, 20),
  });

  if (withdrawable.ok) {
    const wrongUser = await withdrawRequest(
      withdrawable.reference,
      advertisers[1].id,
    );
    check("Only the requester can withdraw", wrongUser === false, "0 rows affected");

    const withdrawn = await withdrawRequest(
      withdrawable.reference,
      advertisers[0].id,
    );
    check("Advertiser can withdraw their request", withdrawn, "withdrawn");
  }

  // --- Notifications ------------------------------------------------------
  const ownerNotifications = await prisma.notification.count({
    where: { userId: asset.owner.userId, type: "BOOKING_REQUESTED" },
  });
  check(
    "Owner is notified of new requests",
    ownerNotifications >= 3,
    `${ownerNotifications} notifications`,
  );

  const advertiserNotifications = await prisma.notification.count({
    where: { userId: advertisers[0].id, type: "BOOKING_CONFIRMED" },
  });
  check(
    "Advertiser is notified of the decision",
    advertiserNotifications >= 1,
    `${advertiserNotifications} notifications`,
  );

  await cleanup();
  await prisma.notification.deleteMany({
    where: { userId: { in: advertisers.map((a) => a.id) } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "req-" } },
  });

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Request test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
