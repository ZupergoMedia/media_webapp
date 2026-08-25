import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { AdminAccessNotice } from "@/components/admin/admin-access-notice";
import { requireAdmin } from "@/server/auth/admin-guard";
import { getBookingsForAdmin } from "@/server/services/admin-service";
import { formatDate, formatPaise } from "@/lib/format";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "bg-success-subtle text-success",
  COMPLETED: "bg-success-subtle text-success",
  HELD: "bg-warning-subtle text-warning",
  PENDING_APPROVAL: "bg-warning-subtle text-warning",
  CANCELLED: "bg-surface-sunken text-muted-foreground",
  REJECTED: "bg-danger-subtle text-danger",
  DRAFT: "bg-surface-sunken text-muted-foreground",
};

export default async function AdminBookingsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return <AdminAccessNotice status={auth.status} />;
  }

  const bookings = await getBookingsForAdmin();

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every booking across the marketplace.
        </p>

        <AdminNav />

        {bookings.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <CalendarDays
              className="mx-auto mb-3 size-7 text-subtle-foreground"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold">No bookings yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Bookings appear here as advertisers reserve inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Advertiser</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Assets</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Created</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/requests/${booking.reference}`}
                        className="font-medium tabular-nums hover:underline"
                      >
                        {booking.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {booking.advertiser.name ?? booking.advertiser.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {booking.items[0]?.asset.title ?? "—"}
                      {booking.items.length > 1 && (
                        <span className="text-xs text-subtle-foreground">
                          {" "}
                          +{booking.items.length - 1} more
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {booking.items[0]?.asset.owner.companyName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(booking.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_TONE[booking.status] ??
                          "bg-surface-sunken text-muted-foreground"
                        }`}
                      >
                        {booking.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPaise(booking.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
