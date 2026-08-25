import { NextResponse } from "next/server";
import { z } from "zod";
import { respondToRequest, withdrawRequest } from "@/server/services/request-service";
import { requireUser } from "@/server/auth";

/**
 * POST /api/requests/:reference/respond
 *
 * The owner confirms or declines, or the advertiser withdraws.
 *
 * Confirmation is the moment inventory is actually claimed — until then the
 * dates remain open to other advertisers.
 */
const bodySchema = z.object({
  response: z.enum(["CONFIRMED", "DECLINED", "WITHDRAWN"]),
  message: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  const { reference } = await context.params;

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const { response, message } = bodySchema.parse(await request.json());

    // Withdrawal is the advertiser's own action and needs no owner rights.
    if (response === "WITHDRAWN") {
      const done = await withdrawRequest(reference, auth.user.id);
      return done
        ? NextResponse.json({ reference, status: "WITHDRAWN" })
        : NextResponse.json(
            { error: "That request cannot be withdrawn." },
            { status: 404 },
          );
    }

    const result = await respondToRequest({
      reference,
      ownerUserId: auth.user.id,
      response,
      message,
    });

    if (result.ok) return NextResponse.json({ reference, status: response });

    switch (result.reason) {
      case "not_found":
        // Reported as missing rather than forbidden: confirming a reference
        // exists would let anyone probe for valid ones.
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      case "already_answered":
        return NextResponse.json(
          { error: "You have already responded to this request." },
          { status: 409 },
        );
      case "reason_required":
        return NextResponse.json(
          { error: "Tell the advertiser why, so they know what to do next." },
          { status: 400 },
        );
      case "already_confirmed_elsewhere":
        return NextResponse.json(
          {
            error:
              "Another request for these dates was confirmed first. This one cannot also be confirmed.",
          },
          { status: 409 },
        );
      default:
        return NextResponse.json(
          { error: "Could not record your response." },
          { status: 500 },
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid response." }, { status: 400 });
    }

    console.error("[api/requests/respond]", error);
    return NextResponse.json(
      { error: "Could not record your response." },
      { status: 500 },
    );
  }
}
