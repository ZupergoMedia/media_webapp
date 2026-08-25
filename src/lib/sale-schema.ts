import { z } from "zod";

/**
 * Sale listing validation — creating, editing, and enquiring about a listing
 * that puts an existing Asset up for sale.
 *
 * Financial fields are all optional and left that way deliberately: a seller
 * declining to disclose revenue must produce `undefined`, never `0` — the two
 * mean different things on the public detail page ("Not disclosed by seller"
 * vs "₹0"). Money fields are entered in rupees here and converted to paise
 * once, server-side, matching every other form in this codebase.
 */

export const SALE_OWNERSHIP_TYPES = [
  "FREEHOLD_OWNED",
  "LEASED",
  "LONG_TERM_LEASE",
  "SUB_LEASE",
  "CONCESSION",
  "LICENSE",
  "ADVERTISING_RIGHTS",
  "OPERATING_RIGHTS",
  "GOVERNMENT_TENDER",
  "REVENUE_SHARE",
  "PARTNERSHIP_JV",
  "OTHER",
] as const;

export const SALE_OWNERSHIP_TYPE_LABELS: Record<
  (typeof SALE_OWNERSHIP_TYPES)[number],
  string
> = {
  FREEHOLD_OWNED: "Freehold / owned",
  LEASED: "Leased",
  LONG_TERM_LEASE: "Long-term lease",
  SUB_LEASE: "Sub-lease",
  CONCESSION: "Concession",
  LICENSE: "License",
  ADVERTISING_RIGHTS: "Advertising rights",
  OPERATING_RIGHTS: "Operating rights",
  GOVERNMENT_TENDER: "Government tender / concession",
  REVENUE_SHARE: "Revenue-share agreement",
  PARTNERSHIP_JV: "Partnership / JV",
  OTHER: "Other",
};

export const SALE_INCLUSIONS = [
  "PHYSICAL_STRUCTURE",
  "ADVERTISING_RIGHTS",
  "LAND_RIGHTS",
  "LEASE_RIGHTS",
  "CONCESSION_RIGHTS",
  "OPERATING_RIGHTS",
  "CUSTOMER_CONTRACTS",
  "DIGITAL_DISPLAY_EQUIPMENT",
  "ELECTRICAL_INFRASTRUCTURE",
  "BRANDING_SIGNAGE_RIGHTS",
  "OTHER",
] as const;

export const SALE_INCLUSION_LABELS: Record<
  (typeof SALE_INCLUSIONS)[number],
  string
> = {
  PHYSICAL_STRUCTURE: "Physical structure",
  ADVERTISING_RIGHTS: "Advertising rights",
  LAND_RIGHTS: "Land rights",
  LEASE_RIGHTS: "Lease rights",
  CONCESSION_RIGHTS: "Concession rights",
  OPERATING_RIGHTS: "Operating rights",
  CUSTOMER_CONTRACTS: "Existing customer contracts",
  DIGITAL_DISPLAY_EQUIPMENT: "Digital display equipment",
  ELECTRICAL_INFRASTRUCTURE: "Electrical infrastructure",
  BRANDING_SIGNAGE_RIGHTS: "Branding / signage rights",
  OTHER: "Other",
};

export const SALE_LOCATION_PRECISIONS = ["EXACT", "APPROXIMATE"] as const;

export const PERMIT_TYPES = [
  "MUNICIPAL_ADVERTISING_PERMIT",
  "HOARDING_PERMIT",
  "STRUCTURAL_STABILITY_CERTIFICATE",
  "LAND_OWNER_NOC",
  "PROPERTY_OWNER_NOC",
  "TRAFFIC_AUTHORITY_NOC",
  "HIGHWAY_AUTHORITY_PERMISSION",
  "RAILWAY_METRO_PERMISSION",
  "AIRPORT_AUTHORITY_PERMISSION",
  "FIRE_SAFETY_APPROVAL",
  "ELECTRICAL_APPROVAL",
  "ENVIRONMENTAL_APPROVAL",
  "GOVERNMENT_CONCESSION_DOC",
  "OTHER",
] as const;

export const PERMIT_TYPE_LABELS: Record<(typeof PERMIT_TYPES)[number], string> = {
  MUNICIPAL_ADVERTISING_PERMIT: "Municipal advertising permit",
  HOARDING_PERMIT: "Hoarding permit",
  STRUCTURAL_STABILITY_CERTIFICATE: "Structural stability certificate",
  LAND_OWNER_NOC: "Land owner NOC",
  PROPERTY_OWNER_NOC: "Property owner NOC",
  TRAFFIC_AUTHORITY_NOC: "Traffic authority NOC",
  HIGHWAY_AUTHORITY_PERMISSION: "Highway authority permission",
  RAILWAY_METRO_PERMISSION: "Railway / Metro permission",
  AIRPORT_AUTHORITY_PERMISSION: "Airport authority permission",
  FIRE_SAFETY_APPROVAL: "Fire / safety approval",
  ELECTRICAL_APPROVAL: "Electrical approval",
  ENVIRONMENTAL_APPROVAL: "Environmental approval",
  GOVERNMENT_CONCESSION_DOC: "Government concession / tender document",
  OTHER: "Other",
};

export const PERMIT_STATUSES = [
  "VALID",
  "EXPIRED",
  "PENDING_RENEWAL",
  "NOT_AVAILABLE",
  "NOT_APPLICABLE",
] as const;

export const PERMIT_STATUS_LABELS: Record<(typeof PERMIT_STATUSES)[number], string> = {
  VALID: "Valid",
  EXPIRED: "Expired",
  PENDING_RENEWAL: "Pending renewal",
  NOT_AVAILABLE: "Not available",
  NOT_APPLICABLE: "Not applicable",
};

export const SALE_DOCUMENT_CATEGORIES = [
  "OWNERSHIP",
  "PERMISSIONS",
  "TECHNICAL",
  "COMMERCIAL",
  "OTHER",
] as const;

export const SALE_DOCUMENT_CATEGORY_LABELS: Record<
  (typeof SALE_DOCUMENT_CATEGORIES)[number],
  string
> = {
  OWNERSHIP: "Ownership",
  PERMISSIONS: "Permissions",
  TECHNICAL: "Technical",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

export const SALE_DOCUMENT_VISIBILITIES = [
  "PUBLIC",
  "BUYER_ON_REQUEST",
  "VERIFIED_BUYER_ONLY",
  "ADMIN_ONLY",
] as const;

export const SALE_DOCUMENT_VISIBILITY_LABELS: Record<
  (typeof SALE_DOCUMENT_VISIBILITIES)[number],
  string
> = {
  PUBLIC: "Visible to everyone",
  BUYER_ON_REQUEST: "Shared if a buyer asks",
  VERIFIED_BUYER_ONLY: "Verified buyers only",
  ADMIN_ONLY: "Admin only",
};

export const SALE_ENQUIRER_INTERESTS = [
  "INVESTOR",
  "MEDIA_COMPANY",
  "ADVERTISER",
  "PROPERTY_OWNER",
  "BROKER",
  "OTHER",
] as const;

export const SALE_ENQUIRER_INTEREST_LABELS: Record<
  (typeof SALE_ENQUIRER_INTERESTS)[number],
  string
> = {
  INVESTOR: "Investor",
  MEDIA_COMPANY: "Media company",
  ADVERTISER: "Advertiser",
  PROPERTY_OWNER: "Property owner",
  BROKER: "Broker",
  OTHER: "Other",
};

export const SALE_ENQUIRY_INTENTS = [
  "MORE_INFORMATION",
  "REQUEST_DOCUMENTS",
  "REQUEST_SITE_VISIT",
  "MAKE_OFFER",
  "CONTACT_SELLER",
] as const;

export const SALE_ENQUIRY_INTENT_LABELS: Record<
  (typeof SALE_ENQUIRY_INTENTS)[number],
  string
> = {
  MORE_INFORMATION: "More information",
  REQUEST_DOCUMENTS: "Request documents",
  REQUEST_SITE_VISIT: "Request a site visit",
  MAKE_OFFER: "Make an offer",
  CONTACT_SELLER: "Contact the seller",
};

/** Rupees in the form; converted to paise once, server-side. */
const rupees = z.coerce
  .number()
  .int()
  .positive("Enter a price greater than zero")
  .max(100_000_000_000, "That figure looks too large");

/** Optional financial figure. Undefined means "not disclosed by seller" — never coerced to 0. */
const optionalRupees = z.coerce
  .number()
  .int()
  .min(0)
  .max(100_000_000_000, "That figure looks too large")
  .optional();

const optionalPercent = z.coerce.number().int().min(0).max(100).optional();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const saleOwnershipRightsSchema = z.object({
  ownershipType: z.enum(SALE_OWNERSHIP_TYPES),
  inclusions: z
    .array(z.enum(SALE_INCLUSIONS))
    .min(1, "Select at least one thing the buyer receives"),
  inclusionsNote: z.string().trim().max(500).optional(),
  leaseStartDate: isoDate,
  leaseEndDate: isoDate,
  leaseRenewalTerms: z.string().trim().max(500).optional(),
  rightsTransferable: z.boolean().optional(),
});

export const salePropertyDetailsSchema = z.object({
  propertyOwnershipType: z.string().trim().max(160).optional(),
  landOwnerRelationship: z.string().trim().max(500).optional(),
  landOwnerName: z.string().trim().max(200).optional(),
  propertyAddress: z.string().trim().max(400).optional(),
  surveyNumber: z.string().trim().max(120).optional(),
  buildingName: z.string().trim().max(160).optional(),
  floorLocation: z.string().trim().max(120).optional(),
  propertyType: z.string().trim().max(120).optional(),
  leaseStartDate: isoDate,
  leaseEndDate: isoDate,
  monthlyLandRent: optionalRupees,
  annualLandRent: optionalRupees,
  revenueSharePercent: optionalPercent,
  renewalTerms: z.string().trim().max(500).optional(),
});

export const salePermitSchema = z
  .object({
    permitType: z.enum(PERMIT_TYPES),
    permitTypeOther: z.string().trim().max(160).optional(),
    documentNumber: z.string().trim().max(120).optional(),
    issuingAuthority: z.string().trim().max(200).optional(),
    issueDate: isoDate,
    expiryDate: isoDate,
    status: z.enum(PERMIT_STATUSES).default("NOT_AVAILABLE"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (permit) => permit.permitType !== "OTHER" || !!permit.permitTypeOther,
    { message: "Describe the permit type", path: ["permitTypeOther"] },
  );

export const saleDocumentSchema = z.object({
  category: z.enum(SALE_DOCUMENT_CATEGORIES),
  documentType: z.string().trim().min(1, "Name the document").max(160),
  title: z.string().trim().max(200).optional(),
  documentNumber: z.string().trim().max(120).optional(),
  issuingAuthority: z.string().trim().max(200).optional(),
  issueDate: isoDate,
  expiryDate: isoDate,
  visibility: z.enum(SALE_DOCUMENT_VISIBILITIES).default("ADMIN_ONLY"),
});

/**
 * Every financial field is optional. A seller who omits one is declining to
 * disclose it — the server must store that as `null`, never `0`, so the
 * public detail page can render "Not disclosed by seller" accurately.
 */
export const saleFinancialsSchema = z.object({
  currentMonthlyRevenue: optionalRupees,
  currentAnnualRevenue: optionalRupees,
  averageOccupancyPercent: optionalPercent,
  averageMonthlyAdIncome: optionalRupees,
  operatingExpensesAnnual: optionalRupees,
  annualMaintenanceCost: optionalRupees,
  landRentAnnual: optionalRupees,
  permitFeesAnnual: optionalRupees,
  netAnnualIncome: optionalRupees,
  expectedRoiPercent: optionalPercent,
  existingAdvertiserContracts: z.string().trim().max(500).optional(),
  remainingContractMonths: z.coerce.number().int().min(0).max(600).optional(),
});

export const createSaleListingSchema = z.object({
  assetId: z.string().min(1, "Choose an asset to sell"),

  askingPrice: rupees,
  negotiable: z.boolean().default(false),

  locationPrecision: z.enum(SALE_LOCATION_PRECISIONS).default("APPROXIMATE"),

  ownership: saleOwnershipRightsSchema,
  property: salePropertyDetailsSchema.optional(),
  financials: saleFinancialsSchema,
  permits: z.array(salePermitSchema).max(20).optional(),
  documents: z.array(saleDocumentSchema).max(30).optional(),
});

export type CreateSaleListingForm = z.infer<typeof createSaleListingSchema>;

/** Editing an existing listing. `assetId` is omitted — a listing is never re-pointed to a different asset. */
export const updateSaleListingSchema = createSaleListingSchema.omit({
  assetId: true,
});

export type UpdateSaleListingForm = z.infer<typeof updateSaleListingSchema>;

/**
 * A public, anonymous enquiry about a listing.
 *
 * `message` is deliberately bounded and stripped of URLs — this is the one
 * place a determined spammer would try to plant a link, and rejecting `http`
 * outright removes the payoff for the most common form of abuse without
 * needing a captcha this codebase has no way to run.
 */
export const saleEnquirySchema = z.object({
  saleListingSlug: z.string().min(1),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email address"),
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(160).optional(),
  interest: z.enum(SALE_ENQUIRER_INTERESTS),
  intents: z
    .array(z.enum(SALE_ENQUIRY_INTENTS))
    .min(1, "Select at least one thing you're asking for"),
  message: z
    .string()
    .trim()
    .max(500, "Keep the message under 500 characters")
    .refine((value) => !/https?:\/\//i.test(value), {
      message: "Links are not allowed in enquiry messages",
    })
    .optional(),
});

export type SaleEnquiryForm = z.infer<typeof saleEnquirySchema>;
