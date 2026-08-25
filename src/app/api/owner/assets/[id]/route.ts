import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/server/db/client";
import { updateAssetSchema } from "@/lib/asset-schema";
import { buildSpecValidator } from "@/lib/specs";
import { updateAsset } from "@/server/services/owner-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * PATCH /api/owner/assets/:id
 *
 * Updates a listing the signed-in partner owns.
 *
 * Validation mirrors creation exactly: fixed fields against the shared schema,
 * then type-specific specs against a validator compiled from that type's own
 * descriptors. The asset type itself is not editable — it determines the spec
 * schema and booking model, so changing it would invalidate the stored specs.
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
    const input = updateAssetSchema.parse(body);

    // Ownership comes from the session, never the request.
    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    // Scoped read: the type is taken from the stored asset, not the payload,
    // so a caller cannot validate their specs against a different type's rules.
    const asset = await prisma.asset.findFirst({
      where: { id, ownerId: owner.id },
      select: {
        id: true,
        type: {
          select: { specSchema: true, isDigital: true, isMobile: true },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const specValidator = buildSpecValidator(asset.type.specSchema);
    const specResult = specValidator.safeParse(input.specs);

    if (!specResult.success) {
      return NextResponse.json(
        {
          error: "Please check the specification fields.",
          issues: specResult.error.issues,
        },
        { status: 400 },
      );
    }

    if (asset.type.isDigital && !input.digital) {
      return NextResponse.json(
        { error: "Digital assets require slot and loop details." },
        { status: 400 },
      );
    }

    if (asset.type.isMobile && !input.operatingAreas?.length) {
      return NextResponse.json(
        { error: "Mobile assets require at least one operating area." },
        { status: 400 },
      );
    }

    const result = await updateAsset(owner.id, id, {
      title: input.title,
      description: input.description,
      specs: specResult.data,
      dailyImpressions: input.dailyImpressions,
      audienceProfile: input.audienceProfile,
      location: {
        ...input.location,
        pincode: input.location.pincode || undefined,
      },
      images: input.images,
      // Rupees in the form, paise in storage — converted once, here.
      pricing: input.pricing.map((price) => ({
        ...price,
        amount: Math.round(price.amount * 100),
      })),
      blackouts: input.blackouts,
      digital: input.digital
        ? {
            ...input.digital,
            // Derived rather than asked for: the partner already supplied both
            // durations, and asking again invites contradictory answers.
            slotsPerLoop: Math.max(
              1,
              Math.floor(
                input.digital.loopDurationSeconds /
                  input.digital.slotDurationSeconds,
              ),
            ),
          }
        : undefined,
      operatingAreas: input.operatingAreas,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    return NextResponse.json({
      id,
      // Lets the client warn that a live listing has gone back for review.
      requiresReverification: result.requiresReverification,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check the listing details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/owner/assets/:id PATCH]", error);
    return NextResponse.json(
      { error: "Could not save your changes." },
      { status: 500 },
    );
  }
}
