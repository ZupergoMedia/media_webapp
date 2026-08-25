import { Clock, Gauge, MapPin, Monitor, Navigation, Route as RouteIcon } from "lucide-react";
import { formatCompact, formatNumber } from "@/lib/format";

/**
 * Supplementary panels for asset characteristics that specs alone cannot convey.
 *
 * These are keyed off structured columns (DigitalInventory, OperatingArea,
 * Route) rather than asset type, so they appear whenever the underlying data
 * exists. A venue screen with slot economics gets the digital panel for the
 * same reason a roadside LED does — no type checks involved.
 */

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Slot economics — what an advertiser is actually buying on a digital screen. */
export function DigitalInventoryPanel({
  inventory,
}: {
  inventory: {
    slotDurationSeconds: number;
    loopDurationSeconds: number;
    slotsPerLoop: number;
    operatingHoursStart: number;
    operatingHoursEnd: number;
    estimatedPlaysPerDay: number | null;
    screenWidthPx: number | null;
    screenHeightPx: number | null;
  };
}) {
  const hours = inventory.operatingHoursEnd - inventory.operatingHoursStart;
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <section aria-labelledby="digital-heading">
      <h2 id="digital-heading" className="mb-3 text-lg font-semibold tracking-tight">
        Digital inventory
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={Clock}
          label="Slot duration"
          value={`${inventory.slotDurationSeconds}s`}
        />
        <Stat
          icon={Monitor}
          label="Slots per loop"
          value={String(inventory.slotsPerLoop)}
        />
        <Stat
          icon={Gauge}
          label="Est. plays/day"
          value={
            inventory.estimatedPlaysPerDay
              ? formatNumber(inventory.estimatedPlaysPerDay)
              : "—"
          }
        />
        <Stat
          icon={Clock}
          label="Operating hours"
          value={`${pad(inventory.operatingHoursStart)}–${pad(inventory.operatingHoursEnd)}`}
        />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Your creative plays in a {inventory.loopDurationSeconds}-second loop
        shared with {inventory.slotsPerLoop - 1} other advertisers, across{" "}
        {hours} operating hours daily
        {inventory.screenWidthPx && inventory.screenHeightPx
          ? `, at ${inventory.screenWidthPx} × ${inventory.screenHeightPx} px`
          : ""}
        .
      </p>
    </section>
  );
}

/**
 * Coverage for mobile assets.
 *
 * A vehicle has no meaningful single location, so its operating areas and route
 * are what an advertiser is actually buying. Presenting a base-point pin here
 * would misrepresent the product.
 */
export function CoveragePanel({
  operatingAreas,
  routes,
}: {
  operatingAreas: Array<{
    id: string;
    name: string;
    city: string | null;
    radiusMeters: number | null;
  }>;
  routes: Array<{
    id: string;
    name: string;
    startLabel: string | null;
    endLabel: string | null;
    lengthKm: number | null;
  }>;
}) {
  if (operatingAreas.length === 0 && routes.length === 0) return null;

  return (
    <section aria-labelledby="coverage-heading">
      <h2 id="coverage-heading" className="mb-3 text-lg font-semibold tracking-tight">
        Coverage
      </h2>

      {operatingAreas.length > 0 && (
        <ul className="space-y-2">
          {operatingAreas.map((area) => (
            <li
              key={area.id}
              className="flex items-start gap-2.5 rounded-card border border-border bg-surface p-3"
            >
              <Navigation
                className="mt-0.5 size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{area.name}</p>
                <p className="text-xs text-muted-foreground">
                  {area.city}
                  {area.radiusMeters
                    ? ` · ${(area.radiusMeters / 1000).toFixed(0)} km operating radius`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {routes.length > 0 && (
        <ul className="mt-2 space-y-2">
          {routes.map((route) => (
            <li
              key={route.id}
              className="flex items-start gap-2.5 rounded-card border border-border bg-surface p-3"
            >
              <RouteIcon
                className="mt-0.5 size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{route.name}</p>
                <p className="text-xs text-muted-foreground">
                  {route.startLabel} → {route.endLabel}
                  {route.lengthKm ? ` · ${route.lengthKm.toFixed(1)} km` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Audience reach summary. */
export function AudiencePanel({
  dailyImpressions,
  audienceProfile,
}: {
  dailyImpressions: number | null;
  audienceProfile: string | null;
}) {
  if (!dailyImpressions && !audienceProfile) return null;

  return (
    <section aria-labelledby="audience-heading">
      <h2 id="audience-heading" className="mb-3 text-lg font-semibold tracking-tight">
        Audience
      </h2>

      <div className="rounded-card border border-border bg-surface p-4">
        {dailyImpressions !== null && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatCompact(dailyImpressions)}
            </span>
            <span className="text-sm text-muted-foreground">
              estimated daily impressions
            </span>
          </div>
        )}

        {audienceProfile && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {audienceProfile}
          </p>
        )}

        <p className="mt-3 text-xs text-subtle-foreground">
          Impression estimates are provided by the media partner and are indicative.
        </p>
      </div>
    </section>
  );
}

/** Address block for assets with a physical location. */
export function LocationPanel({
  location,
}: {
  location: {
    addressLine: string | null;
    landmark: string | null;
    locality: string | null;
    city: string;
    state: string;
    pincode: string | null;
  };
}) {
  const lines = [
    location.addressLine,
    location.landmark,
    [location.locality, location.city].filter(Boolean).join(", "),
    [location.state, location.pincode].filter(Boolean).join(" "),
  ].filter((line): line is string => Boolean(line));

  // De-duplicate: addressLine often already contains locality and city.
  const unique = lines.filter(
    (line, index) => lines.findIndex((l) => l === line) === index,
  );

  return (
    <div className="flex items-start gap-2.5">
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <address className="text-sm not-italic leading-relaxed text-muted-foreground">
        {unique.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  );
}
