import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { getSetupOverview } from "@/lib/services/setup/setup-status";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const overview = await getSetupOverview(ctx.companyId);
  return NextResponse.json(overview);
}
