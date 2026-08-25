-- Availability requests, not bookings — part 1 of 2 (enum values).
--
-- ZuperGo lists inventory it does not own or control. An asset can be sold
-- through the media owner's own channels at any time, so submitting a request
-- on ZuperGo reserves nothing — only the owner can confirm.
--
-- Split across two migrations because Postgres will not allow a newly added
-- enum value to be USED in the same transaction that adds it. Part 2 migrates
-- the data and rebuilds the constraint.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'VIEWED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
