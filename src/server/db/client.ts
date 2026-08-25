import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter — there is no built-in engine
 * connection any more.
 *
 * The runtime uses DATABASE_URL (the pooled endpoint on Neon). Migrations use
 * DIRECT_URL instead, configured separately in prisma.config.ts, because the
 * migration engine cannot run through a connection pooler.
 */
const createClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in, " +
        "or set SERVICE_MODE=mock to run the UI without a database.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
};

// Cached on globalThis so Next's dev-mode module reloading does not open a new
// pool on every edit and exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
