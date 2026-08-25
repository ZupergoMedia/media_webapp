import { z } from "zod";

/**
 * Asset creation validation.
 *
 * Covers the fixed fields every asset has. Type-specific specifications are
 * validated separately by `buildSpecValidator`, which compiles rules from the
 * type's own descriptors — so a billboard's required width and a screen's
 * required resolution are both enforced without either being named here.
 */

export const PRICING_UNITS = [
  "PER_DAY",
  "PER_WEEK",
  "PER_MONTH",
  "PER_SLOT",
  "PER_SPOT",
  "PER_IMPRESSION",
  "PER_EVENT",
] as const;

export const PRICING_UNIT_LABELS: Record<(typeof PRICING_UNITS)[number], string> = {
  PER_DAY: "Per day",
  PER_WEEK: "Per week",
  PER_MONTH: "Per month",
  PER_SLOT: "Per slot",
  PER_SPOT: "Per spot",
  PER_IMPRESSION: "Per 1,000 impressions",
  PER_EVENT: "Per event",
};

/** Latitude/longitude sanity bounds — catches transposed coordinates. */
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const assetLocationSchema = z.object({
  addressLine: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  locality: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State is required").max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a 6-digit pincode")
    .optional()
    .or(z.literal("")),
  lat: latitude.optional(),
  lng: longitude.optional(),
  areaLabel: z.string().trim().max(120).optional(),
});

export const assetPricingSchema = z.object({
  unit: z.enum(PRICING_UNITS),
  /** Entered in rupees; converted to paise before storage. */
  amount: z.coerce
    .number()
    .positive("Enter a price greater than zero")
    .max(100_000_000, "That price looks too large"),
  minDuration: z.coerce.number().int().positive().optional(),
  discountThreshold: z.coerce.number().int().positive().optional(),
  discountPercent: z.coerce.number().int().min(1).max(90).optional(),
});

export const assetImageSchema = z.object({
  url: z.url("Enter a valid image URL"),
  alt: z.string().trim().max(200).optional(),
});

export const assetBlackoutSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    note: z.string().trim().max(200).optional(),
  })
  .refine((window) => window.endDate > window.startDate, {
    message: "The end date must be after the start date",
    path: ["endDate"],
  });

export const digitalInventorySchema = z
  .object({
    slotDurationSeconds: z.coerce.number().int().min(1).max(600),
    loopDurationSeconds: z.coerce.number().int().min(1).max(3600),
    operatingHoursStart: z.coerce.number().int().min(0).max(23),
    operatingHoursEnd: z.coerce.number().int().min(1).max(24),
    screenWidthPx: z.coerce.number().int().positive().optional(),
    screenHeightPx: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (inventory) => inventory.operatingHoursEnd > inventory.operatingHoursStart,
    {
      message: "Closing hour must be after opening hour",
      path: ["operatingHoursEnd"],
    },
  )
  .refine(
    (inventory) =>
      inventory.slotDurationSeconds <= inventory.loopDurationSeconds,
    {
      message: "A slot cannot be longer than the full loop",
      path: ["slotDurationSeconds"],
    },
  );

export const operatingAreaSchema = z.object({
  name: z.string().trim().min(1, "Name the area").max(120),
  city: z.string().trim().max(80).optional(),
  centerLat: latitude.optional(),
  centerLng: longitude.optional(),
  radiusMeters: z.coerce.number().int().min(100).max(200_000).optional(),
});

export const createAssetSchema = z.object({
  typeId: z.string().min(1, "Choose an asset type"),
  title: z
    .string()
    .trim()
    .min(8, "Give the listing a descriptive title")
    .max(140),
  description: z.string().trim().max(2000).optional(),

  /** Validated against the type's own descriptors, not here. */
  specs: z.record(z.string(), z.unknown()).default({}),

  dailyImpressions: z.coerce.number().int().min(0).max(100_000_000).optional(),
  audienceProfile: z.string().trim().max(600).optional(),

  location: assetLocationSchema,
  images: z
    .array(assetImageSchema)
    .min(1, "Add at least one photo")
    .max(12, "Twelve photos maximum"),
  pricing: z
    .array(assetPricingSchema)
    .min(1, "Add at least one price")
    .max(5, "Five pricing options maximum"),

  blackouts: z.array(assetBlackoutSchema).max(24).optional(),
  digital: digitalInventorySchema.optional(),
  operatingAreas: z.array(operatingAreaSchema).max(10).optional(),
});

export type CreateAssetForm = z.infer<typeof createAssetSchema>;

/**
 * Editing an existing listing.
 *
 * `typeId` is deliberately omitted: the asset type determines the spec schema,
 * the booking model and which auxiliary tables exist, so changing it would
 * invalidate the stored specs. A partner who picked the wrong type archives and
 * relists rather than mutating.
 */
export const updateAssetSchema = createAssetSchema.omit({ typeId: true });

export type UpdateAssetForm = z.infer<typeof updateAssetSchema>;
