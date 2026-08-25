import { formatPaise, pricingUnitSuffix } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Price with its unit suffix. Pricing models vary widely across media types
 * (per month for a billboard, per slot for a screen), so the unit is never
 * assumed — it always travels with the amount.
 */
export function PriceDisplay({
  amount,
  unit,
  className,
  size = "default",
}: {
  amount: number | null | undefined;
  unit: string | null | undefined;
  className?: string;
  size?: "default" | "lg" | "sm";
}) {
  const unavailable = amount === null || amount === undefined;

  return (
    <p className={cn("flex items-baseline gap-1", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums text-foreground",
          size === "lg" && "text-2xl",
          size === "default" && "text-base",
          size === "sm" && "text-sm",
        )}
      >
        {unavailable ? "On request" : formatPaise(amount)}
      </span>
      {!unavailable && (
        <span
          className={cn(
            "text-muted-foreground",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {pricingUnitSuffix(unit)}
        </span>
      )}
    </p>
  );
}
