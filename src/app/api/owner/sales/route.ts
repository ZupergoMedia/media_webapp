import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSaleListingSchema } from "@/lib/sale-schema";
import { createSaleListing } from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * POST /api/owner/sales
 *
 * Creates a DRAFT sale listing for an existing asset the owner controls.
 * Ownership comes from the session, never from the request body — see
 * requireOwner.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = createSaleListingSchema.parse(body);

    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    const outcome = await createSaleListing(owner.id, {
      ...input,
      // Rupees in the form, paise in storage — converted once, here.
      askingPrice: Math.round(input.askingPrice * 100),
    });

    if (outcome.ok) {
      return NextResponse.json(outcome.value, { status: 201 });
    }

    const { failure } = outcome;
    switch (failure.kind) {
      case "asset_not_found":
        return NextResponse.json(
          { error: "Choose one of your own active or paused assets." },
          { status: 404 },
        );
      case "asset_already_listed":
        return NextResponse.json(
          { error: "This asset already has an active sale listing." },
          { status: 409 },
        );
      default:
        return NextResponse.json(
          { error: "Could not create the listing." },
          { status: 500 },
        );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check the listing details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/owner/sales]", error);
    return NextResponse.json(
      { error: "Could not create the listing." },
      { status: 500 },
    );
  }
}
