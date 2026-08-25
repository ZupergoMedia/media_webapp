import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { ImageGallery } from "@/components/marketplace/image-gallery";
import { SpecificationTable } from "@/components/marketplace/specification-table";
import { OwnershipRightsPanel } from "@/components/sales/ownership-rights-panel";
import { SaleFinancialsPanel } from "@/components/sales/sale-financials-panel";
import { PermitsTable } from "@/components/sales/permits-table";
import { SaleDocumentsPanel } from "@/components/sales/sale-documents-panel";
import { SaleEnquiryForm } from "@/components/sales/sale-enquiry-form";
import { SaleDisclaimer } from "@/components/sales/sale-disclaimer";
import { SellerDeclaredBadge } from "@/components/sales/seller-declared-badge";
import {
  getSaleListingBySlug,
  getVisibleSaleDocuments,
} from "@/server/services/sale-listing-service";
import { formatPaise, formatLocation, formatDate } from "@/lib/format";
import { SALE_OWNERSHIP_TYPE_LABELS } from "@/lib/sale-schema";

/**
 * Sale listing detail body.
 *
 * Server-rendered for indexability, following the advertising detail page's
 * shape — but every trust signal here is explicitly qualified (see
 * seller-declared-badge.tsx) because this pass ships with auto-publish and
 * no admin review. Nothing on this page may claim "Verified".
 */
export async function SaleListingView({ listingSlug }: { listingSlug: string }) {
  const listing = await getSaleListingBySlug(listingSlug);
  if (!listing) notFound();

  const location = formatLocation({
    locality: listing.publicLocality,
    city: listing.publicCity,
    areaLabel: listing.publicAreaLabel,
  });

  const { visible: visibleDocuments, hiddenCount } = getVisibleSaleDocuments(
    listing.documents,
  );

  // Prefer the frozen snapshot's image URLs — what the buyer sees must match
  // what they were shown when the listing was published, even if the seller
  // has since edited the asset's own photos (see SaleListing.snapshotImageUrls).
  const images = listing.snapshotImageUrls.length
    ? listing.snapshotImageUrls.map((url, index) => ({
        id: `snapshot-${index}`,
        url,
        alt: listing.snapshotTitle ?? null,
      }))
    : listing.asset.images;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.snapshotTitle ?? listing.asset.slug,
    description: listing.snapshotDescription ?? undefined,
    image: images.map((image) => image.url),
    category: listing.snapshotTypeName ?? undefined,
    offers: {
      "@type": "Offer",
      price: (listing.askingPriceAmount / 100).toFixed(2),
      priceCurrency: listing.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link
          href="/assets-for-sale"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assets for sale
        </Link>

        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-medium">
              {listing.snapshotTypeName ?? listing.asset.type.name}
            </span>
            <span className="text-xs text-muted-foreground">
              Listed {formatDate(listing.publishedAt ?? listing.createdAt)} · Seller type:{" "}
              {SALE_OWNERSHIP_TYPE_LABELS[
                listing.ownershipType as keyof typeof SALE_OWNERSHIP_TYPE_LABELS
              ] ?? listing.ownershipType}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {listing.snapshotTitle}
          </h1>

          <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {location}
            {listing.locationPrecision === "APPROXIMATE" && (
              <span className="text-xs text-subtle-foreground">(approximate location)</span>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums">
              {formatPaise(listing.askingPriceAmount)}
            </span>
            {listing.negotiable && (
              <span className="text-sm text-muted-foreground">Negotiable</span>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {images.length > 0 && <ImageGallery images={images} title={listing.snapshotTitle ?? ""} />}

            {listing.snapshotDescription && (
              <section>
                <h2 className="mb-2 text-base font-semibold">About this asset</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {listing.snapshotDescription}
                </p>
              </section>
            )}

            {listing.snapshotSpecs && (
              <SpecificationTable
                specSchema={listing.asset.type.specSchema}
                specs={listing.snapshotSpecs}
              />
            )}

            <OwnershipRightsPanel
              ownershipType={listing.ownershipType}
              inclusions={listing.inclusions}
              inclusionsNote={listing.inclusionsNote}
              leaseStartDate={listing.leaseStartDate}
              leaseEndDate={listing.leaseEndDate}
              leaseRenewalTerms={listing.leaseRenewalTerms}
              rightsTransferable={listing.rightsTransferable}
            />

            <SaleFinancialsPanel
              currentMonthlyRevenue={listing.currentMonthlyRevenue}
              currentAnnualRevenue={listing.currentAnnualRevenue}
              averageOccupancyPercent={listing.averageOccupancyPercent}
              averageMonthlyAdIncome={listing.averageMonthlyAdIncome}
              operatingExpensesAnnual={listing.operatingExpensesAnnual}
              annualMaintenanceCost={listing.annualMaintenanceCost}
              landRentAnnual={listing.landRentAnnual}
              permitFeesAnnual={listing.permitFeesAnnual}
              netAnnualIncome={listing.netAnnualIncome}
              expectedRoiPercent={listing.expectedRoiPercent}
              existingAdvertiserContracts={listing.existingAdvertiserContracts}
              remainingContractMonths={listing.remainingContractMonths}
              negotiable={listing.negotiable}
            />

            <PermitsTable permits={listing.permits} />

            <SaleDocumentsPanel visible={visibleDocuments} hiddenCount={hiddenCount} />
          </div>

          <aside className="space-y-4">
            <div className="rounded-card border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-base font-semibold text-brand"
                >
                  {listing.owner.companyName.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{listing.owner.companyName}</p>
                  <SellerDeclaredBadge size="sm" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                All claims on this listing are provided by the seller. See the disclaimer
                below before proceeding.
              </p>
            </div>

            <div id="enquiry" className="rounded-card border border-border bg-surface p-5">
              <h2 className="mb-3 text-base font-semibold">Make an enquiry</h2>
              <SaleEnquiryForm saleListingSlug={listing.slug} />
            </div>

            <SaleDisclaimer variant="offer" />
          </aside>
        </div>
      </main>
    </>
  );
}
