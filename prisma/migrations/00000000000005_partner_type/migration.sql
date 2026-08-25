-- Records how a media partner relates to the inventory they list.
--
-- Many partners are agencies or site managers rather than owners. Capturing
-- this at registration tells verification what to actually check: title for an
-- owner, a mandate to sell for an agency.

CREATE TYPE "PartnerType" AS ENUM ('OWNER', 'AGENCY', 'MANAGER', 'OTHER');

ALTER TABLE "MediaOwner"
  ADD COLUMN "partnerType" "PartnerType" NOT NULL DEFAULT 'OWNER';
