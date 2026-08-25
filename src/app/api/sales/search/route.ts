import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSaleSearchParams } from "@/lib/sale-search-params";
import { searchSaleListingSummaries } from "@/server/services/sale-listing-service";

/**
 * GET /api/sales/search
 *
 * Public, no login required. Paginated sale-listing search — mirrors
 * /api/assets/search but against SaleListing, and only ever returns the
 * public/snapshot columns (see sale-listing-service.ts for the enforcement
 * point).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const params = parseSaleSearchParams(url.searchParams);
    const result = await searchSaleListingSummaries(params);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid search parameters", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/sales/search]", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
