import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/server/db/client";
import { createAssetSchema } from "@/lib/asset-schema";
import { buildSpecValidator } from "@/lib/specs";
import { createAsset } from "@/server/services/owner-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * POST /api/owner/assets
 *
 * Creates a listing in PENDING verification.
 *
 * Specification validation is two-stage: the fixed fields are checked by
 * `createAssetSchema`, then the type-specific fields are checked against a
 * validator compiled from that type's own descriptors. The server never trusts
 * the client's idea of which fields are required — that lives in the database.
 */

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = createAssetSchema.parse(body);

    // Ownership comes from the session, never from the request body.
    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }
    const { owner } = ownerAuth;

    const type = await prisma.assetType.findUnique({
      where: { id: input.typeId },
      select: { id: true, specSchema: true, isDigital: true, isMobile: true },
    });

    if (!type) {
      return NextResponse.json({ error: "Unknown asset type." }, { status: 400 });
    }

    // Stage two: validate specs against this type's descriptors.
    const specValidator = buildSpecValidator(type.specSchema);
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

    // Digital assets must declare slot economics, or the booking engine has no
    // capacity to count against and DIGITAL_SLOT bookings become unbounded.
    if (type.isDigital && !input.digital) {
      return NextResponse.json(
        { error: "Digital assets require slot and loop details." },
        { status: 400 },
      );
    }

    // Mobile assets need coverage: a base point alone would make them
    // undiscoverable in the area searches that actually sell them.
    if (type.isMobile && !input.operatingAreas?.length) {
      return NextResponse.json(
        { error: "Mobile assets require at least one operating area." },
        { status: 400 },
      );
    }

    const asset = await createAsset({
      ownerId: owner.id,
      typeId: type.id,
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
            // Derived rather than asked for: the owner already gave both
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

    return NextResponse.json(
      {
        id: asset.id,
        slug: asset.slug,
        status: asset.status,
        verificationStatus: asset.verificationStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check the listing details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/owner/assets]", error);
    return NextResponse.json(
      { error: "Could not create the listing." },
      { status: 500 },
    );
  }
}
