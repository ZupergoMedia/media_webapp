import { formatPaise } from "@/lib/format";
import { SellerDeclaredBadge } from "./seller-declared-badge";
import { SaleDisclaimer } from "./sale-disclaimer";

/**
 * Optional commercial information. Every field is nullable, and null renders
 * as "Not disclosed by seller" — never as zero. The product spec is explicit
 * that sellers must not be required to disclose financials, so absence here
 * carries no negative signal.
 */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "text-right font-medium" : "text-right text-subtle-foreground"}>
        {value ?? "Not disclosed by seller"}
      </dd>
    </div>
  );
}

export function SaleFinancialsPanel({
  currentMonthlyRevenue,
  currentAnnualRevenue,
  averageOccupancyPercent,
  averageMonthlyAdIncome,
  operatingExpensesAnnual,
  annualMaintenanceCost,
  landRentAnnual,
  permitFeesAnnual,
  netAnnualIncome,
  expectedRoiPercent,
  existingAdvertiserContracts,
  remainingContractMonths,
  negotiable,
}: {
  currentMonthlyRevenue: number | null;
  currentAnnualRevenue: number | null;
  averageOccupancyPercent: number | null;
  averageMonthlyAdIncome: number | null;
  operatingExpensesAnnual: number | null;
  annualMaintenanceCost: number | null;
  landRentAnnual: number | null;
  permitFeesAnnual: number | null;
  netAnnualIncome: number | null;
  expectedRoiPercent: number | null;
  existingAdvertiserContracts: string | null;
  remainingContractMonths: number | null;
  negotiable: boolean;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Commercial information</h2>
        <SellerDeclaredBadge size="sm" />
      </div>

      <dl>
        <Row label="Negotiable" value={negotiable ? "Yes" : "No"} />
        <Row
          label="Current monthly revenue"
          value={currentMonthlyRevenue !== null ? formatPaise(currentMonthlyRevenue) : null}
        />
        <Row
          label="Current annual revenue"
          value={currentAnnualRevenue !== null ? formatPaise(currentAnnualRevenue) : null}
        />
        <Row
          label="Average occupancy"
          value={averageOccupancyPercent !== null ? `${averageOccupancyPercent}%` : null}
        />
        <Row
          label="Average monthly advertising income"
          value={averageMonthlyAdIncome !== null ? formatPaise(averageMonthlyAdIncome) : null}
        />
        <Row
          label="Operating expenses (annual)"
          value={operatingExpensesAnnual !== null ? formatPaise(operatingExpensesAnnual) : null}
        />
        <Row
          label="Annual maintenance cost"
          value={annualMaintenanceCost !== null ? formatPaise(annualMaintenanceCost) : null}
        />
        <Row label="Land rent (annual)" value={landRentAnnual !== null ? formatPaise(landRentAnnual) : null} />
        <Row
          label="Permit / municipal fees (annual)"
          value={permitFeesAnnual !== null ? formatPaise(permitFeesAnnual) : null}
        />
        <Row
          label="Net annual income"
          value={netAnnualIncome !== null ? formatPaise(netAnnualIncome) : null}
        />
        <Row
          label="Expected ROI"
          value={expectedRoiPercent !== null ? `${expectedRoiPercent}%` : null}
        />
        <Row label="Existing advertiser contracts" value={existingAdvertiserContracts} />
        <Row
          label="Remaining contract duration"
          value={remainingContractMonths !== null ? `${remainingContractMonths} months` : null}
        />
      </dl>

      <SaleDisclaimer variant="financials" className="mt-4" />
    </section>
  );
}
