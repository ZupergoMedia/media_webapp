import { z } from "zod";

/**
 * Media partner registration.
 *
 * "Partner" rather than "owner": the party listing inventory is frequently an
 * agency, franchisee or manager acting for the site owner, so asserting
 * ownership would often be wrong. See the UserRole enum for the same reasoning.
 *
 * Account and company are validated together because they are collected in one
 * continuous flow — a partner who creates an account but abandons before adding
 * company details is stranded in exactly the dead end this flow exists to fix.
 */

export const partnerAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long"),
});

export const partnerCompanySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Enter your company or trading name")
    .max(160),
  /**
   * How the partner relates to the inventory. Recorded because it changes what
   * verification should check: an owner proves title, an agency proves mandate.
   */
  partnerType: z.enum(["OWNER", "AGENCY", "MANAGER", "OTHER"]),
  city: z.string().trim().min(1, "Which city are you based in?").max(80),
  state: z.string().trim().max(80).optional(),
  contactPhone: z
    .string()
    .trim()
    .min(6, "Enter a phone number advertisers can reach you on")
    .max(20),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(600).optional(),
});

/** The whole registration, as submitted. */
export const partnerRegistrationSchema = partnerAccountSchema.and(
  partnerCompanySchema,
);

export type PartnerRegistration = z.infer<typeof partnerRegistrationSchema>;

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  OWNER: "I own the media",
  AGENCY: "I represent it as an agency",
  MANAGER: "I manage it for the owner",
  OTHER: "Something else",
};

export const PARTNER_TYPE_HELP: Record<string, string> = {
  OWNER: "You hold title to the sites you list.",
  AGENCY: "You sell inventory on behalf of one or more owners.",
  MANAGER: "You operate or maintain sites owned by someone else.",
  OTHER: "Tell us more during verification.",
};
