import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSaleListingDrift } from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * POST /api/owner/sales/:id/sync
 *
 * Resolves a drift flag: "accept" re-snapshots from the current Asset,
 * "dismiss" clears the flag without touching the snapshot. Never applied
 * automatically — see the AFTER UPDATE trigger in migration 0006 and
 * resolveSaleListingDrift for why a human always decides.
 */
const bodySchema = z.object({
  resolution: z.enum(["accept", "dismiss"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { resolution } = bodySchema.parse(body);

    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    const outcome = await resolveSaleListingDrift(owner.id, id, resolution);

    if (outcome.ok) {
      return NextResponse.json(outcome.value);
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
      return NextResponse.json({ error: "Invalid resolution value." }, { status: 400 });
    }

    console.error("[api/owner/sales/sync]", error);
    return NextResponse.json(
      { error: "Could not update the listing." },
      { status: 500 },
    );
  }
}
