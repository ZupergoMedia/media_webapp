"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import type { Taxonomy } from "@/server/services/asset-service";
import { cn } from "@/lib/utils";

/**
 * Search filters.
 *
 * Categories and types come from the database taxonomy — nothing here is
 * hardcoded, so a new medium added by an admin appears automatically. Filter
 * state lives in the URL (owned by the parent), which keeps every search
 * shareable and the back button correct.
 */

export interface FilterState {
  categories: string[];
  types: string[];
  digital?: boolean;
  mobile?: boolean;
  verified: boolean;
  priceMin?: number;
  priceMax?: number;
  from?: string;
  to?: string;
}

interface FilterPanelProps {
  taxonomy: Taxonomy;
  value: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onReset: () => void;
  resultCount?: number;
  className?: string;
}

export function FilterPanel({
  taxonomy,
  value,
  onChange,
  onReset,
  resultCount,
  className,
}: FilterPanelProps) {
  // Types shown are scoped to the selected categories, so the list stays
  // navigable rather than dumping all 68 at once.
  const visibleTypes = useMemo(() => {
    const selected = value.categories;
    const source =
      selected.length > 0
        ? taxonomy.filter((c) => selected.includes(c.slug))
        : taxonomy;
    return source.flatMap((c) => c.assetTypes);
  }, [taxonomy, value.categories]);

  const activeCount =
    value.categories.length +
    value.types.length +
    (value.digital !== undefined ? 1 : 0) +
    (value.mobile !== undefined ? 1 : 0) +
    (value.verified ? 1 : 0) +
    (value.priceMin !== undefined ? 1 : 0) +
    (value.priceMax !== undefined ? 1 : 0) +
    (value.from ? 1 : 0);

  const toggle = (list: string[], slug: string) =>
    list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Filters</h2>
          {resultCount !== undefined && (
            <p className="text-xs text-muted-foreground">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </p>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
            Clear ({activeCount})
          </Button>
        )}
      </div>

      <Separator />

      {/* Availability window */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Availability
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="filter-from" className="text-xs font-normal">
              From
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={value.from ?? ""}
              onChange={(e) => onChange({ from: e.target.value || undefined })}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-to" className="text-xs font-normal">
              To
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={value.to ?? ""}
              min={value.from}
              onChange={(e) => onChange({ to: e.target.value || undefined })}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </fieldset>

      <Separator />

      {/* Budget — entered in rupees, converted to paise at the URL boundary. */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Budget (₹)
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="filter-price-min" className="text-xs font-normal">
              Min
            </Label>
            <Input
              id="filter-price-min"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={value.priceMin ?? ""}
              onChange={(e) =>
                onChange({
                  priceMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-price-max" className="text-xs font-normal">
              Max
            </Label>
            <Input
              id="filter-price-max"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Any"
              value={value.priceMax ?? ""}
              onChange={(e) =>
                onChange({
                  priceMax: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="h-9 text-xs"
            />
          </div>
        </div>
      </fieldset>

      <Separator />

      {/* Media character — orthogonal to category, so kept separate. */}
      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Media type
        </legend>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={value.digital === true}
            onCheckedChange={(checked) =>
              onChange({ digital: checked === true ? true : undefined })
            }
          />
          Digital / DOOH only
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={value.mobile === true}
            onCheckedChange={(checked) =>
              onChange({ mobile: checked === true ? true : undefined })
            }
          />
          Mobile / transit only
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={value.verified}
            onCheckedChange={(checked) => onChange({ verified: checked === true })}
          />
          Verified listings only
        </label>
      </fieldset>

      <Separator />

      {/* Categories — database-driven. */}
      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </legend>
        {taxonomy.map((category) => (
          <label
            key={category.id}
            className="flex cursor-pointer items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2.5">
              <Checkbox
                checked={value.categories.includes(category.slug)}
                onCheckedChange={() =>
                  onChange({
                    categories: toggle(value.categories, category.slug),
                    // Type selections belong to the previous category set, so
                    // clear them rather than leaving an impossible combination.
                    types: [],
                  })
                }
              />
              {category.name}
            </span>
            <span className="text-xs text-subtle-foreground">
              {category._count.assets}
            </span>
          </label>
        ))}
      </fieldset>

      {visibleTypes.length > 0 && (
        <>
          <Separator />
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asset type
            </legend>
            <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {visibleTypes.map((type) => (
                <label
                  key={type.id}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={value.types.includes(type.slug)}
                    onCheckedChange={() =>
                      onChange({ types: toggle(value.types, type.slug) })
                    }
                  />
                  {type.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
