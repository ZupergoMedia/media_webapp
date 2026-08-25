import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCitiesWithInventory,
  getTaxonomy,
} from "@/server/services/asset-service";
import { Navbar } from "@/components/layout/navbar";
import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore advertising sites",
  description:
    "Browse and compare verified billboards, digital screens, transit media and venues. Filter by city, category, media type and budget.",
  openGraph: {
    title: "Explore advertising sites · ZuperGo",
    description:
      "Browse and compare verified out-of-home advertising inventory across Mumbai.",
  },
};

/**
 * Taxonomy is fetched on the server so the filter bar renders populated on
 * first paint rather than flashing empty. Results are client-fetched so filter
 * changes do not require a full page navigation.
 */
export default async function ExplorePage() {
  const [taxonomy, cities] = await Promise.all([
    getTaxonomy(),
    getCitiesWithInventory(),
  ]);

  return (
    <>
      <Navbar />
      <Suspense fallback={<ExploreFallback />}>
        <ExploreClient taxonomy={taxonomy} cities={cities} />
      </Suspense>
    </>
  );
}

/** useSearchParams requires a Suspense boundary during prerender. */
function ExploreFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-surface-muted">
      <p className="text-sm text-muted-foreground">Loading inventory…</p>
    </div>
  );
}
