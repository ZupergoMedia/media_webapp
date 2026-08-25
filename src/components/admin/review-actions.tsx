"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Ban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Decision = "VERIFIED" | "REJECTED" | "SUSPENDED";

/**
 * Approve / reject / suspend controls.
 *
 * Rejection and suspension require a written reason, matched to the same rule
 * the server enforces — the owner receives this text, and an unexplained
 * rejection gives them nothing to act on. Approval needs no note, so it stays a
 * single click and the queue moves quickly.
 */
export function ReviewActions({
  target,
  id,
  currentStatus,
  onDone,
}: {
  target: "assets" | "owners";
  id: string;
  currentStatus: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async (decision: Decision) => {
      const response = await fetch(`/api/admin/${target}/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not record the decision");
      return data;
    },
    onSuccess: () => {
      setPendingDecision(null);
      setNotes("");
      onDone?.();
      router.refresh();
    },
  });

  const needsReason = pendingDecision && pendingDecision !== "VERIFIED";

  return (
    <div className="space-y-3">
      {needsReason ? (
        <div className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
          <Label htmlFor={`reason-${id}`} className="text-sm">
            {pendingDecision === "REJECTED"
              ? "Why is this being rejected?"
              : "Why is this being suspended?"}
            <span className="ml-0.5 text-danger">*</span>
          </Label>
          <Textarea
            id={`reason-${id}`}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="The owner sees this, so be specific about what needs fixing."
            autoFocus
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={!notes.trim() || mutation.isPending}
              onClick={() => mutation.mutate(pendingDecision)}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Confirm {pendingDecision === "REJECTED" ? "rejection" : "suspension"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => {
                setPendingDecision(null);
                setNotes("");
                mutation.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {currentStatus !== "VERIFIED" && (
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("VERIFIED")}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" />
              )}
              Approve
            </Button>
          )}

          {currentStatus !== "REJECTED" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setPendingDecision("REJECTED")}
            >
              <X className="size-4" />
              Reject
            </Button>
          )}

          {currentStatus === "VERIFIED" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setPendingDecision("SUSPENDED")}
            >
              <Ban className="size-4" />
              Suspend
            </Button>
          )}
        </div>
      )}

      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
