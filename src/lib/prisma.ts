import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Append connection pool params to DATABASE_URL if not already present.
 * `connection_limit` is recognized by Prisma; `pool_timeout` is NOT a Prisma
 * query param (PostgreSQL drivers may ignore it), so we only set the
 * Prisma-supported param. Connection limit lowered from 15 to 5 — adequate
 * for serverless and avoids exhausting Supabase's free-tier pool.
 */
function getDbUrl(): string {
  const base = process.env.DATABASE_URL || "";
  if (!base) return base;
  const url = new URL(base);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDbUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
