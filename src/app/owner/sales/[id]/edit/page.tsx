import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { getOwnerSaleListing } from "@/server/services/sale-seller-service";
import { OwnerNav } from "../../../owner-nav";
import { EditListingForm, type EditListingInitial } from "./edit-listing-form";

export const metadata: Metadata = {
  title: "Edit sale listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Edit a sale listing.
 *
 * getOwnerSaleListing is scoped by ownerId, so another partner's listing
 * simply is not found — reported as a 404 rather than a 403, matching
 * getOwnerAsset's reasoning: a 403 would confirm the listing exists.
 */
export default async function EditSaleListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) return <OwnerAccessNotice error={ownerAuth.error} />;

  const { id } = await params;
  const listing = await getOwnerSaleListing(ownerAuth.owner.id, id);
  if (!listing) notFound();

  const str = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  const isoDate = (value: Date | null | undefined) =>
    value ? value.toISOString().slice(0, 10) : "";

  const initial: EditListingInitial = {
    id: listing.id,
    slug: listing.slug,
    status: listing.status,
    syncState: listing.syncState,
    assetTitle: listing.asset.title,

    askingPrice: str(Math.round(listing.askingPriceAmount / 100)),
    negotiable: listing.negotiable,
    locationPrecision: listing.locationPrecision,

    ownershipType: listing.ownershipType,
    inclusions: listing.inclusions,
    inclusionsNote: listing.inclusionsNote ?? "",

    financials: {
      currentMonthlyRevenue: str(
        listing.currentMonthlyRevenue !== null
          ? Math.round(listing.currentMonthlyRevenue / 100)
          : null,
      ),
      currentAnnualRevenue: str(
        listing.currentAnnualRevenue !== null
          ? Math.round(listing.currentAnnualRevenue / 100)
          : null,
      ),
      averageOccupancyPercent: str(listing.averageOccupancyPercent),
      averageMonthlyAdIncome: str(
        listing.averageMonthlyAdIncome !== null
          ? Math.round(listing.averageMonthlyAdIncome / 100)
          : null,
      ),
      operatingExpensesAnnual: str(
        listing.operatingExpensesAnnual !== null
          ? Math.round(listing.operatingExpensesAnnual / 100)
          : null,
      ),
      annualMaintenanceCost: str(
        listing.annualMaintenanceCost !== null
          ? Math.round(listing.annualMaintenanceCost / 100)
          : null,
      ),
      landRentAnnual: str(
        listing.landRentAnnual !== null ? Math.round(listing.landRentAnnual / 100) : null,
      ),
      permitFeesAnnual: str(
        listing.permitFeesAnnual !== null ? Math.round(listing.permitFeesAnnual / 100) : null,
      ),
      netAnnualIncome: str(
        listing.netAnnualIncome !== null ? Math.round(listing.netAnnualIncome / 100) : null,
      ),
      expectedRoiPercent: str(listing.expectedRoiPercent),
      existingAdvertiserContracts: listing.existingAdvertiserContracts ?? "",
      remainingContractMonths: str(listing.remainingContractMonths),
    },

    property: listing.propertyDetails
      ? {
          propertyOwnershipType: listing.propertyDetails.propertyOwnershipType ?? "",
          landOwnerRelationship: listing.propertyDetails.landOwnerRelationship ?? "",
          landOwnerName: listing.propertyDetails.landOwnerName ?? "",
          propertyAddress: listing.propertyDetails.propertyAddress ?? "",
          surveyNumber: listing.propertyDetails.surveyNumber ?? "",
          buildingName: listing.propertyDetails.buildingName ?? "",
          floorLocation: listing.propertyDetails.floorLocation ?? "",
          propertyType: listing.propertyDetails.propertyType ?? "",
          leaseStartDate: isoDate(listing.propertyDetails.leaseStartDate),
          leaseEndDate: isoDate(listing.propertyDetails.leaseEndDate),
          monthlyLandRent: str(
            listing.propertyDetails.monthlyLandRent !== null
              ? Math.round(listing.propertyDetails.monthlyLandRent / 100)
              : null,
          ),
          annualLandRent: str(
            listing.propertyDetails.annualLandRent !== null
              ? Math.round(listing.propertyDetails.annualLandRent / 100)
              : null,
          ),
          revenueSharePercent: str(listing.propertyDetails.revenueSharePercent),
          renewalTerms: listing.propertyDetails.renewalTerms ?? "",
        }
      : null,

    permits: listing.permits.map((permit) => ({
      permitType: permit.permitType,
      permitTypeOther: permit.permitTypeOther ?? "",
      documentNumber: permit.documentNumber ?? "",
      issuingAuthority: permit.issuingAuthority ?? "",
      issueDate: isoDate(permit.issueDate),
      expiryDate: isoDate(permit.expiryDate),
      status: permit.status,
      notes: permit.notes ?? "",
    })),

    documents: listing.documents.map((doc) => ({
      category: doc.category,
      documentType: doc.documentType,
      title: doc.title ?? "",
      documentNumber: doc.documentNumber ?? "",
      issuingAuthority: doc.issuingAuthority ?? "",
      issueDate: isoDate(doc.issueDate),
      expiryDate: isoDate(doc.expiryDate),
      visibility: doc.visibility,
    })),
  };

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <OwnerNav />

        <Link
          href="/owner/sales"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assets for sale
        </Link>

        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          {listing.asset.title}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Edit ownership, rights, financials, permits and documents.
        </p>

        <EditListingForm initial={initial} />
      </main>
    </>
  );
}
