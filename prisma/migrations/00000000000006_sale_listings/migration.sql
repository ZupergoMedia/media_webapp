-- Asset sales marketplace.
--
-- Advertising lets someone rent space on an asset; this lets a media partner
-- sell the asset itself (or the rights they hold in it) outright. Different
-- counterparty, different lifecycle, different disclosure rules — so this
-- gets its own enum family and status vocabulary rather than overloading
-- VerificationStatus/AssetStatus, which existing code switches on
-- exhaustively (see admin-service.ts). Everything in this migration is
-- additive: no column dropped, no existing enum altered, Verification and
-- VerificationStatus untouched.
--
-- Every enum here is created fresh in this transaction, so — unlike the
-- BookingStatus split across migrations 0002/0003 — there is no
-- "used a new value in the same transaction it was added" hazard. That
-- hazard returns the day SaleListingKind gains LEASE/AUCTION or
-- SaleListingStatus gains a new workflow value; do that as its own
-- migration, added first, used later.
--
-- The central domain fact shaping this model: the seller frequently owns
-- neither the land nor the physical structure. SalePropertyDetails is split
-- into its own table (see below) specifically so the public read path can
-- never select it.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "SaleListingKind" AS ENUM ('SALE');

-- CreateEnum
CREATE TYPE "SaleListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PUBLISHED', 'PAUSED', 'OFFER_RECEIVED', 'UNDER_NEGOTIATION', 'SALE_AGREED', 'SOLD', 'WITHDRAWN', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SaleOwnershipType" AS ENUM ('FREEHOLD_OWNED', 'LEASED', 'LONG_TERM_LEASE', 'SUB_LEASE', 'CONCESSION', 'LICENSE', 'ADVERTISING_RIGHTS', 'OPERATING_RIGHTS', 'GOVERNMENT_TENDER', 'REVENUE_SHARE', 'PARTNERSHIP_JV', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleInclusion" AS ENUM ('PHYSICAL_STRUCTURE', 'ADVERTISING_RIGHTS', 'LAND_RIGHTS', 'LEASE_RIGHTS', 'CONCESSION_RIGHTS', 'OPERATING_RIGHTS', 'CUSTOMER_CONTRACTS', 'DIGITAL_DISPLAY_EQUIPMENT', 'ELECTRICAL_INFRASTRUCTURE', 'BRANDING_SIGNAGE_RIGHTS', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleLocationPrecision" AS ENUM ('EXACT', 'APPROXIMATE');

-- CreateEnum
CREATE TYPE "SaleListingSyncState" AS ENUM ('IN_SYNC', 'DRIFTED', 'RESYNC_REQUESTED');

-- CreateEnum
CREATE TYPE "SellerVerificationStatus" AS ENUM ('UNVERIFIED', 'BASIC_VERIFIED', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_UNDER_REVIEW', 'VERIFIED_SELLER');

-- CreateEnum
CREATE TYPE "ListingVerificationStatus" AS ENUM ('UNVERIFIED', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SaleVerificationItem" AS ENUM ('SELLER_IDENTITY', 'ASSET_OWNERSHIP_OR_RIGHT', 'LAND_LEASE_RELATIONSHIP', 'ADVERTISING_PERMISSION', 'PERMIT_VALIDITY', 'STRUCTURAL_DOCUMENTS', 'SALE_RIGHTS', 'EXISTING_CONTRACTS', 'LOCATION', 'PHOTOGRAPHS');

-- CreateEnum
CREATE TYPE "VerificationCheckStatus" AS ENUM ('VERIFIED', 'NOT_VERIFIED', 'NOT_APPLICABLE', 'NEEDS_MORE_INFO');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('MUNICIPAL_ADVERTISING_PERMIT', 'HOARDING_PERMIT', 'STRUCTURAL_STABILITY_CERTIFICATE', 'LAND_OWNER_NOC', 'PROPERTY_OWNER_NOC', 'TRAFFIC_AUTHORITY_NOC', 'HIGHWAY_AUTHORITY_PERMISSION', 'RAILWAY_METRO_PERMISSION', 'AIRPORT_AUTHORITY_PERMISSION', 'FIRE_SAFETY_APPROVAL', 'ELECTRICAL_APPROVAL', 'ENVIRONMENTAL_APPROVAL', 'GOVERNMENT_CONCESSION_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('VALID', 'EXPIRED', 'PENDING_RENEWAL', 'NOT_AVAILABLE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SaleDocumentCategory" AS ENUM ('OWNERSHIP', 'PERMISSIONS', 'TECHNICAL', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleDocumentVisibility" AS ENUM ('PUBLIC', 'BUYER_ON_REQUEST', 'VERIFIED_BUYER_ONLY', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "SaleEnquirerInterest" AS ENUM ('INVESTOR', 'MEDIA_COMPANY', 'ADVERTISER', 'PROPERTY_OWNER', 'BROKER', 'OTHER');

-- CreateEnum
CREATE TYPE "SaleEnquiryIntent" AS ENUM ('MORE_INFORMATION', 'REQUEST_DOCUMENTS', 'REQUEST_SITE_VISIT', 'MAKE_OFFER', 'CONTACT_SELLER');

-- CreateEnum
CREATE TYPE "SaleEnquiryStatus" AS ENUM ('NEW', 'VIEWED', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SaleOfferStatus" AS ENUM ('SUBMITTED', 'VIEWED', 'COUNTER_OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SaleListingEventType" AS ENUM ('CREATED', 'SUBMITTED', 'PUBLISHED', 'STATUS_CHANGED', 'PRICE_CHANGED', 'SNAPSHOT_UPDATED', 'DRIFT_DISMISSED', 'DOCUMENT_ADDED', 'DOCUMENT_REMOVED', 'PERMIT_ADDED', 'VERIFICATION_DECISION', 'ENQUIRY_RECEIVED', 'OFFER_RECEIVED', 'OFFER_STATUS_CHANGED', 'REPORTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SaleReportReason" AS ENUM ('MISLEADING_INFORMATION', 'SUSPECTED_FRAUD', 'DUPLICATE_LISTING', 'ALREADY_SOLD', 'INAPPROPRIATE_CONTENT', 'OTHER');

-- ---------------------------------------------------------------------------
-- Additive columns on existing tables
-- ---------------------------------------------------------------------------

-- Selling is a materially higher-trust act than listing for advertising, so a
-- partner verified for one must be able to disagree with the other. NULL
-- means this partner has never engaged with the sales module at all —
-- distinct from having engaged and been found UNVERIFIED.
ALTER TABLE "MediaOwner" ADD COLUMN "saleVerificationStatus" "SellerVerificationStatus";
ALTER TABLE "MediaOwner" ADD COLUMN "saleVerifiedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "SaleListing" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "listingKind" "SaleListingKind" NOT NULL DEFAULT 'SALE',
    "status" "SaleListingStatus" NOT NULL DEFAULT 'DRAFT',
    "askingPriceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "currentMonthlyRevenue" INTEGER,
    "currentAnnualRevenue" INTEGER,
    "averageOccupancyPercent" INTEGER,
    "averageMonthlyAdIncome" INTEGER,
    "operatingExpensesAnnual" INTEGER,
    "annualMaintenanceCost" INTEGER,
    "landRentAnnual" INTEGER,
    "permitFeesAnnual" INTEGER,
    "netAnnualIncome" INTEGER,
    "expectedRoiPercent" INTEGER,
    "existingAdvertiserContracts" TEXT,
    "remainingContractMonths" INTEGER,
    "ownershipType" "SaleOwnershipType" NOT NULL,
    "inclusions" "SaleInclusion"[],
    "inclusionsNote" TEXT,
    "leaseStartDate" TIMESTAMP(3),
    "leaseEndDate" TIMESTAMP(3),
    "leaseRenewalTerms" TEXT,
    "rightsTransferable" BOOLEAN,
    "locationPrecision" "SaleLocationPrecision" NOT NULL DEFAULT 'APPROXIMATE',
    "publicGeog" geography(Point, 4326),
    "publicLat" DOUBLE PRECISION,
    "publicLng" DOUBLE PRECISION,
    "publicAreaLabel" TEXT,
    "publicLocality" TEXT,
    "publicCity" TEXT,
    "publicState" TEXT,
    "snapshotTitle" TEXT,
    "snapshotDescription" TEXT,
    "snapshotCategoryId" TEXT,
    "snapshotTypeId" TEXT,
    "snapshotTypeName" TEXT,
    "snapshotSpecs" JSONB,
    "snapshotCity" TEXT,
    "snapshotState" TEXT,
    "snapshotLocality" TEXT,
    "snapshotImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshotDailyImpressions" INTEGER,
    "snapshotHash" TEXT,
    "snapshotAt" TIMESTAMP(3),
    "syncState" "SaleListingSyncState" NOT NULL DEFAULT 'IN_SYNC',
    "driftedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "driftDetectedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "duplicateSignature" TEXT,
    "duplicateOfId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePropertyDetails" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "propertyOwnershipType" TEXT,
    "landOwnerRelationship" TEXT,
    "landOwnerName" TEXT,
    "propertyAddress" TEXT,
    "surveyNumber" TEXT,
    "buildingName" TEXT,
    "floorLocation" TEXT,
    "propertyType" TEXT,
    "leaseStartDate" TIMESTAMP(3),
    "leaseEndDate" TIMESTAMP(3),
    "monthlyLandRent" INTEGER,
    "annualLandRent" INTEGER,
    "revenueSharePercent" INTEGER,
    "renewalTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalePropertyDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePermit" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "permitType" "PermitType" NOT NULL,
    "permitTypeOther" TEXT,
    "documentNumber" TEXT,
    "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "PermitStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalePermit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
--
-- A seller-DECLARED claim that a supporting document exists — not the
-- document itself. `url` stays nullable and unused: see the doc comment in
-- schema.prisma. Do not populate it until real object storage exists.
CREATE TABLE "SaleDocument" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "category" "SaleDocumentCategory" NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT,
    "documentNumber" TEXT,
    "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "visibility" "SaleDocumentVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
--
-- Anonymous by design. Contact details collected here are never returned by
-- the submitting request and never surfaced publicly — see createSaleEnquiry.
CREATE TABLE "SaleEnquiry" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "interest" "SaleEnquirerInterest" NOT NULL,
    "intents" "SaleEnquiryIntent"[],
    "message" TEXT,
    "ipHash" TEXT,
    "status" "SaleEnquiryStatus" NOT NULL DEFAULT 'NEW',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleOffer" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "offerPriceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "message" TEXT,
    "expectedClosingTimeline" TEXT,
    "status" "SaleOfferStatus" NOT NULL DEFAULT 'SUBMITTED',
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleListingVerification" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "ListingVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleListingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleVerificationCheck" (
    "id" TEXT NOT NULL,
    "saleListingVerificationId" TEXT NOT NULL,
    "item" "SaleVerificationItem" NOT NULL,
    "status" "VerificationCheckStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleVerificationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
--
-- Typed fromValue/toValue cover the two questions anyone actually asks; detail
-- is a comment field for the long tail, not a payload contract — this is
-- deliberately not a generic event-sourcing store.
CREATE TABLE "SaleListingEvent" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "SaleListingEventType" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReport" (
    "id" TEXT NOT NULL,
    "saleListingId" TEXT,
    "reportedOwnerId" TEXT,
    "reporterUserId" TEXT,
    "reporterEmail" TEXT,
    "reason" "SaleReportReason" NOT NULL,
    "details" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReport_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "MediaOwner_saleVerificationStatus_idx" ON "MediaOwner"("saleVerificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SaleListing_slug_key" ON "SaleListing"("slug");

-- CreateIndex
CREATE INDEX "SaleListing_status_listingKind_idx" ON "SaleListing"("status", "listingKind");

-- CreateIndex
CREATE INDEX "SaleListing_ownerId_idx" ON "SaleListing"("ownerId");

-- CreateIndex
CREATE INDEX "SaleListing_assetId_idx" ON "SaleListing"("assetId");

-- CreateIndex
CREATE INDEX "SaleListing_publicCity_idx" ON "SaleListing"("publicCity");

-- CreateIndex
CREATE INDEX "SaleListing_duplicateSignature_idx" ON "SaleListing"("duplicateSignature");

-- CreateIndex
CREATE UNIQUE INDEX "SalePropertyDetails_saleListingId_key" ON "SalePropertyDetails"("saleListingId");

-- CreateIndex
CREATE INDEX "SalePermit_saleListingId_idx" ON "SalePermit"("saleListingId");

-- CreateIndex
CREATE INDEX "SalePermit_status_idx" ON "SalePermit"("status");

-- CreateIndex
CREATE INDEX "SaleDocument_saleListingId_idx" ON "SaleDocument"("saleListingId");

-- CreateIndex
CREATE INDEX "SaleDocument_visibility_idx" ON "SaleDocument"("visibility");

-- CreateIndex
CREATE INDEX "SaleEnquiry_saleListingId_status_idx" ON "SaleEnquiry"("saleListingId", "status");

-- CreateIndex
CREATE INDEX "SaleEnquiry_email_createdAt_idx" ON "SaleEnquiry"("email", "createdAt");

-- CreateIndex
CREATE INDEX "SaleEnquiry_ipHash_createdAt_idx" ON "SaleEnquiry"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "SaleOffer_saleListingId_status_idx" ON "SaleOffer"("saleListingId", "status");

-- CreateIndex
CREATE INDEX "SaleOffer_buyerId_idx" ON "SaleOffer"("buyerId");

-- CreateIndex
CREATE INDEX "SaleListingVerification_saleListingId_idx" ON "SaleListingVerification"("saleListingId");

-- CreateIndex
CREATE INDEX "SaleListingVerification_status_idx" ON "SaleListingVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SaleVerificationCheck_saleListingVerificationId_item_key" ON "SaleVerificationCheck"("saleListingVerificationId", "item");

-- CreateIndex
CREATE INDEX "SaleListingEvent_saleListingId_createdAt_idx" ON "SaleListingEvent"("saleListingId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleListingEvent_eventType_idx" ON "SaleListingEvent"("eventType");

-- CreateIndex
CREATE INDEX "SaleReport_saleListingId_idx" ON "SaleReport"("saleListingId");

-- CreateIndex
CREATE INDEX "SaleReport_reportedOwnerId_idx" ON "SaleReport"("reportedOwnerId");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

-- AddForeignKey
ALTER TABLE "SaleListing" ADD CONSTRAINT "SaleListing_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListing" ADD CONSTRAINT "SaleListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MediaOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListing" ADD CONSTRAINT "SaleListing_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "SaleListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePropertyDetails" ADD CONSTRAINT "SalePropertyDetails_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePermit" ADD CONSTRAINT "SalePermit_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDocument" ADD CONSTRAINT "SaleDocument_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleEnquiry" ADD CONSTRAINT "SaleEnquiry_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListingVerification" ADD CONSTRAINT "SaleListingVerification_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListingVerification" ADD CONSTRAINT "SaleListingVerification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleVerificationCheck" ADD CONSTRAINT "SaleVerificationCheck_saleListingVerificationId_fkey" FOREIGN KEY ("saleListingVerificationId") REFERENCES "SaleListingVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListingEvent" ADD CONSTRAINT "SaleListingEvent_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleListingEvent" ADD CONSTRAINT "SaleListingEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReport" ADD CONSTRAINT "SaleReport_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "SaleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReport" ADD CONSTRAINT "SaleReport_reportedOwnerId_fkey" FOREIGN KEY ("reportedOwnerId") REFERENCES "MediaOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReport" ADD CONSTRAINT "SaleReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Spatial index
--
-- Only the PUBLIC point ever needs a GiST index: it is the only geography
-- column any public query may reference. The true AssetLocation.geog already
-- has one from migration 0000, and public sale search filters on that column
-- (filter on truth, project approximation — see sale-spatial.ts), so this
-- index exists purely to make the public bbox/radius sale search itself fast
-- once listing volume grows past a handful of rows.
-- ---------------------------------------------------------------------------

CREATE INDEX "SaleListing_publicGeog_idx" ON "SaleListing" USING GIST ("publicGeog");

-- ---------------------------------------------------------------------------
-- GIN indexes over array/JSONB columns, mirroring Asset_specs_idx
-- ---------------------------------------------------------------------------

CREATE INDEX "SaleListing_inclusions_idx" ON "SaleListing" USING GIN ("inclusions");

CREATE INDEX "SaleListing_snapshotSpecs_idx" ON "SaleListing" USING GIN ("snapshotSpecs");

-- ---------------------------------------------------------------------------
-- Partial index matching the public search predicate — mirrors
-- Asset_searchable_idx: only PUBLISHED listings are ever returned to the
-- public marketplace.
-- ---------------------------------------------------------------------------

CREATE INDEX "SaleListing_searchable_idx"
  ON "SaleListing" ("publicCity", "ownershipType")
  WHERE "status" = 'PUBLISHED';

-- ---------------------------------------------------------------------------
-- Drift detection trigger
--
-- Flags PUBLISHED (and other live-lifecycle) sale listings when the Asset
-- they were cut from changes in a way that matters to a buyer. The trigger
-- only raises a flag — nothing here rewrites the listing's snapshot. A human
-- decides whether to accept the change (re-snapshot, via the seller
-- dashboard) or dismiss it (the seller may have edited the asset for an
-- unrelated advertising reason).
--
-- AFTER UPDATE OF (named columns) means this never fires on the columns that
-- change on every write elsewhere in the app — ratingAverage/ratingCount
-- rollups, publishedAt — so the cost on Asset's hot path is zero.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sale_listing_flag_drift()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."title"            IS DISTINCT FROM OLD."title"
  OR NEW."description"      IS DISTINCT FROM OLD."description"
  OR NEW."specs"             IS DISTINCT FROM OLD."specs"
  OR NEW."typeId"            IS DISTINCT FROM OLD."typeId"
  OR NEW."categoryId"        IS DISTINCT FROM OLD."categoryId"
  OR NEW."dailyImpressions"  IS DISTINCT FROM OLD."dailyImpressions"
  THEN
    UPDATE "SaleListing"
       SET "syncState" = 'DRIFTED',
           "driftDetectedAt" = COALESCE("driftDetectedAt", NOW())
     WHERE "assetId" = NEW."id"
       AND "status" IN ('PUBLISHED', 'OFFER_RECEIVED', 'UNDER_NEGOTIATION', 'SALE_AGREED')
       AND "syncState" <> 'DRIFTED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sale_listing_drift_trigger
  AFTER UPDATE OF "title", "description", "specs", "typeId", "categoryId", "dailyImpressions"
  ON "Asset"
  FOR EACH ROW EXECUTE FUNCTION sale_listing_flag_drift();
