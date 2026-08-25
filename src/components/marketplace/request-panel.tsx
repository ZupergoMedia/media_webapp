"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "./price-display";
import {
  AvailabilityCalendar,
  type UnavailableRange,
} from "./availability-calendar";
import { formatPaise } from "@/lib/format";
import { PricingDisclosure } from "./pricing-disclosure";
import { quotePrice, type PricingOption } from "@/lib/pricing";

/**
 * Availability request entry point on the asset detail page.
 *
 * ZuperGo does not own the inventory it lists, so this is an enquiry rather
 * than a checkout: the media partner confirms afterwards, and may already have
 * sold the dates through their own channels. The copy here is deliberately
 * unambiguous about that.
 *
 * The figure shown is an estimate from the owner's published rate card,
 * computed by the same function the server uses so the two never disagree.
 */
export function RequestPanel({
  assetSlug,
  pricing,
  unavailable,
  bookingModel,
  digitalSlotsPerLoop,
}: {
  assetSlug: string;
  pricing: PricingOption[];
  unavailable: UnavailableRange[];
  bookingModel: string;
  digitalSlotsPerLoop?: number | null;
}) {
  const router = useRouter();
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [slotCount, setSlotCount] = useState(1);

  const primary = pricing[0];

  const quote = useMemo(
    () =>
      quotePrice({
        pricing,
        from: range.from,
        to: range.to,
        slotCount: bookingModel === "DIGITAL_SLOT" ? slotCount : undefined,
      }),
    [pricing, range.from, range.to, slotCount, bookingModel],
  );

  const canProceed = Boolean(range.from && range.to && quote);

  const proceed = () => {
    if (!canProceed) return;
    const params = new URLSearchParams({
      from: range.from!,
      to: range.to!,
    });
    if (bookingModel === "DIGITAL_SLOT") {
      params.set("slots", String(slotCount));
    }
    router.push(`/assets/${assetSlug}/request?${params.toString()}`);
  };

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <PriceDisplay
          amount={primary?.amount ?? null}
          unit={primary?.unit ?? null}
          size="lg"
        />
      </div>

      {pricing.length > 1 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {pricing.length} pricing options available
        </p>
      )}

      <PricingDisclosure variant="compact" className="mt-1" />

      <div className="mt-4 border-t border-border pt-4">
        <AvailabilityCalendar
          unavailable={unavailable}
          value={range}
          onChange={setRange}
          monthsToShow={1}
        />
      </div>

      {bookingModel === "DIGITAL_SLOT" && digitalSlotsPerLoop ? (
        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor="slot-count"
            className="mb-1.5 block text-sm font-medium"
          >
            Slots per loop
          </label>
          <input
            id="slot-count"
            type="range"
            min={1}
            max={digitalSlotsPerLoop}
            value={slotCount}
            onChange={(event) => setSlotCount(Number(event.target.value))}
            className="w-full accent-[var(--brand)]"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {slotCount} of {digitalSlotsPerLoop} slots — more slots means more
            plays per hour.
          </p>
        </div>
      ) : null}

      {quote ? (
        <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>
              {formatPaise(quote.unitPrice)} × {quote.quantity}{" "}
              {quote.unitLabel}
            </dt>
            <dd className="tabular-nums">{formatPaise(quote.subtotal)}</dd>
          </div>

          {/*
            Explains why a short booking can cost more than the days chosen.
            Without this the total looks like an arithmetic error.
          */}
          {quote.minimumApplied && (
            <p className="text-xs text-warning">
              {quote.minimumApplied.label} — charged for the minimum, not the{" "}
              {quote.days} {quote.days === 1 ? "day" : "days"} selected.
            </p>
          )}

          {quote.discountAmount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Volume discount ({quote.discountPercent}%)</dt>
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
        </dl>
      ) : (
        <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
          <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Select your dates to see an estimate.
        </p>
      )}

      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={!canProceed}
        onClick={proceed}
      >
        Request availability
      </Button>

      <PricingDisclosure variant="inline" className="mt-3" />

    </div>
  );
}
