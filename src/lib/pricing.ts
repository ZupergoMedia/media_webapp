/**
 * Pricing calculation.
 *
 * Deliberately isolated and dependency-free so the identical function runs in
 * the browser (live quote), on the server (authoritative booking total), and in
 * tests. A quote the server later disagrees with is worse than showing no quote
 * at all, so there is exactly one implementation.
 *
 * All money is in paise. Every intermediate result is rounded to an integer, so
 * no fractional paise can accumulate across a multi-asset campaign.
 */

export interface PricingOption {
  unit: string;
  amount: number;
  currency: string;
  minDuration?: number | null;
  maxDuration?: number | null;
  discountThreshold?: number | null;
  discountPercent?: number | null;
}

export interface Quote {
  unitPrice: number;
  quantity: number;
  unitLabel: string;
  /**
   * Set when the owner's minimum booking period raised the charge above the
   * days actually selected. The UI shows this so a buyer is never left
   * wondering why five days cost more than five days.
   */
  minimumApplied?: { days: number; label: string };
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  tax: number;
  total: number;
  currency: string;
  unit: string;
  days: number;
}

/** GST on advertising services in India. */
export const TAX_RATE = 0.18;

const DAY_MS = 86_400_000;

/** Whole days between two ISO dates, half-open so a single-day booking is 1. */
export function daysBetween(from: string | Date, to: string | Date): number {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diff = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return Math.max(diff, 1);
}

/** Nominal days in each billing period, used for pro-rating. */
const DAYS_PER_UNIT: Record<string, number> = {
  PER_DAY: 1,
  PER_WEEK: 7,
  PER_MONTH: 30,
};

/**
 * Converts a day count into billable units.
 *
 * Pro-rated, not rounded up. Charging a full month for a five-day booking —
 * which is what `Math.ceil(days / 30)` did — overstates the cost by six times
 * and is the kind of error that destroys trust in a marketplace quote.
 *
 * Fractional units are kept to two decimals so a partial period reads
 * honestly ("0.17 months") rather than being silently inflated. Owners who
 * genuinely will not sell below a period express that through
 * `minDuration` on their rate card, which is applied separately and labelled
 * as a minimum so the buyer knows why the figure is higher than the days
 * they picked.
 */
function quantityForUnit(unit: string, days: number, slotCount?: number): {
  quantity: number;
  label: string;
} {
  switch (unit) {
    case "PER_DAY":
      return { quantity: days, label: days === 1 ? "day" : "days" };
    case "PER_WEEK": {
      const weeks = roundUnits(days / 7);
      return { quantity: weeks, label: weeks === 1 ? "week" : "weeks" };
    }
    case "PER_MONTH": {
      const months = roundUnits(days / 30);
      return { quantity: months, label: months === 1 ? "month" : "months" };
    }
    case "PER_SLOT":
    case "PER_SPOT": {
      // Digital inventory bills per slot per day, so a week at 2 slots is 14.
      const slots = (slotCount ?? 1) * days;
      return { quantity: slots, label: slots === 1 ? "slot-day" : "slot-days" };
    }
    case "PER_EVENT":
      return { quantity: 1, label: "event" };
    case "PER_IMPRESSION":
      return { quantity: days, label: "days" };
    default:
      return { quantity: days, label: "days" };
  }
}

/**
 * Rounds a fractional unit count.
 *
 * Three decimals, not two. At 2dp, 5/30 months rounds 0.1667 up to 0.17 — a
 * 2% overcharge that always lands in the owner's favour. 3dp keeps the error
 * under a rupee on a six-figure rate while still displaying tidily.
 */
function roundUnits(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export interface QuoteInput {
  pricing: PricingOption[];
  from?: string | Date | null;
  to?: string | Date | null;
  slotCount?: number;
  /** Overrides automatic selection when the buyer picks a specific rate. */
  preferredUnit?: string;
}

/**
 * Produces a full quote, or null when the inputs cannot support one.
 *
 * Returning null rather than a zero-value quote keeps callers from rendering a
 * confident "₹0" for an incomplete selection.
 */
export function quotePrice(input: QuoteInput): Quote | null {
  const { pricing, from, to, slotCount, preferredUnit } = input;

  if (!pricing.length || !from || !to) return null;

  const option =
    (preferredUnit && pricing.find((p) => p.unit === preferredUnit)) ??
    pricing[0];
  if (!option) return null;

  const days = daysBetween(from, to);
  if (days <= 0) return null;

  /*
   * Owner-declared minimum booking period.
   *
   * Expressed in the pricing unit's own periods (minDuration: 1 on a monthly
   * rate means "one month minimum"), so it is converted to days before being
   * compared with the requested window.
   */
  const unitDays = DAYS_PER_UNIT[option.unit] ?? 1;
  const minimumDays =
    option.minDuration && option.minDuration > 0
      ? option.minDuration * unitDays
      : 0;

  const billableDays = Math.max(days, minimumDays);

  const { quantity, label } = quantityForUnit(
    option.unit,
    billableDays,
    slotCount,
  );
  if (quantity <= 0) return null;

  const minimumApplied =
    minimumDays > days
      ? {
          days: minimumDays,
          label: `Minimum booking is ${option.minDuration} ${label.replace(/s$/, "")}${
            (option.minDuration ?? 0) > 1 ? "s" : ""
          }`,
        }
      : undefined;

  // Rounded because a fractional unit count multiplied by a paise price can
  // land on a fraction of a paise, which is not a real amount of money.
  const subtotal = Math.round(option.amount * quantity);

  // Volume discount applies on days booked, not billable units: "10% off 30+
  // days" should not depend on whether the rate card is daily or monthly.
  const threshold = option.discountThreshold ?? null;
  const percent = option.discountPercent ?? 0;
  const discountApplies = threshold !== null && percent > 0 && days >= threshold;
  const discountPercent = discountApplies ? percent : 0;
  const discountAmount = discountApplies
    ? Math.round((subtotal * discountPercent) / 100)
    : 0;

  const taxableAmount = subtotal - discountAmount;
  const tax = Math.round(taxableAmount * TAX_RATE);
  const total = taxableAmount + tax;

  return {
    unitPrice: option.amount,
    quantity,
    unitLabel: label,
    minimumApplied,
    subtotal,
    discountPercent,
    discountAmount,
    taxableAmount,
    tax,
    total,
    currency: option.currency,
    unit: option.unit,
    days,
  };
}

/** Sums quotes for a multi-asset campaign or basket. */
export function sumQuotes(quotes: Quote[]): {
  subtotal: number;
  discountAmount: number;
  tax: number;
  total: number;
} {
  return quotes.reduce(
    (acc, quote) => ({
      subtotal: acc.subtotal + quote.subtotal,
      discountAmount: acc.discountAmount + quote.discountAmount,
      tax: acc.tax + quote.tax,
      total: acc.total + quote.total,
    }),
    { subtotal: 0, discountAmount: 0, tax: 0, total: 0 },
  );
}
