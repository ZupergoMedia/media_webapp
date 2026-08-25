import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection configuration out of the `datasource` block and into
 * this file. Two further Prisma 7 behaviour changes matter for this project:
 *
 *   1. `migrate dev` / `db push` no longer run `generate` automatically.
 *   2. Automatic seeding was removed — the seed command below must be invoked
 *      explicitly via `pnpm db:seed`.
 *
 * Migrations use DIRECT_URL because they cannot run through a connection pooler.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // This config is consumed by the Prisma CLI (migrate / db push / studio),
    // which must never talk through a connection pooler. So DIRECT_URL wins here
    // and DATABASE_URL is only the fallback for setups without a separate
    // unpooled endpoint. The application runtime is unaffected — it builds its
    // own pooled connection in src/server/db/client.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
