import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { getEligibleAssetsForSale } from "@/server/services/sale-seller-service";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { OwnerNav } from "../../owner-nav";
import { CreateListingWizard } from "./create-listing-wizard";

export const metadata: Metadata = {
  title: "Put an asset up for sale",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewSaleListingPage() {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) {
    return <OwnerAccessNotice error={ownerAuth.error} />;
  }

  const { owner } = ownerAuth;
  const eligibleAssets = await getEligibleAssetsForSale(owner.id);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <OwnerNav />

        <Link
          href="/owner/sales"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assets for sale
        </Link>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Put an asset up for sale
        </h1>

        <CreateListingWizard
          eligibleAssets={eligibleAssets.map((asset) => ({
            id: asset.id,
            title: asset.title,
            typeName: asset.type.name,
            city: asset.location?.city ?? null,
            locality: asset.location?.locality ?? null,
            imageUrl: asset.images[0]?.url ?? null,
          }))}
        />
      </main>
    </>
  );
}
