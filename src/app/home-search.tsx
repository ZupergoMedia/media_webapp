"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
   * Below `md`, only Location and the submit button are shown; asset type,
   * date and budget collapse behind a "More filters" toggle. Stacked, all
   * five controls pushed the hero's own content off a phone screen, so the
   * page opened on a form rather than on what the product is.
   */
  const [refinementsOpen, setRefinementsOpen] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const params = new URLSearchParams();
    if (city !== "all") params.set("city", city);
    if (category !== "all") params.set("categories", category);
    if (budget) params.set("priceMax", budget);
    if (from) params.set("from", from);

    router.push(`/explore?${params.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-9 max-w-4xl rounded-card border border-border bg-surface p-3 shadow-sm"
    >
      {/*
        Column widths are sized to their actual content rather than even
        fractions: the date field has to fit a native `dd/mm/yyyy` picker plus
        its calendar button, and budget needs room for "Max budget (₹)" on one
        line. Splitting the row evenly squeezed both, wrapping the budget label
        onto a second line and pushing its input out of line with the others.

        Each field is a flex column with `justify-end`, so the inputs align to
        the bottom of the row no matter how tall a label ends up — a label that
        wraps can no longer drag its input out of alignment.
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

        <div
          className={cn(
            "flex-col justify-end gap-1.5 md:flex",
            refinementsOpen ? "flex" : "hidden",
          )}
        >
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

        <div
          className={cn(
            "flex-col justify-end gap-1.5 md:flex",
            refinementsOpen ? "flex" : "hidden",
          )}
        >
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

        <div
          className={cn(
            "flex-col justify-end gap-1.5 md:flex",
            refinementsOpen ? "flex" : "hidden",
          )}
        >
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

        <div className="flex flex-col justify-end">
          <Button type="submit" size="lg" className="h-11 w-full md:w-auto">
            <Search className="size-4" />
            Find Media
          </Button>
        </div>
      </div>

      {/* Refinement toggle — below md only, where the three extra fields are
          collapsed. Above md they are always inline and this is redundant. */}
      <button
        type="button"
        onClick={() => setRefinementsOpen((value) => !value)}
        aria-expanded={refinementsOpen}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-control py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {refinementsOpen ? "Fewer filters" : "More filters"}
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            refinementsOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </form>
  );
}
