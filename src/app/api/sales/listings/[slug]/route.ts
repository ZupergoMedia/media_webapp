import { NextResponse } from "next/server";
import { getSaleListingBySlug } from "@/server/services/sale-listing-service";

/**
 * GET /api/sales/listings/:slug
 *
 * Public detail fetch, used by the client-side compare view. The server
 * component detail page (assets-for-sale/[...segments]) calls the service
 * directly instead of this route — this exists for surfaces that need the
 * data client-side without a full page navigation.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  try {
    const listing = await getSaleListingBySlug(slug);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error("[api/sales/listings/slug]", error);
    return NextResponse.json(
      { error: "Could not load the listing." },
      { status: 500 },
    );
  }
}
