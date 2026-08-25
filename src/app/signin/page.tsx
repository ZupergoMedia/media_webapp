import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser } from "@/server/auth";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Already signed in — no reason to show the form again.
  const user = await getCurrentUser();
  if (user) redirect("/");

  /**
   * Demo credentials are surfaced only outside production, and only when the
   * seed password is actually configured. Printing them on a live deployment
   * would hand out working accounts to anyone who loaded the page.
   */
  const demoHint =
    process.env.NODE_ENV !== "production"
      ? process.env.SEED_DEMO_PASSWORD
      : undefined;

  return (
    <>
      <Navbar />

      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to ZuperGo
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Book advertising inventory, or manage the media you own.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-6">
          <Suspense fallback={<FormFallback />}>
            <SignInForm demoHint={demoHint} />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Browsing without an account?{" "}
          <Link href="/explore" className="underline underline-offset-4">
            Explore inventory
          </Link>
        </p>
      </main>
    </>
  );
}

/** useSearchParams requires a Suspense boundary during prerender. */
function FormFallback() {
  return (
    <div className="space-y-4">
      <div className="h-16 animate-pulse rounded bg-surface-sunken" />
      <div className="h-16 animate-pulse rounded bg-surface-sunken" />
      <div className="h-11 animate-pulse rounded bg-surface-sunken" />
    </div>
  );
}
