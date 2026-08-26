import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Handshake,
  Info,
  MapPin,
  Scale,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getTaxonomy, getCitiesWithInventory } from "@/server/services/asset-service";

export const metadata: Metadata = {
  title: "About us",
  description:
    "ZuperGo is a marketplace for out-of-home advertising in India — connecting advertisers with verified media partners across billboards, digital screens, transit and venues.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About ZuperGo",
    description:
      "A marketplace for out-of-home advertising: verified inventory, transparent pricing, and direct relationships with media partners.",
  },
};

export const revalidate = 600;

export default async function AboutPage() {
  const [taxonomy, cities] = await Promise.all([
    getTaxonomy(),
    getCitiesWithInventory(),
  ]);

  const totalAssets = taxonomy.reduce((sum, c) => sum + c._count.assets, 0);
  const totalTypes = taxonomy.reduce((sum, c) => sum + c.assetTypes.length, 0);

  return (
    <>
      <Navbar />

      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-4xl px-4 py-14 md:py-20">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-accent">
              <Building2 className="size-3.5" aria-hidden="true" />
              About ZuperGo
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Out-of-home advertising, made searchable.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Buying a billboard in India still usually means phone calls, PDF
              rate cards and a lot of guesswork about what is actually
              available. ZuperGo puts that inventory on a map, with real
              specifications and real prices, so advertisers can find what fits
              and media partners can be found.
            </p>
          </div>
        </section>

        {/* What we are — and are not */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              What ZuperGo is
            </h2>
            <p className="mt-2 text-muted-foreground">
              A marketplace, not a media partner. Every asset listed here belongs
              to an independent business that operates it, prices it, and
              decides who books it.
            </p>

            {/*
              Said plainly, because it shapes every interaction on the platform
              and is the thing most easily misunderstood about a marketplace.
            */}
            <div className="mt-5 flex items-start gap-2.5 rounded-card border border-border bg-surface p-4">
              <Info
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  We do not own or resell the media we list.
                </span>{" "}
                An advertiser registers interest; the media partner confirms it
                directly, and the two settle the final price and terms between
                themselves. That keeps owners in control of their own inventory
                and pricing, and means advertisers always hear the real answer
                rather than a broker&rsquo;s guess.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Value
                icon={MapPin}
                title="Location first"
                body="Advertising is a geography problem. Search starts on a map, and mobile media is matched by the areas it serves rather than a pin on a depot."
              />
              <Value
                icon={BadgeCheck}
                title="Verified inventory"
                body="Every listing is reviewed before it goes live — photos, coordinates, specifications and the owner's business details."
              />
              <Value
                icon={Scale}
                title="Honest by default"
                body="Prices are published with GST and described as indicative, because the owner sets the final figure. Availability is indicative too — only the owner knows what they sold last week."
              />
            </div>
          </div>
        </section>

        {/* Numbers, from live data */}
        <section className="border-b border-border bg-surface py-14">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Where we are today
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              ZuperGo is early. These figures are live from the platform, not
              projections.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Figure value={String(totalAssets)} label="verified assets" />
              <Figure value={String(cities.length)} label="cities" />
              <Figure value={String(totalTypes)} label="media types" />
              <Figure value={String(taxonomy.length)} label="categories" />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Currently live across {cities.map((c) => c.city).join(", ")}, with
              inventory spanning{" "}
              {taxonomy.map((c) => c.name.toLowerCase()).join(", ")}.
            </p>
          </div>
        </section>

        {/* Who it serves */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Who we build for
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/for-advertisers"
                className="group rounded-card border border-border border-l-[3px] border-l-brand bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <Handshake className="size-5 text-brand" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">Advertisers</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Brands and agencies who need to find the right site quickly,
                  compare options fairly, and get a straight answer on
                  availability.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  For advertisers
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>

              <Link
                href="/for-media-partners"
                className="group rounded-card border border-border border-l-[3px] border-l-accent bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <Building2 className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">Media partners</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Operators of billboards, screens, fleets and venues who want
                  demand from buyers they would not otherwise reach — without
                  giving up control of their inventory.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  For media partners
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-surface py-16">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-card border border-border bg-surface-muted p-8 text-center md:p-12">
              <h2 className="text-2xl font-semibold tracking-tight">
                Have a question?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Whether you are planning a campaign or have media to list, we
                would like to hear from you.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/explore">Explore inventory</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/how-it-works">How it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ZuperGo Media.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link href="/explore" className="hover:text-foreground">
              Explore
            </Link>
            <Link href="/how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="/for-media-partners" className="hover:text-foreground">
              For media partners
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

function Value({
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
      <span className="flex size-9 items-center justify-center rounded-md bg-brand-subtle text-brand">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
