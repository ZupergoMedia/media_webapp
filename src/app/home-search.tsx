"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Taxonomy } from "@/server/services/asset-service";

/**
 * Hero search.
 *
 * Composes a query string and hands off to /explore, which owns all search
 * state. Keeping the entry point stateless means the homepage and Explore can
 * never disagree about what a search means.
 */
export function HomeSearch({
  taxonomy,
  cities,
}: {
  taxonomy: Taxonomy;
  cities: Array<{ city: string; count: number }>;
}) {
  const router = useRouter();
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState("all");
  const [budget, setBudget] = useState("");
  const [from, setFrom] = useState("");

  /**
   * Below `md`, asset type / date / budget move into a right-hand sheet
   * behind a Filters button, matching Explore's filter sheet — stacked
   * inline they pushed the hero's own content off a phone screen, so the
   * page opened on a form rather than on what the product is.
   */
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Stops the page scrolling behind the open sheet.
  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [filtersOpen]);

  // Escape closes the sheet, matching the nav drawer and Explore.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const params = new URLSearchParams();
    if (city !== "all") params.set("city", city);
    if (category !== "all") params.set("categories", category);
    if (budget) params.set("priceMax", budget);
    if (from) params.set("from", from);

    router.push(`/explore?${params.toString()}`);
  };

  /** How many refinements are set — shown on the trigger so a collapsed set never reads as none. */
  const activeCount = [
    category !== "all" ? category : null,
    from || null,
    budget || null,
  ].filter(Boolean).length;

  /**
   * Asset type / date / budget, rendered twice: inline from `md` up, and
   * inside the sheet below it. Extracted rather than duplicated so a field
   * cannot exist at one breakpoint and go missing at another.
   */
  const refinements = (
    <>
      <div className="flex flex-col justify-end gap-1.5">
        <Label htmlFor="hero-category" className="text-xs text-muted-foreground">
          Asset type
        </Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="hero-category" className="h-11">
            <SelectValue placeholder="All media" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All media</SelectItem>
            {taxonomy.map((entry) => (
              <SelectItem key={entry.id} value={entry.slug}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col justify-end gap-1.5">
        <Label htmlFor="hero-from" className="text-xs text-muted-foreground">
          Start date
        </Label>
        <Input
          id="hero-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="flex flex-col justify-end gap-1.5">
        <Label
          htmlFor="hero-budget"
          className="whitespace-nowrap text-xs text-muted-foreground"
        >
          Max budget (₹)
        </Label>
        <Input
          id="hero-budget"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Any"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="h-11"
        />
      </div>
    </>
  );

  return (
    <>
      <form
        onSubmit={submit}
        className="mx-auto mt-9 max-w-4xl rounded-card border border-border bg-surface p-3 shadow-sm"
      >
        {/*
          Column widths are sized to their actual content rather than even
          fractions: the date field has to fit a native `dd/mm/yyyy` picker
          plus its calendar button, and budget needs room for
          "Max budget (₹)" on one line. Splitting the row evenly squeezed
          both, wrapping the budget label onto a second line and pushing its
          input out of line with the others.

          Each field is a flex column with `justify-end`, so the inputs align
          to the bottom of the row no matter how tall a label ends up.
        */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_9rem_auto]">
          <div className="flex flex-col justify-end gap-1.5">
            <Label htmlFor="hero-city" className="text-xs text-muted-foreground">
              Location
            </Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger id="hero-city" className="h-11">
                <SelectValue placeholder="Any city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any city</SelectItem>
                {cities.map((entry) => (
                  <SelectItem key={entry.city} value={entry.city}>
                    {entry.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inline from md up, where the row has space for all four. */}
          <div className="hidden md:contents">{refinements}</div>

          {/* Trigger below md, sharing the row with Location. */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setFiltersOpen(true)}
            className="h-11 self-end md:hidden"
          >
            <SlidersHorizontal className="size-4" />
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>

          <div className="flex flex-col justify-end">
            <Button type="submit" size="lg" className="h-11 w-full md:w-auto">
              <Search className="size-4" />
              Find Media
            </Button>
          </div>
        </div>
      </form>

      {/*
        Rendered outside the <form> so the sheet is not visually clipped by
        the card's border and shadow. Nothing in the hero's ancestry sets a
        transform or filter, so `fixed` resolves against the viewport here
        and no portal is needed — unlike the nav drawer, whose backdrop-blur
        header required one.
      */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-[drawer-fade-in_160ms_ease-out]"
          />

          <div className="absolute inset-y-0 right-0 z-10 flex w-[min(20rem,88vw)] flex-col border-l border-border bg-surface shadow-2xl motion-safe:animate-[drawer-slide-in_220ms_cubic-bezier(0.32,0.72,0,1)]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="font-semibold tracking-tight">Filters</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {refinements}
            </div>

            <div className="shrink-0 space-y-2 border-t border-border p-4">
              {activeCount > 0 && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setCategory("all");
                    setFrom("");
                    setBudget("");
                  }}
                >
                  Clear filters
                </Button>
              )}
              <Button className="w-full" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
