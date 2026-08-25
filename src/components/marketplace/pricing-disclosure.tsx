import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single statement of how pricing and booking actually work on ZuperGo.
 *
 * Defined once and reused everywhere money or dates appear, because this is the
 * claim most likely to be misread and most damaging when it is. An advertiser
 * who believes a figure here is a binding quote — or that sending a request
 * secures a billboard — has been misled by the product, not by the owner.
 *
 * Three facts, in the order that matters:
 *
 *   1. This is an expression of interest, not a booking.
 *   2. The figure is indicative; the final price is whatever the owner quotes.
 *   3. Price and terms are settled directly between advertiser and owner.
 *
 * Variants differ only in length, never in meaning — a compact line in a
 * sidebar must not say something softer than the full panel on a review page.
 */

export type DisclosureVariant = "inline" | "panel" | "compact";

export function PricingDisclosure({
  variant = "inline",
  className,
}: {
  variant?: DisclosureVariant;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p className={cn("text-xs text-subtle-foreground", className)}>
        Indicative price. Final cost is agreed directly with the media partner.
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 text-xs text-subtle-foreground",
          className,
        )}
      >
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          This sends an expression of interest — it does not book the asset. The
          figure shown is indicative; the final price and terms are settled
          directly between you and the media partner.
        </span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-card border border-border bg-surface-muted p-4",
        className,
      )}
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="text-sm">
        <p className="font-medium">This is an enquiry, not a booking</p>
        <p className="mt-1 text-muted-foreground">
          Sending this registers your interest in the dates shown. It does not
          reserve the asset, and no payment is taken. The amount is an
          indicative estimate from the owner&rsquo;s published rate card —{" "}
          <span className="font-medium text-foreground">
            the final price may differ
          </span>
          . Pricing, production costs and terms are agreed directly between you
          and the media partner.
        </p>
      </div>
    </div>
  );
}
