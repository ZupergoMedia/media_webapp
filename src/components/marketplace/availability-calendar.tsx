"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnavailableRange {
  start: string | Date;
  end: string | Date;
  reason: "booked" | "blocked";
}

/**
 * Availability calendar and date-range picker.
 *
 * Unavailable days come from the same `holdsInventory` flag the database's
 * exclusion constraint uses, so the calendar cannot show a date the booking
 * step would then reject. The calendar is a convenience, not the authority —
 * the constraint is still what guarantees correctness under concurrency.
 */

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Midnight UTC for a date, so comparisons ignore local timezone drift. */
function utcDay(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatISO(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function AvailabilityCalendar({
  unavailable,
  value,
  onChange,
  monthsToShow = 2,
}: {
  unavailable: UnavailableRange[];
  value: { from?: string; to?: string };
  onChange: (next: { from?: string; to?: string }) => void;
  monthsToShow?: number;
}) {
  const today = useMemo(() => utcDay(new Date()), []);
  const [monthOffset, setMonthOffset] = useState(0);

  /**
   * Flattened set of blocked days.
   *
   * Ranges are half-open '[)' to match the database, so a booking ending on the
   * 30th leaves the 30th bookable — the same rule the exclusion constraint uses.
   */
  const blockedDays = useMemo(() => {
    const days = new Set<number>();
    for (const range of unavailable) {
      const start = utcDay(range.start);
      const end = utcDay(range.end);
      for (let day = start; day < end; day += DAY_MS) {
        days.add(day);
      }
    }
    return days;
  }, [unavailable]);

  const fromDay = value.from ? utcDay(value.from) : null;
  const toDay = value.to ? utcDay(value.to) : null;

  /** True if any blocked day falls inside the candidate range. */
  const rangeHasConflict = (start: number, end: number) => {
    for (let day = start; day <= end; day += DAY_MS) {
      if (blockedDays.has(day)) return true;
    }
    return false;
  };

  const handleDayClick = (day: number) => {
    // Starting fresh, or restarting after a complete range.
    if (fromDay === null || toDay !== null) {
      onChange({ from: formatISO(day), to: undefined });
      return;
    }

    // Clicking before the start re-anchors rather than producing a reversed range.
    if (day <= fromDay) {
      onChange({ from: formatISO(day), to: undefined });
      return;
    }

    // Refuse a range that spans blocked days — silently truncating it would be
    // worse, since the user would not know what they actually selected.
    if (rangeHasConflict(fromDay, day)) {
      onChange({ from: formatISO(day), to: undefined });
      return;
    }

    onChange({ from: formatISO(fromDay), to: formatISO(day) });
  };

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: monthsToShow }, (_, index) => {
      const base = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + index, 1),
      );
      return base;
    });
  }, [monthOffset, monthsToShow]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
          disabled={monthOffset === 0}
          aria-label="Previous month"
          className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>

        <p className="text-sm font-medium">Select your dates</p>

        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(11, o + 1))}
          disabled={monthOffset >= 11}
          aria-label="Next month"
          className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className={cn("grid gap-5", monthsToShow > 1 && "sm:grid-cols-2")}>
        {months.map((month) => (
          <MonthGrid
            key={month.toISOString()}
            month={month}
            today={today}
            blockedDays={blockedDays}
            fromDay={fromDay}
            toDay={toDay}
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-foreground" aria-hidden="true" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm bg-surface-sunken line-through"
            aria-hidden="true"
          />
          Unavailable
        </span>
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  today,
  blockedDays,
  fromDay,
  toDay,
  onDayClick,
}: {
  month: Date;
  today: number;
  blockedDays: Set<number>;
  fromDay: number | null;
  toDay: number | null;
  onDayClick: (day: number) => void;
}) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  // Monday-first offset; getUTCDay() returns 0 for Sunday.
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;

  const label = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium">{label}</p>

      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={label}>
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            role="columnheader"
            className="py-1 text-center text-[11px] font-medium text-subtle-foreground"
          >
            {weekday}
          </div>
        ))}

        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNumber = i + 1;
          const timestamp = Date.UTC(year, monthIndex, dayNumber);

          const isPast = timestamp < today;
          const isBlocked = blockedDays.has(timestamp);
          const disabled = isPast || isBlocked;

          const isStart = fromDay === timestamp;
          const isEnd = toDay === timestamp;
          const inRange =
            fromDay !== null &&
            toDay !== null &&
            timestamp > fromDay &&
            timestamp < toDay;

          return (
            <button
              key={dayNumber}
              type="button"
              role="gridcell"
              disabled={disabled}
              onClick={() => onDayClick(timestamp)}
              aria-label={`${dayNumber} ${label}${isBlocked ? " (unavailable)" : ""}`}
              aria-selected={isStart || isEnd || inRange}
              className={cn(
                "aspect-square rounded-control text-xs tabular-nums transition-colors",
                disabled && "cursor-not-allowed text-subtle-foreground",
                isBlocked && !isPast && "bg-surface-sunken line-through",
                !disabled && "hover:bg-surface-muted",
                inRange && "bg-brand-subtle text-brand",
                (isStart || isEnd) &&
                  "bg-foreground font-semibold text-background hover:bg-foreground",
              )}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
