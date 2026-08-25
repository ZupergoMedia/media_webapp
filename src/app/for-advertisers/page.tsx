import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  Filter,
  Mail,
  MapPin,
  Search,
  Send,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { AssetCard } from "@/components/marketplace/asset-card";
import {
  getFeaturedAssets,
  getTaxonomy,
  getCitiesWithInventory,
} from "@/server/services/asset-service";

export const metadata: Metadata = {
  title: "For advertisers",
  description:
    "Find, compare and request out-of-home advertising across Mumbai — billboards, digital screens, transit media and venues, with transparent pricing.",
  alternates: { canonical: "/for-advertisers" },
  openGraph: {
    title: "For advertisers · ZuperGo",
    description:
      "Search verified OOH inventory on a map, compare specifications and pricing, and request availability directly from media partners.",
  },
};

export const revalidate = 600;

export default async function ForAdvertisersPage() {
  const [taxonomy, cities, featured] = await Promise.all([
    getTaxonomy(),
    getCitiesWithInventory(),
    getFeaturedAssets(3),
  ]);

  const totalAssets = taxonomy.reduce((sum, c) => sum + c._count.assets, 0);
  const totalTypes = taxonomy.reduce((sum, c) => sum + c.assetTypes.length, 0);

  return (
    <>
      <Navbar />

      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand">
              <Megaphone />
              For advertisers
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Buy out-of-home the way you buy digital.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Search {totalAssets} verified assets across{" "}
              {cities.map((c) => c.city).join(", ")} on a live map. Compare
              specifications, audience and price side by side — then request
              availability from the media partner in a few clicks.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/explore">
                  Explore inventory
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              What you get
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Benefit
                icon={MapPin}
                title="Everything on one map"
                body={`${totalTypes} media types — billboards, LED screens, vehicles, venues, street furniture — searchable by location, not scattered across agency PDFs.`}
              />
              <Benefit
                icon={Filter}
                title="Compare like with like"
                body="Exact dimensions or resolution, illumination, footfall estimates and audience profile on every listing. Digital screens show slot length and plays per day."
              />
              <Benefit
                icon={BadgeCheck}
                title="Verified inventory only"
                body="Every listing is reviewed by our team before it appears — photos, location and owner details checked. Unverified media never reaches search."
              />
              <Benefit
                icon={Eye}
                title="Transparent pricing"
                body="Published rates with GST shown up front, so you can plan a budget without a round of enquiry emails first. Figures are indicative — the final price is agreed with the owner."
              />
            </div>
          </div>
        </section>

        {/* How buying works */}
        <section className="border-b border-border bg-surface py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              How buying works
            </h2>
            <p className="mt-1.5 max-w-2xl text-muted-foreground">
              ZuperGo does not own the media it lists. You register interest,
              the owner confirms, and the final price is settled between you —
              no payment is taken here.
            </p>

            <ol className="mt-7 grid gap-4 md:grid-cols-3">
              <Step
                n={1}
                icon={Search}
                title="Search and shortlist"
                body="Filter by city, budget, media type and dates. Save what fits."
              />
              <Step
                n={2}
                icon={Send}
                title="Request availability"
                body="Pick your window and send. This registers interest — nothing is charged, the dates are not held, and the amount shown is not a final quote."
              />
              <Step
                n={3}
                icon={Mail}
                title="Owner confirms"
                body="They check their own records and contact you by phone or email to confirm, decline, or suggest alternatives — and to agree the final price and terms with you directly."
              />
            </ol>
          </div>
        </section>

        {/* Live inventory proof */}
        {featured.length > 0 && (
          <section className="border-b border-border bg-surface-muted py-14">
            <div className="mx-auto max-w-5xl px-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Available now
                </h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/explore">
                    See all {totalAssets}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((asset, index) => (
                  <AssetCard key={asset.id} asset={asset} priority={index < 3} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="bg-surface py-16">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-card border border-border bg-surface-muted p-8 text-center md:p-12">
              <h2 className="text-2xl font-semibold tracking-tight">
                Find your next campaign site
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                No account needed to browse. You only sign in when you are ready
                to send a request.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link href="/explore">Explore inventory</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/** Small inline icon for the eyebrow label. */
function Megaphone() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
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
