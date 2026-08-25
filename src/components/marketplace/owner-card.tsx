import { Star } from "lucide-react";
import { VerificationBadge } from "./verification-badge";
import { formatDate } from "@/lib/format";

/**
 * Media partner summary.
 *
 * Owner identity is a trust signal in a marketplace where the buyer cannot
 * inspect the asset in person, so verification status and rating are given
 * prominence rather than being buried in fine print.
 */
export function OwnerCard({
  owner,
}: {
  owner: {
    companyName: string;
    description: string | null;
    city: string | null;
    verificationStatus: string;
    ratingAverage: number;
    ratingCount: number;
    createdAt: Date;
  };
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-base font-semibold text-brand"
        >
          {owner.companyName.charAt(0)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{owner.companyName}</h3>
            {owner.verificationStatus === "VERIFIED" && (
              <VerificationBadge size="sm" />
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {owner.ratingCount > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3 fill-current" aria-hidden="true" />
                {owner.ratingAverage.toFixed(1)} ({owner.ratingCount} reviews)
              </span>
            )}
            {owner.city && <span>{owner.city}</span>}
            <span>On ZuperGo since {formatDate(owner.createdAt)}</span>
          </div>
        </div>
      </div>

      {owner.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {owner.description}
        </p>
      )}
    </div>
  );
}
