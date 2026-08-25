import { NextResponse } from "next/server";
import { markSaleEnquiryViewed } from "@/server/services/sale-enquiry-service";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * PATCH /api/owner/sales/enquiries/:id/view
 *
 * Marks an enquiry as viewed. Scoped by ownerId inside the service, so a
 * mismatched id simply affects no rows.
 */
export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const ownerAuth = await requireOwner();
    if (!ownerAuth.ok) {
      return NextResponse.json(
        { error: ownerAuth.error },
        { status: ownerAuth.status },
      );
    }

    const updated = await markSaleEnquiryViewed(ownerAuth.owner.id, id);

    if (!updated) {
      return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    }

    return NextResponse.json({ id, status: "VIEWED" });
  } catch (error) {
    console.error("[api/owner/sales/enquiries/view]", error);
    return NextResponse.json(
      { error: "Could not update the enquiry." },
      { status: 500 },
    );
  }
}
