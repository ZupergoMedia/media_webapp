import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const COPY = {
  panel:
    "ZuperGo is a marketplace connecting sellers and potential buyers — it is not a party to any sale. Claims on this page are provided by the seller and are unverified unless explicitly marked otherwise. Conduct your own due diligence before relying on anything here.",
  financials:
    "Revenue and return figures are provided by the seller and have not been audited or verified by ZuperGo. Request supporting documents and seek independent advice before relying on them.",
  documents:
    "ZuperGo has not inspected these documents. The seller has declared they exist. We do not verify title, encumbrances, or legal validity.",
  offer:
    "An accepted offer is not a transfer of ownership. The final transaction and transfer of rights must be completed between the parties under applicable agreements and law.",
} as const;

export type SaleDisclaimerVariant = keyof typeof COPY;

/**
 * The platform's core legal/product disclaimer, worded per surface.
 *
 * Every sale surface that could otherwise be read as an endorsement carries
 * one of these. The wording is deliberate: it distinguishes seller-provided
 * information from platform-verified information, per the product spec's
 * instruction never to imply verification that has not happened.
 */
export function SaleDisclaimer({
  variant,
  className,
}: {
  variant: SaleDisclaimerVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border border-border-strong bg-surface-muted p-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>{COPY[variant]}</p>
    </div>
  );
}
