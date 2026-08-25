import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { getAssetBySlug } from "@/server/services/asset-service";
import { getUnavailableRanges } from "@/server/services/request-service";
import { RequestWizard } from "./request-wizard";

/** Contains buyer details — never indexed. */
export const metadata: Metadata = {
  title: "Request availability",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string; slots?: string }>;
}

export default async function RequestAvailabilityPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const asset = await getAssetBySlug(slug);
  if (!asset) notFound();

  const unavailable = await getUnavailableRanges(asset.id);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Request {asset.title}
        </h1>

        {/*
          Stated once, prominently, at the top of the flow. An advertiser who
          reads only one line should still understand that this is an enquiry
          rather than a purchase, and that the price is not final.
        */}
        <div className="mt-4 flex items-start gap-2.5 rounded-card border border-border bg-surface-muted p-4">
          <Info
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-medium">
              This is an expression of interest, not a booking
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {asset.owner.companyName} owns this media and may already have
              sold these dates through their own channels. Prices shown are
              indicative — the final price and terms are settled directly
              between you and the owner. No payment is taken here.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <RequestWizard
            asset={{
              slug: asset.slug,
              title: asset.title,
              typeName: asset.type.name,
              imageUrl: asset.images[0]?.url ?? null,
              locality: asset.location?.locality ?? null,
              city: asset.location?.city ?? null,
              areaLabel: asset.location?.areaLabel ?? null,
              ownerName: asset.owner.companyName,
              bookingModel: asset.bookingModel,
              pricing: asset.pricing,
              slotsPerLoop: asset.digitalInventory?.slotsPerLoop ?? null,
            }}
            // Serialised to ISO strings: Dates cannot cross the server/client
            // boundary as props without being converted.
            unavailable={unavailable.map((range) => ({
              start: range.start.toISOString(),
              end: range.end.toISOString(),
              reason: range.reason === "confirmed" ? "booked" : "blocked",
            }))}
            initialFrom={query.from}
            initialTo={query.to}
            initialSlots={query.slots ? Number(query.slots) : undefined}
          />
        </div>
      </main>
    </>
  );
}
