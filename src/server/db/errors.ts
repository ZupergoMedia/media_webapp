/**
 * Database error interpretation.
 *
 * Prisma 7's driver adapters do not surface Postgres SQLSTATE codes at the top
 * level. An exclusion-constraint violation arrives as Prisma code `P2039` with
 * the real code buried at:
 *
 *   error.meta.driverAdapterError.cause.code === "23P01"
 *
 * Reaching into that shape is unpleasant, so it is done once, here. Callers ask
 * a question about intent ("was this a double-booking?") instead of pattern
 * matching on driver internals.
 */

/** Postgres: exclusion constraint violation. */
const EXCLUSION_VIOLATION = "23P01";
/** Postgres: unique constraint violation. */
const UNIQUE_VIOLATION = "23505";
/** Postgres: serialization failure — the transaction should be retried. */
const SERIALIZATION_FAILURE = "40001";

interface DriverCause {
  code?: string;
  originalCode?: string;
  message?: string;
  detail?: string;
  constraint?: string;
}

/** Digs the underlying Postgres error out of Prisma's adapter wrapper. */
function driverCause(error: unknown): DriverCause | undefined {
  if (!error || typeof error !== "object") return undefined;

  const meta = (error as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return undefined;

  const adapterError = (meta as { driverAdapterError?: unknown })
    .driverAdapterError;
  if (!adapterError || typeof adapterError !== "object") return undefined;

  const cause = (adapterError as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return undefined;

  return cause as DriverCause;
}

function hasPostgresCode(error: unknown, code: string): boolean {
  const cause = driverCause(error);
  if (cause && (cause.code === code || cause.originalCode === code)) {
    return true;
  }

  // Some paths (raw queries, direct pg usage) surface the code at the top level.
  const direct = (error as { code?: string } | null)?.code;
  return direct === code;
}

/**
 * True when a write was rejected because it would have double-booked an asset.
 *
 * This is the signal the booking service turns into a friendly "those dates
 * were just taken" response rather than a 500.
 */
export function isBookingConflictError(error: unknown): boolean {
  if (!hasPostgresCode(error, EXCLUSION_VIOLATION)) return false;

  const cause = driverCause(error);
  const text = `${cause?.message ?? ""} ${cause?.detail ?? ""} ${cause?.constraint ?? ""}`;

  // Only our booking constraint counts. Any future exclusion constraint should
  // not be silently reported to the user as a booking conflict.
  return text.includes("BookingItem_no_overlap") || !cause;
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPostgresCode(error, UNIQUE_VIOLATION);
}

/**
 * True when a transaction aborted because it could not be serialized. Safe —
 * and expected — to retry.
 *
 * Detection covers three shapes, because Prisma's driver adapter surfaces this
 * inconsistently depending on where in the transaction the conflict is detected:
 *
 *   1. PrismaClientKnownRequestError, code P2034, with 40001 nested in
 *      meta.driverAdapterError.cause
 *   2. A bare DriverAdapterError carrying only `message: "TransactionWriteConflict"`
 *      — no code, no meta at all
 *   3. Raw SQLSTATE 40001, if a future adapter surfaces it directly
 *
 * Shape 2 is the one that matters most in practice: missing it means a routine
 * write conflict is reported to the user as a 500 instead of being retried.
 */
export function isSerializationFailure(error: unknown): boolean {
  if (hasPostgresCode(error, SERIALIZATION_FAILURE)) return true;

  if (!error || typeof error !== "object") return false;

  // Prisma's documented code for "transaction failed due to a write conflict
  // or deadlock" — retryable by definition.
  if ((error as { code?: string }).code === "P2034") return true;

  const cause = driverCause(error);
  if (cause && (cause as { kind?: string }).kind === "TransactionWriteConflict") {
    return true;
  }

  // The bare DriverAdapterError case: the conflict kind is the entire message.
  const name = (error as { name?: string }).name;
  const message = (error as { message?: string }).message ?? "";
  if (
    name === "DriverAdapterError" &&
    message.includes("TransactionWriteConflict")
  ) {
    return true;
  }

  return false;
}

/** Human-readable Postgres detail, for logging. Never shown to end users. */
export function describeDbError(error: unknown): string {
  const cause = driverCause(error);
  if (!cause) return error instanceof Error ? error.message : String(error);
  return [cause.code, cause.message, cause.detail].filter(Boolean).join(" | ");
}
