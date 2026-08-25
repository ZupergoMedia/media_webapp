"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, Pause, Pencil, Play, RefreshCw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Status controls for a seller's own sale listing, mirroring
 * asset-status-controls.tsx.
 *
 * "Submit" auto-publishes in this phase — there is no admin review gate yet
 * (see the "auto-publish, no badges" decision) — so the button is labelled
 * "Publish", not "Submit for review", to avoid promising a review step that
 * does not exist.
 */
export function SaleStatusControls({
  saleListingId,
  slug,
  status,
  syncState,
}: {
  saleListingId: string;
  slug: string;
  status: string;
  syncState: string;
}) {
  const router = useRouter();
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const statusMutation = useMutation({
    mutationFn: async (next: string) => {
      const response = await fetch(`/api/owner/sales/${saleListingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update the listing");
      }
      return response.json();
    },
    onSuccess: () => router.refresh(),
  });

  const syncMutation = useMutation({
    mutationFn: async (resolution: "accept" | "dismiss") => {
      const response = await fetch(`/api/owner/sales/${saleListingId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update the listing");
      }
      return response.json();
    },
    onSuccess: () => router.refresh(),
  });

  const isLive = status === "PUBLISHED";
  const isDraft = status === "DRAFT";
  const canWithdraw = [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "PUBLISHED",
    "PAUSED",
    "OFFER_RECEIVED",
    "UNDER_NEGOTIATION",
  ].includes(status);

  return (
    <div className="flex flex-col items-end gap-2">
      {syncState === "DRIFTED" && (
        <div className="w-full max-w-[260px] rounded-control border border-warning-subtle bg-warning-subtle/40 p-2 text-right text-xs text-warning">
          <p className="mb-1.5 font-medium">Asset details changed</p>
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate("dismiss")}
            >
              Keep published
            </Button>
            <Button
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate("accept")}
            >
              <RefreshCw className="size-3.5" />
              Update listing
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/owner/sales/${saleListingId}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>

        {isLive && (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/assets-for-sale/listing/${slug}`}>
              <Eye className="size-4" />
              View
            </Link>
          </Button>
        )}

        {isDraft && (
          <Button
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate("SUBMITTED")}
          >
            {statusMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" />
            )}
            Publish
          </Button>
        )}

        {(isLive || status === "PAUSED") && (
          <Button
            variant="secondary"
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(isLive ? "PAUSED" : "PUBLISHED")}
          >
            {statusMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : isLive ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {isLive ? "Pause" : "Resume"}
          </Button>
        )}

        {canWithdraw && (
          <Button
            variant="danger"
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => {
              if (confirmingWithdraw) {
                statusMutation.mutate("WITHDRAWN");
                setConfirmingWithdraw(false);
              } else {
                setConfirmingWithdraw(true);
              }
            }}
          >
            <X className="size-4" />
            {confirmingWithdraw ? "Confirm withdraw" : "Withdraw"}
          </Button>
        )}
      </div>

      {(statusMutation.isError || syncMutation.isError) && (
        <p role="alert" className="text-xs text-danger">
          {((statusMutation.error ?? syncMutation.error) as Error).message}
        </p>
      )}
    </div>
  );
}
