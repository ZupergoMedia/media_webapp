import Link from "next/link";
import { ArrowRight, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { AssetCard } from "@/components/marketplace/asset-card";
import { HomeMap } from "@/components/map/home-map";
import {
  getFeaturedAssets,
  getMapMarkers,
  getTaxonomy,
  getCitiesWithInventory,
} from "@/server/services/asset-service";
import { HomeSearch } from "./home-search";

/**
 * Marketplace homepage.
 *
 * Server-rendered with real inventory: the featured rail and category counts
 * come from the database, so the page reflects what is actually bookable rather
 * than being a static brochure.
 */
export const revalidate = 300;

export default async function HomePage() {
  const [featured, taxonomy, cities, markers] = await Promise.all([
    getFeaturedAssets(6),
    getTaxonomy(),
    getCitiesWithInventory(),
    // Pins are fetched on the server at a zoom that returns individual assets
    // rather than clusters, so the hero map has real inventory on first paint
    // with no client round trip.
    getMapMarkers({
      zoom: 14,
      sort: "relevance",
      page: 1,
      perPage: 60,
    } as Parameters<typeof getMapMarkers>[0]),
  ]);

  const totalAssets = taxonomy.reduce((sum, c) => sum + c._count.assets, 0);
  const mapAssets = markers.kind === "assets" ? markers.assets : [];

  return (
    <>
      <Navbar />

      <main>
        {/* Hero */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-[1400px] px-4 py-12 md:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
              {/* Copy + search */}
              <div>
                <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-accent">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Find. Book. Be Seen.
                </p>
                <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
                  Find advertising spaces where your{" "}
                  <span className="text-brand">audience</span> is.
                </h1>
                <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                  Discover and compare billboards, digital screens, vehicles and
                  venues — then request availability directly from the media
                  owner.
                </p>

                <HomeSearch taxonomy={taxonomy} cities={cities} />

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <Stat value={String(totalAssets)} label="verified assets" />
                  <Stat value={String(cities.length)} label="cities" />
                  <Stat
                    value={String(taxonomy.reduce((n, c) => n + c.assetTypes.length, 0))}
                    label="media types"
                  />
                </div>
              </div>

              {/*
                A real map, not a picture of one. Pins are rendered from live
                inventory so the homepage cannot show something the marketplace
                does not actually have.
              */}
              <HomeMap
                assets={mapAssets}
                totalAssets={totalAssets}
                cities={cities}
              />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-xl font-semibold tracking-tight">
              Browse by category
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every listing is verified, priced and bookable.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {taxonomy.map((category) => (
                <Link
                  key={category.id}
                  href={`/explore?categories=${category.slug}`}
                  className="group flex flex-col justify-between rounded-card border border-border border-l-[3px] border-l-accent bg-surface p-4 transition-colors hover:border-border-strong hover:border-l-accent-hover"
                >
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className="mt-3 text-xs text-muted-foreground">
                    {category._count.assets}{" "}
                    {category._count.assets === 1 ? "asset" : "assets"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured inventory */}
        {featured.length > 0 && (
          <section className="border-b border-border bg-surface-muted py-14">
            <div className="mx-auto max-w-6xl px-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Featured media
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    High-visibility inventory available now.
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/explore">
                    See all
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

        {/* How it works */}
        <section className="border-b border-border bg-surface py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-xl font-semibold tracking-tight">
              How ZuperGo works
            </h2>

            <ol className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                {
                  title: "Search",
                  body: "Filter by location, budget, audience and media type on an interactive map.",
                  icon: Search,
                },
                {
                  title: "Compare",
                  body: "Check specifications, footfall estimates, photos and live availability side by side.",
                  icon: Sparkles,
                },
                {
                  title: "Request",
                  body: "Register interest in your dates. Prices shown are indicative — the owner confirms availability and the final cost.",
                  icon: ShieldCheck,
                },
                {
                  title: "Be Seen",
                  body: "Upload creative, track your campaign and receive proof of display.",
                  icon: MapPin,
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-card border border-border bg-surface p-5"
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-md text-sm font-semibold ${
                      index % 2 === 0
                        ? "bg-brand-subtle text-brand"
                        : "bg-accent-subtle text-accent"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Media partner CTA */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-4xl px-4">
            <div className="rounded-card border border-border bg-surface-muted p-8 text-center md:p-12">
              <h2 className="text-2xl font-semibold tracking-tight">
                Own or manage advertising media?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                List your billboards, screens, vehicles or venue space and reach
                advertisers actively searching for inventory like yours.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link href="/partners/join">List your media on ZuperGo</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ZuperGo. Demo marketplace.</p>
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

/** Compact hero statistic. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
