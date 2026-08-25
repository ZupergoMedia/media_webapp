import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authConfig } from "@/server/auth/config";

/**
 * Route protection at the edge.
 *
 * Built from `authConfig` alone — no Prisma, no bcrypt — because middleware
 * runs on the Edge runtime where those cannot load. The `authorized` callback
 * in that config decides access; see src/server/auth/config.ts.
 *
 * This is the outer gate only. Pages and API routes still enforce their own
 * permissions, since middleware cannot check whether a specific record belongs
 * to the signed-in user.
 */
const { auth } = NextAuth(authConfig);

/**
 * Exported as an explicit function rather than
 * `export const { auth: middleware } = ...`.
 *
 * Next 16 detects the middleware export by static analysis, and a destructuring
 * pattern is invisible to it — the file loads, logs a warning, and every route
 * silently becomes unprotected. This shape is verifiable at build time.
 */
export default function middleware(request: NextRequest) {
  // The typings model `auth` as an overloaded handler factory; called directly
  // with a request it returns the middleware response.
  return (auth as unknown as (req: NextRequest) => Promise<Response>)(request);
}

export const config = {
  /**
   * Skip static assets and Next internals. Auth endpoints are excluded too —
   * guarding them would make signing in impossible.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
