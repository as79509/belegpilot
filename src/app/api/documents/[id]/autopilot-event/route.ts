import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;

    // Sicherstellen, dass das Document zur aktiven Firma gehört
    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Letzten AutopilotEvent für dieses Document laden
    const event = await prisma.autopilotEvent.findFirst({
      where: { documentId: id, companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
    });

    if (!event) {
      return NextResponse.json({ event: null });
    }

    return NextResponse.json({
      event: {
        id: event.id,
        mode: event.mode,
        decision: event.decision,
        safetyChecks: event.safetyChecks,
        blockedBy: event.blockedBy,
        confidenceScore: event.confidenceScore,
        suggestedAccount: event.suggestedAccount,
        supplierName: event.supplierName,
        createdAt: event.createdAt,
      },
    });
  } catch (err: any) {
    console.error("[autopilot-event] GET error:", err);
    return NextResponse.json(
      { error: err?.message || "Serverfehler" },
      { status: 500 }
    );
  }
}
