/** Validate required env vars on startup */
export function validateConfig() {
  const required = ["DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error(`[Config] Missing required env vars: ${missing.join(", ")}`);
  }

  // Log config (masked)
  const dbUrl = process.env.DATABASE_URL;
  console.log(
    "[Config] DATABASE_URL:",
    dbUrl ? dbUrl.replace(/:[^:@]+@/, ":***@").substring(0, 60) + "..." : "NOT SET"
  );
  console.log("[Config] AI_PROVIDER:", process.env.AI_PROVIDER || "mock");
  console.log(
    "[Config] ANTHROPIC_API_KEY:",
    process.env.ANTHROPIC_API_KEY ? "set (" + process.env.ANTHROPIC_API_KEY.slice(-4) + ")" : "NOT SET"
  );
  console.log("[Config] INNGEST_DEV:", process.env.INNGEST_DEV || "not set");
  console.log(
    "[Config] SUPABASE_URL:",
    process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET"
  );
}
