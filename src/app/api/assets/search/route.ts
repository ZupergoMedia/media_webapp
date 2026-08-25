import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSearchParams } from "@/lib/search-params";
import { searchAssetSummaries } from "@/server/services/asset-service";

/**
 * GET /api/assets/search
 *
 * Paginated inventory search. Every filter is validated by the shared schema, so
 * a malformed query returns a precise 400 rather than a 500 from deep inside a
 * SQL call.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const params = parseSearchParams(url.searchParams);
    const result = await searchAssetSummaries(params);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid search parameters", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/assets/search]", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
