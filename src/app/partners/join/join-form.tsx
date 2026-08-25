"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PARTNER_TYPE_HELP,
  PARTNER_TYPE_LABELS,
  partnerAccountSchema,
  partnerCompanySchema,
} from "@/lib/partner-schema";
import { cn } from "@/lib/utils";

/**
 * Media partner registration.
 *
 * Two short steps, then straight into the listing wizard. Previously "List your
 * media" sent a new visitor directly to an eight-step asset form, and anyone
 * without an existing partner record hit an error telling them to "create a
 * company profile" — a page that did not exist. This is that page, and it hands
 * off rather than dead-ending.
 *
 * Signed-in users skip the account step: their existing account is upgraded.
 */

const STEPS = [
  { id: "account", label: "Your account" },
  { id: "company", label: "Your company" },
] as const;

type Field = Record<string, string>;

export function JoinForm({
  signedInEmail,
  signedInName,
}: {
  signedInEmail?: string;
  signedInName?: string | null;
}) {
  const router = useRouter();
  const alreadySignedIn = Boolean(signedInEmail);

  // A signed-in visitor has nothing to fill in on step one.
  const [stepIndex, setStepIndex] = useState(alreadySignedIn ? 1 : 0);
  const [errors, setErrors] = useState<Field>({});

  const [account, setAccount] = useState({
    name: signedInName ?? "",
    email: signedInEmail ?? "",
    password: "",
  });

  const [company, setCompany] = useState({
    companyName: "",
    partnerType: "OWNER",
    city: "Mumbai",
    state: "Maharashtra",
    contactPhone: "",
    website: "",
    description: "",
  });

  const step = STEPS[stepIndex];

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...account,
          // A signed-in user supplies no password; the API ignores it for them,
          // but the schema still expects the field.
          password: account.password || "placeholder-unused",
          ...company,
          website: company.website || undefined,
          description: company.description || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new JoinError(data.error ?? "Could not complete registration");
      }
      return data as { requiresSignIn: boolean; email: string };
    },
    onSuccess: async (data) => {
      // A brand-new partner is signed in automatically, so they land in the
      // listing wizard rather than at a login screen having just typed their
      // password.
      if (data.requiresSignIn) {
        await signIn("credentials", {
          email: data.email,
          password: account.password,
          redirect: false,
        });
      }
      router.push("/owner/assets/new?welcome=1");
      router.refresh();
    },
  });

  const validateStep = (): boolean => {
    const schema = step.id === "account" ? partnerAccountSchema : partnerCompanySchema;
    const value = step.id === "account" ? account : company;
    const result = schema.safeParse(value);

    if (result.success) {
      setErrors({});
      return true;
    }

    const next: Field = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress — spans registration and the listing wizard that follows, so
          the visitor can see how much is left overall. */}
      <ol className="mb-6 flex items-center gap-2" aria-label="Steps">
        {[...STEPS, { id: "listing", label: "First listing" }].map(
          (entry, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={entry.id} className="flex flex-1 items-center gap-2">
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-success text-white",
                    current && "bg-foreground text-background",
                    !done && !current && "bg-surface-sunken text-subtle-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs sm:inline",
                    current ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.label}
                </span>
                {index < 2 && (
                  <span className="mx-1 h-px flex-1 bg-border" aria-hidden="true" />
                )}
              </li>
            );
          },
        )}
      </ol>

      <div className="rounded-card border border-border bg-surface p-6">
        {step.id === "account" ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Create your account
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Already have one?{" "}
              <Link
                href="/signin?callbackUrl=/partners/join"
                className="underline underline-offset-4"
              >
                Sign in
              </Link>{" "}
              and we will add a company profile to it.
            </p>

            <div className="space-y-4">
              <Field
                id="name"
                label="Your name"
                required
                value={account.name}
                error={errors.name}
                onChange={(v) => setAccount((a) => ({ ...a, name: v }))}
              />
              <Field
                id="email"
                label="Work email"
                type="email"
                required
                value={account.email}
                error={errors.email}
                onChange={(v) => setAccount((a) => ({ ...a, email: v }))}
                placeholder="you@company.com"
              />
              <Field
                id="password"
                label="Password"
                type="password"
                required
                value={account.password}
                error={errors.password}
                onChange={(v) => setAccount((a) => ({ ...a, password: v }))}
                help="At least 8 characters."
              />
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              About your company
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Advertisers see this alongside your listings.
            </p>

            <div className="space-y-4">
              <Field
                id="companyName"
                label="Company or trading name"
                required
                value={company.companyName}
                error={errors.companyName}
                onChange={(v) => setCompany((c) => ({ ...c, companyName: v }))}
              />

              {/*
                The question that makes "partner" the right word: many people
                listing here manage or represent inventory rather than owning
                it, and verification needs to know which.
              */}
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  How do you work with this media?
                  <span className="ml-0.5 text-danger">*</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setCompany((c) => ({ ...c, partnerType: value }))
                      }
                      aria-pressed={company.partnerType === value}
                      className={cn(
                        "rounded-control border px-3 py-2.5 text-left text-sm transition-colors",
                        company.partnerType === value
                          ? "border-foreground bg-surface-muted"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className="block font-medium">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {PARTNER_TYPE_HELP[value]}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="city"
                  label="City"
                  required
                  value={company.city}
                  error={errors.city}
                  onChange={(v) => setCompany((c) => ({ ...c, city: v }))}
                />
                <Field
                  id="state"
                  label="State"
                  value={company.state}
                  error={errors.state}
                  onChange={(v) => setCompany((c) => ({ ...c, state: v }))}
                />
              </div>

              <Field
                id="contactPhone"
                label="Contact phone"
                required
                value={company.contactPhone}
                error={errors.contactPhone}
                onChange={(v) => setCompany((c) => ({ ...c, contactPhone: v }))}
                placeholder="+91 98765 43210"
                help="Advertisers confirm bookings with you directly, so this matters."
              />

              <Field
                id="website"
                label="Website"
                value={company.website}
                error={errors.website}
                onChange={(v) => setCompany((c) => ({ ...c, website: v }))}
                placeholder="https://"
              />

              <div className="space-y-1.5">
                <Label htmlFor="description">About your business</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={company.description}
                  onChange={(event) =>
                    setCompany((c) => ({ ...c, description: event.target.value }))
                  }
                  placeholder="What kind of media you operate, and where."
                />
              </div>
            </div>
          </section>
        )}

        {mutation.isError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-3"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-danger"
              aria-hidden="true"
            />
            <p className="text-sm text-danger">
              {(mutation.error as JoinError).message}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {stepIndex > 0 && !alreadySignedIn ? (
          <Button
            variant="ghost"
            onClick={() => {
              setErrors({});
              setStepIndex(stepIndex - 1);
            }}
            disabled={mutation.isPending}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : (
          <Button variant="ghost" asChild>
            <Link href="/for-media-partners">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        )}

        <Button size="lg" onClick={goNext} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Setting up…
            </>
          ) : stepIndex === STEPS.length - 1 ? (
            "Continue to your first listing"
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-subtle-foreground">
        Listing is free. We verify new partners before their inventory appears in
        search.
      </p>
    </div>
  );
}

class JoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinError";
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
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
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        className={cn(error && "border-danger")}
      />
      {help && !error && (
        <p id={`${id}-help`} className="text-xs text-subtle-foreground">
          {help}
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
