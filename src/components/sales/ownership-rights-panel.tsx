import { formatDate } from "@/lib/format";
import { SALE_OWNERSHIP_TYPE_LABELS, SALE_INCLUSION_LABELS } from "@/lib/sale-schema";
import { SellerDeclaredBadge } from "./seller-declared-badge";

/**
 * Public "Ownership & Rights" section on the listing detail page.
 *
 * This is the section the product spec is most emphatic about: the seller
 * frequently owns neither the land nor the physical structure, so what is
 * being sold (inclusions) and how the seller holds it (ownershipType) are
 * shown as two separate, explicit facts rather than implied by one price tag.
 */
export function OwnershipRightsPanel({
  ownershipType,
  inclusions,
  inclusionsNote,
  leaseStartDate,
  leaseEndDate,
  leaseRenewalTerms,
  rightsTransferable,
}: {
  ownershipType: string;
  inclusions: string[];
  inclusionsNote: string | null;
  leaseStartDate: Date | null;
  leaseEndDate: Date | null;
  leaseRenewalTerms: string | null;
  rightsTransferable: boolean | null;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Ownership &amp; rights</h2>
        <SellerDeclaredBadge size="sm" />
      </div>

      <dl className="mb-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">How the seller holds this asset</dt>
          <dd className="text-right font-medium">
            {SALE_OWNERSHIP_TYPE_LABELS[
              ownershipType as keyof typeof SALE_OWNERSHIP_TYPE_LABELS
            ] ?? ownershipType}
          </dd>
        </div>
        {(leaseStartDate || leaseEndDate) && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Lease term</dt>
            <dd className="text-right font-medium">
              {leaseStartDate ? formatDate(leaseStartDate) : "—"} to{" "}
              {leaseEndDate ? formatDate(leaseEndDate) : "—"}
            </dd>
          </div>
        )}
        {leaseRenewalTerms && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Renewal terms</dt>
            <dd className="text-right font-medium">{leaseRenewalTerms}</dd>
          </div>
        )}
        {rightsTransferable !== null && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Rights transferable</dt>
            <dd className="text-right font-medium">{rightsTransferable ? "Yes" : "No"}</dd>
          </div>
        )}
      </dl>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What is included in this sale
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {inclusions.map((value) => (
          <li key={value} className="flex items-center gap-2 text-sm">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            {SALE_INCLUSION_LABELS[value as keyof typeof SALE_INCLUSION_LABELS] ?? value}
          </li>
        ))}
      </ul>

      {inclusionsNote && (
        <p className="mt-3 rounded-control bg-surface-muted p-2 text-sm text-muted-foreground">
          {inclusionsNote}
        </p>
      )}
    </section>
  );
}
