import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { authConfig } from "./config";

/**
 * Node-runtime authentication.
 *
 * Imports Prisma and bcrypt, so this module must never be pulled into
 * middleware — see config.ts for the Edge-safe half.
 */

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Cost factor for password hashing.
 *
 * 12 is the current sensible default: roughly 250ms per hash on typical
 * hardware, which is slow enough to make offline brute-forcing expensive
 * without making sign-in feel sluggish.
 */
export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A bcrypt hash of a throwaway value, used to equalise timing when an account
 * does not exist.
 *
 * Without this, a missing email returns in ~1ms while a wrong password takes
 * ~250ms — a timing oracle that lets an attacker enumerate which addresses are
 * registered. Comparing against this dummy hash keeps both paths similar.
 */
const TIMING_EQUALISER_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6KsX3vBiG9tRVCEYQVFrO/K/QMHLKGy";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  adapter: PrismaAdapter(prisma),

  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * Verifies credentials.
       *
       * Returns null for every failure mode — unknown email, no password set,
       * wrong password — so the response never reveals which one occurred.
       * Distinguishing them would tell an attacker which addresses exist.
       */
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
          },
        });

        // Always run a comparison, even with no user, to keep timing flat.
        const hash = user?.passwordHash ?? TIMING_EQUALISER_HASH;
        const valid = await verifyPassword(password, hash);

        if (!user || !user.passwordHash || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});

/**
 * The signed-in user, or null.
 *
 * Every server component and route handler that needs identity goes through
 * here rather than reading the session directly, so the shape stays consistent.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Requires a signed-in user with one of the given roles.
 *
 * Returns a discriminated result instead of throwing, so callers can map the
 * outcome to a redirect or a status code without a try/catch.
 *
 * This is defence in depth: middleware already blocks unauthorised requests to
 * protected prefixes, but middleware cannot express per-record ownership, and a
 * new route added outside a protected prefix would otherwise be unguarded.
 */
export async function requireUser(roles?: Array<"ADVERTISER" | "MEDIA_PARTNER" | "ADMIN">) {
  const user = await getCurrentUser();

  if (!user) return { ok: false as const, reason: "unauthenticated" as const };

  if (roles && !roles.includes(user.role)) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  return { ok: true as const, user };
}
