import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { computeTelemetry } from "@/lib/services/telemetry/telemetry-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!["admin", "trustee"].includes(ctx.session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const daysRaw = searchParams.get("days");
  const days = daysRaw ? parseInt(daysRaw, 10) : 30;
  if (Number.isNaN(days) || days <= 0 || days > 365) {
    return NextResponse.json(
      { error: "days muss eine Zahl zwischen 1 und 365 sein" },
      { status: 400 }
    );
  }

  const snapshot = await computeTelemetry(ctx.companyId, days);
  return NextResponse.json(snapshot);
}
