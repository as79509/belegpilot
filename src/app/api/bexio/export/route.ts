import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportDocumentToBexio } from "@/lib/services/bexio/bexio-export";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "reviewer"].includes(session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { documentId, documentIds } = await request.json();
    const ids = documentIds || (documentId ? [documentId] : []);

    if (!ids.length) return NextResponse.json({ error: "Keine Belege angegeben" }, { status: 400 });

    const results = [];
    for (const id of ids) {
      const result = await exportDocumentToBexio(session.user.companyId, id);
      results.push({ documentId: id, ...result });

      if (result.success) {
        await logAudit({
          companyId: session.user.companyId,
          userId: session.user.id,
          action: "document_exported_bexio",
          entityType: "document",
          entityId: id,
          changes: { bexioId: { before: null, after: result.bexioId } },
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ results, successCount, totalCount: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
