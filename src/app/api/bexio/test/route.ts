import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { BexioClient } from "@/lib/services/bexio/bexio-client";

export async function POST() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const integration = await prisma.integration.findFirst({
    where: { companyId: ctx.companyId, providerType: "export", providerName: "bexio" },
  });

  if (!integration?.credentials) {
    return NextResponse.json({ connected: false, error: "Nicht konfiguriert" });
  }

  const creds = integration.credentials as Record<string, any>;
  const client = new BexioClient(creds.accessToken);
  const connected = await client.testConnection();

  await prisma.integration.update({
    where: { id: integration.id },
    data: { lastTestedAt: new Date(), lastTestStatus: connected ? "connected" : "failed" },
  });

  return NextResponse.json({ connected });
}
