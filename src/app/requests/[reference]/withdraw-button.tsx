"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Lets an advertiser withdraw their own open request.
 *
 * Useful because a request costs the owner attention: an advertiser who has
 * already sourced media elsewhere should be able to take it off the queue.
 */
export function WithdrawRequestButton({ reference }: { reference: string }) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/requests/${reference}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: "WITHDRAWN" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not withdraw the request");
      }
      return response.json();
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <X className="size-4" />
        )}
        Withdraw request
      </Button>
      {mutation.isError && (
        <p role="alert" className="text-xs text-danger">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
