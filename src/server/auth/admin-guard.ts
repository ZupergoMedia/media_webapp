import { requireUser } from "./index";

/**
 * Admin authorization.
 *
 * A single chokepoint: every admin route and page calls `requireAdmin()`, so
 * the privilege check exists in exactly one place and cannot be forgotten on an
 * individual route.
 *
 * Two properties hold here:
 *
 *   1. The acting admin is resolved from the session, server-side. No route
 *      accepts a caller-supplied admin id — that would let anyone approve their
 *      own listings.
 *   2. Anything other than a signed-in ADMIN fails closed. There is no fallback
 *      to "the first admin in the database", which would silently grant admin
 *      powers to unauthenticated visitors.
 *
 * This is defence in depth. Middleware already blocks non-admins from /admin,
 * but the API routes are reachable independently and must not rely on it.
 */

export interface AdminIdentity {
  id: string;
  email: string;
  name: string | null;
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return null;

  return {
    id: auth.user.id,
    email: auth.user.email,
    name: auth.user.name ?? null,
  };
}

/**
 * Resolves the acting admin or explains why not.
 *
 * Returns a discriminated result rather than throwing so routes can map the
 * failure to a status code without a try/catch around every handler.
 */
export async function requireAdmin(): Promise<
  { ok: true; admin: AdminIdentity } | { ok: false; status: 401 | 403 }
> {
  const auth = await requireUser(["ADMIN"]);

  if (!auth.ok) {
    return {
      ok: false,
      status: auth.reason === "unauthenticated" ? 401 : 403,
    };
  }

  return {
    ok: true,
    admin: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name ?? null,
    },
  };
}
