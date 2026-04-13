import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import "@/lib/services/integrations/providers/csv-provider";
import "@/lib/services/integrations/providers/bexio-provider";
import { getAdapter } from "@/lib/services/integrations/provider-registry";
import type { IntegrationAction } from "@/lib/services/integrations/integration-provider";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { providerId } = await params;
  const adapter = getAdapter(providerId);
  if (!adapter) return NextResponse.json({ error: "Provider nicht gefunden: " + providerId }, { status: 404 });
  if (!adapter.executeImport) return NextResponse.json({ error: "Provider unterst\u00fctzt keinen Import" }, { status: 400 });

  const integration = await prisma.integration.findFirst({
    where: {
      companyId: ctx.companyId,
      providerName: providerId,
      isEnabled: true,
    },
  });
  if (!integration) {
    return NextResponse.json({ error: "Integration ist nicht aktiviert" }, { status: 409 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const action = formData.get("action") as string | null;

  if (!file) return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "Import-Typ (action) fehlt" }, { status: 400 });
  if (!adapter.provider.supportedActions.includes(action as IntegrationAction)) {
    return NextResponse.json({ error: "Aktion nicht unterst\u00fctzt: " + action }, { status: 400 });
  }

  const content = await file.text();
  const result = await adapter.executeImport(ctx.companyId, action as IntegrationAction, content, file.name);

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "integration_import_executed",
    entityType: "integration",
    entityId: integration.id,
    changes: {
      import: {
        before: null,
        after: {
          providerId,
          action,
          fileName: file.name,
          success: result.success,
          imported: result.imported,
          skipped: result.skipped,
          errorCount: result.errors.length,
        },
      },
    },
  });

  return NextResponse.json({ result });
}
