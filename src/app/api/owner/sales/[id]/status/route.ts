import { NextResponse } from "next/server";
import { z } from "zod";
import {
  publishSaleListing,
  updateSaleListingStatus,
} from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * PATCH /api/owner/sales/:id/status
 *
 * Submit, pause, resume, or withdraw a listing.
 *
 * "SUBMITTED" auto-publishes in this phase — there is no admin review gate
 * yet (see the "auto-publish, no badges" decision), so submitting a listing
 * takes it straight to PUBLISHED. Nothing here sets a verified badge: the
 * listing renders "Seller-declared" throughout regardless of status.
 */
const bodySchema = z.object({
  status: z.enum(["SUBMITTED", "PAUSED", "PUBLISHED", "WITHDRAWN"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { status } = bodySchema.parse(body);

    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    const outcome =
      status === "SUBMITTED" || status === "PUBLISHED"
        ? await publishSaleListing(owner.id, id)
        : await updateSaleListingStatus(owner.id, id, status);

    if (outcome.ok) {
      return NextResponse.json({ id, status: status === "SUBMITTED" ? "PUBLISHED" : status });
    }

    const { failure } = outcome;
    switch (failure.kind) {
      case "not_found":
        return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      case "invalid_transition":
        return NextResponse.json({ error: failure.message }, { status: 409 });
      default:
        return NextResponse.json(
          { error: "Could not update the listing." },
          { status: 500 },
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    console.error("[api/owner/sales/status]", error);
    return NextResponse.json(
      { error: "Could not update the listing." },
      { status: 500 },
    );
  }
}
