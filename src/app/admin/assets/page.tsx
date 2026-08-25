import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { requireAdmin } from "@/server/auth/admin-guard";
import { prisma } from "@/server/db/client";
import { formatDate, formatLocation, formatPaise, pricingUnitSuffix } from "@/lib/format";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = {
  title: "All assets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VERIFICATION_TONE: Record<string, string> = {
  VERIFIED: "bg-success-subtle text-success",
  PENDING: "bg-warning-subtle text-warning",
  REJECTED: "bg-danger-subtle text-danger",
  SUSPENDED: "bg-danger-subtle text-danger",
};

export default async function AdminAssetsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      type: { select: { name: true } },
      location: { select: { city: true, locality: true } },
      owner: { select: { companyName: true } },
      pricing: {
        take: 1,
        orderBy: [{ isDefault: "desc" }, { amount: "asc" }],
      },
      _count: { select: { bookingItems: true } },
    },
  });

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">All assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {assets.length} most recent listings across every owner.
        </p>

        <AdminNav />

        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-muted text-left">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Listing</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Location</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Bookings</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Listing</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/verifications/${asset.id}`}
                      className="font-medium hover:underline"
                    >
                      {asset.title}
                    </Link>
                    <span className="block text-xs text-subtle-foreground">
                      {asset.type.name} · {formatDate(asset.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {asset.owner.companyName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatLocation({
                      locality: asset.location?.locality,
                      city: asset.location?.city,
                    })}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {asset.pricing[0]
                      ? `${formatPaise(asset.pricing[0].amount)}${pricingUnitSuffix(asset.pricing[0].unit)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {asset._count.bookingItems}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {asset.status.toLowerCase()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        VERIFICATION_TONE[asset.verificationStatus] ??
                        "bg-surface-sunken text-muted-foreground"
                      }`}
                    >
                      {asset.verificationStatus.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
