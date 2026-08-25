import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

/**
 * Shown when the visitor cannot act as an administrator.
 *
 * Distinguishes "not signed in" from "signed in without permission": telling
 * someone to sign in when they already have is a dead end, and confirming that
 * an admin area exists to a non-admin is more information than they need.
 */
export function AdminAccessNotice({ status }: { status: 401 | 403 }) {
  const unauthenticated = status === 401;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {unauthenticated ? "Sign in required" : "Not available"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {unauthenticated
            ? "Sign in with an administrator account to continue."
            : "Your account does not have access to this area."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/">Go home</Link>
          </Button>
          {unauthenticated && (
            <Button asChild>
              <Link href="/signin?callbackUrl=/admin">Sign in</Link>
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
