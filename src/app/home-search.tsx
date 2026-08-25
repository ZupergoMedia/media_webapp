"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
      <div className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label htmlFor="hero-budget" className="text-xs text-muted-foreground">
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

        <div className="flex items-end">
          <Button type="submit" size="lg" className="h-11 w-full md:w-auto">
            <Search className="size-4" />
            Find Media
          </Button>
        </div>
      </div>
    </form>
  );
}
