import { formatDate } from "@/lib/format";
import { PERMIT_TYPE_LABELS, PERMIT_STATUS_LABELS } from "@/lib/sale-schema";
import { cn } from "@/lib/utils";
import { SellerDeclaredBadge } from "./seller-declared-badge";

/**
 * Public permits table. Hand-rolled raw <table>, matching the admin pages'
 * convention rather than introducing a new Table primitive for this pass.
 *
 * Only publicly-safe fields are shown: type, issuing authority, and status.
 * documentNumber is never passed to this component — see
 * sale-listing-service.ts's include, which never selects it for the public
 * detail path.
 */
export function PermitsTable({
  permits,
}: {
  permits: Array<{
    permitType: string;
    permitTypeOther: string | null;
    issuingAuthority: string | null;
    expiryDate: Date | null;
    status: string;
  }>;
}) {
  if (permits.length === 0) {
    return (
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-2 text-base font-semibold">Permits &amp; permissions</h2>
        <p className="text-sm text-muted-foreground">
          The seller has not declared any permits for this listing.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Permits &amp; permissions</h2>
        <SellerDeclaredBadge size="sm" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[560px] w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Permit</th>
              <th scope="col" className="py-2 pr-4 font-medium">Issuing authority</th>
              <th scope="col" className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((permit, index) => {
              // The seller's declared status is the source of truth here,
              // not a live comparison against "now" — that would make this
              // render impure, and a permit's expiry status is exactly the
              // kind of fact the seller is expected to keep current.
              const isExpired = permit.status === "EXPIRED";

              return (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    {permit.permitType === "OTHER"
                      ? permit.permitTypeOther ?? "Other"
                      : PERMIT_TYPE_LABELS[permit.permitType as keyof typeof PERMIT_TYPE_LABELS] ??
                        permit.permitType}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {permit.issuingAuthority ?? "—"}
                  </td>
                  <td className={cn("py-2", isExpired ? "text-danger" : "text-muted-foreground")}>
                    {PERMIT_STATUS_LABELS[permit.status as keyof typeof PERMIT_STATUS_LABELS] ??
                      permit.status}
                    {isExpired && permit.expiryDate && ` (${formatDate(permit.expiryDate)})`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
