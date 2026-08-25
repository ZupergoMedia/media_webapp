/**
 * Admin flow test:  pnpm test:admin
 *
 * The verification loop is the platform's trust boundary: approval is what
 * makes inventory publicly bookable. These tests cover that transition in both
 * directions, the audit trail behind it, and the guards that stop a listing
 * going live by accident.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createAsset } from "../src/server/services/owner-service";
import {
  getAdminMetrics,
  getVerificationQueue,
  reviewAsset,
  reviewOwner,
} from "../src/server/services/admin-service";
import { countAssets } from "../src/server/db/spatial";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const PREFIX = "ZZ Admin Test";

async function cleanup() {
  await prisma.asset.deleteMany({ where: { title: { startsWith: PREFIX } } });
}

async function main() {
  console.log("\nZuperGo admin flow test\n");

  await cleanup();

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const owner = await prisma.mediaOwner.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });
  const billboardType = await prisma.assetType.findUniqueOrThrow({
    where: { slug: "billboard" },
  });

  const baseline = await countAssets({});

  const makeAsset = (suffix: string) =>
    createAsset({
      ownerId: owner.id,
      typeId: billboardType.id,
      title: `${PREFIX} ${suffix}`,
      specs: { widthFt: 20, heightFt: 10, illumination: "Backlit" },
      location: {
        city: "Mumbai",
        state: "Maharashtra",
        locality: "Test",
        lat: 19.04,
        lng: 72.83,
      },
      images: [{ url: `https://picsum.photos/seed/admin-${suffix}/1200/800` }],
      pricing: [{ unit: "PER_MONTH", amount: 7_500_000 }],
    });

  // --- Queue --------------------------------------------------------------
  const pending = await makeAsset("Pending");

  const queue = await getVerificationQueue("PENDING");
  check(
    "New listing enters the pending queue",
    queue.some((item) => item.id === pending.id),
    `${queue.length} pending`,
  );

  const beforeApproval = await countAssets({});
  check(
    "Pending listing is not searchable",
    beforeApproval === baseline,
    `${beforeApproval} searchable`,
  );

  // --- Guards -------------------------------------------------------------
  // Rejection without a reason gives the owner nothing to act on, so it is
  // refused at the service layer, not merely discouraged in the UI.
  const noReason = await reviewAsset({
    assetId: pending.id,
    reviewerId: admin.id,
    decision: "REJECTED",
  });
  check(
    "Rejection without a reason is refused",
    !noReason.ok && noReason.reason === "reason_required",
    noReason.reason ?? "allowed",
  );

  const stillPending = await prisma.asset.findUniqueOrThrow({
    where: { id: pending.id },
    select: { verificationStatus: true },
  });
  check(
    "Refused rejection changed nothing",
    stillPending.verificationStatus === "PENDING",
    stillPending.verificationStatus,
  );

  const missing = await reviewAsset({
    assetId: "does-not-exist",
    reviewerId: admin.id,
    decision: "VERIFIED",
  });
  check(
    "Unknown listing is rejected",
    !missing.ok && missing.reason === "not_found",
    missing.reason ?? "accepted",
  );

  // --- Approval -----------------------------------------------------------
  const approved = await reviewAsset({
    assetId: pending.id,
    reviewerId: admin.id,
    decision: "VERIFIED",
    notes: "Site inspected.",
  });
  check("Approval succeeds", approved.ok, "verified");

  const afterApproval = await prisma.asset.findUniqueOrThrow({
    where: { id: pending.id },
    select: { status: true, verificationStatus: true, publishedAt: true },
  });
  check(
    "Approval sets status ACTIVE",
    afterApproval.status === "ACTIVE",
    afterApproval.status,
  );
  check(
    "Approval stamps publishedAt",
    afterApproval.publishedAt !== null,
    String(afterApproval.publishedAt !== null),
  );

  const searchableNow = await countAssets({});
  check(
    "Approved listing becomes searchable",
    searchableNow === baseline + 1,
    `${searchableNow} searchable`,
  );

  // --- Audit trail --------------------------------------------------------
  const audit = await prisma.verification.findMany({
    where: { assetId: pending.id },
    orderBy: { createdAt: "asc" },
    include: { reviewer: { select: { id: true } } },
  });
  check(
    "Audit records submission and decision",
    audit.length === 2 && audit[1].status === "VERIFIED",
    audit.map((entry) => entry.status).join(" -> "),
  );
  check(
    "Decision records the acting admin",
    audit[1]?.reviewer?.id === admin.id,
    audit[1]?.reviewer?.id ?? "none",
  );
  check(
    "Decision records the reason",
    audit[1]?.notes === "Site inspected.",
    audit[1]?.notes ?? "none",
  );

  const notification = await prisma.notification.findFirst({
    where: { userId: owner.userId, type: "ASSET_VERIFIED" },
    orderBy: { createdAt: "desc" },
  });
  check(
    "Owner is notified of approval",
    notification !== null,
    notification?.title ?? "none",
  );

  // --- Suspension ---------------------------------------------------------
  // A suspended listing must leave the market immediately; otherwise the
  // suspension has no practical effect.
  const suspended = await reviewAsset({
    assetId: pending.id,
    reviewerId: admin.id,
    decision: "SUSPENDED",
    notes: "Complaint received.",
  });
  check("Suspension succeeds", suspended.ok, "suspended");

  const afterSuspend = await countAssets({});
  check(
    "Suspended listing leaves search",
    afterSuspend === baseline,
    `${afterSuspend} searchable`,
  );

  // --- Rejection ----------------------------------------------------------
  const rejectable = await makeAsset("Rejected");
  const rejected = await reviewAsset({
    assetId: rejectable.id,
    reviewerId: admin.id,
    decision: "REJECTED",
    notes: "Photos do not match the stated location.",
  });
  check("Rejection with a reason succeeds", rejected.ok, "rejected");

  const rejectedAsset = await prisma.asset.findUniqueOrThrow({
    where: { id: rejectable.id },
    select: { status: true, verificationStatus: true },
  });
  check(
    "Rejected listing stays out of the market",
    rejectedAsset.verificationStatus === "REJECTED" &&
      rejectedAsset.status !== "ACTIVE",
    `${rejectedAsset.verificationStatus}/${rejectedAsset.status}`,
  );

  const afterReject = await countAssets({});
  check(
    "Rejection does not affect search count",
    afterReject === baseline,
    `${afterReject} searchable`,
  );

  // --- Owner suspension cascades -----------------------------------------
  // Suspending an owner must pull their live inventory too, or the suspension
  // is cosmetic.
  const cascadeAsset = await makeAsset("Cascade");
  await reviewAsset({
    assetId: cascadeAsset.id,
    reviewerId: admin.id,
    decision: "VERIFIED",
    notes: "ok",
  });

  const beforeOwnerSuspend = await countAssets({});
  const ownerSuspended = await reviewOwner({
    ownerId: owner.id,
    reviewerId: admin.id,
    decision: "SUSPENDED",
    notes: "Account under review.",
  });
  check("Owner suspension succeeds", ownerSuspended.ok, "suspended");

  const afterOwnerSuspend = await countAssets({});
  check(
    "Suspending an owner pulls their inventory",
    afterOwnerSuspend < beforeOwnerSuspend,
    `${beforeOwnerSuspend} -> ${afterOwnerSuspend} searchable`,
  );

  // Restore the owner so the demo data stays usable.
  await reviewOwner({
    ownerId: owner.id,
    reviewerId: admin.id,
    decision: "VERIFIED",
  });
  await prisma.asset.updateMany({
    where: { ownerId: owner.id, verificationStatus: "VERIFIED", status: "PAUSED" },
    data: { status: "ACTIVE" },
  });

  // --- Metrics ------------------------------------------------------------
  const metrics = await getAdminMetrics();
  check(
    "Metrics report asset totals",
    metrics.totalAssets > 0 && metrics.verifiedAssets > 0,
    `${metrics.totalAssets} total, ${metrics.verifiedAssets} verified`,
  );
  check(
    "Metrics count rejected listings",
    metrics.rejectedAssets >= 1,
    `${metrics.rejectedAssets} rejected`,
  );
  check(
    "GMV is non-negative",
    metrics.gmv >= 0,
    `${metrics.gmv} paise`,
  );

  await cleanup();

  const finalCount = await countAssets({});
  check(
    "Cleanup restores baseline",
    finalCount === baseline,
    `${finalCount} searchable`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Admin test error:\n", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
