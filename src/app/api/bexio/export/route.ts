import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { exportDocumentToBexio } from "@/lib/services/bexio/bexio-export";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "reviewer"].includes(ctx.session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { documentId, documentIds, force } = await request.json();
    const ids = documentIds || (documentId ? [documentId] : []);

    if (!ids.length) return NextResponse.json({ error: "Keine Belege angegeben" }, { status: 400 });

    const BATCH_SIZE = 3;
    const results: any[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (id: string) => {
          const result = await exportDocumentToBexio(ctx.companyId, id, !!force);
          if (result.success) {
            await logAudit({
              companyId: ctx.companyId,
              userId: ctx.session.user.id,
              action: "document_exported_bexio",
              entityType: "document",
              entityId: id,
              changes: { bexioId: { before: null, after: result.bexioId } },
            });
          }
          return { documentId: id, ...result };
        })
      );
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ results, successCount, totalCount: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
