import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { getOwnerAsset } from "@/server/services/owner-service";
import { EditAssetForm, type EditAssetInitial } from "./edit-asset-form";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Edit a listing.
 *
 * `getOwnerAsset` is scoped by ownerId, so another partner's asset simply is
 * not found — reported as a 404 rather than a 403, which would confirm the
 * listing exists.
 */
export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) return <OwnerAccessNotice error={ownerAuth.error} />;

  const { id } = await params;
  const asset = await getOwnerAsset(ownerAuth.owner.id, id);
  if (!asset) notFound();

  // Form state is all strings: number inputs round-trip through the DOM as
  // strings anyway, and an empty field must stay empty rather than becoming 0.
  const str = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);

  const initial: EditAssetInitial = {
    id: asset.id,
    title: asset.title,
    description: asset.description ?? "",
    typeName: asset.type.name,
    categoryName: asset.category.name,
    isDigital: asset.type.isDigital,
    isMobile: asset.type.isMobile,
    specSchema: asset.type.specSchema,
    specs:
      asset.specs && typeof asset.specs === "object"
        ? (asset.specs as Record<string, unknown>)
        : {},
    dailyImpressions: str(asset.dailyImpressions),
    audienceProfile: asset.audienceProfile ?? "",
    verificationStatus: asset.verificationStatus,
    status: asset.status,
    location: {
      addressLine: asset.location?.addressLine ?? "",
      locality: asset.location?.locality ?? "",
      city: asset.location?.city ?? "",
      state: asset.location?.state ?? "",
      pincode: asset.location?.pincode ?? "",
      lat: str(asset.location?.lat),
      lng: str(asset.location?.lng),
    },
    images: asset.images.length
      ? asset.images.map((image) => ({ url: image.url }))
      : [{ url: "" }],
    pricing: asset.pricing.length
      ? asset.pricing.map((price) => ({
          unit: price.unit,
          // Paise in storage, rupees in the form.
          amount: String(price.amount / 100),
          discountThreshold: str(price.discountThreshold),
          discountPercent: str(price.discountPercent),
        }))
      : [
          {
            unit: "PER_MONTH",
            amount: "",
            discountThreshold: "",
            discountPercent: "",
          },
        ],
    // Only owner-declared blackouts are editable. BOOKED rows are derived from
    // confirmed requests and are not the partner's to remove here.
    blackouts: asset.availability
      .filter((window) => window.kind === "BLOCKED" || window.kind === "MAINTENANCE")
      .map((window) => ({
        startDate: window.startDate.toISOString().slice(0, 10),
        endDate: window.endDate.toISOString().slice(0, 10),
        note: window.note ?? "",
      })),
    digital: {
      slotDurationSeconds: str(asset.digitalInventory?.slotDurationSeconds) || "15",
      loopDurationSeconds: str(asset.digitalInventory?.loopDurationSeconds) || "180",
      operatingHoursStart: str(asset.digitalInventory?.operatingHoursStart) || "6",
      operatingHoursEnd: str(asset.digitalInventory?.operatingHoursEnd) || "23",
      screenWidthPx: str(asset.digitalInventory?.screenWidthPx),
      screenHeightPx: str(asset.digitalInventory?.screenHeightPx),
    },
    operatingAreas: asset.operatingAreas.map((area) => ({
      name: area.name,
      city: area.city ?? "",
      centerLat: str(area.centerLat),
      centerLng: str(area.centerLng),
      radiusMeters: str(area.radiusMeters),
    })),
  };

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/owner/assets"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to your media
        </Link>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Edit {asset.title}
        </h1>

        <EditAssetForm initial={initial} />
      </main>
    </>
  );
}
