"use client";

import { ReviewActions } from "@/components/admin/review-actions";

/**
 * Owner approval controls inside the users table.
 *
 * A thin client wrapper so the server-rendered table can stay a server
 * component while still embedding interactive review actions.
 */
export function OwnerReviewCell({
  ownerId,
  status,
}: {
  ownerId: string;
  status: string;
}) {
  return <ReviewActions target="owners" id={ownerId} currentStatus={status} />;
}
