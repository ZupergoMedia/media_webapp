"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SaleListingCard, SaleListingCardSkeleton } from "@/components/sales/sale-listing-card";
import type { SaleSearchResult } from "@/server/services/sale-listing-service";
import type { Taxonomy } from "@/server/services/asset-service";
import { SALE_SORT_LABELS, SALE_SORT_OPTIONS, type SaleSortOption } from "@/lib/sale-search-params";
import { cn } from "@/lib/utils";

/**
 * Public sale marketplace browse grid, mirroring explore-client.tsx.
 *
 * Filter state lives in the URL, so any result set is shareable and the back
 * button behaves — same reasoning as the advertising side.
 */
export function SaleBrowseClient({
  taxonomy,
  cities,
}: {
  taxonomy: Taxonomy;
  cities: Array<{ city: string; count: number }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [queryDraft, setQueryDraft] = useState(params.get("q") ?? "");

  const allTypes = useMemo(
    () => taxonomy.flatMap((category) => category.assetTypes),
    [taxonomy],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      router.replace(`/assets-for-sale?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const page = Number(params.get("page") ?? "1");
  const sort = (params.get("sort") as SaleSortOption) ?? "relevance";

  const apiQuery = useMemo(() => {
    const search = new URLSearchParams();
    for (const key of [
      "q",
      "city",
      "categories",
      "types",
      "priceMin",
      "priceMax",
      "ownershipTypes",
      "inclusions",
      "negotiable",
    ]) {
      const value = params.get(key);
      if (value) search.set(key, value);
    }
    search.set("sort", sort);
    search.set("page", String(page));
    search.set("perPage", "24");
    return search.toString();
  }, [params, sort, page]);

  const listQuery = useQuery<SaleSearchResult>({
    queryKey: ["sales", "browse", apiQuery],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/sales/search?${apiQuery}`, { signal });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    placeholderData: keepPreviousData,
  });

  const listings = listQuery.data?.listings ?? [];
  const total = listQuery.data?.total ?? 0;
  const isInitialLoading = listQuery.isLoading && !listQuery.data;

  const activeFilters = [
    params.get("city"),
    params.get("categories"),
    params.get("types"),
    params.get("priceMax"),
    params.get("negotiable"),
    params.get("q"),
  ].filter(Boolean).length;

  const clearAll = () => {
    setQueryDraft("");
    router.replace("/assets-for-sale", { scroll: false });
  };

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label="Showing"
              value={isInitialLoading ? "…" : `${listings.length} / ${total}`}
              emphasis
            />
            <Chip label="Cities" value={String(cities.length)} />
            <Chip label="Categories" value={String(taxonomy.length)} />
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-30 border-b border-border bg-surface-muted">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <form
              className="relative lg:col-span-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateParams({ q: queryDraft || undefined });
              }}
            >
              <label
                htmlFor="sale-search"
                className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="sale-search"
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  placeholder="Location, area or media type…"
                  className="h-10 bg-surface pl-9"
                />
                {queryDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryDraft("");
                      updateParams({ q: undefined });
                    }}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </form>

            <FilterSelect
              label="City"
              value={params.get("city") ?? "all"}
              onChange={(value) => updateParams({ city: value })}
              options={[
                { value: "all", label: "All cities" },
                ...cities.map((city) => ({
                  value: city.city,
                  label: `${city.city} (${city.count})`,
                })),
              ]}
            />

            <FilterSelect
              label="Media type"
              value={params.get("types") ?? "all"}
              onChange={(value) => updateParams({ types: value })}
              options={[
                { value: "all", label: "All types" },
                ...allTypes.map((type) => ({ value: type.slug, label: type.name })),
              ]}
            />

            <FilterSelect
              label="Sort by"
              value={sort}
              onChange={(value) => updateParams({ sort: value })}
              options={SALE_SORT_OPTIONS.map((option) => ({
                value: option,
                label: SALE_SORT_LABELS[option],
              }))}
            />
          </div>

          {activeFilters > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {activeFilters} {activeFilters === 1 ? "filter" : "filters"} applied
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-brand hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {listQuery.isError ? (
          <ErrorState onRetry={() => listQuery.refetch()} />
        ) : isInitialLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SaleListingCardSkeleton key={index} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState onReset={clearAll} />
        ) : (
          <>
            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                listQuery.isFetching && "opacity-60 transition-opacity",
              )}
            >
              {listings.map((listing, index) => (
                <SaleListingCard key={listing.id} listing={listing} priority={index < 4} />
              ))}
            </div>

            {(listQuery.data?.hasMore || page > 1) && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) }, false)}
                >
                  Previous
                </Button>
                <span className="px-3 text-sm text-muted-foreground">Page {page}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!listQuery.data?.hasMore}
                  onClick={() => updateParams({ page: String(page + 1) }, false)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Chip({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        emphasis ? "border-brand/30 bg-brand-subtle" : "border-border bg-surface-muted",
      )}
    >
      <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 bg-surface" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface px-6 py-20 text-center">
      <Search className="mb-3 size-8 text-subtle-foreground" aria-hidden="true" />
      <h2 className="text-base font-semibold">No listings match those filters</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try widening your budget, clearing a category, or searching a different area.
      </p>
      <Button variant="secondary" onClick={onReset} className="mt-4">
        Clear all filters
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-card border border-danger/30 bg-danger-subtle px-6 py-20 text-center"
    >
      <h2 className="text-base font-semibold text-danger">Could not load listings</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Something went wrong while searching. Your filters are still applied.
      </p>
      <Button variant="secondary" onClick={onRetry} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
