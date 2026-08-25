import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { getSaleCities, getSaleListingBySlug } from "@/server/services/sale-listing-service";
import { getTaxonomy } from "@/server/services/asset-service";
import { findSaleCollection, resolveSaleRoute } from "@/lib/sale-routes";
import { formatLocation } from "@/lib/format";
import { SaleListingView } from "./sale-listing-view";
import { SaleLandingView } from "./sale-landing-view";

/**
 * `/assets-for-sale/[...segments]` catch-all.
 *
 * `/assets-for-sale/[slug]` and `/assets-for-sale/[city]` cannot be sibling
 * dynamic segments in the App Router, so both — plus city+type landing pages
 * and curated collections — are folded into one catch-all, disambiguated by
 * segment COUNT (see resolveSaleRoute in sale-routes.ts). This file is kept
 * to a resolver + dispatcher; the actual page bodies live in
 * sale-listing-view.tsx and sale-landing-view.tsx.
 *
 * Renders <Navbar/> exactly once here, at the dispatch point, preserving the
 * "every page renders Navbar itself" convention with one call site instead
 * of two.
 */

interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

async function resolve(segmentsParam: string[] | undefined) {
  const [cities, taxonomy] = await Promise.all([getSaleCities(), getTaxonomy()]);
  const knownCities = cities.map((c) => c.city);
  const knownTypeSlugs = taxonomy.flatMap((c) => c.assetTypes.map((t) => t.slug));

  return resolveSaleRoute(segmentsParam, knownCities, knownTypeSlugs);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const resolution = await resolve(segments);

  if (resolution.kind === "listing") {
    const listing = await getSaleListingBySlug(resolution.listingSlug);
    if (!listing) return { title: "Listing not found" };

    const location = formatLocation({
      locality: listing.publicLocality,
      city: listing.publicCity,
      areaLabel: listing.publicAreaLabel,
    });

    const description =
      listing.metaDescription ??
      listing.snapshotDescription ??
      `${listing.snapshotTypeName ?? "Outdoor media asset"} for sale in ${location}.`;

    return {
      title: listing.seoTitle ?? `${listing.snapshotTitle} for sale — ${location}`,
      description,
      alternates: {
        canonical: `/assets-for-sale/${resolution.city}/${listing.slug}`,
      },
      openGraph: {
        title: listing.snapshotTitle ?? "Asset for sale",
        description,
        images: listing.ogImageUrl
          ? [{ url: listing.ogImageUrl, width: 1200, height: 800 }]
          : listing.snapshotImageUrls[0]
            ? [{ url: listing.snapshotImageUrls[0], width: 1200, height: 800 }]
            : undefined,
      },
    };
  }

  if (resolution.kind === "city") {
    return {
      title: `Outdoor media assets for sale in ${resolution.city}`,
      description: `Browse billboards, digital screens and other outdoor advertising assets for sale in ${resolution.city}.`,
      alternates: { canonical: `/assets-for-sale/${resolution.city}` },
      openGraph: {
        type: "website",
        title: `Outdoor media assets for sale in ${resolution.city}`,
        description: `Browse billboards, digital screens and other outdoor advertising assets for sale in ${resolution.city}.`,
      },
    };
  }

  if (resolution.kind === "city_type") {
    const typeLabel = resolution.typeSlug.replace(/-/g, " ");
    const title = `${typeLabel} for sale in ${resolution.city}`;
    return {
      title,
      description: `Browse ${typeLabel} available for sale in ${resolution.city}.`,
      alternates: {
        canonical: `/assets-for-sale/${resolution.city}/${resolution.typeSlug}`,
      },
      openGraph: {
        type: "website",
        title,
        description: `Browse ${typeLabel} available for sale in ${resolution.city}.`,
      },
    };
  }

  if (resolution.kind === "collection") {
    const collection = findSaleCollection(resolution.collection);
    const title = collection?.label ?? "Assets for sale";
    return {
      title,
      description: collection
        ? `Browse ${collection.label.toLowerCase()} on ZuperGo.`
        : undefined,
      alternates: { canonical: `/assets-for-sale/${resolution.collection}` },
      openGraph: { type: "website", title },
    };
  }

  return {};
}

export default async function AssetsForSaleCatchAllPage({ params }: PageProps) {
  const { segments } = await params;
  const resolution = await resolve(segments);

  if (resolution.kind === "not_found") notFound();

  return (
    <>
      <Navbar />
      {resolution.kind === "listing" ? (
        <SaleListingView listingSlug={resolution.listingSlug} />
      ) : (
        <SaleLandingView resolution={resolution} />
      )}
    </>
  );
}
