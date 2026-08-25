"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, Pause, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pause / resume controls for an owner's listing.
 *
 * Only actions with a real implementation are rendered. A pending asset shows
 * no pause button because pausing something not yet verified is meaningless,
 * and "View" only appears once the listing is actually publicly reachable —
 * a link to a 404 is worse than no link.
 */
export function AssetStatusControls({
  assetId,
  slug,
  status,
  verificationStatus,
}: {
  assetId: string;
  slug: string;
  status: string;
  verificationStatus: string;
}) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async (next: "ACTIVE" | "PAUSED") => {
      const response = await fetch(`/api/owner/assets/${assetId}/status`, {
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

  const isLive = status === "ACTIVE" && verificationStatus === "VERIFIED";
  const canToggle = verificationStatus === "VERIFIED";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {/* Editing is always available — a rejected listing especially needs
            correcting, and a paused one may be paused precisely to fix it. */}
        <Button asChild variant="secondary" size="sm">
          <Link href={`/owner/assets/${assetId}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>

        {isLive && (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/assets/${slug}`}>
              <Eye className="size-4" />
              View
            </Link>
          </Button>
        )}

        {canToggle && (
          <Button
            variant="secondary"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : status === "ACTIVE" ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {status === "ACTIVE" ? "Pause" : "Resume"}
          </Button>
        )}
      </div>

      {mutation.isError && (
        <p role="alert" className="text-xs text-danger">
          {(mutation.error as Error).message}
        </p>
      )}

      {verificationStatus === "PENDING" && (
        <p className="max-w-[180px] text-right text-xs text-subtle-foreground">
          Available to advertisers once verified
        </p>
      )}
    </div>
  );
}
