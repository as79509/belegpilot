import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: {
      id: true, name: true, legalName: true, vatNumber: true, currency: true, settings: true,
      legalForm: true, uid: true, industry: true, subIndustry: true, businessModel: true,
      employeeCount: true, fiscalYearStart: true, phone: true, email: true, website: true,
      vatLiable: true, vatMethod: true, vatInterval: true, vatFlatRate: true,
      chartOfAccounts: true, costCentersEnabled: true, projectsEnabled: true,
      aiContext: true, aiConfidenceThreshold: true, aiAutoApprove: true, status: true,
    },
  });

  if (!company) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "company:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const old = await prisma.company.findUnique({ where: { id: ctx.companyId } });

  const allowedFields = [
    "name", "legalName", "vatNumber", "currency", "legalForm", "uid", "industry",
    "subIndustry", "businessModel", "employeeCount", "fiscalYearStart", "phone",
    "email", "website", "vatLiable", "vatMethod", "vatInterval", "vatFlatRate",
    "chartOfAccounts", "costCentersEnabled", "projectsEnabled",
    "aiContext", "aiConfidenceThreshold", "aiAutoApprove", "settings",
  ];
  const updateData: Record<string, any> = {};
  for (const f of allowedFields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }

  const company = await prisma.company.update({
    where: { id: ctx.companyId },
    data: updateData,
  });

  const changes = computeChanges(old as any, body, ["name", "legalName", "vatNumber", "currency"]);
  if (changes) {
    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "company_settings_updated",
      entityType: "company",
      entityId: company.id,
      changes,
    });
  }

  return NextResponse.json(company);
}
