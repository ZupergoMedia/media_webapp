import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { saleEnquirySchema } from "@/lib/sale-schema";
import { createSaleEnquiry } from "@/server/services/sale-enquiry-service";

/**
 * POST /api/sales/enquiries
 *
 * Public, no login required — the product requirement is that browsing AND
 * enquiring need no account. The response never includes the seller's
 * contact details: the whole point of an enquiry, rather than exposing the
 * seller's phone/email on the listing, is that the seller chooses whether to
 * respond. See sale-enquiry-service.ts for the rate-limit mitigations this
 * codebase can actually support today.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = saleEnquirySchema.parse(body);

    // Best-effort client IP for the rate-limit checks only — never stored
    // unhashed, and never trusted as an identity signal beyond that.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    const outcome = await createSaleEnquiry({ ...input, ip });

    if (outcome.ok) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const { failure } = outcome;
    switch (failure.kind) {
      case "listing_not_found":
        return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      case "rate_limited":
        return NextResponse.json({ error: failure.message }, { status: 429 });
      case "duplicate":
        return NextResponse.json({ error: failure.message }, { status: 409 });
      default:
        return NextResponse.json(
          { error: "Could not send your enquiry." },
          { status: 500 },
        );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check your enquiry details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/sales/enquiries]", error);
    return NextResponse.json(
      { error: "Could not send your enquiry." },
      { status: 500 },
    );
  }
}
