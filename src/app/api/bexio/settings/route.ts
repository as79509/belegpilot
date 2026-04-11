import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const integration = await prisma.integration.findFirst({
    where: { companyId: ctx.companyId, providerType: "export", providerName: "bexio" },
    select: { isEnabled: true, lastTestedAt: true, lastTestStatus: true },
  });

  return NextResponse.json({
    configured: !!integration,
    isEnabled: integration?.isEnabled || false,
    lastTestedAt: integration?.lastTestedAt,
    lastTestStatus: integration?.lastTestStatus,
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "integrations:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { accessToken } = await request.json();
  if (!accessToken?.trim()) return NextResponse.json({ error: "Token ist erforderlich" }, { status: 400 });

  await prisma.integration.upsert({
    where: {
      companyId_providerType_providerName: {
        companyId: ctx.companyId,
        providerType: "export",
        providerName: "bexio",
      },
    },
    create: {
      companyId: ctx.companyId,
      providerType: "export",
      providerName: "bexio",
      credentials: { accessToken },
      isEnabled: true,
    },
    update: {
      credentials: { accessToken },
      isEnabled: true,
    },
  });

  return NextResponse.json({ success: true });
}
