import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requestSchema } from "@/lib/request-schema";
import { createRequest } from "@/server/services/request-service";
import { requireUser } from "@/server/auth";

/**
 * POST /api/requests
 *
 * Submits an availability request. This does not book anything: ZuperGo does
 * not control the inventory, so the media owner confirms out-of-band. See
 * request-service for why competing requests are allowed.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = requestSchema.parse(body);

    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json(
        { error: "Sign in to send your request." },
        { status: 401 },
      );
    }

    const outcome = await createRequest({
      assetSlug: input.assetSlug,
      advertiserId: auth.user.id,
      from: input.from,
      to: input.to,
      slotCount: input.slotCount,
      campaignName: input.campaignName,
      brandName: input.brandName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone || undefined,
      notes: input.notes,
      creativeNotes: input.creativeNotes,
    });

    if (outcome.ok) {
      return NextResponse.json(
        {
          reference: outcome.reference,
          estimatedTotal: outcome.estimatedTotal,
        },
        { status: 201 },
      );
    }

    const { failure } = outcome;
    switch (failure.kind) {
      case "asset_not_found":
        return NextResponse.json({ error: "Asset not found." }, { status: 404 });
      case "invalid_dates":
        return NextResponse.json({ error: failure.message }, { status: 400 });
      case "no_pricing":
        return NextResponse.json(
          { error: "This asset has no published pricing." },
          { status: 409 },
        );
      case "unavailable":
      case "duplicate":
        return NextResponse.json({ error: failure.message }, { status: 409 });
      default:
        return NextResponse.json({ error: failure.message }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check your request details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/requests]", error);
    return NextResponse.json(
      { error: "Could not send your request." },
      { status: 500 },
    );
  }
}
