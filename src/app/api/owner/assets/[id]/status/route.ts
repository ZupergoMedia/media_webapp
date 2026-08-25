import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAssetStatus } from "@/server/services/owner-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * PATCH /api/owner/assets/:id/status
 *
 * Pause, resume or archive a listing.
 *
 * Only listing status is settable here. Verification status is admin-only —
 * allowing an owner to set it would let anyone self-verify and defeat the whole
 * trust model.
 */
const bodySchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
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

    // Scoped by ownerId inside the service, so a mismatched id simply affects
    // no rows rather than touching someone else's listing.
    const updated = await updateAssetStatus(owner.id, id, status);

    if (!updated) {
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ id, status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid status value." },
        { status: 400 },
      );
    }

    console.error("[api/owner/assets/status]", error);
    return NextResponse.json(
      { error: "Could not update the listing." },
      { status: 500 },
    );
  }
}
