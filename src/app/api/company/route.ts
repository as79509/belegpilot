import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { id: true, name: true, legalName: true, vatNumber: true, currency: true, settings: true },
  });

  if (!company) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await request.json();
  const { name, legalName, vatNumber, currency } = body;

  const old = await prisma.company.findUnique({ where: { id: session.user.companyId } });

  const company = await prisma.company.update({
    where: { id: session.user.companyId },
    data: {
      ...(name !== undefined && { name }),
      ...(legalName !== undefined && { legalName }),
      ...(vatNumber !== undefined && { vatNumber }),
      ...(currency !== undefined && { currency }),
    },
    select: { id: true, name: true, legalName: true, vatNumber: true, currency: true },
  });

  const changes = computeChanges(old as any, body, ["name", "legalName", "vatNumber", "currency"]);
  if (changes) {
    await logAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "company_settings_updated",
      entityType: "company",
      entityId: company.id,
      changes,
    });
  }

  return NextResponse.json(company);
}
