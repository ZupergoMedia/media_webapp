import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { getAssetTypesForWizard } from "@/server/services/owner-service";
import { AddAssetWizard } from "./add-asset-wizard";

export const metadata: Metadata = {
  title: "Add an asset",
  robots: { index: false, follow: false },
};

/**
 * The taxonomy — including every type's spec descriptors — is loaded server-side
 * so the wizard renders type-specific fields immediately on selection, without a
 * round trip per choice.
 *
 * Not prerendered: the taxonomy is database-driven, so a new asset type added by
 * an admin must appear in the wizard without a rebuild.
 */
export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const taxonomy = await getAssetTypesForWizard();

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/owner/assets"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assets
        </Link>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Add an advertising asset
        </h1>

        <AddAssetWizard taxonomy={taxonomy} />
      </main>
    </>
  );
}
