import "dotenv/config";

import { mkdirSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function resolveSqliteUrl(input?: string) {
  const fallback = `file:${path.join(process.cwd(), "data", "dev.db").replace(/\\/g, "/")}`;

  if (!input || !input.startsWith("file:")) {
    return fallback;
  }

  if (input.startsWith("file:./") || input.startsWith("file:.\\") || input.startsWith("file:data")) {
    const relativePath = input.replace(/^file:/, "");
    return `file:${path.resolve(process.cwd(), relativePath).replace(/\\/g, "/")}`;
  }

  return input;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const sqliteUrl = resolveSqliteUrl(process.env.DATABASE_URL || "file:./data/dev.db");
const sqlitePath = sqliteUrl.replace(/^file:/, "");
mkdirSync(path.dirname(sqlitePath), { recursive: true });

const adapter = new PrismaBetterSqlite3({
  url: sqliteUrl,
});
let bootstrapPromise: Promise<void> | null = null;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function ensureDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const existingTables = (await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AppSetting'",
      )) as Array<{ name: string }>;

      if (existingTables.length) {
        return;
      }

      const migrationPath = path.join(
        process.cwd(),
        "prisma",
        "migrations",
        "20260424023000_init",
        "migration.sql",
      );

      const migrationSql = await readFile(migrationPath, "utf8");
      const statements = migrationSql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
    })();
  }

  await bootstrapPromise;
}
