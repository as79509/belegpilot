import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const fields = ["status", "documentsExpected", "recurringGenerated", "depreciationGenerated", "vatChecked", "exportCompleted", "notes"];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }
    if (body.status === "locked") {
      if (!["admin", "trustee"].includes(ctx.session.user.role))
        return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
      data.closedAt = new Date();
      data.closedBy = ctx.session.user.id;
    }
    const updated = await prisma.monthlyPeriod.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
