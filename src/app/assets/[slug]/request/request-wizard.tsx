"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AvailabilityCalendar,
  type UnavailableRange,
} from "@/components/marketplace/availability-calendar";
import { requestCampaignSchema } from "@/lib/request-schema";
import { formatDate, formatPaise, formatLocation } from "@/lib/format";
import { PricingDisclosure } from "@/components/marketplace/pricing-disclosure";
import { quotePrice, type PricingOption } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Multi-step availability request.
 *
 * Steps: dates -> inventory -> campaign details -> review -> send.
 *
 * This is an enquiry, not a checkout. ZuperGo does not control the inventory,
 * so nothing here reserves dates and no payment is taken — the media partner
 * confirms afterwards by phone or email. Every label and total is worded to
 * keep that clear, because an advertiser who believes they have booked a
 * billboard and later finds they have not is the worst outcome this flow can
 * produce.
 *
 * The figure shown is an estimate from the owner's published rate card; they
 * may quote differently on confirmation.
 */

const STEPS = [
  { id: "dates", label: "Dates" },
  { id: "inventory", label: "Inventory" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review & send" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface RequestWizardProps {
  asset: {
    slug: string;
    title: string;
    typeName: string;
    imageUrl: string | null;
    locality: string | null;
    city: string | null;
    areaLabel: string | null;
    ownerName: string;
    bookingModel: string;
    pricing: PricingOption[];
    slotsPerLoop: number | null;
  };
  unavailable: UnavailableRange[];
  initialFrom?: string;
  initialTo?: string;
  initialSlots?: number;
}

export function RequestWizard({
  asset,
  unavailable,
  initialFrom,
  initialTo,
  initialSlots,
}: RequestWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<StepId>(initialFrom && initialTo ? "inventory" : "dates");
  const [range, setRange] = useState<{ from?: string; to?: string }>({
    from: initialFrom,
    to: initialTo,
  });
  const [slotCount, setSlotCount] = useState(initialSlots ?? 1);

  const [campaign, setCampaign] = useState({
    campaignName: "",
    brandName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    creativeNotes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDigital = asset.bookingModel === "DIGITAL_SLOT";

  const quote = quotePrice({
    pricing: asset.pricing,
    from: range.from,
    to: range.to,
    slotCount: isDigital ? slotCount : undefined,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetSlug: asset.slug,
          from: range.from,
          to: range.to,
          slotCount: isDigital ? slotCount : undefined,
          ...campaign,
          contactPhone: campaign.contactPhone || undefined,
          notes: campaign.notes || undefined,
          creativeNotes: campaign.creativeNotes || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new RequestError(
          payload.error ?? "Could not send your request",
          response.status,
        );
      }
      return payload as { reference: string };
    },
    onSuccess: (data) => {
      router.push(`/requests/${data.reference}`);
    },
  });

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const validateCampaign = () => {
    const result = requestCampaignSchema.safeParse(campaign);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (!errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
    return false;
  };

  const goNext = () => {
    if (step === "dates" && range.from && range.to) setStep("inventory");
    else if (step === "inventory") setStep("campaign");
    else if (step === "campaign" && validateCampaign()) setStep("review");
  };

  const goBack = () => {
    const previous = STEPS[stepIndex - 1];
    if (previous) setStep(previous.id);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {/* Progress */}
        <ol className="mb-6 flex items-center gap-1" aria-label="Request steps">
          {STEPS.map((s, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={s.id} className="flex flex-1 items-center gap-1">
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-success text-white",
                    current && "bg-foreground text-background",
                    !done && !current && "bg-surface-sunken text-subtle-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs sm:inline",
                    current ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {index < STEPS.length - 1 && (
                  <span className="mx-1 h-px flex-1 bg-border" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        {/* Step 1 — dates */}
        {step === "dates" && (
          <section aria-labelledby="step-dates">
            <h2 id="step-dates" className="mb-1 text-lg font-semibold tracking-tight">
              Select your dates
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Greyed-out dates are already confirmed or blocked by the owner.
              Availability shown is indicative — the owner confirms it when they
              respond.
            </p>
            <AvailabilityCalendar
              unavailable={unavailable}
              value={range}
              onChange={setRange}
              monthsToShow={2}
            />
          </section>
        )}

        {/* Step 2 — inventory */}
        {step === "inventory" && (
          <section aria-labelledby="step-inventory">
            <h2 id="step-inventory" className="mb-1 text-lg font-semibold tracking-tight">
              {isDigital ? "Choose your slots" : "Confirm your campaign period"}
            </h2>

            {isDigital && asset.slotsPerLoop ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  This screen runs {asset.slotsPerLoop} advertising slots per
                  loop. More slots means your creative plays more often.
                </p>
                <div className="rounded-card border border-border bg-surface p-5">
                  <Label htmlFor="wizard-slots" className="text-sm font-medium">
                    Slots per loop
                  </Label>
                  <input
                    id="wizard-slots"
                    type="range"
                    min={1}
                    max={asset.slotsPerLoop}
                    value={slotCount}
                    onChange={(e) => setSlotCount(Number(e.target.value))}
                    className="mt-3 w-full accent-[var(--brand)]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>1 slot</span>
                    <span className="font-medium text-foreground">
                      {slotCount} of {asset.slotsPerLoop} selected
                    </span>
                    <span>{asset.slotsPerLoop} slots</span>
                  </div>
                  <p className="mt-3 text-xs text-subtle-foreground">
                    Slot availability is confirmed by the owner, not at submission.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-card border border-border bg-surface p-5">
                <p className="text-sm text-muted-foreground">
                  You are requesting this asset for the selected period. Other
                  advertisers may be asking about the same dates — the owner
                  decides who gets them.
                </p>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Start</dt>
                    <dd className="font-medium">{formatDate(range.from)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">End</dt>
                    <dd className="font-medium">{formatDate(range.to)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-medium">{quote?.days ?? 0} days</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        )}

        {/* Step 3 — campaign */}
        {step === "campaign" && (
          <section aria-labelledby="step-campaign">
            <h2 id="step-campaign" className="mb-1 text-lg font-semibold tracking-tight">
              Campaign details
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              The media partner contacts you directly to confirm, so give details
              they can reach you on.
            </p>

            <div className="space-y-4 rounded-card border border-border bg-surface p-5">
              <Field
                id="campaignName"
                label="Campaign name"
                required
                value={campaign.campaignName}
                error={fieldErrors.campaignName}
                onChange={(v) => setCampaign((c) => ({ ...c, campaignName: v }))}
                placeholder="Diwali Mumbai Campaign"
              />
              <Field
                id="brandName"
                label="Brand"
                required
                value={campaign.brandName}
                error={fieldErrors.brandName}
                onChange={(v) => setCampaign((c) => ({ ...c, brandName: v }))}
                placeholder="Your brand name"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="contactEmail"
                  label="Contact email"
                  type="email"
                  required
                  value={campaign.contactEmail}
                  error={fieldErrors.contactEmail}
                  onChange={(v) => setCampaign((c) => ({ ...c, contactEmail: v }))}
                  placeholder="you@company.com"
                />
                <Field
                  id="contactPhone"
                  label="Contact phone"
                  required
                  value={campaign.contactPhone}
                  error={fieldErrors.contactPhone}
                  onChange={(v) => setCampaign((c) => ({ ...c, contactPhone: v }))}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="creativeNotes">Creative requirements</Label>
                <Textarea
                  id="creativeNotes"
                  rows={3}
                  value={campaign.creativeNotes}
                  onChange={(e) =>
                    setCampaign((c) => ({ ...c, creativeNotes: e.target.value }))
                  }
                  placeholder="Artwork format, printing requirements, or anything the owner should know."
                />
              </div>
            </div>
          </section>
        )}

        {/* Step 4 — review */}
        {step === "review" && (
          <section aria-labelledby="step-review">
            <h2 id="step-review" className="mb-1 text-lg font-semibold tracking-tight">
              Review your request
            </h2>
            <PricingDisclosure variant="panel" className="mb-5" />

            <dl className="divide-y divide-border rounded-card border border-border bg-surface">
              <Row label="Asset" value={asset.title} />
              <Row label="Type" value={asset.typeName} />
              <Row
                label="Period"
                value={`${formatDate(range.from)} — ${formatDate(range.to)}`}
              />
              {isDigital && (
                <Row
                  label="Slots"
                  value={`${slotCount} of ${asset.slotsPerLoop} per loop`}
                />
              )}
              <Row label="Campaign" value={campaign.campaignName} />
              <Row label="Brand" value={campaign.brandName} />
              <Row label="Contact" value={campaign.contactEmail} />
              {campaign.creativeNotes && (
                <Row label="Creative notes" value={campaign.creativeNotes} />
              )}
            </dl>

            {mutation.isError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-4"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-danger"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-danger">
                    {(mutation.error as RequestError).message}
                  </p>
                  {(mutation.error as RequestError).status === 409 && (
                    <button
                      type="button"
                      onClick={() => {
                        mutation.reset();
                        setStep("dates");
                      }}
                      className="mt-1 text-sm underline underline-offset-4"
                    >
                      Choose different dates
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={goBack} disabled={mutation.isPending}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href={`/assets/${asset.slug}`}>
                <ArrowLeft className="size-4" />
                Back to asset
              </Link>
            </Button>
          )}

          {step === "review" ? (
            <Button
              size="lg"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                "Send request"
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={goNext}
              disabled={step === "dates" && !(range.from && range.to)}
            >
              Continue
            </Button>
          )}
        </div>
      </div>

      {/* Summary rail */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {asset.imageUrl && (
            <div className="relative aspect-[16/10] bg-surface-sunken">
              <Image
                src={asset.imageUrl}
                alt={asset.title}
                fill
                sizes="340px"
                className="object-cover"
              />
            </div>
          )}

          <div className="p-4">
            <h3 className="text-sm font-semibold leading-snug">{asset.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatLocation(asset)} · {asset.ownerName}
            </p>

            {quote ? (
              <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>
                    {formatPaise(quote.unitPrice)} × {quote.quantity} {quote.unitLabel}
                  </dt>
                  <dd className="tabular-nums">{formatPaise(quote.subtotal)}</dd>
                </div>

                {quote.minimumApplied && (
                  <p className="text-xs text-warning">
                    {quote.minimumApplied.label} — charged for the minimum, not
                    the {quote.days} {quote.days === 1 ? "day" : "days"} selected.
                  </p>
                )}
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>Discount ({quote.discountPercent}%)</dt>
                    <dd className="tabular-nums">−{formatPaise(quote.discountAmount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <dt>GST (18%)</dt>
                  <dd className="tabular-nums">{formatPaise(quote.tax)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Estimated total</dt>
                  <dd className="tabular-nums">{formatPaise(quote.total)}</dd>
                </div>
                <PricingDisclosure variant="compact" className="pt-1" />
              </dl>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                Select dates to see an estimate.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(error && "border-danger")}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
