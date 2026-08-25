import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trust marker shown on verified inventory.
 *
 * Verification is the platform's core trust signal — an advertiser committing
 * six figures needs to know the listing was inspected — so it renders
 * consistently everywhere rather than being restyled per surface.
 */
export function VerificationBadge({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-subtle font-medium text-accent",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      <BadgeCheck
        className={size === "sm" ? "size-3" : "size-3.5"}
        aria-hidden="true"
      />
      Verified
    </span>
  );
}
