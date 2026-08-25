import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Inbox,
  ShieldCheck,
  Store,
  Upload,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getTaxonomy, getCitiesWithInventory } from "@/server/services/asset-service";
import { getCurrentUser } from "@/server/auth";
import { getOwnerForUser } from "@/server/services/owner-service";

export const metadata: Metadata = {
  title: "For media partners",
  description:
    "List your billboards, digital screens, vehicles or venue space on ZuperGo and receive availability requests from advertisers actively searching.",
  alternates: { canonical: "/for-media-partners" },
  openGraph: {
    title: "For media partners · ZuperGo",
    description:
      "List your advertising inventory and reach advertisers searching for media like yours. You stay in control of every booking.",
  },
};

export const revalidate = 600;

export default async function ForMediaPartnersPage() {
  const [taxonomy, cities, user] = await Promise.all([
    getTaxonomy(),
    getCitiesWithInventory(),
    getCurrentUser(),
  ]);

  const totalTypes = taxonomy.reduce((sum, c) => sum + c.assetTypes.length, 0);

  // Existing partners get sent to their dashboard rather than a pitch to join
  // something they have already joined.
  const partner = user ? await getOwnerForUser(user.id) : null;

  return (
    <>
      <Navbar />

      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-accent">
              <Store className="size-3.5" aria-hidden="true" />
              For media partners
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Put your inventory in front of buyers.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              List billboards, screens, vehicles or venue space and receive
              enquiries from advertisers actively searching your area. Listing
              is free, and you decide which requests to accept.
            </p>

            {/*
              Three audiences, three different next steps. Offering "Partner
              dashboard" to a signed-out visitor just bounced them to sign-in,
              and offering "Join" to an existing partner is noise.
            */}
            <div className="mt-7 flex flex-wrap gap-3">
              {partner ? (
                <>
                  <Button asChild size="lg">
                    <Link href="/owner">
                      Go to your dashboard
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/owner/assets/new">List new media</Link>
                  </Button>
                </>
              ) : user ? (
                <Button asChild size="lg">
                  <Link href="/partners/join">
                    Add your company profile
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/partners/join">
                      Sign up as a partner
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/signin?callbackUrl=/owner">
                      Sign in
                    </Link>
                  </Button>
                </>
              )}
            </div>

            {!user && (
              <p className="mt-3 text-sm text-muted-foreground">
                Already a partner?{" "}
                <Link
                  href="/signin?callbackUrl=/owner"
                  className="underline underline-offset-4"
                >
                  Sign in to your dashboard
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        {/* Control, stated plainly — the main objection an owner has. */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              You stay in control
            </h2>
            <p className="mt-1.5 max-w-2xl text-muted-foreground">
              ZuperGo never commits your inventory on your behalf. We surface
              demand; every decision remains yours.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Benefit
                icon={Inbox}
                title="Requests, not bookings"
                body="Advertisers register interest with their contact details. Nothing is confirmed until you say so, and the rate they saw is indicative — you quote the final price yourself."
              />
              <Benefit
                icon={CalendarCheck}
                title="Your dates, your call"
                body="Confirm, decline with a reason, or block dates in advance. Only a confirmation marks a window as taken on ZuperGo."
              />
              <Benefit
                icon={Wallet}
                title="Direct relationships"
                body="You agree the final price, artwork, production and payment directly with the advertiser. We make the introduction and keep the record — we do not set your prices or take a cut of them."
              />
            </div>
          </div>
        </section>

        {/* Getting listed */}
        <section className="border-b border-border bg-surface py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Getting listed
            </h2>

            <ol className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Step
                n={1}
                icon={Store}
                title="Create your profile"
                body="Register your company once. We verify your business details so advertisers know who they are dealing with."
              />
              <Step
                n={2}
                icon={Upload}
                title="Add your assets"
                body={`The wizard adapts to what you list — ${totalTypes} asset types supported, and it asks only the questions relevant to yours.`}
              />
              <Step
                n={3}
                icon={BadgeCheck}
                title="Get verified"
                body="Our team reviews photos, location and specifications before your listing goes live and earns its Verified badge."
              />
              <Step
                n={4}
                icon={ShieldCheck}
                title="Receive enquiries"
                body="Verified listings appear in search and on the map. Requests arrive in your dashboard with the advertiser's contact details."
              />
            </ol>
          </div>
        </section>

        {/* What can be listed */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              What you can list
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              Anything that puts a brand in front of people in the physical
              world — currently across {cities.map((c) => c.city).join(", ")}.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {taxonomy.map((category) => (
                <div
                  key={category.id}
                  className="rounded-card border border-border border-l-[3px] border-l-accent bg-surface p-4"
                >
                  <h3 className="text-sm font-semibold">{category.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                  <p className="mt-2 text-xs text-subtle-foreground">
                    {category.assetTypes.length} types ·{" "}
                    {category.assetTypes
                      .slice(0, 3)
                      .map((type) => type.name)
                      .join(", ")}
                    {category.assetTypes.length > 3 ? "…" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface py-16">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-card border border-border bg-surface-muted p-8 text-center md:p-12">
              <h2 className="text-2xl font-semibold tracking-tight">
                List your first asset
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                It takes a few minutes. Our team reviews new listings and
                typically verifies them within one business day.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link href={partner ? "/owner/assets/new" : "/partners/join"}>
                  {partner ? "List new media" : "Sign up as a partner"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <span className="flex size-9 items-center justify-center rounded-md bg-accent-subtle text-accent">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-subtle text-sm font-semibold text-brand">
          {n}
        </span>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
