import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "belegpilot" });

// Log config on first import
if (typeof process !== "undefined") {
  console.log("[Inngest] Client initialized, INNGEST_DEV:", process.env.INNGEST_DEV);
  console.log("[Inngest] AI_PROVIDER:", process.env.AI_PROVIDER);
}
