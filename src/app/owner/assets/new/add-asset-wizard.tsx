"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
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
import { parseSpecSchema, buildSpecValidator } from "@/lib/specs";
import {
  PRICING_UNITS,
  PRICING_UNIT_LABELS,
  createAssetSchema,
} from "@/lib/asset-schema";
import type { WizardTaxonomy } from "@/server/services/owner-service";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Add Asset wizard.
 *
 * Eight steps, but the shape of steps 5–7 is decided by the chosen asset type:
 * specification fields come from that type's descriptors, and the digital and
 * coverage steps appear only for types that need them.
 *
 * The wizard therefore has no per-type branching beyond `isDigital`/`isMobile`
 * flags that the database already provides. Adding a new medium changes nothing
 * in this file.
 */

interface StepDef {
  id: string;
  label: string;
}

interface FormState {
  typeId: string;
  title: string;
  description: string;
  specs: Record<string, unknown>;
  dailyImpressions: string;
  audienceProfile: string;
  location: {
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    lat: string;
    lng: string;
  };
  images: Array<{ url: string; alt: string }>;
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

const EMPTY: FormState = {
  typeId: "",
  title: "",
  description: "",
  specs: {},
  dailyImpressions: "",
  audienceProfile: "",
  location: {
    addressLine: "",
    locality: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "",
    lat: "",
    lng: "",
  },
  images: [{ url: "", alt: "" }],
  pricing: [
    { unit: "PER_MONTH", amount: "", discountThreshold: "", discountPercent: "" },
  ],
  blackouts: [],
  digital: {
    slotDurationSeconds: "15",
    loopDurationSeconds: "180",
    operatingHoursStart: "6",
    operatingHoursEnd: "23",
    screenWidthPx: "",
    screenHeightPx: "",
  },
  operatingAreas: [],
};

export function AddAssetWizard({ taxonomy }: { taxonomy: WizardTaxonomy }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allTypes = useMemo(
    () => taxonomy.flatMap((category) => category.assetTypes),
    [taxonomy],
  );

  const selectedType = useMemo(
    () => allTypes.find((type) => type.id === form.typeId),
    [allTypes, form.typeId],
  );

  const descriptors = useMemo(
    () => (selectedType ? parseSpecSchema(selectedType.specSchema) : []),
    [selectedType],
  );

  // Steps are computed from the selected type: a billboard never sees the
  // digital slot step, and a fixed asset never sees coverage.
  const steps = useMemo<StepDef[]>(() => {
    const base: StepDef[] = [
      { id: "type", label: "Asset type" },
      { id: "basics", label: "Basics" },
      { id: "location", label: "Location" },
      { id: "photos", label: "Photos" },
      { id: "specs", label: "Specifications" },
    ];

    if (selectedType?.isDigital) base.push({ id: "digital", label: "Slots" });
    if (selectedType?.isMobile) base.push({ id: "coverage", label: "Coverage" });

    base.push(
      { id: "availability", label: "Availability" },
      { id: "pricing", label: "Pricing" },
      { id: "review", label: "Review" },
    );
    return base;
  }, [selectedType]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const patch = (updates: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...updates }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form, selectedType);
      const response = await fetch("/api/owner/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new SubmitError(data.error ?? "Could not create the listing", data.issues);
      }
      return data as { slug: string };
    },
    onSuccess: () => {
      router.push("/owner/assets?created=1");
      router.refresh();
    },
  });

  /** Validates only the current step, so owners are not blocked by later fields. */
  const validateStep = (): boolean => {
    const next: Record<string, string> = {};

    if (step.id === "type" && !form.typeId) {
      next.typeId = "Choose an asset type to continue";
    }

    if (step.id === "basics") {
      if (form.title.trim().length < 8) {
        next.title = "Give the listing a descriptive title (at least 8 characters)";
      }
    }

    if (step.id === "location") {
      if (!form.location.city.trim()) next.city = "City is required";
      if (!form.location.state.trim()) next.state = "State is required";
      if (form.location.pincode && !/^\d{6}$/.test(form.location.pincode)) {
        next.pincode = "Enter a 6-digit pincode";
      }
      const lat = Number(form.location.lat);
      const lng = Number(form.location.lng);
      if (form.location.lat && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        next.lat = "Latitude must be between -90 and 90";
      }
      if (form.location.lng && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
        next.lng = "Longitude must be between -180 and 180";
      }
    }

    if (step.id === "photos") {
      const usable = form.images.filter((image) => image.url.trim());
      if (usable.length === 0) next.images = "Add at least one photo URL";
    }

    if (step.id === "specs") {
      // Validated against the type's own descriptors — the same rules the
      // server will apply, so the owner is never surprised at submit.
      const validator = buildSpecValidator(selectedType?.specSchema ?? []);
      const result = validator.safeParse(form.specs);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          if (!next[key]) next[key] = issue.message;
        }
      }
    }

    if (step.id === "coverage" && form.operatingAreas.length === 0) {
      next.operatingAreas =
        "Mobile assets need at least one operating area so advertisers can find them";
    }

    if (step.id === "pricing") {
      const priced = form.pricing.filter((price) => Number(price.amount) > 0);
      if (priced.length === 0) next.pricing = "Add at least one price";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setStepIndex((index) => Math.max(0, index - 1));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Step rail */}
      <nav aria-label="Listing steps">
        <ol className="space-y-1">
          {steps.map((entry, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={entry.id}>
                <div
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm",
                    current && "bg-surface-muted font-medium",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      done && "bg-success text-white",
                      current && "bg-foreground text-background",
                      !done && !current && "bg-surface-sunken text-subtle-foreground",
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn(!current && "text-muted-foreground")}>
                    {entry.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0">
        <div className="rounded-card border border-border bg-surface p-6">
          {/* 1 — Type */}
          {step.id === "type" && (
            <StepShell
              title="What are you listing?"
              hint="Your choice determines which details we ask for next."
            >
              <div className="space-y-5">
                {taxonomy.map((category) => (
                  <div key={category.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.name}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {category.assetTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => patch({ typeId: type.id, specs: {} })}
                          aria-pressed={form.typeId === type.id}
                          className={cn(
                            "rounded-control border px-3 py-2 text-left text-sm transition-colors",
                            form.typeId === type.id
                              ? "border-foreground bg-surface-muted font-medium"
                              : "border-border hover:border-border-strong",
                          )}
                        >
                          {type.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {errors.typeId && <ErrorText>{errors.typeId}</ErrorText>}
            </StepShell>
          )}

          {/* 2 — Basics */}
          {step.id === "basics" && (
            <StepShell
              title="Describe your asset"
              hint="Advertisers see this first, so be specific about the location and format."
            >
              <div className="space-y-4">
                <TextField
                  id="title"
                  label="Listing title"
                  required
                  value={form.title}
                  error={errors.title}
                  placeholder="Premium LED Billboard — BKC Signal Junction"
                  onChange={(value) => patch({ title: value })}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    value={form.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Visibility, traffic patterns, nearby landmarks…"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="dailyImpressions"
                    label="Estimated daily impressions"
                    type="number"
                    value={form.dailyImpressions}
                    onChange={(value) => patch({ dailyImpressions: value })}
                    placeholder="150000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="audienceProfile">Audience profile</Label>
                  <Textarea
                    id="audienceProfile"
                    rows={2}
                    value={form.audienceProfile}
                    onChange={(event) => patch({ audienceProfile: event.target.value })}
                    placeholder="Corporate commuters, premium retail shoppers…"
                  />
                </div>
              </div>
            </StepShell>
          )}

          {/* 3 — Location */}
          {step.id === "location" && (
            <StepShell
              title="Where is it?"
              hint="Coordinates place your asset on the map, which is how most advertisers search."
            >
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
                  placeholder="Bandra Kurla Complex"
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
                  placeholder="400051"
                  onChange={(value) =>
                    patch({ location: { ...form.location, pincode: value } })
                  }
                />
                <TextField
                  id="lat"
                  label="Latitude"
                  value={form.location.lat}
                  error={errors.lat}
                  placeholder="19.0662"
                  onChange={(value) =>
                    patch({ location: { ...form.location, lat: value } })
                  }
                />
                <TextField
                  id="lng"
                  label="Longitude"
                  value={form.location.lng}
                  error={errors.lng}
                  placeholder="72.8686"
                  onChange={(value) =>
                    patch({ location: { ...form.location, lng: value } })
                  }
                />
              </div>
              <p className="mt-3 text-xs text-subtle-foreground">
                Without coordinates your listing will not appear on the map or in
                nearby searches.
              </p>
            </StepShell>
          )}

          {/* 4 — Photos */}
          {step.id === "photos" && (
            <StepShell
              title="Add photos"
              hint="Photos are the strongest signal that a site is real. The first becomes the cover image."
            >
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
                          // Owner-supplied URLs may 404; the browser's broken
                          // image state is acceptable here and self-explanatory.
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
                        placeholder="https://…"
                        onChange={(event) => {
                          const images = [...form.images];
                          images[index] = { ...images[index], url: event.target.value };
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

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => patch({ images: [...form.images, { url: "", alt: "" }] })}
                >
                  <Plus className="size-4" />
                  Add another photo
                </Button>

                {errors.images && <ErrorText>{errors.images}</ErrorText>}

                <p className="text-xs text-subtle-foreground">
                  Direct file upload arrives with image storage. For now, paste a
                  hosted image URL.
                </p>
              </div>
            </StepShell>
          )}

          {/* 5 — Specs (fully dynamic) */}
          {step.id === "specs" && (
            <StepShell
              title={`${selectedType?.name ?? "Asset"} specifications`}
              hint="These fields are specific to this asset type."
            >
              <DynamicSpecFields
                descriptors={descriptors}
                values={form.specs}
                errors={errors}
                onChange={(name, value) =>
                  patch({ specs: { ...form.specs, [name]: value } })
                }
              />
            </StepShell>
          )}

          {/* 6a — Digital */}
          {step.id === "digital" && (
            <StepShell
              title="Slot configuration"
              hint="How your screen divides advertising time. We calculate slots per loop for you."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="slotDuration"
                  label="Slot duration (seconds)"
                  type="number"
                  required
                  value={form.digital.slotDurationSeconds}
                  onChange={(value) =>
                    patch({ digital: { ...form.digital, slotDurationSeconds: value } })
                  }
                />
                <TextField
                  id="loopDuration"
                  label="Loop duration (seconds)"
                  type="number"
                  required
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

              <p className="mt-4 rounded-control bg-surface-muted p-3 text-sm">
                {(() => {
                  const slot = Number(form.digital.slotDurationSeconds);
                  const loop = Number(form.digital.loopDurationSeconds);
                  if (!slot || !loop || slot > loop) {
                    return "Enter slot and loop durations to see your inventory.";
                  }
                  const slots = Math.floor(loop / slot);
                  const hours =
                    Number(form.digital.operatingHoursEnd) -
                    Number(form.digital.operatingHoursStart);
                  const plays = Math.round((hours * 3600) / loop);
                  return `${slots} slots per loop · roughly ${plays} plays per slot per day.`;
                })()}
              </p>
            </StepShell>
          )}

          {/* 6b — Coverage */}
          {step.id === "coverage" && (
            <StepShell
              title="Operating areas"
              hint="Mobile assets are found by the areas they serve, not a single address."
            >
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
                      placeholder="Western Suburbs"
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
                      id={`area-lat-${index}`}
                      label="Centre latitude"
                      value={area.centerLat}
                      onChange={(value) => {
                        const areas = [...form.operatingAreas];
                        areas[index] = { ...areas[index], centerLat: value };
                        patch({ operatingAreas: areas });
                      }}
                    />
                    <TextField
                      id={`area-lng-${index}`}
                      label="Centre longitude"
                      value={area.centerLng}
                      onChange={(value) => {
                        const areas = [...form.operatingAreas];
                        areas[index] = { ...areas[index], centerLng: value };
                        patch({ operatingAreas: areas });
                      }}
                    />
                    <TextField
                      id={`area-radius-${index}`}
                      label="Radius (metres)"
                      type="number"
                      value={area.radiusMeters}
                      placeholder="8000"
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
            </StepShell>
          )}

          {/* 7 — Availability */}
          {step.id === "availability" && (
            <StepShell
              title="Availability"
              hint="Your asset is bookable by default. Block any dates it is already committed."
            >
              <div className="space-y-3">
                {form.blackouts.length === 0 && (
                  <p className="rounded-control bg-surface-muted p-3 text-sm text-muted-foreground">
                    No blocked dates. Advertisers can book any future window.
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
                      placeholder="Maintenance"
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
            </StepShell>
          )}

          {/* 8 — Pricing */}
          {step.id === "pricing" && (
            <StepShell
              title="Set your pricing"
              hint="Enter amounts in rupees. Add multiple units if you sell by both day and month."
            >
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
                      placeholder="150000"
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
                      placeholder="30"
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
                      placeholder="10"
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
            </StepShell>
          )}

          {/* 9 — Review */}
          {step.id === "review" && (
            <StepShell
              title="Review and submit"
              hint="Your listing goes to our team for verification before it appears in search."
            >
              <dl className="divide-y divide-border rounded-card border border-border">
                <ReviewRow label="Type" value={selectedType?.name ?? "—"} />
                <ReviewRow label="Title" value={form.title} />
                <ReviewRow
                  label="Location"
                  value={[form.location.locality, form.location.city, form.location.state]
                    .filter(Boolean)
                    .join(", ")}
                />
                <ReviewRow
                  label="Coordinates"
                  value={
                    form.location.lat && form.location.lng
                      ? `${form.location.lat}, ${form.location.lng}`
                      : "Not set — will not appear on the map"
                  }
                />
                <ReviewRow
                  label="Photos"
                  value={`${form.images.filter((i) => i.url.trim()).length} added`}
                />
                <ReviewRow
                  label="Specifications"
                  value={`${Object.values(form.specs).filter((v) => v !== undefined && v !== "").length} of ${descriptors.length} fields`}
                />
                <ReviewRow
                  label="Pricing"
                  value={form.pricing
                    .filter((price) => Number(price.amount) > 0)
                    .map(
                      (price) =>
                        `${formatPaise(Number(price.amount) * 100)} ${PRICING_UNIT_LABELS[price.unit as keyof typeof PRICING_UNIT_LABELS].toLowerCase()}`,
                    )
                    .join(" · ")}
                />
                <ReviewRow
                  label="Blocked dates"
                  value={
                    form.blackouts.length
                      ? `${form.blackouts.length} window(s)`
                      : "None"
                  }
                />
              </dl>

              <div className="mt-4 rounded-card border border-border bg-surface-muted p-4 text-sm">
                <p className="font-medium">What happens next</p>
                <p className="mt-1 text-muted-foreground">
                  Our team reviews your listing — typically within one business
                  day. Once verified it becomes searchable and bookable. You can
                  edit it at any time from your dashboard.
                </p>
              </div>

              {mutation.isError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-4"
                >
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-danger">
                      {(mutation.error as SubmitError).message}
                    </p>
                    {(mutation.error as SubmitError).issues?.length ? (
                      <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                        {(mutation.error as SubmitError).issues!.slice(0, 5).map(
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
            </StepShell>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {step.id === "review" ? (
            <Button
              size="lg"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit for verification"
              )}
            </Button>
          ) : (
            <Button size="lg" onClick={goNext}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

class SubmitError extends Error {
  constructor(
    message: string,
    readonly issues?: Array<{ path?: (string | number)[]; message: string }>,
  ) {
    super(message);
    this.name = "SubmitError";
  }
}

/** Converts form strings into the API's typed payload. */
function buildPayload(
  form: FormState,
  type: WizardTaxonomy[number]["assetTypes"][number] | undefined,
): unknown {
  const numeric = (value: string) =>
    value.trim() === "" ? undefined : Number(value);

  const payload = {
    typeId: form.typeId,
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
      .map((image) => ({
        url: image.url.trim(),
        alt: image.alt.trim() || undefined,
      })),
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
    digital: type?.isDigital
      ? {
          slotDurationSeconds: Number(form.digital.slotDurationSeconds),
          loopDurationSeconds: Number(form.digital.loopDurationSeconds),
          operatingHoursStart: Number(form.digital.operatingHoursStart),
          operatingHoursEnd: Number(form.digital.operatingHoursEnd),
          screenWidthPx: numeric(form.digital.screenWidthPx),
          screenHeightPx: numeric(form.digital.screenHeightPx),
        }
      : undefined,
    operatingAreas: type?.isMobile
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

  // Parsed locally first so obvious mistakes surface before a round trip.
  const result = createAssetSchema.safeParse(payload);
  return result.success ? result.data : payload;
}

function StepShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium">{value || "—"}</dd>
    </div>
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
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
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
        placeholder={placeholder}
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
