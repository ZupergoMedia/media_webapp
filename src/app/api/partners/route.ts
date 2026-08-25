import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/server/db/client";
import { hashPassword, getCurrentUser } from "@/server/auth";
import { partnerRegistrationSchema } from "@/lib/partner-schema";

/**
 * POST /api/partners
 *
 * Registers a media partner: creates the account and the company profile in one
 * step, so a new partner is never left with an account that cannot list
 * anything — the dead end this endpoint exists to remove.
 *
 * Also handles the case where someone already signed in as an advertiser wants
 * to list inventory: their existing account is upgraded rather than duplicated.
 */

/** Slug from the company name, with a short suffix to avoid collisions. */
function buildSlug(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const input = partnerRegistrationSchema.parse(body);
    const email = input.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, mediaOwner: { select: { id: true } } },
    });

    // Signed in already? Upgrade that account rather than creating a second one.
    const currentUser = await getCurrentUser();

    if (existingUser && existingUser.mediaOwner) {
      return NextResponse.json(
        {
          error:
            "That email is already registered as a media partner. Sign in instead.",
        },
        { status: 409 },
      );
    }

    if (existingUser && currentUser?.id !== existingUser.id) {
      // The address belongs to someone else's account. Deliberately does not
      // confirm whether a password would work — that would let anyone probe
      // for registered addresses.
      return NextResponse.json(
        {
          error:
            "That email is already in use. Sign in to add a company profile to your account.",
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { role: "MEDIA_PARTNER", name: input.name },
            select: { id: true, email: true },
          })
        : await tx.user.create({
            data: {
              email,
              name: input.name,
              role: "MEDIA_PARTNER",
              passwordHash: await hashPassword(input.password),
            },
            select: { id: true, email: true },
          });

      const partner = await tx.mediaOwner.create({
        data: {
          userId: user.id,
          companyName: input.companyName,
          slug: buildSlug(input.companyName),
          partnerType: input.partnerType,
          city: input.city,
          state: input.state,
          contactName: input.name,
          contactEmail: user.email,
          contactPhone: input.contactPhone,
          website: input.website || undefined,
          description: input.description,
          // Partners start unverified. Their listings are separately verified
          // too, so nothing reaches advertisers on an unchecked account.
          verificationStatus: "PENDING",
        },
        select: { id: true, slug: true, companyName: true },
      });

      // Opens the admin review queue entry for the account itself.
      await tx.verification.create({
        data: {
          ownerId: partner.id,
          status: "PENDING",
          notes: `Partner registration (${input.partnerType.toLowerCase()}).`,
        },
      });

      return { userId: user.id, partner };
    });

    return NextResponse.json(
      {
        partnerId: result.partner.id,
        companyName: result.partner.companyName,
        // Tells the client whether to sign the user in before continuing.
        requiresSignIn: !currentUser,
        email,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check your details.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[api/partners]", error);
    return NextResponse.json(
      { error: "Could not complete registration." },
      { status: 500 },
    );
  }
}
