

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADVERTISER', 'MEDIA_OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('FIXED', 'AREA', 'ROUTE', 'MOBILE', 'VENUE', 'EVENT');

-- CreateEnum
CREATE TYPE "BookingModel" AS ENUM ('FULL_ASSET', 'DATE_RANGE', 'TIME_SLOT', 'DIGITAL_SLOT', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'HELD', 'PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('PER_DAY', 'PER_WEEK', 'PER_MONTH', 'PER_SLOT', 'PER_SPOT', 'PER_IMPRESSION', 'PER_EVENT');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'BLOCKED', 'BOOKED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_REQUESTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'ASSET_VERIFIED', 'ASSET_REJECTED', 'PAYMENT_RECEIVED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "IlluminationType" AS ENUM ('NONE', 'BACKLIT', 'FRONTLIT', 'DIGITAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADVERTISER',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "MediaOwner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetType" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultLocationMode" "LocationMode" NOT NULL DEFAULT 'FIXED',
    "supportedBookingModels" "BookingModel"[],
    "isDigital" BOOLEAN NOT NULL DEFAULT false,
    "isMobile" BOOLEAN NOT NULL DEFAULT false,
    "specSchema" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationMode" "LocationMode" NOT NULL,
    "bookingModel" "BookingModel" NOT NULL DEFAULT 'DATE_RANGE',
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "specs" JSONB NOT NULL DEFAULT '{}',
    "dailyImpressions" INTEGER,
    "audienceProfile" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "geog" geography(Point, 4326),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "addressLine" TEXT,
    "landmark" TEXT,
    "locality" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "pincode" TEXT,
    "areaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetImage" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSpecification" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "group" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssetSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPricing" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "minDuration" INTEGER,
    "maxDuration" INTEGER,
    "discountThreshold" INTEGER,
    "discountPercent" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAvailability" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "AvailabilityKind" NOT NULL DEFAULT 'BLOCKED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalInventory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "slotDurationSeconds" INTEGER NOT NULL,
    "loopDurationSeconds" INTEGER NOT NULL,
    "slotsPerLoop" INTEGER NOT NULL,
    "operatingHoursStart" INTEGER NOT NULL DEFAULT 6,
    "operatingHoursEnd" INTEGER NOT NULL DEFAULT 23,
    "estimatedPlaysPerDay" INTEGER,
    "screenWidthPx" INTEGER,
    "screenHeightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingArea" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "area" geography(Polygon, 4326),
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusMeters" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "path" geography(LineString, 4326),
    "startLabel" TEXT,
    "endLabel" TEXT,
    "lengthKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "campaignId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "holdExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "creativeNotes" TEXT,
    "cancelledReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "bookingModel" "BookingModel" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "slotCount" INTEGER,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "targetLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetAudience" TEXT,
    "creativeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "estimatedCost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "failureReason" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "documents" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT,
    "filters" JSONB,
    "city" TEXT,
    "resultCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "MediaOwner_userId_key" ON "MediaOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaOwner_slug_key" ON "MediaOwner"("slug");

-- CreateIndex
CREATE INDEX "MediaOwner_verificationStatus_idx" ON "MediaOwner"("verificationStatus");

-- CreateIndex
CREATE INDEX "MediaOwner_city_idx" ON "MediaOwner"("city");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_slug_key" ON "AssetCategory"("slug");

-- CreateIndex
CREATE INDEX "AssetCategory_isActive_sortOrder_idx" ON "AssetCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_slug_key" ON "AssetType"("slug");

-- CreateIndex
CREATE INDEX "AssetType_categoryId_isActive_idx" ON "AssetType"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "AssetType_isDigital_idx" ON "AssetType"("isDigital");

-- CreateIndex
CREATE INDEX "AssetType_isMobile_idx" ON "AssetType"("isMobile");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_slug_key" ON "Asset"("slug");

-- CreateIndex
CREATE INDEX "Asset_status_verificationStatus_idx" ON "Asset"("status", "verificationStatus");

-- CreateIndex
CREATE INDEX "Asset_categoryId_typeId_idx" ON "Asset"("categoryId", "typeId");

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "Asset_isFeatured_idx" ON "Asset"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLocation_assetId_key" ON "AssetLocation"("assetId");

-- CreateIndex
CREATE INDEX "AssetLocation_city_idx" ON "AssetLocation"("city");

-- CreateIndex
CREATE INDEX "AssetLocation_locality_idx" ON "AssetLocation"("locality");

-- CreateIndex
CREATE INDEX "AssetImage_assetId_sortOrder_idx" ON "AssetImage"("assetId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssetSpecification_assetId_idx" ON "AssetSpecification"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSpecification_assetId_key_key" ON "AssetSpecification"("assetId", "key");

-- CreateIndex
CREATE INDEX "AssetPricing_assetId_isDefault_idx" ON "AssetPricing"("assetId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPricing_assetId_unit_key" ON "AssetPricing"("assetId", "unit");

-- CreateIndex
CREATE INDEX "AssetAvailability_assetId_startDate_endDate_idx" ON "AssetAvailability"("assetId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalInventory_assetId_key" ON "DigitalInventory"("assetId");

-- CreateIndex
CREATE INDEX "OperatingArea_assetId_idx" ON "OperatingArea"("assetId");

-- CreateIndex
CREATE INDEX "OperatingArea_city_idx" ON "OperatingArea"("city");

-- CreateIndex
CREATE INDEX "Route_assetId_idx" ON "Route"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_advertiserId_status_idx" ON "Booking"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Booking_campaignId_idx" ON "Booking"("campaignId");

-- CreateIndex
CREATE INDEX "BookingItem_assetId_startAt_endAt_idx" ON "BookingItem"("assetId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "Campaign_advertiserId_status_idx" ON "Campaign"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "CampaignAsset_assetId_idx" ON "CampaignAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAsset_campaignId_assetId_key" ON "CampaignAsset"("campaignId", "assetId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Review_assetId_idx" ON "Review"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_assetId_authorId_key" ON "Review"("assetId", "authorId");

-- CreateIndex
CREATE INDEX "Verification_status_idx" ON "Verification"("status");

-- CreateIndex
CREATE INDEX "Verification_assetId_idx" ON "Verification"("assetId");

-- CreateIndex
CREATE INDEX "Verification_ownerId_idx" ON "Verification"("ownerId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Favorite_assetId_idx" ON "Favorite"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_assetId_key" ON "Favorite"("userId", "assetId");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaOwner" ADD CONSTRAINT "MediaOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetType" ADD CONSTRAINT "AssetType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MediaOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLocation" ADD CONSTRAINT "AssetLocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetImage" ADD CONSTRAINT "AssetImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPricing" ADD CONSTRAINT "AssetPricing_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAvailability" ADD CONSTRAINT "AssetAvailability_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalInventory" ADD CONSTRAINT "DigitalInventory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingArea" ADD CONSTRAINT "OperatingArea_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MediaOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Spatial indexes
--
-- Prisma cannot express GiST indexes on Unsupported() columns, so they are
-- declared here. Without these, every bounds query degrades to a sequential
-- scan and the map becomes unusable well before the inventory is large.
-- ===========================================================================

CREATE INDEX "AssetLocation_geog_idx" ON "AssetLocation" USING GIST ("geog");
CREATE INDEX "OperatingArea_area_idx" ON "OperatingArea" USING GIST ("area");
CREATE INDEX "Route_path_idx" ON "Route" USING GIST ("path");

-- Partial index matching the exact search predicate: only listings that are
-- both ACTIVE and VERIFIED are ever returned to advertisers.
CREATE INDEX "Asset_searchable_idx"
  ON "Asset" ("categoryId", "typeId")
  WHERE "status" = 'ACTIVE' AND "verificationStatus" = 'VERIFIED';

-- GIN index over the JSONB spec blob so spec-level filters stay indexable
-- without promoting every field to a column.
CREATE INDEX "Asset_specs_idx" ON "Asset" USING GIN ("specs");


-- ===========================================================================
-- Booking integrity
--
-- All five booking models normalise to a half-open tstzrange, so one mechanism
-- detects every conflict. `period` is maintained by trigger rather than as a
-- GENERATED column because Prisma would otherwise attempt to write it.
--
-- The exclusion constraint is the single most valuable line in this schema: it
-- makes double-booking impossible at the database level. Application-level
-- checks cannot close the race between two concurrent checkouts reading
-- "available" before either writes.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BookingItem" ADD COLUMN "period" tstzrange;

-- Denormalised copy of Booking.status, narrowed to the one question the
-- constraint asks: does this row currently hold inventory?
--
-- This column exists because an exclusion constraint's WHERE clause must be
-- IMMUTABLE — it cannot contain a subquery against Booking. Denormalising the
-- answer onto the row, kept in sync by the triggers below, is what makes the
-- constraint expressible at all.
ALTER TABLE "BookingItem" ADD COLUMN "holdsInventory" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION booking_item_sync_derived()
RETURNS TRIGGER AS $$
BEGIN
  -- Half-open '[)' so a booking ending at 09:00 does not collide with one
  -- starting at 09:00 — back-to-back bookings are legal.
  NEW."period" := tstzrange(NEW."startAt", NEW."endAt", '[)');

  SELECT b."status" IN ('HELD', 'PENDING_APPROVAL', 'CONFIRMED')
    INTO NEW."holdsInventory"
    FROM "Booking" b
   WHERE b."id" = NEW."bookingId";

  NEW."holdsInventory" := COALESCE(NEW."holdsInventory", false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_item_derived_trigger
  BEFORE INSERT OR UPDATE OF "startAt", "endAt", "bookingId" ON "BookingItem"
  FOR EACH ROW EXECUTE FUNCTION booking_item_sync_derived();

-- When a booking transitions (DRAFT -> HELD -> CONFIRMED, or -> CANCELLED), its
-- items must gain or release their claim on inventory. Without this, cancelled
-- bookings would keep blocking their dates forever.
CREATE OR REPLACE FUNCTION booking_propagate_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    UPDATE "BookingItem"
       SET "holdsInventory" = NEW."status" IN ('HELD', 'PENDING_APPROVAL', 'CONFIRMED')
     WHERE "bookingId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_status_propagate_trigger
  AFTER UPDATE OF "status" ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION booking_propagate_status();

-- Blocks overlapping reservations of the same asset, but only for rows that
-- currently hold inventory. Cancelled and draft bookings are ignored.
--
-- DIGITAL_SLOT is deliberately exempt: a DOOH screen sells N slots per loop, so
-- overlap is legal up to DigitalInventory.slotsPerLoop. Those conflicts are
-- enforced by a counting check inside a SERIALIZABLE transaction instead.
ALTER TABLE "BookingItem"
  ADD CONSTRAINT "BookingItem_no_overlap"
  EXCLUDE USING GIST (
    "assetId" WITH =,
    "period" WITH &&
  )
  WHERE (
    "holdsInventory" = true
    AND "bookingModel" <> 'DIGITAL_SLOT'
  );

CREATE INDEX "BookingItem_period_idx" ON "BookingItem" USING GIST ("assetId", "period");
