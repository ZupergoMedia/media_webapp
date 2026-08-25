import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser } from "@/server/auth";
import { getOwnerForUser } from "@/server/services/owner-service";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Become a media partner",
  description:
    "List your billboards, digital screens, vehicles or venue space on ZuperGo. Free to join, whether you own the media or manage it for someone else.",
  alternates: { canonical: "/partners/join" },
};

export const dynamic = "force-dynamic";

/**
 * Media partner registration.
 *
 * Anyone who already has a partner profile is sent straight to the listing
 * wizard — registering twice is never what they meant, and bouncing them to a
 * form they have already completed is the kind of dead end this flow replaces.
 */
export default async function PartnerJoinPage() {
  const user = await getCurrentUser();

  if (user) {
    const existing = await getOwnerForUser(user.id);
    if (existing) redirect("/owner/assets/new");
  }

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Become a media partner
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            List billboards, screens, vehicles or venue space — whether you own
            the media or manage it for someone else. Free to join, and you stay
            in control of every booking.
          </p>
        </div>

        <JoinForm
          signedInEmail={user?.email}
          signedInName={user?.name}
        />
      </main>
    </>
  );
}
