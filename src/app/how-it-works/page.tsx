import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Filter,
  Info,
  Mail,
  MapPin,
  Megaphone,
  Search,
  Send,
  Store,
  Upload,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { getTaxonomy, getCitiesWithInventory } from "@/server/services/asset-service";

export const metadata: Metadata = {
  title: "How ZuperGo works",
  description:
    "How to find, request and confirm out-of-home advertising on ZuperGo — for advertisers and media partners.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How ZuperGo works",
    description:
      "Search verified OOH inventory, request availability, and confirm directly with the media partner.",
  },
};

/** Counts come from live inventory, so the page cannot overstate the catalogue. */
export const revalidate = 600;

export default async function HowItWorksPage() {
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
        {/* Hero */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-4xl px-4 py-14 md:py-20">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              How ZuperGo works
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              ZuperGo is a marketplace for out-of-home advertising. We help you
              find and compare real inventory — billboards, digital screens,
              vehicles, venues — then connect you directly with the media partner
              who runs it.
            </p>

            {/*
              Stated once, prominently, near the top. Everything downstream
              depends on the reader understanding that ZuperGo brokers the
              introduction rather than selling the media itself.
            */}
            <div className="mt-6 flex items-start gap-2.5 rounded-card border border-border bg-surface-muted p-4">
              <Info
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  ZuperGo does not own the media it lists.
                </span>{" "}
                Every asset belongs to an independent media partner who may also
                sell it through their own channels. That is why you send an
                expression of interest rather than a booking — the owner
                confirms availability, and the final price and terms are agreed
                directly between the two of you.
              </p>
            </div>
          </div>
        </section>

        {/* Advertiser journey */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-5xl px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              For advertisers
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">
              Find and request advertising space
            </h2>

            <ol className="mt-8 space-y-4">
              <Step
                number={1}
                icon={Search}
                title="Search the map"
                body={`Browse ${totalAssets} verified assets across ${cities.map((c) => c.city).join(", ")}. Filter by location, budget, media type, audience and availability — the map and results stay in step as you pan.`}
              />
              <Step
                number={2}
                icon={Filter}
                title="Compare properly"
                body="Every listing carries photos, exact dimensions or resolution, estimated daily impressions, audience profile and transparent pricing. Digital screens show slot length, loop duration and plays per day, so you can compare like with like."
              />
              <Step
                number={3}
                icon={Send}
                title="Request availability"
                body="Pick your dates, add campaign details, and send. This registers your interest — nothing is charged, the dates are not reserved, and the amount shown is indicative rather than a final quote. Other advertisers may be asking about the same window."
              />
              <Step
                number={4}
                icon={Mail}
                title="The owner confirms"
                body="The media partner checks their own records — they may have sold those dates offline — then contacts you by phone or email to confirm, decline with a reason, or suggest alternatives."
              />
              <Step
                number={5}
                icon={Megaphone}
                title="Go live"
                body="Once confirmed, you agree the final price and terms with the owner directly, along with artwork, printing deadlines and payment. Your campaign goes up."
                last
              />
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/explore">
                  Start exploring
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Media partner journey */}
        <section className="border-b border-border bg-surface py-14">
          <div className="mx-auto max-w-5xl px-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              For media partners
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">
              List your media and receive enquiries
            </h2>

            <ol className="mt-8 space-y-4">
              <Step
                number={1}
                icon={Store}
                title="Create your company profile"
                body="Register as a media partner. We verify your business details once, so advertisers know who they are dealing with."
              />
              <Step
                number={2}
                icon={Upload}
                title="Add your assets"
                body={`Our listing wizard adapts to what you are listing — we support ${totalTypes} asset types across ${taxonomy.length} categories, and ask only the questions relevant to yours. A billboard needs dimensions and illumination; a screen needs resolution and loop timing; a vehicle needs its operating area.`}
              />
              <Step
                number={3}
                icon={BadgeCheck}
                title="Get verified"
                body="Our team reviews each listing — photos, location, specifications — before it goes live. Verified inventory earns a badge, and unverified listings never appear in search."
              />
              <Step
                number={4}
                icon={CalendarCheck}
                title="Respond to requests"
                body="Advertisers send availability requests with their contact details. You stay in control: confirm only after checking your own bookings, or decline with a reason. ZuperGo never commits your inventory on your behalf."
                last
              />
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/partners/join">
                  List your media
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/owner">Partner dashboard</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* What we list */}
        <section className="border-b border-border bg-surface-muted py-14">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              What you can find on ZuperGo
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              Not just billboards. Anything that puts a brand in front of people
              in the physical world.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {taxonomy.map((category) => (
                <Link
                  key={category.id}
                  href={`/explore?categories=${category.slug}`}
                  className="group rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{category.name}</h3>
                    <span className="shrink-0 text-xs text-subtle-foreground">
                      {category._count.assets}
                    </span>
                  </div>
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
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="bg-surface py-14">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Common questions
            </h2>

            <dl className="mt-6 space-y-5">
              <Faq
                q="Is a request the same as a booking?"
                a="No. A request tells the media partner you are interested in specific dates. They confirm — or decline — after checking their own records. Nothing is reserved and no payment is taken when you send it."
              />
              <Faq
                q="Can two advertisers request the same dates?"
                a="Yes, and often they do. Because ZuperGo does not control the inventory, we do not block dates on an unconfirmed request — that would turn advertisers away over space that may still be free. The owner decides who gets it. If others have enquired about your window, we tell you."
              />
              <Faq
                q="Is the price I see final?"
                a="No. It is an indicative estimate from the owner's published rate card, including GST. The final price may differ, and is settled directly between you and the media partner — along with printing, mounting, production and any other terms. ZuperGo does not set prices or take payment."
              />
              <Faq
                q="What does the Verified badge mean?"
                a="Our team has reviewed the listing's photos, location, specifications and the owner's business details before it went live. Listings that have not been verified never appear in search results."
              />
              <Faq
                q="Why is availability described as indicative?"
                a="Owners sell through their own channels too. We show what we know — confirmed campaigns and dates the owner has blocked — but the owner's records are the authority. That is exactly what they check when they respond to you."
              />
              <Faq
                q="How do mobile assets like vans work?"
                a="A vehicle has no single fixed address, so we list the areas it serves and its route rather than a pin on a map. Search for a location and mobile media covering that area will appear, even though its depot may be elsewhere."
              />
              <Faq
                q="How is payment handled?"
                a="Directly between you and the media partner. ZuperGo does not process payments today — we make the introduction and keep a record of what was requested and agreed."
              />
            </dl>

            <div className="mt-10 rounded-card border border-border bg-surface-muted p-6 text-center">
              <MapPin className="mx-auto size-6 text-brand" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold">Ready to look around?</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Browse {totalAssets} verified assets on the map — no account
                needed until you send a request.
              </p>
              <Button asChild className="mt-4">
                <Link href="/explore">Explore inventory</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
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

function Step({
  number,
  icon: Icon,
  title,
  body,
  last,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {/* Connector line, purely decorative. */}
        {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>

      <div className={last ? "" : "pb-2"}>
        <h3 className="text-sm font-semibold">
          <span className="mr-1.5 text-subtle-foreground">{number}.</span>
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-border pb-5 last:border-0">
      <dt className="text-sm font-semibold">{q}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a}</dd>
    </div>
  );
}
