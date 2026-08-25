/**
 * Pricing test:  pnpm test:pricing
 *
 * Pure-function tests over src/lib/pricing.ts — no database needed. Pricing is
 * money, and this same function produces both the browser quote and the
 * server-side booking total, so an error here is a mispriced invoice.
 */
import { quotePrice, daysBetween, sumQuotes, TAX_RATE } from "../src/lib/pricing";

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

const rupees = (n: number) => n * 100;

const monthly = [
  {
    unit: "PER_MONTH",
    amount: rupees(150_000),
    currency: "INR",
    discountThreshold: 30,
    discountPercent: 10,
  },
];

const daily = [
  { unit: "PER_DAY", amount: rupees(18_000), currency: "INR" },
];

const perSlot = [
  { unit: "PER_SLOT", amount: rupees(4_500), currency: "INR" },
];

function main() {
  console.log("\nZuperGo pricing test\n");

  // --- Day maths ----------------------------------------------------------
  check("Same-day booking is 1 day", daysBetween("2026-09-01", "2026-09-01") === 1, "1");
  check("Sept 1 -> Sept 30 is 29 days", daysBetween("2026-09-01", "2026-09-30") === 29, "29");
  check(
    "Crosses month boundary",
    daysBetween("2026-09-25", "2026-10-05") === 10,
    "10",
  );

  // --- Incomplete input ---------------------------------------------------
  check(
    "No dates yields no quote",
    quotePrice({ pricing: monthly }) === null,
    "null (not a ₹0 quote)",
  );
  check(
    "No pricing yields no quote",
    quotePrice({ pricing: [], from: "2026-09-01", to: "2026-09-30" }) === null,
    "null",
  );

  // --- Partial periods are pro-rated --------------------------------------
  // The regression this suite previously enshrined: a 5-day booking on a
  // monthly rate was billed as a full month, overstating the cost six-fold.
  const fiveDays = quotePrice({
    pricing: monthly,
    from: "2026-08-18",
    to: "2026-08-23",
  })!;
  check(
    "5 days on a monthly rate is pro-rated",
    fiveDays.quantity < 1 && fiveDays.subtotal < rupees(150_000),
    `${fiveDays.quantity} months = ₹${fiveDays.subtotal / 100} (not ₹1,50,000)`,
  );
  check(
    "Pro-rated amount is proportionate",
    // 5/30 of ₹1,50,000 = ₹25,000 exactly; 3dp rounding keeps the error under
    // ₹100 on a six-figure monthly rate.
    Math.abs(fiveDays.subtotal - rupees(25_000)) < rupees(100),
    `₹${fiveDays.subtotal / 100} ≈ ₹25,000`,
  );

  const short = quotePrice({
    pricing: monthly,
    from: "2026-09-01",
    to: "2026-09-20",
  })!;
  check(
    "19 days bills as ~0.63 months",
    short.quantity > 0.6 && short.quantity < 0.7,
    `${short.quantity} months = ₹${short.subtotal / 100}`,
  );
  check(
    "No discount below threshold",
    short.discountAmount === 0,
    `19 days < 30-day threshold`,
  );
  check(
    "GST applied at 18%",
    short.tax === Math.round(short.taxableAmount * TAX_RATE),
    `₹${short.tax / 100} on ₹${short.taxableAmount / 100}`,
  );
  check(
    "Total = taxable + tax",
    short.total === short.taxableAmount + short.tax,
    `₹${short.total / 100}`,
  );

  // --- Monthly, discount applies ------------------------------------------
  const long = quotePrice({
    pricing: monthly,
    from: "2026-09-01",
    to: "2026-10-15",
  })!;
  check(
    "44 days bills as ~1.47 months",
    long.quantity > 1.4 && long.quantity < 1.5,
    `${long.quantity} months`,
  );
  check(
    "Discount applies past threshold",
    long.discountPercent === 10 &&
      long.discountAmount === Math.round(long.subtotal * 0.1),
    `10% off ₹${long.subtotal / 100} = −₹${long.discountAmount / 100}`,
  );
  check(
    "Tax computed after discount",
    long.tax === Math.round((long.subtotal - long.discountAmount) * TAX_RATE),
    "tax on discounted amount",
  );

  // --- Daily --------------------------------------------------------------
  const week = quotePrice({
    pricing: daily,
    from: "2026-09-01",
    to: "2026-09-08",
  })!;
  check(
    "Daily rate × 7 days",
    week.quantity === 7 && week.subtotal === rupees(18_000) * 7,
    `7 × ₹18,000 = ₹${week.subtotal / 100}`,
  );

  // --- Digital slots ------------------------------------------------------
  const slots = quotePrice({
    pricing: perSlot,
    from: "2026-09-01",
    to: "2026-09-08",
    slotCount: 3,
  })!;
  check(
    "Slots bill per slot per day",
    slots.quantity === 21,
    `3 slots × 7 days = ${slots.quantity} slot-days`,
  );

  const oneSlot = quotePrice({
    pricing: perSlot,
    from: "2026-09-01",
    to: "2026-09-08",
    slotCount: 1,
  })!;
  check(
    "More slots costs proportionally more",
    slots.subtotal === oneSlot.subtotal * 3,
    `₹${slots.subtotal / 100} = 3 × ₹${oneSlot.subtotal / 100}`,
  );

  // --- Integer safety -----------------------------------------------------
  // Money is integer paise; a fractional result anywhere means rounding is
  // wrong and totals will drift across a multi-asset campaign.
  const odd = quotePrice({
    pricing: [
      {
        unit: "PER_DAY",
        amount: 33_333,
        currency: "INR",
        discountThreshold: 3,
        discountPercent: 7,
      },
    ],
    from: "2026-09-01",
    to: "2026-09-08",
  })!;
  const allIntegers = [
    odd.subtotal,
    odd.discountAmount,
    odd.taxableAmount,
    odd.tax,
    odd.total,
  ].every(Number.isInteger);
  check("All amounts are whole paise", allIntegers, "no fractional paise");

  // --- Owner minimum booking period ---------------------------------------
  // An owner who will not sell below a month says so via minDuration. The
  // charge rises to that minimum, and the quote reports why.
  const withMinimum = quotePrice({
    pricing: [
      {
        unit: "PER_MONTH",
        amount: rupees(150_000),
        currency: "INR",
        minDuration: 1,
      },
    ],
    from: "2026-08-18",
    to: "2026-08-23",
  })!;
  check(
    "Minimum duration raises a short booking",
    withMinimum.quantity === 1 && withMinimum.subtotal === rupees(150_000),
    `${withMinimum.quantity} month = ₹${withMinimum.subtotal / 100}`,
  );
  check(
    "Minimum is reported to the buyer",
    withMinimum.minimumApplied !== undefined,
    withMinimum.minimumApplied?.label ?? "not reported",
  );
  check(
    "Requested days still reported honestly",
    withMinimum.days === 5,
    `${withMinimum.days} days requested`,
  );

  const overMinimum = quotePrice({
    pricing: [
      {
        unit: "PER_MONTH",
        amount: rupees(150_000),
        currency: "INR",
        minDuration: 1,
      },
    ],
    from: "2026-08-01",
    to: "2026-10-01",
  })!;
  check(
    "No minimum flag when the booking exceeds it",
    overMinimum.minimumApplied === undefined,
    `${overMinimum.quantity} months`,
  );

  // --- Campaign totals ----------------------------------------------------
  const combined = sumQuotes([short, week, slots]);
  check(
    "Campaign total sums line items",
    combined.total === short.total + week.total + slots.total,
    `₹${combined.total / 100} across 3 assets`,
  );

  // --- Preferred unit -----------------------------------------------------
  const multi = [
    { unit: "PER_MONTH", amount: rupees(100_000), currency: "INR" },
    { unit: "PER_DAY", amount: rupees(5_000), currency: "INR" },
  ];
  const byDay = quotePrice({
    pricing: multi,
    from: "2026-09-01",
    to: "2026-09-06",
    preferredUnit: "PER_DAY",
  })!;
  check(
    "Preferred unit overrides default",
    byDay.unit === "PER_DAY" && byDay.quantity === 5,
    `${byDay.quantity} days on the daily rate`,
  );

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main();
