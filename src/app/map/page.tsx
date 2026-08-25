import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import {
  getCitiesWithInventory,
  getTaxonomy,
} from "@/server/services/asset-service";
import { MapClient } from "./map-client";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Browse every verified advertising asset on ZuperGo geographically — billboards, digital screens, transit media and venues across Mumbai.",
  alternates: { canonical: "/map" },
  openGraph: {
    title: "Advertising inventory map · ZuperGo",
    description:
      "See verified out-of-home advertising inventory on a full-screen map, filtered by city, category and media type.",
  },
};

/**
 * Full-screen map view.
 *
 * Taxonomy is fetched on the server so the filter sidebar renders populated on
 * first paint. Markers are client-fetched because they follow the viewport.
 */
export default async function MapPage() {
  const [taxonomy, cities] = await Promise.all([
    getTaxonomy(),
    getCitiesWithInventory(),
  ]);

  return (
    <>
      <Navbar />
      <Suspense fallback={<MapFallback />}>
        <MapClient taxonomy={taxonomy} cities={cities} />
      </Suspense>
    </>
  );
}

/** useSearchParams requires a Suspense boundary during prerender. */
function MapFallback() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-surface-muted">
      <p className="text-sm text-muted-foreground">Loading map…</p>
    </div>
  );
}
