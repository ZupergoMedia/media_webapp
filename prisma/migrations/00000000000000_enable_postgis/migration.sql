-- Enable PostGIS.
--
-- This MUST be the first migration. Every geography column in the schema
-- depends on the extension existing, so a later ordering fails outright.
--
-- Critically, the extension is created HERE rather than by hand in the Neon
-- console. Hand-created extensions do not travel to new Neon branches, fresh
-- Docker volumes, or CI databases, and the schemas silently diverge.

CREATE EXTENSION IF NOT EXISTS postgis;
