import { buildSpecGroups } from "@/lib/specs";

/**
 * Specifications, rendered from the asset type's descriptors.
 *
 * Entirely data-driven: this component has no knowledge of billboards, screens
 * or vehicles. It renders whatever the taxonomy defines, in the order and
 * grouping the taxonomy specifies, which is what lets one component serve all
 * 68 asset types. Sensitive fields are filtered out upstream in buildSpecGroups.
 */
export function SpecificationTable({
  specSchema,
  specs,
}: {
  specSchema: unknown;
  specs: unknown;
}) {
  const groups = buildSpecGroups(specSchema, specs);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The owner has not published detailed specifications for this asset.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.group}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </h3>
          <dl className="divide-y divide-border rounded-card border border-border">
            {group.specs.map((spec) => (
              <div
                key={spec.name}
                className="flex items-baseline justify-between gap-4 px-4 py-2.5"
              >
                <dt className="text-sm text-muted-foreground">{spec.label}</dt>
                <dd className="text-right text-sm font-medium tabular-nums">
                  {spec.value}
                  {spec.unit ? ` ${spec.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
