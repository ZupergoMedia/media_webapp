import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { requireOwner } from "@/server/auth/owner-guard";
import { OwnerAccessNotice } from "@/components/owner/owner-access-notice";
import { getOwnerSaleEnquiries } from "@/server/services/sale-enquiry-service";
import { SALE_ENQUIRER_INTEREST_LABELS, SALE_ENQUIRY_INTENT_LABELS } from "@/lib/sale-schema";
import { formatDate } from "@/lib/format";
import { OwnerNav } from "../../owner-nav";
import { EnquiryViewButton } from "./enquiry-view-button";

export const metadata: Metadata = {
  title: "Sale enquiries",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function statusTone(status: string): string {
  if (status === "NEW") return "bg-accent-subtle text-accent";
  if (status === "RESPONDED") return "bg-success-subtle text-success";
  if (status === "CLOSED") return "bg-surface-sunken text-muted-foreground";
  return "bg-warning-subtle text-warning";
}

export default async function OwnerSaleEnquiriesPage() {
  const ownerAuth = await requireOwner();
  if (!ownerAuth.ok) return <OwnerAccessNotice error={ownerAuth.error} />;

  const enquiries = await getOwnerSaleEnquiries(ownerAuth.owner.id);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <OwnerNav />

        <h1 className="text-2xl font-semibold tracking-tight">Sale enquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enquiries.length} {enquiries.length === 1 ? "enquiry" : "enquiries"}
        </p>

        {enquiries.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No enquiries yet. They will appear here as soon as a buyer reaches out.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {enquiries.map((enquiry) => (
              <li
                key={enquiry.id}
                className="rounded-card border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{enquiry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {enquiry.saleListing.asset.title} · {formatDate(enquiry.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(enquiry.status)}`}
                  >
                    {enquiry.status.charAt(0) + enquiry.status.slice(1).toLowerCase()}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {SALE_ENQUIRER_INTEREST_LABELS[
                    enquiry.interest as keyof typeof SALE_ENQUIRER_INTEREST_LABELS
                  ] ?? enquiry.interest}
                  {enquiry.company ? ` · ${enquiry.company}` : ""}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Wants: {enquiry.intents
                    .map(
                      (intent) =>
                        SALE_ENQUIRY_INTENT_LABELS[
                          intent as keyof typeof SALE_ENQUIRY_INTENT_LABELS
                        ] ?? intent,
                    )
                    .join(", ")}
                </p>

                {enquiry.message && (
                  <p className="mt-2 rounded-control bg-surface-muted p-2 text-sm">
                    {enquiry.message}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-subtle-foreground">
                    {enquiry.email}
                    {enquiry.phone ? ` · ${enquiry.phone}` : ""}
                  </p>
                  {enquiry.status === "NEW" && <EnquiryViewButton enquiryId={enquiry.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
