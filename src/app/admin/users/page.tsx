import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { requireAdmin } from "@/server/auth/admin-guard";
import {
  getAdvertisersForAdmin,
  getOwnersForAdmin,
} from "@/server/services/admin-service";
import { formatDate } from "@/lib/format";
import { AdminNav } from "../admin-nav";
import { OwnerReviewCell } from "./owner-review-cell";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  VERIFIED: "bg-success-subtle text-success",
  PENDING: "bg-warning-subtle text-warning",
  REJECTED: "bg-danger-subtle text-danger",
  SUSPENDED: "bg-danger-subtle text-danger",
};

export default async function AdminUsersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const [owners, advertisers] = await Promise.all([
    getOwnersForAdmin(),
    getAdvertisersForAdmin(),
  ]);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Media partners and advertisers on the platform.
        </p>

        <AdminNav />

        <section aria-labelledby="owners-heading">
          <h2 id="owners-heading" className="mb-3 text-lg font-semibold tracking-tight">
            Media partners ({owners.length})
          </h2>

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">City</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Listings</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {owners.map((owner) => (
                  <tr key={owner.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{owner.companyName}</span>
                      <span className="block text-xs text-subtle-foreground">
                        Joined {formatDate(owner.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {owner.contactEmail ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {owner.city ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{owner._count.assets}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_TONE[owner.verificationStatus] ??
                          "bg-surface-sunken text-muted-foreground"
                        }`}
                      >
                        {owner.verificationStatus.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OwnerReviewCell
                        ownerId={owner.id}
                        status={owner.verificationStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="advertisers-heading">
          <h2
            id="advertisers-heading"
            className="mb-3 text-lg font-semibold tracking-tight"
          >
            Advertisers ({advertisers.length})
          </h2>

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Bookings</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Campaigns</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {advertisers.map((advertiser) => (
                  <tr key={advertiser.id}>
                    <td className="px-4 py-3 font-medium">
                      {advertiser.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {advertiser.email}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {advertiser._count.bookings}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {advertiser._count.campaigns}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(advertiser.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
