import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: resolveSqliteUrl(process.env["DATABASE_URL"] || "file:./data/dev.db"),
  },
});
