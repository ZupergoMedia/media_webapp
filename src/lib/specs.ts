import { z } from "zod";

/**
 * Runtime interpretation of AssetType.specSchema.
 *
 * Each asset type stores an array of field descriptors in the database. This
 * module turns those descriptors into something the UI can render and something
 * Zod can validate — which is what allows ~70 asset types to share one detail
 * page and one creation wizard, with no per-type branching anywhere.
 *
 * The descriptor shape is defined in prisma/taxonomy.ts (seed-side). It is
 * re-declared here rather than imported: prisma/ is build tooling and must not
 * become a runtime dependency of the app. The Zod schema below is the contract
 * between them, so a mismatch surfaces as a parse failure rather than a crash.
 */

export const specInputSchema = z.enum([
  "text",
  "number",
  "select",
  "boolean",
  "time",
  "textarea",
]);

export const specDescriptorSchema = z.object({
  name: z.string(),
  label: z.string(),
  input: specInputSchema,
  unit: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  group: z.string().optional(),
  order: z.number().optional(),
  help: z.string().optional(),
  /** Never rendered on public pages — see taxonomy.ts for the rationale. */
  sensitive: z.boolean().optional(),
});

export type SpecDescriptor = z.infer<typeof specDescriptorSchema>;

/**
 * Parses a stored specSchema. Returns [] on malformed data rather than throwing:
 * one bad descriptor should degrade that asset's spec table, not take down the
 * whole page.
 */
export function parseSpecSchema(raw: unknown): SpecDescriptor[] {
  const result = z.array(specDescriptorSchema).safeParse(raw);
  if (!result.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[specs] Invalid specSchema, ignoring:", result.error.issues);
    }
    return [];
  }
  return result.data;
}

export interface RenderedSpec {
  name: string;
  label: string;
  value: string;
  unit?: string;
  help?: string;
}

export interface SpecGroup {
  group: string;
  specs: RenderedSpec[];
}

/** Formats one stored value for display, per its descriptor. */
function renderValue(
  descriptor: SpecDescriptor,
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;

  switch (descriptor.input) {
    case "boolean":
      return value ? "Yes" : "No";
    case "number": {
      const numeric = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(numeric)) return null;
      return new Intl.NumberFormat("en-IN").format(numeric);
    }
    default:
      return String(value);
  }
}

/**
 * Joins a type's descriptors with an asset's stored values, producing ordered,
 * grouped, display-ready rows.
 *
 * Sensitive fields are dropped unconditionally. Values with no descriptor are
 * also dropped: they are stale keys from an earlier schema version, and showing
 * a raw camelCase key to an advertiser looks broken.
 */
export function buildSpecGroups(
  specSchema: unknown,
  specs: unknown,
): SpecGroup[] {
  const descriptors = parseSpecSchema(specSchema);
  if (descriptors.length === 0) return [];

  const values =
    specs && typeof specs === "object"
      ? (specs as Record<string, unknown>)
      : {};

  const groups = new Map<string, RenderedSpec[]>();

  const ordered = [...descriptors].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  );

  for (const descriptor of ordered) {
    if (descriptor.sensitive) continue;

    const rendered = renderValue(descriptor, values[descriptor.name]);
    if (rendered === null) continue;

    const groupName = descriptor.group ?? "Details";
    const bucket = groups.get(groupName) ?? [];
    bucket.push({
      name: descriptor.name,
      label: descriptor.label,
      value: rendered,
      unit: descriptor.unit,
      help: descriptor.help,
    });
    groups.set(groupName, bucket);
  }

  return [...groups.entries()].map(([group, specs]) => ({ group, specs }));
}

/**
 * Compiles descriptors into a Zod object for validating owner submissions.
 *
 * Used by the Add Asset wizard so validation rules live with the taxonomy
 * rather than being duplicated in form code.
 */
export function buildSpecValidator(specSchema: unknown) {
  const descriptors = parseSpecSchema(specSchema);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const descriptor of descriptors) {
    let field: z.ZodTypeAny;

    // Messages are written for the media owner filling in the form, not for a
    // developer reading a stack trace. Zod's defaults ("expected number,
    // received NaN") leak implementation detail into the UI.
    const label = descriptor.label;

    switch (descriptor.input) {
      case "number": {
        let numeric = z.coerce.number({
          error: `${label} must be a number`,
        });
        if (descriptor.min !== undefined) {
          numeric = numeric.min(descriptor.min, {
            error: `${label} must be at least ${descriptor.min}`,
          });
        }
        if (descriptor.max !== undefined) {
          numeric = numeric.max(descriptor.max, {
            error: `${label} must be at most ${descriptor.max}`,
          });
        }
        field = numeric;
        break;
      }
      case "boolean":
        field = z.coerce.boolean();
        break;
      case "select":
        field =
          descriptor.options && descriptor.options.length > 0
            ? z.enum(descriptor.options as [string, ...string[]], {
                error: `Choose one of: ${descriptor.options.join(", ")}`,
              })
            : z.string();
        break;
      default:
        field = z.string({ error: `${label} is required` });
    }

    // Optional fields must also accept an explicitly-cleared value: the form
    // sends undefined for a blank number input rather than omitting the key.
    shape[descriptor.name] = descriptor.required
      ? field
      : field.optional().nullable();
  }

  return z.object(shape);
}
