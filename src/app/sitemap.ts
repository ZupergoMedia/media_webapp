import type { MetadataRoute } from "next";
import { prisma } from "@/server/db/client";
import { POSTS } from "@/content/blog";
import { citySlug } from "@/lib/sale-routes";
import { appUrl } from "@/lib/env";

/**
 * Sitemap.
 *
 * Without one, search engines had no discovery path into individual asset,
 * listing or blog pages — they are only reachable through client-fetched
 * search results, which a crawler does not execute. Static pages could be
 * found by following nav links; the long tail could not.
 *
 * Deliberately excludes /admin, /owner and /requests (see PROTECTED_ROUTES
 * in server/auth/config.ts) — they are behind auth and carry
 * `robots: noindex` of their own.
 *
 * Regenerated hourly rather than per request: the query touches every
 * published asset and listing, which is too much work for a crawler hit,
 * and inventory does not change minute to minute.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/assets-for-sale`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/map`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${appUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${appUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${appUrl}/for-advertisers`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/for-media-partners`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${appUrl}/partners/join`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = POSTS.map((post) => ({
    url: `${appUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  // Only publicly visible records. Mirrors the search predicates exactly, so
  // the sitemap can never advertise a page that returns a 404.
  const [assets, listings] = await Promise.all([
    prisma.asset.findMany({
      where: { status: "ACTIVE", verificationStatus: "VERIFIED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.saleListing.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true, publicCity: true },
    }),
  ]);

  const assetRoutes: MetadataRoute.Sitemap = assets.map((asset) => ({
    url: `${appUrl}/assets/${asset.slug}`,
    lastModified: asset.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Sale listings use the city-scoped canonical form the detail page sets,
  // so the sitemap and the canonical tag agree.
  const listingRoutes: MetadataRoute.Sitemap = listings
    .filter((listing) => listing.publicCity)
    .map((listing) => ({
      url: `${appUrl}/assets-for-sale/${citySlug(listing.publicCity as string)}/${listing.slug}`,
      lastModified: listing.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  // City landing pages, one per city with live sale inventory.
  const cities = [
    ...new Set(
      listings
        .map((listing) => listing.publicCity)
        .filter((city): city is string => Boolean(city)),
    ),
  ];

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${appUrl}/assets-for-sale/${citySlug(city)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...cityRoutes,
    ...assetRoutes,
    ...listingRoutes,
  ];
}
