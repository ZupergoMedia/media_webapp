import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { SpecificationTable } from "@/components/marketplace/specification-table";
import { ReviewActions } from "@/components/admin/review-actions";
import { requireAdmin } from "@/server/auth/admin-guard";
import { getAssetForReview } from "@/server/services/admin-service";
import { formatDate, formatPaise, pricingUnitSuffix } from "@/lib/format";

export const metadata: Metadata = {
  title: "Review listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Asset inspection page.
 *
 * Surfaces everything needed to make a verification decision, including the
 * things that are easy to miss in a list view: missing coordinates, an
 * unverified owner, thin photography. Those are called out as explicit warnings
 * rather than left for the admin to notice.
 */
export default async function ReviewAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const { id } = await params;
  const asset = await getAssetForReview(id);
  if (!asset) notFound();

  // Checks worth flagging before approval. Each one produces a listing that is
  // live but underperforming or unfindable, which is worse than a rejection.
  const warnings: string[] = [];
  if (asset.location?.lat == null || asset.location?.lng == null) {
    warnings.push("No coordinates — this listing will not appear on the map or in nearby searches.");
  }
  if (asset.images.length === 0) {
    warnings.push("No photos. Advertisers rarely book inventory they cannot see.");
  }
  if (asset.pricing.length === 0) {
    warnings.push("No pricing set — the listing cannot be booked.");
  }
  if (asset.owner.verificationStatus !== "VERIFIED") {
    warnings.push(
      `The owner account (${asset.owner.companyName}) is not verified yet.`,
    );
  }
  if (asset.type.isDigital && !asset.digitalInventory) {
    warnings.push("Digital asset with no slot inventory configured.");
  }
  if (asset.type.isMobile && asset.operatingAreas.length === 0) {
    warnings.push("Mobile asset with no operating areas — it will be hard to find.");
  }

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/admin/verifications"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to queue
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{asset.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {asset.type.name} · {asset.category.name} · submitted{" "}
              {formatDate(asset.createdAt)}
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              asset.verificationStatus === "VERIFIED"
                ? "bg-success-subtle text-success"
                : asset.verificationStatus === "PENDING"
                  ? "bg-warning-subtle text-warning"
                  : "bg-danger-subtle text-danger"
            }`}
          >
            {asset.verificationStatus.toLowerCase()}
          </span>
        </div>

        {warnings.length > 0 && (
          <div className="mt-5 rounded-card border border-warning/30 bg-warning-subtle p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-warning">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {warnings.length} {warnings.length === 1 ? "issue" : "issues"} to consider
            </p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-8">
            {/* Photos */}
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Photos ({asset.images.length})
              </h2>
              {asset.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {asset.images.map((image) => (
                    <div
                      key={image.id}
                      className="relative aspect-[4/3] overflow-hidden rounded-control bg-surface-sunken"
                    >
                      <Image
                        src={image.url}
                        alt={image.alt ?? ""}
                        fill
                        sizes="(max-width: 640px) 50vw, 220px"
                        className="object-cover"
                      />
                      {image.isPrimary && (
                        <span className="absolute left-2 top-2 rounded bg-foreground/85 px-1.5 py-0.5 text-[11px] text-background">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photos submitted.</p>
              )}
            </section>

            {asset.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold tracking-tight">Description</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {asset.description}
                </p>
              </section>
            )}

            {/* Location — the field most often wrong on a new listing. */}
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Location</h2>
              <dl className="divide-y divide-border rounded-card border border-border">
                <Row label="Address" value={asset.location?.addressLine} />
                <Row label="Locality" value={asset.location?.locality} />
                <Row label="City" value={asset.location?.city} />
                <Row label="State" value={asset.location?.state} />
                <Row label="Pincode" value={asset.location?.pincode} />
                <Row
                  label="Coordinates"
                  value={
                    asset.location?.lat != null && asset.location?.lng != null
                      ? `${asset.location.lat}, ${asset.location.lng}`
                      : null
                  }
                />
                <Row label="Location mode" value={asset.locationMode} />
              </dl>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Specifications
              </h2>
              <SpecificationTable
                specSchema={asset.type.specSchema}
                specs={asset.specs}
              />
            </section>

            {asset.digitalInventory && (
              <section>
                <h2 className="mb-3 text-lg font-semibold tracking-tight">
                  Digital inventory
                </h2>
                <dl className="divide-y divide-border rounded-card border border-border">
                  <Row
                    label="Slot duration"
                    value={`${asset.digitalInventory.slotDurationSeconds}s`}
                  />
                  <Row
                    label="Loop duration"
                    value={`${asset.digitalInventory.loopDurationSeconds}s`}
                  />
                  <Row
                    label="Slots per loop"
                    value={String(asset.digitalInventory.slotsPerLoop)}
                  />
                  <Row
                    label="Operating hours"
                    value={`${asset.digitalInventory.operatingHoursStart}:00 – ${asset.digitalInventory.operatingHoursEnd}:00`}
                  />
                </dl>
              </section>
            )}

            {asset.operatingAreas.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold tracking-tight">
                  Operating areas
                </h2>
                <ul className="space-y-2">
                  {asset.operatingAreas.map((area) => (
                    <li
                      key={area.id}
                      className="rounded-card border border-border bg-surface p-3 text-sm"
                    >
                      <span className="font-medium">{area.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {area.city}
                        {area.radiusMeters
                          ? ` · ${(area.radiusMeters / 1000).toFixed(0)} km radius`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Audit trail */}
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">
                Review history
              </h2>
              <ol className="space-y-2">
                {asset.verifications.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-card border border-border bg-surface p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{entry.status.toLowerCase()}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                        {entry.reviewer
                          ? ` · ${entry.reviewer.name ?? entry.reviewer.email}`
                          : " · owner submission"}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-muted-foreground">{entry.notes}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Decision rail */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-card border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">Decision</h2>
              <ReviewActions
                target="assets"
                id={asset.id}
                currentStatus={asset.verificationStatus}
              />
            </div>

            <div className="rounded-card border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">Owner</h2>
              <dl className="space-y-1.5 text-sm">
                <Pair label="Company" value={asset.owner.companyName} />
                <Pair label="Contact" value={asset.owner.contactName} />
                <Pair label="Email" value={asset.owner.contactEmail} />
                <Pair label="Phone" value={asset.owner.contactPhone} />
                <Pair label="GST" value={asset.owner.gstNumber} />
                <Pair label="PAN" value={asset.owner.panNumber} />
                <Pair
                  label="Listings"
                  value={String(asset.owner._count.assets)}
                />
                <Pair
                  label="Owner status"
                  value={asset.owner.verificationStatus.toLowerCase()}
                />
                <Pair label="Joined" value={formatDate(asset.owner.createdAt)} />
              </dl>
            </div>

            <div className="rounded-card border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">Pricing</h2>
              {asset.pricing.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {asset.pricing.map((price) => (
                    <li key={price.id} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {price.unit.replace("PER_", "").toLowerCase()}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatPaise(price.amount)}
                        {pricingUnitSuffix(price.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No pricing set.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`max-w-[60%] text-right text-sm ${
          value ? "font-medium" : "text-subtle-foreground"
        }`}
      >
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function Pair({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "text-right font-medium" : "text-subtle-foreground"}>
        {value || "—"}
      </dd>
    </div>
  );
}
