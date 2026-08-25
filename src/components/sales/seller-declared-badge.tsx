import { FileText, Landmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_TONE,
  type TrustLevel,
} from "@/lib/sale-trust";

const ICONS: Record<TrustLevel, typeof FileText> = {
  SELLER_DECLARED: FileText,
  PLATFORM_REVIEWED: ShieldCheck,
  AUTHORITY_ISSUED: Landmark,
};

/**
 * Renders the trust-level badge for one claim. Never the bare word
 * "Verified" — see sale-trust.ts for why that word is reserved for the
 * advertising-side VerificationBadge, where it means something different
 * (site inspected) from what a buyer would infer here (legal verification).
 *
 * Defaults to SELLER_DECLARED, which is what every claim renders as in this
 * pass — there is no admin review yet, so nothing can honestly claim more.
 */
export function SellerDeclaredBadge({
  level = "SELLER_DECLARED",
  className,
  size = "default",
}: {
  level?: TrustLevel;
  className?: string;
  size?: "default" | "sm";
}) {
  const Icon = ICONS[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        TRUST_LEVEL_TONE[level],
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" />
      {TRUST_LEVEL_LABELS[level]}
    </span>
  );
}
