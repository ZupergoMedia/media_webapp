import Link from "next/link";
import { SaleListingCard } from "@/components/sales/sale-listing-card";
import { getSaleLandingListings } from "@/server/services/sale-listing-service";
import { SALE_COLLECTIONS, citySlug, type SaleRouteResolution } from "@/lib/sale-routes";

/**
 * SEO landing body — national index, curated collection, city, or city+type.
 *
 * Separate from SaleListingView purely to keep the catch-all page.tsx a thin
 * resolver + dispatcher. These are the pages that make the sale marketplace
 * SEO-friendly per the product spec's example URLs
 * (/assets-for-sale/mumbai/billboards).
 */
export async function SaleLandingView({
  resolution,
}: {
  resolution: SaleRouteResolution;
}) {
  if (resolution.kind === "national") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Assets for sale</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse outdoor media assets for sale by city, or explore a curated
          collection below.
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {SALE_COLLECTIONS.map((collection) => (
            <li key={collection.slug}>
              <Link
                href={`/assets-for-sale/${collection.slug}`}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
              >
                {collection.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm">
          <Link href="/assets-for-sale" className="text-brand hover:underline">
            View the full marketplace →
          </Link>
        </p>
      </main>
    );
  }

  if (resolution.kind === "collection") {
    const collection = SALE_COLLECTIONS.find((c) => c.slug === resolution.collection);
    const listings = await getSaleLandingListings(
      undefined,
      collection ? [...collection.typeSlugs] : undefined,
    );

    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {collection?.label ?? "Assets for sale"}
        </h1>
        <ListingGrid listings={listings} />
      </main>
    );
  }

  // Only "city" and "city_type" remain — the dispatcher (page.tsx) already
  // calls notFound() for "not_found" before this component renders, and
  // "listing" is routed to SaleListingView instead. This guard makes that
  // invariant checkable by the type system rather than merely assumed.
  if (resolution.kind !== "city" && resolution.kind !== "city_type") {
    return null;
  }

  const listings = await getSaleLandingListings(
    resolution.city,
    resolution.kind === "city_type" ? [resolution.typeSlug] : undefined,
  );

  const cityLabel = resolution.city
    .split("-")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {resolution.kind === "city_type"
          ? `${resolution.typeSlug.replace(/-/g, " ")} for sale in ${cityLabel}`
          : `Outdoor media assets for sale in ${cityLabel}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {listings.length} {listings.length === 1 ? "listing" : "listings"}
      </p>

      <ListingGrid listings={listings} />
    </main>
  );
}

function ListingGrid({
  listings,
}: {
  listings: Awaited<ReturnType<typeof getSaleLandingListings>>;
}) {
  if (listings.length === 0) {
    return (
      <p className="mt-8 rounded-card border border-dashed border-border-strong bg-surface p-12 text-center text-sm text-muted-foreground">
        No listings here yet. Check back soon, or{" "}
        <Link href="/assets-for-sale" className="text-brand hover:underline">
          browse the full marketplace
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing, index) => (
        <SaleListingCard key={listing.id} listing={listing} priority={index < 4} />
      ))}
    </div>
  );
}

// Re-export for the resolver page's use in generateMetadata's city segment.
export { citySlug };
