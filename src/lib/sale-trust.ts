/**
 * The sale marketplace's trust vocabulary.
 *
 * The failure mode this exists to prevent is precise: a buyer sees a badge,
 * infers "the platform checked the title deed", and commits capital. The
 * platform did not check the title deed — at most it checked that a claim
 * was consistent. The word "Verified" must never appear alone on a sale
 * surface; every claim is qualified by which of these three levels it has
 * actually reached.
 *
 * This phase ships with auto-publish and no admin review, so in practice
 * every claim renders SELLER_DECLARED — PLATFORM_REVIEWED and
 * AUTHORITY_ISSUED stay defined but unreachable until admin verification
 * ships, so that phase can add real badges without touching a component.
 */

export const TRUST_LEVELS = [
  "SELLER_DECLARED",
  "PLATFORM_REVIEWED",
  "AUTHORITY_ISSUED",
] as const;

export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  SELLER_DECLARED: "Seller-declared",
  PLATFORM_REVIEWED: "Platform-reviewed",
  AUTHORITY_ISSUED: "Authority-issued",
};

/**
 * Deliberately not a green/amber/red severity ramp — "seller-declared" is
 * normal and expected, not a warning, so all three read as different KINDS
 * of claim rather than different qualities of claim.
 */
export const TRUST_LEVEL_TONE: Record<TrustLevel, string> = {
  SELLER_DECLARED: "bg-surface-muted text-muted-foreground",
  PLATFORM_REVIEWED: "bg-accent-subtle text-accent",
  AUTHORITY_ISSUED: "bg-highlight/10 text-highlight",
};

export const TRUST_LEVEL_EXPLAINER: Record<TrustLevel, string> = {
  SELLER_DECLARED:
    "The seller provided this. Nobody at ZuperGo has checked it.",
  PLATFORM_REVIEWED:
    "A ZuperGo admin reviewed this claim against the supporting information provided.",
  AUTHORITY_ISSUED:
    "This claim names a specific issuing authority, reference and date.",
};

/**
 * Derives the trust level for one claim (a permit, a document, an ownership
 * statement). Kept as the single place this decision is made so no component
 * has to reimplement the rule.
 */
export function getTrustLevel(input: {
  hasAuthorityReference: boolean;
  isPlatformReviewed: boolean;
}): TrustLevel {
  if (input.isPlatformReviewed) return "PLATFORM_REVIEWED";
  if (input.hasAuthorityReference) return "AUTHORITY_ISSUED";
  return "SELLER_DECLARED";
}
