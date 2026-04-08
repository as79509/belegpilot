import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { fromCanonical, toCanonical } from "@/lib/types/canonical";
import { validateDocument } from "@/lib/services/validation/validation-engine";
import {
  buildConfidenceFactors,
  computeCompositeConfidence,
} from "@/lib/services/validation/confidence";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";

const EDITABLE_FIELDS = [
  "supplierNameRaw",
  "supplierNameNormalized",
  "documentType",
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "currency",
  "netAmount",
  "vatAmount",
  "grossAmount",
  "iban",
  "paymentReference",
  "expenseCategory",
  "accountCode",
  "costCenter",
  "reviewNotes",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, companyId: ctx.companyId },
    include: {
      file: true,
      ocrResult: true,
      aiResults: { orderBy: { version: "desc" }, take: 1 },
      processingSteps: { orderBy: { startedAt: "asc" } },
      supplier: true,
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    if (!["admin", "reviewer"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const document = await prisma.document.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!document) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Check period lock
    if (document.invoiceDate) {
      const lock = await checkPeriodLock(ctx.companyId, new Date(document.invoiceDate));
      if (lock.locked) {
        return NextResponse.json({ error: lock.message }, { status: 409 });
      }
    }

    // Build update from allowed fields only
    const updateData: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        if (field === "invoiceDate" || field === "dueDate") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (
          field === "netAmount" ||
          field === "vatAmount" ||
          field === "grossAmount"
        ) {
          updateData[field] =
            body[field] != null ? Number(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Compute before/after changes for audit
    const changes = computeChanges(document as any, updateData, EDITABLE_FIELDS);

    // Update document
    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    // Re-run validation after field changes
    const canonical = toCanonical(updated);
    const validationResult = validateDocument(canonical);
    const aiConfidence = document.confidenceScore || 0;
    const factors = buildConfidenceFactors(aiConfidence, canonical, validationResult, 0);
    const compositeConfidence = computeCompositeConfidence(factors);

    await prisma.document.update({
      where: { id },
      data: {
        validationResults: validationResult as any,
        confidenceScore: compositeConfidence,
      },
    });

    // Audit log
    if (changes) {
      await logAudit({
        companyId: ctx.companyId,
        userId: ctx.session.user.id,
        action: "document_fields_edited",
        entityType: "document",
        entityId: id,
        changes,
      });
    }

    // Re-fetch with relations
    const result = await prisma.document.findUnique({
      where: { id },
      include: {
        file: true,
        ocrResult: true,
        aiResults: { orderBy: { version: "desc" }, take: 1 },
        processingSteps: { orderBy: { startedAt: "asc" } },
        supplier: true,
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[PATCH document]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
