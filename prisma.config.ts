import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed-direct.ts",
  },
  datasource: {
    // For Supabase: use DIRECT_URL for migrations (bypasses PgBouncer),
    // fall back to DATABASE_URL for runtime.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
