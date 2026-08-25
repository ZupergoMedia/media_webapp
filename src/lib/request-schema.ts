import { z } from "zod";

/**
 * Availability request validation.
 *
 * Shared by the client form and the API route so both enforce identical rules.
 * The server re-validates regardless of what the client did — client-side
 * validation is a convenience, never a trust boundary.
 *
 * Contact details are required rather than optional: the media owner confirms
 * off-platform, so a request with no way to reach the advertiser cannot be
 * answered at all.
 */
export const requestSchema = z.object({
  assetSlug: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  slotCount: z.coerce.number().int().min(1).max(100).optional(),

  campaignName: z.string().trim().min(2, "Campaign name is too short").max(120),
  brandName: z.string().trim().min(1, "Brand name is required").max(120),
  contactEmail: z.email("Enter a valid email address"),
  contactPhone: z
    .string()
    .trim()
    .min(6, "Enter a phone number the owner can reach you on")
    .max(20),

  notes: z.string().trim().max(1000).optional(),
  creativeNotes: z.string().trim().max(1000).optional(),
});

export type AvailabilityRequest = z.infer<typeof requestSchema>;

/** Step-scoped schemas so the wizard can validate one step at a time. */
export const requestDatesSchema = requestSchema.pick({
  from: true,
  to: true,
  slotCount: true,
});

export const requestCampaignSchema = requestSchema.pick({
  campaignName: true,
  brandName: true,
  contactEmail: true,
  contactPhone: true,
  notes: true,
  creativeNotes: true,
});
