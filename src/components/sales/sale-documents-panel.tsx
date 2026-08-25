import { formatDate } from "@/lib/format";
import { SALE_DOCUMENT_CATEGORY_LABELS } from "@/lib/sale-schema";
import type { PublicSaleDocument } from "@/server/services/sale-listing-service";
import { cn } from "@/lib/utils";
import { SellerDeclaredBadge } from "./seller-declared-badge";
import { SaleDisclaimer } from "./sale-disclaimer";

const STATUS_LABEL: Record<PublicSaleDocument["status"], string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  unspecified: "No expiry recorded",
};

/**
 * Public documents panel. Receives only the pre-filtered, allow-listed shape
 * from getVisibleSaleDocuments — never the raw SaleDocument rows, so this
 * component cannot render a private field even by accident.
 */
export function SaleDocumentsPanel({
  visible,
  hiddenCount,
}: {
  visible: PublicSaleDocument[];
  hiddenCount: number;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Documents</h2>
        <SellerDeclaredBadge size="sm" />
      </div>

      {visible.length === 0 && hiddenCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          The seller has not declared any documents for this listing.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((doc, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-control border border-border p-2.5 text-sm"
            >
              <div>
                <p className="font-medium">{doc.title ?? doc.documentType}</p>
                <p className="text-xs text-muted-foreground">
                  {SALE_DOCUMENT_CATEGORY_LABELS[
                    doc.category as keyof typeof SALE_DOCUMENT_CATEGORY_LABELS
                  ] ?? doc.category}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  doc.status === "expired" ? "text-danger" : "text-muted-foreground",
                )}
              >
                {STATUS_LABEL[doc.status]}
                {doc.expiryDate && doc.status !== "unspecified"
                  ? ` (${formatDate(doc.expiryDate)})`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {hiddenCount} further {hiddenCount === 1 ? "document" : "documents"} available on
          request.{" "}
          <a href="#enquiry" className="text-brand hover:underline">
            Ask the seller
          </a>
          .
        </p>
      )}

      <SaleDisclaimer variant="documents" className="mt-4" />
    </section>
  );
}
