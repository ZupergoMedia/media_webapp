/**
 * Display formatting.
 *
 * Money is stored in paise everywhere (integers, no float drift), so every
 * rupee value shown to a user passes through here. Indian digit grouping
 * (1,50,000 rather than 150,000) matters for the launch market.
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimal = new Intl.NumberFormat("en-IN");

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Paise -> "₹1,50,000". */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "On request";
  return inr.format(paise / 100);
}

/** Paise -> "₹1.5L". For dense surfaces like map pins. */
export function formatPaiseCompact(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  return inrCompact.format(paise / 100);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return decimal.format(value);
}

/** 185000 -> "1.9L". Used for impression counts. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return compact.format(value);
}

/** Enum -> the suffix shown after a price, e.g. "/month". */
const PRICING_UNIT_SUFFIX: Record<string, string> = {
  PER_DAY: "/day",
  PER_WEEK: "/week",
  PER_MONTH: "/month",
  PER_SLOT: "/slot",
  PER_SPOT: "/spot",
  PER_IMPRESSION: "/1k impressions",
  PER_EVENT: "/event",
};

export function pricingUnitSuffix(unit: string | null | undefined): string {
  if (!unit) return "";
  return PRICING_UNIT_SUFFIX[unit] ?? "";
}

/** "₹1,50,000/month" */
export function formatPrice(
  paise: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (paise === null || paise === undefined) return "Price on request";
  return `${formatPaise(paise)}${pricingUnitSuffix(unit)}`;
}

/** Human labels for the LocationMode enum. */
const LOCATION_MODE_LABELS: Record<string, string> = {
  FIXED: "Fixed location",
  AREA: "Area coverage",
  ROUTE: "Route based",
  MOBILE: "Mobile",
  VENUE: "Venue",
  EVENT: "Event",
};

export function locationModeLabel(mode: string): string {
  return LOCATION_MODE_LABELS[mode] ?? mode;
}

const BOOKING_MODEL_LABELS: Record<string, string> = {
  FULL_ASSET: "Full asset",
  DATE_RANGE: "By date range",
  TIME_SLOT: "By time slot",
  DIGITAL_SLOT: "Digital slots",
  CAMPAIGN: "Campaign",
};

export function bookingModelLabel(model: string): string {
  return BOOKING_MODEL_LABELS[model] ?? model;
}

/** "Bandra Kurla Complex, Mumbai" from whichever location fields exist. */
export function formatLocation(input: {
  locality?: string | null;
  city?: string | null;
  areaLabel?: string | null;
}): string {
  const parts = [input.locality ?? input.areaLabel, input.city].filter(
    (part): part is string => Boolean(part),
  );
  // De-duplicate when locality already contains the city name.
  const unique = parts.filter(
    (part, index) => parts.findIndex((p) => p === part) === index,
  );
  return unique.join(", ") || "Location on request";
}

/** Short dimension summary pulled from the spec blob, e.g. "40 × 20 ft". */
export function formatDimensions(specs: unknown): string | null {
  if (!specs || typeof specs !== "object") return null;
  const record = specs as Record<string, unknown>;

  const width = record.widthFt ?? record.panelWidthFt;
  const height = record.heightFt ?? record.panelHeightFt;
  if (typeof width === "number" && typeof height === "number") {
    return `${width} × ${height} ft`;
  }

  const px = record.screenWidthPx;
  const py = record.screenHeightPx;
  if (typeof px === "number" && typeof py === "number") {
    return `${px} × ${py} px`;
  }

  return null;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}
