import { z } from "zod";

/**
 * Fail fast on misconfiguration rather than at the first query.
 *
 * Only server-side values are validated eagerly here. `NEXT_PUBLIC_*` values are
 * inlined at build time, so they are read through explicit accessors below —
 * `process.env` is not a real object in the browser bundle and cannot be spread
 * or iterated.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  /**
   * Required in production: without it Auth.js cannot sign session cookies, and
   * a deployment would accept unsigned or forgeable sessions. Optional in
   * development so the UI can be worked on before auth is configured.
   */
  AUTH_SECRET:
    process.env.NODE_ENV === "production"
      ? z.string().min(32, "AUTH_SECRET must be at least 32 characters")
      : z.string().min(1).optional(),
  SERVICE_MODE: z.enum(["live", "mock"]).default("live"),
  /**
   * Salts the IP hash stored on anonymous sale enquiries (see
   * sale-enquiry-service.ts), so that table is never a plaintext IP log.
   * Falls back to a fixed dev value — real rate limiting is deferred to
   * phase 2 anyway (see the TODO in sale-enquiry-service.ts), and this only
   * needs to be unguessable in production.
   */
  SALE_ENQUIRY_IP_SALT: z.string().min(1).default("dev-salt-not-for-production"),
});

const parsed = serverSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SERVICE_MODE: process.env.SERVICE_MODE,
  SALE_ENQUIRY_IP_SALT: process.env.SALE_ENQUIRY_IP_SALT,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const serverEnv = parsed.data;

/**
 * Whether the app should use Prisma-backed services. Falls back to mock
 * implementations when no database has been provisioned yet, so the UI is
 * buildable before DATABASE_URL exists.
 */
export const useLiveServices =
  serverEnv.SERVICE_MODE === "live" && Boolean(serverEnv.DATABASE_URL);

/**
 * Map provider keys. Each must be referenced statically for Next to inline it
 * into the browser bundle — see src/lib/map/config.ts for provider resolution
 * and the token-free MapLibre fallback.
 */
export const mapProvider = process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "maplibre";
export const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Google Analytics measurement id. Undefined by default so local dev and
 * preview environments never fire real analytics events — see
 * components/analytics/google-analytics.tsx, which renders nothing when
 * this is unset.
 */
export const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined;
