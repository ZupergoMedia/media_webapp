import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { getTaxonomy } from "@/server/services/asset-service";
import { getSaleCities } from "@/server/services/sale-listing-service";
import { SaleBrowseClient } from "./sale-browse-client";

export const metadata: Metadata = {
  title: "Assets for sale",
  description:
    "Browse outdoor media assets for sale — billboards, digital screens, transit media and venue advertising rights. No login required.",
  openGraph: {
    title: "Assets for sale · ZuperGo",
    description:
      "Browse outdoor media assets for sale across India, from billboards to digital screens.",
  },
};

/**
 * Public sale marketplace index.
 *
 * Taxonomy and cities load server-side so the filter bar renders populated
 * on first paint, matching the /explore pattern. Results are client-fetched
 * so filter changes never require a full navigation.
 */
export default async function AssetsForSalePage() {
  const [taxonomy, cities] = await Promise.all([getTaxonomy(), getSaleCities()]);

  return (
    <>
      <Navbar />
      <Suspense fallback={<SaleBrowseFallback />}>
        <SaleBrowseClient taxonomy={taxonomy} cities={cities} />
      </Suspense>
    </>
  );
}

function SaleBrowseFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-surface-muted">
      <p className="text-sm text-muted-foreground">Loading listings…</p>
    </div>
  );
}
