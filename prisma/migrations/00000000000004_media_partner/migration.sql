-- Rename MEDIA_OWNER -> MEDIA_PARTNER.
--
-- The people who list inventory are frequently not the owner of the site: they
-- are agencies, franchisees or managers acting for an owner. "Media partner" is
-- the established term in Indian OOH and is true in every one of those cases,
-- where "owner" asserts a relationship that often does not exist.
--
-- ALTER TYPE ... RENAME VALUE rewrites the label in place, so existing rows
-- carry over without a data migration.

ALTER TYPE "UserRole" RENAME VALUE 'MEDIA_OWNER' TO 'MEDIA_PARTNER';
