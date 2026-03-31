import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCsvExport } from "@/lib/services/export/csv-export";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    let documentIds: string[] = body.documentIds || [];
    const separator = body.separator || ";";

    // If no specific IDs, export all ready documents
    if (!documentIds.length) {
      const readyDocs = await prisma.document.findMany({
        where: { companyId: session.user.companyId, status: "ready" },
        select: { id: true },
      });
      documentIds = readyDocs.map((d) => d.id);
    }

    if (!documentIds.length) {
      return NextResponse.json(
        { error: "Keine bereiten Belege zum Exportieren" },
        { status: 400 }
      );
    }

    // Check for already exported documents
    const alreadyExported = await prisma.exportRecord.findMany({
      where: { documentId: { in: documentIds }, status: "success" },
      select: { documentId: true },
    });
    const alreadyExportedIds = new Set(alreadyExported.map((e) => e.documentId));

    const result = await generateCsvExport(
      session.user.companyId,
      session.user.id,
      documentIds,
      separator
    );

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "documents_exported",
      entityType: "export",
      entityId: result.batchId,
      changes: {
        documentCount: { before: 0, after: result.count },
        alreadyExportedSkipped: {
          before: 0,
          after: alreadyExportedIds.size,
        },
      },
    });

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="belegpilot-export-${result.batchId.slice(0, 8)}.csv"`,
        "X-Export-Batch-Id": result.batchId,
        "X-Export-Count": String(result.count),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
