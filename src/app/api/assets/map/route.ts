import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSearchParams } from "@/lib/search-params";
import { getMapMarkers } from "@/server/services/asset-service";

/**
 * GET /api/assets/map
 *
 * Markers for the current viewport. Returns aggregated clusters when zoomed out
 * and individual assets when zoomed in, so the payload stays bounded no matter
 * how large the inventory grows.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const params = parseSearchParams(url.searchParams);
    const markers = await getMapMarkers(params);
    return NextResponse.json(markers);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid map parameters", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/assets/map]", error);
    return NextResponse.json(
      { error: "Could not load map data." },
      { status: 500 },
    );
  }
}
