import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (e: any) {
    checks.database = { status: "error", error: e.message, latencyMs: Date.now() - dbStart };
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    checks.storage = { status: res.ok ? "ok" : "error" };
  } catch (e: any) {
    checks.storage = { status: "error", error: e.message };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 }
  );
}
