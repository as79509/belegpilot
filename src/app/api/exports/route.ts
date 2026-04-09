import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Load export records
  const records = await prisma.exportRecord.findMany({
    where: {
      document: { companyId: ctx.companyId },
    },
    include: {
      document: {
        select: {
          id: true,
          documentNumber: true,
          supplierNameNormalized: true,
          supplierNameRaw: true,
          grossAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  // Group by batch (externalId) — collect failures and document refs
  type BatchSummary = {
    batchId: string;
    createdAt: Date;
    exportTarget: string;
    count: number;
    status: string;
    failures: Array<{
      documentId: string;
      documentNumber: string | null;
      supplierName: string | null;
      errorMessage: string | null;
    }>;
    documentIds: string[];
  };
  const batches = new Map<string, BatchSummary>();
  for (const r of records) {
    const batchId = r.externalId || r.id;
    let bucket = batches.get(batchId);
    if (!bucket) {
      bucket = {
        batchId,
        createdAt: r.createdAt,
        exportTarget: r.exportTarget,
        count: 0,
        status: r.status,
        failures: [],
        documentIds: [],
      };
      batches.set(batchId, bucket);
    }
    bucket.count++;
    bucket.documentIds.push(r.documentId);
    // Worst-case wins for status: if any record failed, batch counts as failed
    if (r.status === "failed") bucket.status = "failed";
    if (r.status === "failed" && r.errorMessage) {
      bucket.failures.push({
        documentId: r.documentId,
        documentNumber: r.document?.documentNumber || null,
        supplierName:
          r.document?.supplierNameNormalized || r.document?.supplierNameRaw || null,
        errorMessage: r.errorMessage,
      });
    }
  }

  // Find "not exported" documents — ready but never successfully exported, with reason
  const notExported = await prisma.document.findMany({
    where: {
      companyId: ctx.companyId,
      status: "ready",
      reviewStatus: "approved",
      exportStatus: { not: "exported" },
    },
    select: {
      id: true,
      documentNumber: true,
      supplierNameNormalized: true,
      supplierNameRaw: true,
      grossAmount: true,
      accountCode: true,
      validationResults: true,
      exportStatus: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const notExportedWithReason = notExported.map((d) => {
    let reason: "noAccount" | "noMapping" | "validationError" | "unknown" = "unknown";
    const validation = d.validationResults as any;
    const hasErrors =
      validation && Array.isArray(validation.checks)
        ? validation.checks.some(
            (c: any) => c?.passed === false && c?.severity === "error"
          )
        : false;
    if (!d.accountCode) reason = "noAccount";
    else if (hasErrors) reason = "validationError";
    else if (d.exportStatus === "export_failed") reason = "noMapping";
    return {
      id: d.id,
      documentNumber: d.documentNumber,
      supplierName: d.supplierNameNormalized || d.supplierNameRaw || null,
      grossAmount: d.grossAmount,
      reason,
    };
  });

  return NextResponse.json({
    batches: Array.from(batches.values()),
    notExported: notExportedWithReason,
  });
}
