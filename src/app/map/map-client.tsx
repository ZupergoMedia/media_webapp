"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MapView, type MapBounds } from "@/components/map/map-view";
import type {
  AssetSummary,
  MapCluster,
  SearchResult,
  Taxonomy,
} from "@/server/services/asset-service";
import { cn } from "@/lib/utils";

/**
 * Full-screen map.
 *
 * The geographic counterpart to Explore: the map fills the viewport and the
 * filters live in a sidebar rather than competing with a results grid. Markers
 * follow the viewport — clusters when zoomed out, individual assets when zoomed
 * in — so the browser never receives the whole inventory at once.
 *
 * Filter state is shared with Explore through the same URL parameters, so
 * switching between the two tabs preserves what the user has narrowed to.
 */

type MapData =
  | { kind: "clusters"; clusters: MapCluster[] }
  | { kind: "assets"; assets: AssetSummary[] };

interface MapClientProps {
  taxonomy: Taxonomy;
  cities: Array<{ city: string; count: number }>;
}

export function MapClient({ taxonomy, cities }: MapClientProps) {
  const router = useRouter();
  const params = useSearchParams();

  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [zoom, setZoom] = useState(11);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateParams = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          next.delete(key);
        } else {
          next.set(key, Array.isArray(value) ? value.join(",") : value);
        }
      }
      router.replace(`/map?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  /*
   * Memoised because these arrays feed `visibleTypes` below. Recreating them on
   * every render would give that useMemo a new dependency each time, so it
   * would recompute the type list on every keystroke in the search box.
   */
  const selectedCities = useMemo(
    () => params.get("city")?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const selectedCategories = useMemo(
    () => params.get("categories")?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const selectedTypes = useMemo(
    () => params.get("types")?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const verifiedOnly = params.get("verified") === "true";

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  /** Types shown are scoped to the chosen categories, so the list stays usable. */
  const visibleTypes = useMemo(() => {
    const source =
      selectedCategories.length > 0
        ? taxonomy.filter((c) => selectedCategories.includes(c.slug))
        : taxonomy;
    return source.flatMap((c) => c.assetTypes);
  }, [taxonomy, selectedCategories]);

  const filterQuery = useMemo(() => {
    const search = new URLSearchParams();
    for (const key of ["q", "city", "categories", "types", "verified"]) {
      const value = params.get(key);
      if (value) search.set(key, value);
    }
    return search;
  }, [params]);

  /** Total matching the filters, independent of the viewport. */
  const countQuery = useQuery<SearchResult>({
    queryKey: ["map", "count", filterQuery.toString()],
    queryFn: async ({ signal }) => {
      const search = new URLSearchParams(filterQuery);
      search.set("perPage", "1");
      const response = await fetch(`/api/assets/search?${search}`, { signal });
      if (!response.ok) throw new Error("Count failed");
      return response.json();
    },
    placeholderData: keepPreviousData,
  });

  const mapApiQuery = useMemo(() => {
    const search = new URLSearchParams(filterQuery);
    search.set("zoom", String(Math.round(zoom)));
    if (bounds) {
      search.set("minLng", bounds.minLng.toFixed(6));
      search.set("minLat", bounds.minLat.toFixed(6));
      search.set("maxLng", bounds.maxLng.toFixed(6));
      search.set("maxLat", bounds.maxLat.toFixed(6));
    }
    return search.toString();
  }, [filterQuery, zoom, bounds]);

  const mapQuery = useQuery<MapData>({
    queryKey: ["map", "markers", mapApiQuery],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/assets/map?${mapApiQuery}`, { signal });
      if (!response.ok) throw new Error("Map query failed");
      return response.json();
    },
    enabled: bounds !== null,
    placeholderData: keepPreviousData,
  });

  // Panning fires continuously; one request per frame would swamp the database.
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBoundsChange = useCallback(
    (next: MapBounds, nextZoom: number) => {
      if (boundsTimer.current) clearTimeout(boundsTimer.current);
      boundsTimer.current = setTimeout(() => {
        setBounds(next);
        setZoom(nextZoom);
      }, 320);
    },
    [],
  );

  useEffect(
    () => () => {
      if (boundsTimer.current) clearTimeout(boundsTimer.current);
    },
    [],
  );

  const total = countQuery.data?.total ?? 0;
  const visible =
    mapQuery.data?.kind === "assets"
      ? mapQuery.data.assets.length
      : mapQuery.data?.kind === "clusters"
        ? mapQuery.data.clusters.reduce((sum, c) => sum + c.count, 0)
        : 0;

  const activeCount =
    selectedCities.length +
    selectedCategories.length +
    selectedTypes.length +
    (verifiedOnly ? 1 : 0) +
    (params.get("q") ? 1 : 0);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => router.replace("/map", { scroll: false })}
              className="text-xs font-medium text-brand hover:underline"
            >
              Clear ({activeCount})
            </button>
          )}
        </div>

        <p className="mt-2 flex items-baseline gap-1.5 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Showing
          </span>
          <span className="font-semibold tabular-nums">{visible}</span>
          <span className="text-muted-foreground">/ {total}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <form
          className="mb-5"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: queryDraft || undefined });
          }}
        >
          <label
            htmlFor="map-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
              aria-hidden="true"
            />
            <Input
              id="map-search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Location, area or media"
              className="h-10 pl-9"
            />
          </div>
        </form>

        <FilterGroup label="City">
          {cities.map((city) => (
            <CheckRow
              key={city.city}
              checked={selectedCities.includes(city.city)}
              onChange={() =>
                updateParams({ city: toggle(selectedCities, city.city) })
              }
              label={city.city}
              count={city.count}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Category">
          {taxonomy.map((category) => (
            <CheckRow
              key={category.id}
              checked={selectedCategories.includes(category.slug)}
              onChange={() =>
                updateParams({
                  categories: toggle(selectedCategories, category.slug),
                  // Type selections belong to the previous category set.
                  types: [],
                })
              }
              label={category.name}
              count={category._count.assets}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Media type" scroll>
          {visibleTypes.map((type) => (
            <CheckRow
              key={type.id}
              checked={selectedTypes.includes(type.slug)}
              onChange={() =>
                updateParams({ types: toggle(selectedTypes, type.slug) })
              }
              label={type.name}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Trust">
          <CheckRow
            checked={verifiedOnly}
            onChange={() =>
              updateParams({ verified: verifiedOnly ? undefined : "true" })
            }
            label="Verified listings only"
          />
        </FilterGroup>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar — persistent on desktop, sheet on mobile */}
      <aside className="hidden w-72 shrink-0 border-r border-border bg-surface lg:block">
        {sidebar}
      </aside>

      {filtersOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            // Black, not `bg-foreground/40`: --foreground is a LIGHT colour
            // in dark mode, so that mixed a pale tint over the page instead
            // of darkening it.
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          {/* From the right, matching the nav drawer and the Explore filter
              sheet — "a panel slides in from the right" should mean one thing
              across the app. */}
          <div className="absolute inset-y-0 right-0 z-10 flex w-[min(20rem,88vw)] flex-col border-l border-border bg-surface shadow-2xl motion-safe:animate-[drawer-slide-in_220ms_cubic-bezier(0.32,0.72,0,1)]">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Filters</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="rounded-control p-1.5 text-muted-foreground hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* flex-1 rather than a height calc: the header is shrink-0, so
                the body takes exactly the remaining space without hardcoding
                the header's height. */}
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
        </div>
      )}

      {/* Map */}
      <section className="relative min-w-0 flex-1" aria-label="Inventory map">
        <MapView
          clusters={
            mapQuery.data?.kind === "clusters" ? mapQuery.data.clusters : undefined
          }
          assets={
            mapQuery.data?.kind === "assets" ? mapQuery.data.assets : undefined
          }
          selectedAssetId={selectedId}
          isLoading={mapQuery.isFetching}
          onBoundsChange={handleBoundsChange}
          onSelectAsset={(asset) => setSelectedId(asset?.id ?? null)}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFiltersOpen(true)}
          className="absolute left-3 top-3 z-10 shadow-sm lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </section>
    </div>
  );
}

function FilterGroup({
  label,
  children,
  scroll,
}: {
  label: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>
      <div
        className={cn(
          "space-y-1.5",
          // Media type can run to dozens of entries; capping its height keeps
          // the groups below it reachable without a long scroll.
          scroll && "max-h-56 overflow-y-auto pr-1",
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2.5">
        <Checkbox checked={checked} onCheckedChange={onChange} />
        {label}
      </span>
      {count !== undefined && (
        <span className="text-xs text-subtle-foreground">{count}</span>
      )}
    </label>
  );
}
