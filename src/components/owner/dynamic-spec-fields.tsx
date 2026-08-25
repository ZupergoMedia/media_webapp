"use client";

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
import type { SpecDescriptor } from "@/lib/specs";
import { cn } from "@/lib/utils";

/**
 * Renders an asset type's specification fields from its descriptors.
 *
 * This is the component that makes ~70 asset types tractable. It knows nothing
 * about billboards, screens or vehicles — it reads `specSchema` from the
 * database and renders whatever fields that type declares, grouped and ordered
 * as the taxonomy specifies.
 *
 * Adding a new medium is therefore a data change. Nothing here needs editing.
 */
export function DynamicSpecFields({
  descriptors,
  values,
  errors,
  onChange,
}: {
  descriptors: SpecDescriptor[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (name: string, value: unknown) => void;
}) {
  if (descriptors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This asset type has no additional specifications.
      </p>
    );
  }

  // Group and order exactly as the taxonomy declares.
  const groups = new Map<string, SpecDescriptor[]>();
  for (const descriptor of [...descriptors].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  )) {
    const key = descriptor.group ?? "Details";
    groups.set(key, [...(groups.get(key) ?? []), descriptor]);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, fields]) => (
        <fieldset key={group}>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((descriptor) => (
              <SpecField
                key={descriptor.name}
                descriptor={descriptor}
                value={values[descriptor.name]}
                error={errors[descriptor.name]}
                onChange={(value) => onChange(descriptor.name, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function SpecField({
  descriptor,
  value,
  error,
  onChange,
}: {
  descriptor: SpecDescriptor;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const id = `spec-${descriptor.name}`;
  const describedBy = [
    error ? `${id}-error` : null,
    descriptor.help ? `${id}-help` : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Textareas and booleans read better full width than in a two-column grid.
  const fullWidth =
    descriptor.input === "textarea" || descriptor.input === "boolean";

  return (
    <div className={cn("space-y-1.5", fullWidth && "sm:col-span-2")}>
      {descriptor.input !== "boolean" && (
        <Label htmlFor={id}>
          {descriptor.label}
          {descriptor.unit && (
            <span className="ml-1 font-normal text-muted-foreground">
              ({descriptor.unit})
            </span>
          )}
          {descriptor.required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}

      {descriptor.input === "boolean" ? (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            aria-describedby={describedBy || undefined}
          />
          {descriptor.label}
        </label>
      ) : descriptor.input === "select" ? (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          <SelectTrigger
            id={id}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            className={cn(error && "border-danger")}
          >
            <SelectValue placeholder={`Select ${descriptor.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {descriptor.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : descriptor.input === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(error && "border-danger")}
        />
      ) : (
        <Input
          id={id}
          type={descriptor.input === "number" ? "number" : "text"}
          inputMode={descriptor.input === "number" ? "numeric" : undefined}
          min={descriptor.min}
          max={descriptor.max}
          value={
            value === undefined || value === null ? "" : String(value)
          }
          onChange={(event) => {
            const raw = event.target.value;
            if (descriptor.input === "number") {
              // Empty clears the field rather than coercing to 0, which would
              // silently record a real measurement the owner never entered.
              onChange(raw === "" ? undefined : Number(raw));
            } else {
              onChange(raw);
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(error && "border-danger")}
        />
      )}

      {descriptor.help && (
        <p id={`${id}-help`} className="text-xs text-subtle-foreground">
          {descriptor.help}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
