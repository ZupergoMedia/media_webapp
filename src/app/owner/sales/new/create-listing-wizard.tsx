"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  saleOwnershipRightsSchema,
  SALE_OWNERSHIP_TYPES,
  SALE_OWNERSHIP_TYPE_LABELS,
  SALE_INCLUSIONS,
  SALE_INCLUSION_LABELS,
} from "@/lib/sale-schema";
import { cn } from "@/lib/utils";

/**
 * "Select an existing asset, then create a sale listing" wizard.
 *
 * Steps: pick asset -> price & rights -> financials (all optional) -> review.
 * Property details and permits/documents are deliberately not in this
 * wizard — they are edited afterwards on the listing's own edit page, which
 * keeps the initial listing flow short enough that a seller finishes it in
 * one sitting. A listing can be published (submitted) without ever touching
 * property/permits, matching the spec's instruction not to make all
 * permissions mandatory.
 *
 * Follows this codebase's house pattern throughout: useState + manual
 * zod.safeParse per step, not react-hook-form (installed, never used
 * elsewhere in this app — see add-asset-wizard.tsx).
 */

const STEPS = [
  { id: "asset", label: "Asset" },
  { id: "terms", label: "Price & rights" },
  { id: "financials", label: "Financials" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface EligibleAsset {
  id: string;
  title: string;
  typeName: string;
  city: string | null;
  locality: string | null;
  imageUrl: string | null;
}

interface FinancialsState {
  currentMonthlyRevenue: string;
  currentAnnualRevenue: string;
  averageOccupancyPercent: string;
  expectedRoiPercent: string;
}

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function CreateListingWizard({
  eligibleAssets,
}: {
  eligibleAssets: EligibleAsset[];
}) {
  const router = useRouter();

  const [step, setStep] = useState<StepId>("asset");
  const [assetId, setAssetId] = useState<string | null>(null);

  const [askingPrice, setAskingPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [locationPrecision, setLocationPrecision] = useState<"EXACT" | "APPROXIMATE">(
    "APPROXIMATE",
  );
  const [ownershipType, setOwnershipType] = useState<
    (typeof SALE_OWNERSHIP_TYPES)[number] | ""
  >("");
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [inclusionsNote, setInclusionsNote] = useState("");

  const [financials, setFinancials] = useState<FinancialsState>({
    currentMonthlyRevenue: "",
    currentAnnualRevenue: "",
    averageOccupancyPercent: "",
    expectedRoiPercent: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedAsset = eligibleAssets.find((a) => a.id === assetId) ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/owner/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          askingPrice: Number(askingPrice),
          negotiable,
          locationPrecision,
          ownership: {
            ownershipType,
            inclusions,
            inclusionsNote: inclusionsNote || undefined,
          },
          financials: {
            currentMonthlyRevenue: financials.currentMonthlyRevenue
              ? Number(financials.currentMonthlyRevenue)
              : undefined,
            currentAnnualRevenue: financials.currentAnnualRevenue
              ? Number(financials.currentAnnualRevenue)
              : undefined,
            averageOccupancyPercent: financials.averageOccupancyPercent
              ? Number(financials.averageOccupancyPercent)
              : undefined,
            expectedRoiPercent: financials.expectedRoiPercent
              ? Number(financials.expectedRoiPercent)
              : undefined,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new RequestError(payload.error ?? "Could not create the listing", response.status);
      }
      return payload as { id: string; slug: string };
    },
    onSuccess: (data) => {
      router.push(`/owner/sales/${data.id}/edit`);
    },
  });

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const validateTerms = () => {
    const result = saleOwnershipRightsSchema.safeParse({
      ownershipType,
      inclusions,
      inclusionsNote: inclusionsNote || undefined,
    });
    const priceValid = askingPrice.trim() !== "" && Number(askingPrice) > 0;

    if (result.success && priceValid) {
      setFieldErrors({});
      return true;
    }

    const errors: Record<string, string> = {};
    if (!priceValid) errors.askingPrice = "Enter an asking price greater than zero";
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errors[key]) errors[key] = issue.message;
      }
    }
    setFieldErrors(errors);
    return false;
  };

  const goNext = () => {
    if (step === "asset") {
      if (!assetId) {
        setFieldErrors({ assetId: "Choose an asset to sell" });
        return;
      }
      setFieldErrors({});
      setStep("terms");
      return;
    }
    if (step === "terms") {
      if (validateTerms()) setStep("financials");
      return;
    }
    if (step === "financials") {
      setStep("review");
      return;
    }
  };

  const goBack = () => {
    const prevIndex = Math.max(0, stepIndex - 1);
    setStep(STEPS[prevIndex].id);
  };

  return (
    <div>
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((s, index) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                index < stepIndex
                  ? "bg-brand text-brand-foreground"
                  : index === stepIndex
                    ? "border-2 border-brand text-brand"
                    : "border border-border-strong text-subtle-foreground",
              )}
            >
              {index < stepIndex ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                index === stepIndex ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      {step === "asset" && (
        <div>
          <h2 className="mb-1 text-lg font-semibold">Choose an asset to sell</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Only assets that are active or paused, and not already listed for
            sale, appear here.
          </p>

          {eligibleAssets.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-strong bg-surface p-8 text-center text-sm text-muted-foreground">
              You have no eligible assets. An asset must be active or paused,
              and verified for advertising, before it can be put up for sale.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {eligibleAssets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => setAssetId(asset.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-card border p-3 text-left transition-colors",
                      assetId === asset.id
                        ? "border-brand bg-brand-subtle/40"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                      {asset.imageUrl ? (
                        <Image
                          src={asset.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{asset.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{asset.typeName}</p>
                      {asset.city && (
                        <p className="text-xs text-subtle-foreground">
                          {asset.locality ? `${asset.locality}, ` : ""}
                          {asset.city}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fieldErrors.assetId && (
            <p className="mt-2 text-sm text-danger">{fieldErrors.assetId}</p>
          )}
        </div>
      )}

      {step === "terms" && selectedAsset && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Price &amp; rights</h2>

          <div>
            <Label htmlFor="askingPrice">Asking price (₹)</Label>
            <Input
              id="askingPrice"
              type="number"
              min={1}
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              placeholder="3500000"
            />
            {fieldErrors.askingPrice && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.askingPrice}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="negotiable"
              checked={negotiable}
              onCheckedChange={(checked) => setNegotiable(checked === true)}
            />
            <Label htmlFor="negotiable" className="font-normal">
              Price is negotiable
            </Label>
          </div>

          <div>
            <Label>Location shown to the public</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Approximate location snaps the pin to a ~1km area and hides the
              exact address. Choose exact only if you are comfortable
              publishing the precise site.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={locationPrecision === "APPROXIMATE" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setLocationPrecision("APPROXIMATE")}
              >
                Approximate
              </Button>
              <Button
                type="button"
                variant={locationPrecision === "EXACT" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setLocationPrecision("EXACT")}
              >
                Exact
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="ownershipType">What best describes how you hold this asset?</Label>
            <Select
              value={ownershipType}
              onValueChange={(value) => setOwnershipType(value as typeof ownershipType)}
            >
              <SelectTrigger id="ownershipType">
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {SALE_OWNERSHIP_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {SALE_OWNERSHIP_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.ownershipType && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.ownershipType}</p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Be specific — the buyer needs to know exactly what they would be
              acquiring. You do not need to own the land to sell advertising
              or operating rights.
            </p>
          </div>

          <div>
            <Label>What is included in the sale?</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Select everything the buyer actually receives.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SALE_INCLUSIONS.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={inclusions.includes(value)}
                    onCheckedChange={(checked) =>
                      setInclusions((prev) =>
                        checked === true
                          ? [...prev, value]
                          : prev.filter((v) => v !== value),
                      )
                    }
                  />
                  {SALE_INCLUSION_LABELS[value]}
                </label>
              ))}
            </div>
            {fieldErrors.inclusions && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.inclusions}</p>
            )}
          </div>

          <div>
            <Label htmlFor="inclusionsNote">Anything else buyers should know? (optional)</Label>
            <Textarea
              id="inclusionsNote"
              value={inclusionsNote}
              onChange={(e) => setInclusionsNote(e.target.value)}
              placeholder="e.g. advertising rights cover the north-facing panel only"
              rows={2}
            />
          </div>
        </div>
      )}

      {step === "financials" && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Financials (optional)</h2>
          <p className="text-sm text-muted-foreground">
            None of this is required. Anything you leave blank shows to
            buyers as &quot;Not disclosed by seller&quot; rather than zero.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="currentMonthlyRevenue">Current monthly revenue (₹)</Label>
              <Input
                id="currentMonthlyRevenue"
                type="number"
                min={0}
                value={financials.currentMonthlyRevenue}
                onChange={(e) =>
                  setFinancials((f) => ({ ...f, currentMonthlyRevenue: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="currentAnnualRevenue">Current annual revenue (₹)</Label>
              <Input
                id="currentAnnualRevenue"
                type="number"
                min={0}
                value={financials.currentAnnualRevenue}
                onChange={(e) =>
                  setFinancials((f) => ({ ...f, currentAnnualRevenue: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="averageOccupancyPercent">Average occupancy (%)</Label>
              <Input
                id="averageOccupancyPercent"
                type="number"
                min={0}
                max={100}
                value={financials.averageOccupancyPercent}
                onChange={(e) =>
                  setFinancials((f) => ({ ...f, averageOccupancyPercent: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="expectedRoiPercent">Expected ROI (%)</Label>
              <Input
                id="expectedRoiPercent"
                type="number"
                min={0}
                value={financials.expectedRoiPercent}
                onChange={(e) =>
                  setFinancials((f) => ({ ...f, expectedRoiPercent: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {step === "review" && selectedAsset && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Review</h2>
          <dl className="space-y-2 rounded-card border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Asset</dt>
              <dd className="text-right font-medium">{selectedAsset.title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Asking price</dt>
              <dd className="text-right font-medium">
                ₹{Number(askingPrice || 0).toLocaleString("en-IN")}
                {negotiable ? " (negotiable)" : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Location shown</dt>
              <dd className="text-right font-medium">
                {locationPrecision === "EXACT" ? "Exact" : "Approximate"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ownership</dt>
              <dd className="text-right font-medium">
                {ownershipType ? SALE_OWNERSHIP_TYPE_LABELS[ownershipType] : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Includes</dt>
              <dd className="text-right font-medium">
                {inclusions.map((v) => SALE_INCLUSION_LABELS[v as never]).join(", ") || "—"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            This creates a draft. You can add property details, permits and
            supporting documents afterwards, then publish when ready.
          </p>

          {mutation.isError && (
            <p role="alert" className="text-sm text-danger">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={goBack}
          disabled={step === "asset"}
        >
          Back
        </Button>

        {step === "review" ? (
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Create draft listing
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
