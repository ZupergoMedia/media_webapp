"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side session context.
 *
 * Required by `signIn()` / `signOut()` from next-auth/react. Server components
 * read the session directly via `auth()` and do not depend on this — it exists
 * only so the sign-in form and user menu can act on the session.
 */
export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
