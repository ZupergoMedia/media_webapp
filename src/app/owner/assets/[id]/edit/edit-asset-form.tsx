"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicSpecFields } from "@/components/owner/dynamic-spec-fields";
import { ImageUploader } from "@/components/owner/image-uploader";
import { parseSpecSchema, buildSpecValidator } from "@/lib/specs";
import { PRICING_UNITS, PRICING_UNIT_LABELS } from "@/lib/asset-schema";
import { cn } from "@/lib/utils";

/**
 * Edit an existing listing.
 *
 * A single scrolling form rather than the creation wizard's steps. Creating is
 * a guided task where the partner does not yet know what is being asked;
 * editing is a corrective one, where they usually arrive knowing the single
 * field they came to change. Making them walk eight steps to fix a price would
 * be worse, not friendlier.
 *
 * Asset type is fixed. It determines the spec schema and booking model, so
 * changing it would invalidate the stored specifications — see
 * `updateAssetSchema`.
 */

export interface EditAssetInitial {
  id: string;
  title: string;
  description: string;
  typeName: string;
  categoryName: string;
  isDigital: boolean;
  isMobile: boolean;
  specSchema: unknown;
  specs: Record<string, unknown>;
  dailyImpressions: string;
  audienceProfile: string;
  verificationStatus: string;
  status: string;
  location: {
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    lat: string;
    lng: string;
  };
  images: Array<{ url: string }>;
  pricing: Array<{
    unit: string;
    amount: string;
    discountThreshold: string;
    discountPercent: string;
  }>;
  blackouts: Array<{ startDate: string; endDate: string; note: string }>;
  digital: {
    slotDurationSeconds: string;
    loopDurationSeconds: string;
    operatingHoursStart: string;
    operatingHoursEnd: string;
    screenWidthPx: string;
    screenHeightPx: string;
  };
  operatingAreas: Array<{
    name: string;
    city: string;
    centerLat: string;
    centerLng: string;
    radiusMeters: string;
  }>;
}

export function EditAssetForm({ initial }: { initial: EditAssetInitial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const descriptors = parseSpecSchema(initial.specSchema);
  const patch = (updates: Partial<EditAssetInitial>) =>
    setForm((current) => ({ ...current, ...updates }));

  const mutation = useMutation({
    mutationFn: async () => {
      const numeric = (value: string) =>
        value.trim() === "" ? undefined : Number(value);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        specs: form.specs,
        dailyImpressions: numeric(form.dailyImpressions),
        audienceProfile: form.audienceProfile.trim() || undefined,
        location: {
          addressLine: form.location.addressLine.trim() || undefined,
          locality: form.location.locality.trim() || undefined,
          city: form.location.city.trim(),
          state: form.location.state.trim(),
          pincode: form.location.pincode.trim() || undefined,
          lat: numeric(form.location.lat),
          lng: numeric(form.location.lng),
        },
        images: form.images
          .filter((image) => image.url.trim())
          .map((image) => ({ url: image.url.trim() })),
        pricing: form.pricing
          .filter((price) => Number(price.amount) > 0)
          .map((price) => ({
            unit: price.unit,
            amount: Number(price.amount),
            discountThreshold: numeric(price.discountThreshold),
            discountPercent: numeric(price.discountPercent),
          })),
        blackouts: form.blackouts
          .filter((window) => window.startDate && window.endDate)
          .map((window) => ({
            startDate: window.startDate,
            endDate: window.endDate,
            note: window.note.trim() || undefined,
          })),
        digital: form.isDigital
          ? {
              slotDurationSeconds: Number(form.digital.slotDurationSeconds),
              loopDurationSeconds: Number(form.digital.loopDurationSeconds),
              operatingHoursStart: Number(form.digital.operatingHoursStart),
              operatingHoursEnd: Number(form.digital.operatingHoursEnd),
              screenWidthPx: numeric(form.digital.screenWidthPx),
              screenHeightPx: numeric(form.digital.screenHeightPx),
            }
          : undefined,
        operatingAreas: form.isMobile
          ? form.operatingAreas
              .filter((area) => area.name.trim())
              .map((area) => ({
                name: area.name.trim(),
                city: area.city.trim() || undefined,
                centerLat: numeric(area.centerLat),
                centerLng: numeric(area.centerLng),
                radiusMeters: numeric(area.radiusMeters),
              }))
          : undefined,
      };

      const response = await fetch(`/api/owner/assets/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new SaveError(data.error ?? "Could not save your changes", data.issues);
      }
      return data as { requiresReverification: boolean };
    },
    onSuccess: (data) => {
      router.push(
        data.requiresReverification
          ? "/owner/assets?updated=review"
          : "/owner/assets?updated=1",
      );
      router.refresh();
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (form.title.trim().length < 8) {
      next.title = "Give the listing a descriptive title (at least 8 characters)";
    }
    if (!form.location.city.trim()) next.city = "City is required";
    if (!form.location.state.trim()) next.state = "State is required";
    if (form.location.pincode && !/^\d{6}$/.test(form.location.pincode)) {
      next.pincode = "Enter a 6-digit pincode";
    }
    if (form.images.filter((image) => image.url.trim()).length === 0) {
      next.images = "Add at least one photo";
    }
    if (form.pricing.filter((price) => Number(price.amount) > 0).length === 0) {
      next.pricing = "Add at least one price";
    }
    if (form.isMobile && form.operatingAreas.length === 0) {
      next.operatingAreas = "Mobile assets need at least one operating area";
    }

    // Specs validate against this type's own descriptors — the same rules the
    // server applies, so the partner is never surprised at save.
    const specResult = buildSpecValidator(initial.specSchema).safeParse(form.specs);
    if (!specResult.success) {
      for (const issue of specResult.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isLive = initial.verificationStatus === "VERIFIED";

  return (
    <div className="space-y-6">
      {/*
        Warns before the fact, not after. A partner editing a live listing needs
        to know that changing the site, its photos or its measurements sends it
        back to review — and that a price change does not.
      */}
      {isLive && (
        <div className="flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning-subtle p-4">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="text-sm">
            <p className="font-medium text-warning">This listing is live</p>
            <p className="mt-0.5 text-muted-foreground">
              Changing the title, location, photos or specifications sends it
              back for verification and removes it from search until approved.
              Editing pricing, availability or the description does not.
            </p>
          </div>
        </div>
      )}

      <Section title="Basics">
        <div className="space-y-4">
          <TextField
            id="title"
            label="Listing title"
            required
            value={form.title}
            error={errors.title}
            onChange={(value) => patch({ title: value })}
          />

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="dailyImpressions"
              label="Estimated daily impressions"
              type="number"
              value={form.dailyImpressions}
              onChange={(value) => patch({ dailyImpressions: value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audienceProfile">Audience profile</Label>
            <Textarea
              id="audienceProfile"
              rows={2}
              value={form.audienceProfile}
              onChange={(event) => patch({ audienceProfile: event.target.value })}
            />
          </div>

          <p className="rounded-control bg-surface-muted p-3 text-xs text-muted-foreground">
            Asset type: <span className="font-medium">{initial.typeName}</span>{" "}
            ({initial.categoryName}). Type cannot be changed after listing — it
            determines which specifications apply. To list this as a different
            type, archive it and create a new listing.
          </p>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="addressLine"
            label="Address"
            value={form.location.addressLine}
            onChange={(value) =>
              patch({ location: { ...form.location, addressLine: value } })
            }
            className="sm:col-span-2"
          />
          <TextField
            id="locality"
            label="Locality"
            value={form.location.locality}
            onChange={(value) =>
              patch({ location: { ...form.location, locality: value } })
            }
          />
          <TextField
            id="city"
            label="City"
            required
            value={form.location.city}
            error={errors.city}
            onChange={(value) =>
              patch({ location: { ...form.location, city: value } })
            }
          />
          <TextField
            id="state"
            label="State"
            required
            value={form.location.state}
            error={errors.state}
            onChange={(value) =>
              patch({ location: { ...form.location, state: value } })
            }
          />
          <TextField
            id="pincode"
            label="Pincode"
            value={form.location.pincode}
            error={errors.pincode}
            onChange={(value) =>
              patch({ location: { ...form.location, pincode: value } })
            }
          />
          <TextField
            id="lat"
            label="Latitude"
            value={form.location.lat}
            onChange={(value) =>
              patch({ location: { ...form.location, lat: value } })
            }
          />
          <TextField
            id="lng"
            label="Longitude"
            value={form.location.lng}
            onChange={(value) =>
              patch({ location: { ...form.location, lng: value } })
            }
          />
        </div>
      </Section>

      <Section title="Photos">
        <div className="space-y-3">
          {form.images.map((image, index) => (
            <div key={index} className="flex gap-3">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-control border border-border bg-surface-sunken">
                {image.url ? (
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <ImagePlus
                      className="size-5 text-subtle-foreground"
                      aria-hidden="true"
                    />
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`image-${index}`} className="text-xs">
                  Photo {index + 1} {index === 0 && "(cover)"}
                </Label>
                <Input
                  id={`image-${index}`}
                  value={image.url}
                  onChange={(event) => {
                    const images = [...form.images];
                    images[index] = { url: event.target.value };
                    patch({ images });
                  }}
                />
              </div>

              {form.images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() =>
                    patch({ images: form.images.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-start gap-2">
            <ImageUploader
              remainingSlots={12 - form.images.filter((i) => i.url.trim()).length}
              onUploaded={(urls) => {
                // Fills blank rows first, then appends.
                const images = [...form.images];
                for (const url of urls) {
                  const blank = images.findIndex((image) => !image.url.trim());
                  if (blank >= 0) images[blank] = { url };
                  else images.push({ url });
                }
                patch({ images });
              }}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ images: [...form.images, { url: "" }] })}
            >
              <Plus className="size-4" />
              Add URL manually
            </Button>
          </div>

          {errors.images && <ErrorText>{errors.images}</ErrorText>}
        </div>
      </Section>

      <Section title={`${initial.typeName} specifications`}>
        <DynamicSpecFields
          descriptors={descriptors}
          values={form.specs}
          errors={errors}
          onChange={(name, value) =>
            patch({ specs: { ...form.specs, [name]: value } })
          }
        />
      </Section>

      {form.isDigital && (
        <Section title="Slot configuration">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="slotDuration"
              label="Slot duration (seconds)"
              type="number"
              value={form.digital.slotDurationSeconds}
              onChange={(value) =>
                patch({ digital: { ...form.digital, slotDurationSeconds: value } })
              }
            />
            <TextField
              id="loopDuration"
              label="Loop duration (seconds)"
              type="number"
              value={form.digital.loopDurationSeconds}
              onChange={(value) =>
                patch({ digital: { ...form.digital, loopDurationSeconds: value } })
              }
            />
            <TextField
              id="hoursStart"
              label="Opening hour (0–23)"
              type="number"
              value={form.digital.operatingHoursStart}
              onChange={(value) =>
                patch({ digital: { ...form.digital, operatingHoursStart: value } })
              }
            />
            <TextField
              id="hoursEnd"
              label="Closing hour (1–24)"
              type="number"
              value={form.digital.operatingHoursEnd}
              onChange={(value) =>
                patch({ digital: { ...form.digital, operatingHoursEnd: value } })
              }
            />
          </div>
        </Section>
      )}

      {form.isMobile && (
        <Section title="Operating areas">
          <div className="space-y-3">
            {form.operatingAreas.map((area, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-2"
              >
                <TextField
                  id={`area-name-${index}`}
                  label="Area name"
                  value={area.name}
                  onChange={(value) => {
                    const areas = [...form.operatingAreas];
                    areas[index] = { ...areas[index], name: value };
                    patch({ operatingAreas: areas });
                  }}
                />
                <TextField
                  id={`area-city-${index}`}
                  label="City"
                  value={area.city}
                  onChange={(value) => {
                    const areas = [...form.operatingAreas];
                    areas[index] = { ...areas[index], city: value };
                    patch({ operatingAreas: areas });
                  }}
                />
                <TextField
                  id={`area-radius-${index}`}
                  label="Radius (metres)"
                  type="number"
                  value={area.radiusMeters}
                  onChange={(value) => {
                    const areas = [...form.operatingAreas];
                    areas[index] = { ...areas[index], radiusMeters: value };
                    patch({ operatingAreas: areas });
                  }}
                />
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      patch({
                        operatingAreas: form.operatingAreas.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                patch({
                  operatingAreas: [
                    ...form.operatingAreas,
                    {
                      name: "",
                      city: form.location.city,
                      centerLat: form.location.lat,
                      centerLng: form.location.lng,
                      radiusMeters: "8000",
                    },
                  ],
                })
              }
            >
              <Plus className="size-4" />
              Add operating area
            </Button>

            {errors.operatingAreas && <ErrorText>{errors.operatingAreas}</ErrorText>}
          </div>
        </Section>
      )}

      <Section title="Availability">
        <div className="space-y-3">
          {form.blackouts.length === 0 && (
            <p className="rounded-control bg-surface-muted p-3 text-sm text-muted-foreground">
              No blocked dates. Advertisers can request any future window.
            </p>
          )}

          {form.blackouts.map((window, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
            >
              <TextField
                id={`blackout-start-${index}`}
                label="From"
                type="date"
                value={window.startDate}
                onChange={(value) => {
                  const blackouts = [...form.blackouts];
                  blackouts[index] = { ...blackouts[index], startDate: value };
                  patch({ blackouts });
                }}
              />
              <TextField
                id={`blackout-end-${index}`}
                label="To"
                type="date"
                value={window.endDate}
                onChange={(value) => {
                  const blackouts = [...form.blackouts];
                  blackouts[index] = { ...blackouts[index], endDate: value };
                  patch({ blackouts });
                }}
              />
              <TextField
                id={`blackout-note-${index}`}
                label="Reason"
                value={window.note}
                onChange={(value) => {
                  const blackouts = [...form.blackouts];
                  blackouts[index] = { ...blackouts[index], note: value };
                  patch({ blackouts });
                }}
              />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove blocked window"
                  onClick={() =>
                    patch({
                      blackouts: form.blackouts.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              patch({
                blackouts: [
                  ...form.blackouts,
                  { startDate: "", endDate: "", note: "" },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Block dates
          </Button>
        </div>
      </Section>

      <Section title="Pricing">
        <div className="space-y-3">
          {form.pricing.map((price, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor={`price-unit-${index}`}>Pricing unit</Label>
                <Select
                  value={price.unit}
                  onValueChange={(value) => {
                    const pricing = [...form.pricing];
                    pricing[index] = { ...pricing[index], unit: value };
                    patch({ pricing });
                  }}
                >
                  <SelectTrigger id={`price-unit-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {PRICING_UNIT_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TextField
                id={`price-amount-${index}`}
                label="Amount (₹)"
                type="number"
                required
                value={price.amount}
                onChange={(value) => {
                  const pricing = [...form.pricing];
                  pricing[index] = { ...pricing[index], amount: value };
                  patch({ pricing });
                }}
              />

              <TextField
                id={`price-threshold-${index}`}
                label="Discount after (days)"
                type="number"
                value={price.discountThreshold}
                onChange={(value) => {
                  const pricing = [...form.pricing];
                  pricing[index] = { ...pricing[index], discountThreshold: value };
                  patch({ pricing });
                }}
              />
              <TextField
                id={`price-percent-${index}`}
                label="Discount (%)"
                type="number"
                value={price.discountPercent}
                onChange={(value) => {
                  const pricing = [...form.pricing];
                  pricing[index] = { ...pricing[index], discountPercent: value };
                  patch({ pricing });
                }}
              />

              {form.pricing.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:col-span-2"
                  onClick={() =>
                    patch({ pricing: form.pricing.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="size-4" />
                  Remove this rate
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              patch({
                pricing: [
                  ...form.pricing,
                  {
                    unit: "PER_DAY",
                    amount: "",
                    discountThreshold: "",
                    discountPercent: "",
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Add another rate
          </Button>

          {errors.pricing && <ErrorText>{errors.pricing}</ErrorText>}
        </div>
      </Section>

      {mutation.isError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-4"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-danger"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-danger">
              {(mutation.error as SaveError).message}
            </p>
            {(mutation.error as SaveError).issues?.length ? (
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {(mutation.error as SaveError).issues!.slice(0, 5).map(
                  (issue, index) => (
                    <li key={index}>
                      {issue.path?.join(".")}: {issue.message}
                    </li>
                  ),
                )}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" asChild>
          <Link href="/owner/assets">Cancel</Link>
        </Button>

        <Button
          size="lg"
          disabled={mutation.isPending}
          onClick={() => {
            if (validate()) mutation.mutate();
          }}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  );
}

class SaveError extends Error {
  constructor(
    message: string,
    readonly issues?: Array<{ path?: (string | number)[]; message: string }>,
  ) {
    super(message);
    this.name = "SaveError";
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-danger">{children}</p>;
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
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
