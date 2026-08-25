"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  SALE_OWNERSHIP_TYPES,
  SALE_OWNERSHIP_TYPE_LABELS,
  SALE_INCLUSIONS,
  SALE_INCLUSION_LABELS,
  PERMIT_TYPES,
  PERMIT_TYPE_LABELS,
  PERMIT_STATUSES,
  PERMIT_STATUS_LABELS,
  SALE_DOCUMENT_CATEGORIES,
  SALE_DOCUMENT_CATEGORY_LABELS,
  SALE_DOCUMENT_VISIBILITIES,
  SALE_DOCUMENT_VISIBILITY_LABELS,
} from "@/lib/sale-schema";

/**
 * Single-page edit form for a sale listing's terms, mirroring
 * edit-asset-form.tsx's shape (useState + manual submit, no wizard, no RHF).
 *
 * Sections are hand-rolled collapsible blocks rather than the Accordion
 * primitive: @radix-ui/react-accordion is a dependency but no ui/accordion.tsx
 * wrapper exists in this codebase yet, and adding one is out of scope for
 * this pass — a plain <details>-like toggle achieves the same result.
 */

interface FinancialsState {
  currentMonthlyRevenue: string;
  currentAnnualRevenue: string;
  averageOccupancyPercent: string;
  averageMonthlyAdIncome: string;
  operatingExpensesAnnual: string;
  annualMaintenanceCost: string;
  landRentAnnual: string;
  permitFeesAnnual: string;
  netAnnualIncome: string;
  expectedRoiPercent: string;
  existingAdvertiserContracts: string;
  remainingContractMonths: string;
}

interface PropertyState {
  propertyOwnershipType: string;
  landOwnerRelationship: string;
  landOwnerName: string;
  propertyAddress: string;
  surveyNumber: string;
  buildingName: string;
  floorLocation: string;
  propertyType: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyLandRent: string;
  annualLandRent: string;
  revenueSharePercent: string;
  renewalTerms: string;
}

interface PermitState {
  permitType: (typeof PERMIT_TYPES)[number];
  permitTypeOther: string;
  documentNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: (typeof PERMIT_STATUSES)[number];
  notes: string;
}

interface DocumentState {
  category: (typeof SALE_DOCUMENT_CATEGORIES)[number];
  documentType: string;
  title: string;
  documentNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  visibility: (typeof SALE_DOCUMENT_VISIBILITIES)[number];
}

export interface EditListingInitial {
  id: string;
  slug: string;
  status: string;
  syncState: string;
  assetTitle: string;

  askingPrice: string;
  negotiable: boolean;
  locationPrecision: "EXACT" | "APPROXIMATE";

  ownershipType: (typeof SALE_OWNERSHIP_TYPES)[number];
  inclusions: string[];
  inclusionsNote: string;

  financials: FinancialsState;
  property: PropertyState | null;
  permits: PermitState[];
  documents: DocumentState[];
}

const EMPTY_PROPERTY: PropertyState = {
  propertyOwnershipType: "",
  landOwnerRelationship: "",
  landOwnerName: "",
  propertyAddress: "",
  surveyNumber: "",
  buildingName: "",
  floorLocation: "",
  propertyType: "",
  leaseStartDate: "",
  leaseEndDate: "",
  monthlyLandRent: "",
  annualLandRent: "",
  revenueSharePercent: "",
  renewalTerms: "",
};

const EMPTY_PERMIT: PermitState = {
  permitType: "MUNICIPAL_ADVERTISING_PERMIT",
  permitTypeOther: "",
  documentNumber: "",
  issuingAuthority: "",
  issueDate: "",
  expiryDate: "",
  status: "NOT_AVAILABLE",
  notes: "",
};

const EMPTY_DOCUMENT: DocumentState = {
  category: "OWNERSHIP",
  documentType: "",
  title: "",
  documentNumber: "",
  issuingAuthority: "",
  issueDate: "",
  expiryDate: "",
  visibility: "ADMIN_ONLY",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function numOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function EditListingForm({ initial }: { initial: EditListingInitial }) {
  const router = useRouter();

  const [askingPrice, setAskingPrice] = useState(initial.askingPrice);
  const [negotiable, setNegotiable] = useState(initial.negotiable);
  const [locationPrecision, setLocationPrecision] = useState(initial.locationPrecision);
  const [ownershipType, setOwnershipType] = useState(initial.ownershipType);
  const [inclusions, setInclusions] = useState<string[]>(initial.inclusions);
  const [inclusionsNote, setInclusionsNote] = useState(initial.inclusionsNote);
  const [financials, setFinancials] = useState<FinancialsState>(initial.financials);
  const [propertyEnabled, setPropertyEnabled] = useState(initial.property !== null);
  const [property, setProperty] = useState<PropertyState>(initial.property ?? EMPTY_PROPERTY);
  const [permits, setPermits] = useState<PermitState[]>(initial.permits);
  const [documents, setDocuments] = useState<DocumentState[]>(initial.documents);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/owner/sales/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          askingPrice: Number(askingPrice),
          negotiable,
          locationPrecision,
          ownership: {
            ownershipType,
            inclusions,
            inclusionsNote: inclusionsNote || undefined,
          },
          financials: {
            currentMonthlyRevenue: numOrUndefined(financials.currentMonthlyRevenue),
            currentAnnualRevenue: numOrUndefined(financials.currentAnnualRevenue),
            averageOccupancyPercent: numOrUndefined(financials.averageOccupancyPercent),
            averageMonthlyAdIncome: numOrUndefined(financials.averageMonthlyAdIncome),
            operatingExpensesAnnual: numOrUndefined(financials.operatingExpensesAnnual),
            annualMaintenanceCost: numOrUndefined(financials.annualMaintenanceCost),
            landRentAnnual: numOrUndefined(financials.landRentAnnual),
            permitFeesAnnual: numOrUndefined(financials.permitFeesAnnual),
            netAnnualIncome: numOrUndefined(financials.netAnnualIncome),
            expectedRoiPercent: numOrUndefined(financials.expectedRoiPercent),
            existingAdvertiserContracts: financials.existingAdvertiserContracts || undefined,
            remainingContractMonths: numOrUndefined(financials.remainingContractMonths),
          },
          property: propertyEnabled
            ? {
                ...property,
                monthlyLandRent: numOrUndefined(property.monthlyLandRent),
                annualLandRent: numOrUndefined(property.annualLandRent),
                revenueSharePercent: numOrUndefined(property.revenueSharePercent),
                leaseStartDate: property.leaseStartDate || undefined,
                leaseEndDate: property.leaseEndDate || undefined,
              }
            : undefined,
          permits: permits.length
            ? permits.map((p) => ({
                ...p,
                issueDate: p.issueDate || undefined,
                expiryDate: p.expiryDate || undefined,
              }))
            : undefined,
          documents: documents.length
            ? documents.map((d) => ({
                ...d,
                issueDate: d.issueDate || undefined,
                expiryDate: d.expiryDate || undefined,
              }))
            : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new RequestError(payload.error ?? "Could not save changes", response.status);
      }
      return payload;
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="space-y-6">
      <Section title="Price & rights">
        <div>
          <Label htmlFor="askingPrice">Asking price (₹)</Label>
          <Input
            id="askingPrice"
            type="number"
            min={1}
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
          />
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
          <div className="mt-1 flex gap-2">
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
          <Label htmlFor="ownershipType">Ownership type</Label>
          <Select
            value={ownershipType}
            onValueChange={(value) => setOwnershipType(value as typeof ownershipType)}
          >
            <SelectTrigger id="ownershipType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALE_OWNERSHIP_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SALE_OWNERSHIP_TYPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>What is included in the sale?</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {SALE_INCLUSIONS.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={inclusions.includes(value)}
                  onCheckedChange={(checked) =>
                    setInclusions((prev) =>
                      checked === true ? [...prev, value] : prev.filter((v) => v !== value),
                    )
                  }
                />
                {SALE_INCLUSION_LABELS[value]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="inclusionsNote">Note for buyers (optional)</Label>
          <Textarea
            id="inclusionsNote"
            value={inclusionsNote}
            onChange={(e) => setInclusionsNote(e.target.value)}
            rows={2}
          />
        </div>
      </Section>

      <Section
        title="Financials"
        description={
          "Optional. Anything left blank shows to buyers as \"Not disclosed by seller\"."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["currentMonthlyRevenue", "Current monthly revenue (₹)"],
              ["currentAnnualRevenue", "Current annual revenue (₹)"],
              ["averageOccupancyPercent", "Average occupancy (%)"],
              ["averageMonthlyAdIncome", "Average monthly ad income (₹)"],
              ["operatingExpensesAnnual", "Operating expenses, annual (₹)"],
              ["annualMaintenanceCost", "Annual maintenance cost (₹)"],
              ["landRentAnnual", "Land rent, annual (₹)"],
              ["permitFeesAnnual", "Permit fees, annual (₹)"],
              ["netAnnualIncome", "Net annual income (₹)"],
              ["expectedRoiPercent", "Expected ROI (%)"],
              ["remainingContractMonths", "Remaining contract (months)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={0}
                value={financials[key]}
                onChange={(e) =>
                  setFinancials((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="existingAdvertiserContracts">Existing advertiser contracts</Label>
          <Textarea
            id="existingAdvertiserContracts"
            value={financials.existingAdvertiserContracts}
            onChange={(e) =>
              setFinancials((f) => ({ ...f, existingAdvertiserContracts: e.target.value }))
            }
            rows={2}
          />
        </div>
      </Section>

      <Section
        title="Land / property"
        description="Optional. Most of this is private and never shown publicly."
      >
        <div className="flex items-center gap-2">
          <Checkbox
            id="propertyEnabled"
            checked={propertyEnabled}
            onCheckedChange={(checked) => setPropertyEnabled(checked === true)}
          />
          <Label htmlFor="propertyEnabled" className="font-normal">
            Add land / property details
          </Label>
        </div>

        {propertyEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["propertyOwnershipType", "Property ownership type"],
                ["landOwnerRelationship", "Land owner relationship"],
                ["landOwnerName", "Land owner name (private)"],
                ["propertyAddress", "Property address (private)"],
                ["surveyNumber", "Survey / Gat / Plot number (private)"],
                ["buildingName", "Building name"],
                ["floorLocation", "Floor / location"],
                ["propertyType", "Property type"],
                ["renewalTerms", "Renewal terms"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={property[key]}
                  onChange={(e) => setProperty((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="leaseStartDate">Lease start date</Label>
              <Input
                id="leaseStartDate"
                type="date"
                value={property.leaseStartDate}
                onChange={(e) => setProperty((p) => ({ ...p, leaseStartDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="leaseEndDate">Lease end date</Label>
              <Input
                id="leaseEndDate"
                type="date"
                value={property.leaseEndDate}
                onChange={(e) => setProperty((p) => ({ ...p, leaseEndDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="monthlyLandRent">Monthly land rent (₹)</Label>
              <Input
                id="monthlyLandRent"
                type="number"
                min={0}
                value={property.monthlyLandRent}
                onChange={(e) => setProperty((p) => ({ ...p, monthlyLandRent: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="revenueSharePercent">Revenue share with land owner (%)</Label>
              <Input
                id="revenueSharePercent"
                type="number"
                min={0}
                max={100}
                value={property.revenueSharePercent}
                onChange={(e) =>
                  setProperty((p) => ({ ...p, revenueSharePercent: e.target.value }))
                }
              />
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Permits & permissions"
        description="Not all permits apply to every asset — add only what's relevant."
      >
        <div className="space-y-3">
          {permits.map((permit, index) => (
            <div key={index} className="rounded-control border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Select
                  value={permit.permitType}
                  onValueChange={(value) =>
                    setPermits((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, permitType: value as typeof p.permitType } : p,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PERMIT_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPermits((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Issuing authority"
                  value={permit.issuingAuthority}
                  onChange={(e) =>
                    setPermits((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, issuingAuthority: e.target.value } : p,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Document number"
                  value={permit.documentNumber}
                  onChange={(e) =>
                    setPermits((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, documentNumber: e.target.value } : p,
                      ),
                    )
                  }
                />
                <Select
                  value={permit.status}
                  onValueChange={(value) =>
                    setPermits((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, status: value as typeof p.status } : p,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PERMIT_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  placeholder="Expiry date"
                  value={permit.expiryDate}
                  onChange={(e) =>
                    setPermits((prev) =>
                      prev.map((p, i) => (i === index ? { ...p, expiryDate: e.target.value } : p)),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setPermits((prev) => [...prev, { ...EMPTY_PERMIT }])}
        >
          <Plus className="size-4" />
          Add a permit
        </Button>
      </Section>

      <Section
        title="Documents"
        description="Records that a document exists and its status — not a file upload. Set who can see each one."
      >
        <div className="space-y-3">
          {documents.map((doc, index) => (
            <div key={index} className="rounded-control border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Select
                  value={doc.category}
                  onValueChange={(value) =>
                    setDocuments((prev) =>
                      prev.map((d, i) =>
                        i === index ? { ...d, category: value as typeof d.category } : d,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_DOCUMENT_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SALE_DOCUMENT_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Document type (e.g. Lease agreement)"
                  value={doc.documentType}
                  onChange={(e) =>
                    setDocuments((prev) =>
                      prev.map((d, i) => (i === index ? { ...d, documentType: e.target.value } : d)),
                    )
                  }
                />
                <Select
                  value={doc.visibility}
                  onValueChange={(value) =>
                    setDocuments((prev) =>
                      prev.map((d, i) =>
                        i === index ? { ...d, visibility: value as typeof d.visibility } : d,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_DOCUMENT_VISIBILITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SALE_DOCUMENT_VISIBILITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDocuments((prev) => [...prev, { ...EMPTY_DOCUMENT }])}
        >
          <Plus className="size-4" />
          Add a document
        </Button>
      </Section>

      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {(mutation.error as Error).message}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-sm text-success">Changes saved.</p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
