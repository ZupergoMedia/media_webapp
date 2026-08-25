"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EnquiryViewButton({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/owner/sales/enquiries/${enquiryId}/view`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update the enquiry");
      }
      return response.json();
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      Mark viewed
    </Button>
  );
}
