-- Availability requests, not bookings — part 2 of 2.
--
-- Migrates existing rows onto the enquiry lifecycle, reshapes the columns, and
-- rebuilds the overlap constraint so it guards CONFIRMED rows only.

-- ---------------------------------------------------------------------------
-- Data migration
-- ---------------------------------------------------------------------------

-- HELD and PENDING_APPROVAL both meant "submitted, awaiting the owner", which
-- is exactly REQUESTED under the new model.
UPDATE "Booking" SET "status" = 'REQUESTED'
 WHERE "status"::text IN ('HELD', 'PENDING_APPROVAL');

-- CANCELLED covered both "advertiser withdrew" and "owner refused"; without a
-- distinguishing column the safe reading is the advertiser's own action.
UPDATE "Booking" SET "status" = 'WITHDRAWN' WHERE "status"::text = 'CANCELLED';
UPDATE "Booking" SET "status" = 'DECLINED'  WHERE "status"::text = 'REJECTED';

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Booking" RENAME COLUMN "holdExpiresAt" TO "respondedAt";
ALTER TABLE "Booking" RENAME COLUMN "cancelledReason" TO "declineReason";
ALTER TABLE "Booking" RENAME COLUMN "cancelledAt" TO "declinedAt";

-- A hold timer is meaningless when nothing is held. Any value left over from
-- the previous model would misrepresent an unanswered request as expiring.
UPDATE "Booking" SET "respondedAt" = NULL WHERE "status"::text = 'REQUESTED';

-- Contact details are captured per request: confirmation happens off-platform,
-- so the owner needs a way to reach this specific advertiser.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "contactEmail" text;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "contactPhone" text;

DROP INDEX IF EXISTS "Booking_status_holdExpiresAt_idx";
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_idx"
  ON "Booking" ("status", "createdAt");

-- ---------------------------------------------------------------------------
-- Overlap constraint — now CONFIRMED-only
-- ---------------------------------------------------------------------------
--
-- This is the substantive change. Previously any HELD/PENDING/CONFIRMED row
-- blocked its window, which made ZuperGo behave as though it controlled the
-- inventory: a second advertiser was turned away over dates ZuperGo could not
-- actually guarantee, and a stale request blocked real demand indefinitely.
--
-- Now only an owner-CONFIRMED row claims a window. Competing requests coexist,
-- and the owner chooses. The constraint still prevents the one thing that is
-- genuinely impossible: two confirmed campaigns on the same billboard at once.

ALTER TABLE "BookingItem" DROP CONSTRAINT IF EXISTS "BookingItem_no_overlap";

CREATE OR REPLACE FUNCTION booking_item_sync_derived()
RETURNS TRIGGER AS $$
BEGIN
  -- Half-open '[)' so a campaign ending at 09:00 does not collide with one
  -- starting at 09:00 — back-to-back bookings are legal.
  NEW."period" := tstzrange(NEW."startAt", NEW."endAt", '[)');

  -- Only a confirmed request claims inventory.
  SELECT b."status" = 'CONFIRMED'
    INTO NEW."holdsInventory"
    FROM "Booking" b
   WHERE b."id" = NEW."bookingId";

  NEW."holdsInventory" := COALESCE(NEW."holdsInventory", false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION booking_propagate_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    UPDATE "BookingItem"
       SET "holdsInventory" = (NEW."status" = 'CONFIRMED')
     WHERE "bookingId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-derive every existing row under the new rule.
UPDATE "BookingItem" bi
   SET "holdsInventory" = (b."status" = 'CONFIRMED')
  FROM "Booking" b
 WHERE b."id" = bi."bookingId";

ALTER TABLE "BookingItem"
  ADD CONSTRAINT "BookingItem_no_overlap"
  EXCLUDE USING GIST (
    "assetId" WITH =,
    "period" WITH &&
  )
  WHERE (
    "holdsInventory" = true
    AND "bookingModel" <> 'DIGITAL_SLOT'
  );
