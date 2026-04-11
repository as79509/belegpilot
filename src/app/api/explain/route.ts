import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { buildScreenContext, generateExplanation } from "@/lib/services/explain/screen-context-builder";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const page = searchParams.get("page");
  if (!page) return NextResponse.json({ error: "Parameter 'page' erforderlich" }, { status: 400 });

  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;

  const context = await buildScreenContext(page, ctx.companyId, ctx.session.user.role, year, month);
  const explanation = generateExplanation(context);

  return NextResponse.json({ context, explanation });
}
