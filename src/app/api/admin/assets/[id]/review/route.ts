import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin-guard";
import { reviewAsset } from "@/server/services/admin-service";

/**
 * POST /api/admin/assets/:id/review
 *
 * Approves, rejects or suspends a listing. Approval is what makes an asset
 * publicly searchable, so the acting admin is resolved server-side and never
 * taken from the request body.
 */
const bodySchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED", "SUSPENDED"]),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 401
            ? "Sign in to continue."
            : "Administrator access required.",
      },
      { status: auth.status },
    );
  }

  try {
    const body = await request.json();
    const { decision, notes } = bodySchema.parse(body);

    const result = await reviewAsset({
      assetId: id,
      reviewerId: auth.admin.id,
      decision,
      notes,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      }
      if (result.reason === "reason_required") {
        return NextResponse.json(
          { error: "Explain the decision so the owner can act on it." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "Could not record the decision." }, { status: 500 });
    }

    return NextResponse.json({ id, decision });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    }

    console.error("[api/admin/assets/review]", error);
    return NextResponse.json({ error: "Could not record the decision." }, { status: 500 });
  }
}
