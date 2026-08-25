"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Owner response to an availability request.
 *
 * Confirming is the moment the dates are actually claimed, so the copy asks the
 * owner to check their own records first — ZuperGo has no visibility of what
 * they have sold through their own channels.
 *
 * Declining requires a reason, matching the server. "Already sold" and "dates
 * unavailable" send the advertiser in very different directions, and a bare
 * refusal gives them nothing to act on.
 */
export function RespondControls({ reference }: { reference: string }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: async (response: "CONFIRMED" | "DECLINED") => {
      const result = await fetch(`/api/requests/${reference}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, message: message.trim() || undefined }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error ?? "Could not record your response");
      return data;
    },
    onSuccess: () => {
      setDeclining(false);
      setMessage("");
      router.refresh();
    },
  });

  if (declining) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`decline-${reference}`} className="text-sm">
          Why can you not take this booking?
          <span className="ml-0.5 text-danger">*</span>
        </Label>
        <Textarea
          id={`decline-${reference}`}
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="e.g. Already sold for those dates — free from 15 October."
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={!message.trim() || mutation.isPending}
            onClick={() => mutation.mutate("DECLINED")}
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Send decline
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              setDeclining(false);
              setMessage("");
              mutation.reset();
            }}
          >
            Cancel
          </Button>
        </div>
        {mutation.isError && (
          <p role="alert" className="text-xs text-danger">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("CONFIRMED")}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" />
          )}
          Confirm availability
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() => setDeclining(true)}
        >
          <X className="size-4" />
          Decline
        </Button>
      </div>

      <p className="text-xs text-subtle-foreground">
        Confirming marks these dates as taken on ZuperGo. Check your own bookings
        first.
      </p>

      {mutation.isError && (
        <p role="alert" className="text-xs text-danger">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
