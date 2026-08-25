import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateSaleListingSchema } from "@/lib/sale-schema";
import { updateSaleListing } from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * PATCH /api/owner/sales/:id
 *
 * Updates the seller-editable terms of a listing. Never touches the
 * underlying Asset or a published listing's snapshot — see the doc comment
 * on updateSaleListing.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = updateSaleListingSchema.parse(body);

    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    const outcome = await updateSaleListing(owner.id, id, {
      ...input,
      askingPrice: Math.round(input.askingPrice * 100),
    });

    if (outcome.ok) {
      return NextResponse.json(outcome.value);
    }

    if (outcome.failure.kind === "not_found") {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Could not update the listing." },
      { status: 500 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check the listing details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/owner/sales/id]", error);
    return NextResponse.json(
      { error: "Could not update the listing." },
      { status: 500 },
    );
  }
}
