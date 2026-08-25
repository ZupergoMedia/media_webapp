import { NextResponse } from "next/server";
import { getCitiesWithInventory, getTaxonomy } from "@/server/services/asset-service";

/**
 * GET /api/taxonomy
 *
 * Categories, asset types and cities that have live inventory. The filter panel
 * renders entirely from this, so new media types appear without a deploy.
 */
export async function GET() {
  try {
    const [categories, cities] = await Promise.all([
      getTaxonomy(),
      getCitiesWithInventory(),
    ]);
    return NextResponse.json({ categories, cities });
  } catch (error) {
    console.error("[api/taxonomy]", error);
    return NextResponse.json(
      { error: "Could not load filters." },
      { status: 500 },
    );
  }
}
