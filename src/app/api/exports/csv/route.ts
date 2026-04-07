import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCsvExport } from "@/lib/services/export/csv-export";
import { generateXlsxExport } from "@/lib/services/export/xlsx-export";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const body = await request.json();
    const format = body.format || "csv-excel";
    const filter = body.filter || "all-ready";
    const dateFrom = body.dateFrom;
    const dateTo = body.dateTo;
    const columns = body.columns;

    // Build document query
    const where: Record<string, any> = {
      companyId: session.user.companyId,
      status: "ready",
    };

    if (filter === "not-exported") {
      where.exportStatus = "not_exported";
    }

    if (filter === "date-range" && (dateFrom || dateTo)) {
      where.invoiceDate = {};
      if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
      if (dateTo) where.invoiceDate.lte = new Date(dateTo + "T23:59:59Z");
    }

    const docs = await prisma.document.findMany({
      where: where as any,
      select: { id: true },
    });

    const documentIds = docs.map((d) => d.id);

    if (!documentIds.length) {
      return NextResponse.json(
        { error: "Keine bereiten Belege zum Exportieren" },
        { status: 400 }
      );
    }

    let responseBody: Buffer | string;
    let contentType: string;
    let fileExt: string;
    let count: number;
    let batchId: string;

    if (format === "xlsx") {
      const result = await generateXlsxExport(
        session.user.companyId,
        session.user.id,
        documentIds,
        columns
      );
      responseBody = result.buffer;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileExt = "xlsx";
      count = result.count;
      batchId = result.batchId;
    } else {
      const separator = format === "csv-standard" ? "," : ";";
      const result = await generateCsvExport(
        session.user.companyId,
        session.user.id,
        documentIds,
        separator
      );
      responseBody = result.csv;
      contentType = "text/csv; charset=utf-8";
      fileExt = "csv";
      count = result.count;
      batchId = result.batchId;
    }

    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "documents_exported",
      entityType: "export",
      entityId: batchId,
      changes: { format: { before: null, after: format }, documentCount: { before: 0, after: count } },
    });

    console.log(`[Export] ${count} documents exported as ${format}, batch ${batchId}`);

    const responseBytes = typeof responseBody === "string"
      ? responseBody
      : new Uint8Array(responseBody);

    return new NextResponse(responseBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="belegpilot-export-${batchId.slice(0, 8)}.${fileExt}"`,
        "X-Export-Batch-Id": batchId,
        "X-Export-Count": String(count),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
