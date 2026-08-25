import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

/**
 * Shown when the signed-in user cannot act as a media partner.
 *
 * Middleware already blocks unauthenticated requests to /owner, so reaching
 * this almost always means the user is signed in but has no company profile.
 * The message distinguishes that from a sign-in problem, because telling
 * someone to "sign in" when they already are is a dead end.
 */
export function OwnerAccessNotice({ error }: { error: string }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Media partner access required
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/explore">Browse inventory</Link>
          </Button>
          <Button asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
