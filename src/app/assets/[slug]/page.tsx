import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Star } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { ImageGallery } from "@/components/marketplace/image-gallery";
import { SpecificationTable } from "@/components/marketplace/specification-table";
import { OwnerCard } from "@/components/marketplace/owner-card";
import { AssetCard } from "@/components/marketplace/asset-card";
import { RequestPanel } from "@/components/marketplace/request-panel";
import { VerificationBadge } from "@/components/marketplace/verification-badge";
import { AssetLocationMap } from "@/components/map/asset-location-map";
import {
  AudiencePanel,
  CoveragePanel,
  DigitalInventoryPanel,
  LocationPanel,
} from "@/components/marketplace/asset-panels";
import {
  getAssetBySlug,
  getSimilarAssets,
} from "@/server/services/asset-service";
import { getUnavailableRanges } from "@/server/services/request-service";
import { bookingModelLabel, formatLocation, locationModeLabel } from "@/lib/format";

/**
 * Asset detail page.
 *
 * Server-rendered so listings are indexable and load fast. The page composes
 * data-driven panels rather than branching on asset type: each panel appears
 * when its underlying data exists, which is what lets one page serve billboards,
 * screens, vehicles and venues alike.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const asset = await getAssetBySlug(slug);

  if (!asset) {
    return { title: "Asset not found" };
  }

  const location = formatLocation({
    locality: asset.location?.locality,
    city: asset.location?.city,
    areaLabel: asset.location?.areaLabel,
  });

  const description =
    asset.description ??
    `${asset.type.name} in ${location}. Check availability, specifications and pricing on ZuperGo.`;

  return {
    title: `${asset.title} — ${location}`,
    description,
    alternates: { canonical: `/assets/${asset.slug}` },
    openGraph: {
      title: asset.title,
      description,
      type: "website",
      images: asset.images[0]
        ? [{ url: asset.images[0].url, width: 1200, height: 800 }]
        : undefined,
    },
  };
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const asset = await getAssetBySlug(slug);

  if (!asset) notFound();

  const [unavailable, similar] = await Promise.all([
    getUnavailableRanges(asset.id),
    getSimilarAssets(asset.id, asset.typeId, asset.location?.city ?? null),
  ]);

  const location = formatLocation({
    locality: asset.location?.locality,
    city: asset.location?.city,
    areaLabel: asset.location?.areaLabel,
  });

  // Mobile assets are represented by their coverage, not a base point.
  const showPointMap =
    !asset.type.isMobile &&
    asset.location?.lat != null &&
    asset.location?.lng != null;

  const coverageRadius = asset.operatingAreas[0]?.radiusMeters ?? null;
  const showCoverageMap =
    asset.type.isMobile &&
    asset.operatingAreas[0]?.centerLat != null &&
    asset.operatingAreas[0]?.centerLng != null;

  /**
   * Structured data for rich search results. Uses Product/Offer because an
   * advertising placement is a purchasable good with a price and availability,
   * which is what schema.org models most closely.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: asset.title,
    description: asset.description ?? undefined,
    image: asset.images.map((image) => image.url),
    category: asset.category.name,
    brand: { "@type": "Organization", name: asset.owner.companyName },
    ...(asset.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: asset.ratingAverage,
            reviewCount: asset.ratingCount,
          },
        }
      : {}),
    ...(asset.pricing[0]
      ? {
          offers: {
            "@type": "Offer",
            price: (asset.pricing[0].amount / 100).toFixed(2),
            priceCurrency: asset.pricing[0].currency,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <>
      <Navbar />

      <script
        type="application/ld+json"
        // Serialised server-side from our own database, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link
          href="/explore"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to search
        </Link>

        {/* Header */}
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-medium">
              {asset.type.name}
            </span>
            {asset.verificationStatus === "VERIFIED" && (
              <VerificationBadge size="sm" />
            )}
            <span className="text-xs text-muted-foreground">
              {locationModeLabel(asset.locationMode)} ·{" "}
              {bookingModelLabel(asset.bookingModel)}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            {asset.title}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{location}</span>
            {asset.ratingCount > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-current" aria-hidden="true" />
                {asset.ratingAverage.toFixed(1)} ({asset.ratingCount})
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main column */}
          <div className="min-w-0 space-y-8">
            <ImageGallery images={asset.images} title={asset.title} />

            {asset.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold tracking-tight">
                  About this asset
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {asset.description}
                </p>
              </section>
            )}

            {asset.digitalInventory && (
              <DigitalInventoryPanel inventory={asset.digitalInventory} />
            )}

            <AudiencePanel
              dailyImpressions={asset.dailyImpressions}
              audienceProfile={asset.audienceProfile}
            />

            <section aria-labelledby="specs-heading">
              <h2
                id="specs-heading"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Specifications
              </h2>
              <SpecificationTable
                specSchema={asset.type.specSchema}
                specs={asset.specs}
              />
            </section>

            <CoveragePanel
              operatingAreas={asset.operatingAreas}
              routes={asset.routes}
            />

            <section aria-labelledby="location-heading">
              <h2
                id="location-heading"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Location
              </h2>

              {asset.location && <LocationPanel location={asset.location} />}

              <div className="mt-3">
                {showPointMap ? (
                  <AssetLocationMap
                    lat={asset.location!.lat!}
                    lng={asset.location!.lng!}
                    label={asset.title}
                  />
                ) : showCoverageMap ? (
                  <AssetLocationMap
                    lat={asset.operatingAreas[0].centerLat!}
                    lng={asset.operatingAreas[0].centerLng!}
                    label={`${asset.title} service area`}
                    radiusMeters={coverageRadius}
                  />
                ) : (
                  <p className="rounded-card border border-dashed border-border-strong bg-surface-muted p-4 text-sm text-muted-foreground">
                    This asset operates across a defined area rather than a
                    single fixed point.
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="owner-heading">
              <h2
                id="owner-heading"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Media partner
              </h2>
              <OwnerCard owner={asset.owner} />
            </section>
          </div>

          {/* Booking rail */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <RequestPanel
              assetSlug={asset.slug}
              pricing={asset.pricing}
              unavailable={unavailable.map((range) => ({
                start: range.start,
                end: range.end,
                reason: range.reason === "confirmed" ? "booked" : "blocked",
              }))}
              bookingModel={asset.bookingModel}
              digitalSlotsPerLoop={asset.digitalInventory?.slotsPerLoop}
            />
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-14" aria-labelledby="similar-heading">
            <h2
              id="similar-heading"
              className="mb-4 text-lg font-semibold tracking-tight"
            >
              Similar assets
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((item) => (
                <AssetCard key={item.id} asset={item} compact />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
