import type { NextAuthConfig } from "next-auth";
// Imported for its side effect: the module must be loaded for the `declare
// module "next-auth/jwt"` augmentation below to resolve.
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Auth configuration shared by the middleware and the Node runtime.
 *
 * Split deliberately: Next's middleware runs on the Edge runtime, which cannot
 * load Prisma or bcrypt. This module contains only what is safe there —
 * callbacks, page paths, and session shape. The Credentials provider and the
 * Prisma adapter live in `index.ts`, which is Node-only.
 *
 * Getting this wrong produces a build that succeeds and then fails at runtime
 * on the first middleware invocation, so the boundary is worth preserving.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}

/** Routes that require a signed-in user, with the roles allowed on each. */
export const PROTECTED_ROUTES: Array<{
  prefix: string;
  roles: UserRole[];
}> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/owner", roles: ["MEDIA_PARTNER", "ADMIN"] },
  { prefix: "/requests", roles: ["ADVERTISER", "MEDIA_PARTNER", "ADMIN"] },
];

/** Finds the rule guarding a path, if any. */
export function matchProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.find(
    (route) =>
      pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
}

export const authConfig = {
  /**
   * Empty here by necessity: the Credentials provider needs Prisma and bcrypt,
   * which cannot load on the Edge runtime. `index.ts` spreads this config and
   * supplies the real provider for the Node runtime. Middleware only reads the
   * session cookie, so it needs no provider at all.
   */
  providers: [],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  session: {
    // JWT rather than database sessions: the middleware must read the session
    // on the Edge runtime, where a database round trip is not possible.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    /**
     * Copies identity onto the token at sign-in.
     *
     * `user` is only present on the first call. Afterwards the token is passed
     * through untouched, so role changes take effect on next sign-in rather
     * than mid-session — acceptable, and far cheaper than re-reading the
     * database on every request.
     */
    jwt({ token, user }: { token: JWT; user?: { id?: string; role?: UserRole } }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    /** Projects the token onto the session object the app consumes. */
    session({ session, token }: { session: Session; token: JWT }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },

    /**
     * Route authorization, evaluated by middleware on every matching request.
     *
     * Returning false redirects to the sign-in page. This is the outer gate —
     * pages and API routes still check their own permissions, because
     * middleware alone cannot express per-record ownership.
     */
    authorized({ auth, request }) {
      const rule = matchProtectedRoute(request.nextUrl.pathname);
      if (!rule) return true;

      const role = auth?.user?.role;
      if (!role) return false;

      return rule.roles.includes(role);
    },
  },

  trustHost: true,
} satisfies NextAuthConfig;
