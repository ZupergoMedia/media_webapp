"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saleEnquirySchema,
  SALE_ENQUIRER_INTERESTS,
  SALE_ENQUIRER_INTEREST_LABELS,
  SALE_ENQUIRY_INTENTS,
  SALE_ENQUIRY_INTENT_LABELS,
} from "@/lib/sale-schema";
import { SaleDisclaimer } from "./sale-disclaimer";

/**
 * Public, anonymous enquiry form.
 *
 * No sign-in required — the seller's contact details are never handed to the
 * enquirer as a result of submitting this. The seller chooses whether to
 * respond, matching how the advertising side hands off availability requests.
 */
export function SaleEnquiryForm({ saleListingSlug }: { saleListingSlug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState<(typeof SALE_ENQUIRER_INTERESTS)[number] | "">("");
  const [intents, setIntents] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = saleEnquirySchema.safeParse({
        saleListingSlug,
        name,
        email,
        phone: phone || undefined,
        company: company || undefined,
        interest,
        intents,
        message: message || undefined,
      });

      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          if (!errors[key]) errors[key] = issue.message;
        }
        setFieldErrors(errors);
        throw new Error("Please check the enquiry details.");
      }
      setFieldErrors({});

      const response = await fetch("/api/sales/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send your enquiry");
      }
      return payload;
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="rounded-card border border-success-subtle bg-success-subtle/40 p-4 text-center">
        <Check className="mx-auto mb-2 size-6 text-success" aria-hidden="true" />
        <p className="text-sm font-medium text-success">Enquiry sent</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The seller has been notified. They will reach out if they choose to respond.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="enquiry-name">Name</Label>
          <Input id="enquiry-name" value={name} onChange={(e) => setName(e.target.value)} />
          {fieldErrors.name && <p className="mt-1 text-xs text-danger">{fieldErrors.name}</p>}
        </div>
        <div>
          <Label htmlFor="enquiry-email">Email</Label>
          <Input
            id="enquiry-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-danger">{fieldErrors.email}</p>}
        </div>
        <div>
          <Label htmlFor="enquiry-phone">Phone (optional)</Label>
          <Input id="enquiry-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="enquiry-company">Company (optional)</Label>
          <Input
            id="enquiry-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="enquiry-interest">I am interested as</Label>
        <Select value={interest} onValueChange={(v) => setInterest(v as typeof interest)}>
          <SelectTrigger id="enquiry-interest">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {SALE_ENQUIRER_INTERESTS.map((value) => (
              <SelectItem key={value} value={value}>
                {SALE_ENQUIRER_INTEREST_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.interest && (
          <p className="mt-1 text-xs text-danger">{fieldErrors.interest}</p>
        )}
      </div>

      <div>
        <Label>I would like</Label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {SALE_ENQUIRY_INTENTS.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={intents.includes(value)}
                onCheckedChange={(checked) =>
                  setIntents((prev) =>
                    checked === true ? [...prev, value] : prev.filter((v) => v !== value),
                  )
                }
              />
              {SALE_ENQUIRY_INTENT_LABELS[value]}
            </label>
          ))}
        </div>
        {fieldErrors.intents && (
          <p className="mt-1 text-xs text-danger">{fieldErrors.intents}</p>
        )}
      </div>

      <div>
        <Label htmlFor="enquiry-message">Message (optional)</Label>
        <Textarea
          id="enquiry-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
        />
        {fieldErrors.message && (
          <p className="mt-1 text-xs text-danger">{fieldErrors.message}</p>
        )}
      </div>

      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {(mutation.error as Error).message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Send enquiry
      </Button>

      <SaleDisclaimer variant="panel" />
    </form>
  );
}
