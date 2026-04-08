import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const access = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: id } },
  });
  if (!access) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json(company);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { id } = await params;
    const access = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId: id } },
    });
    if (!access || !["admin", "trustee"].includes(access.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const body = await request.json();
    const fields = [
      "name", "legalName", "legalForm", "vatNumber", "currency", "industry",
      "businessModel", "employeeCount", "fiscalYearStart", "phone", "email", "website",
      "vatLiable", "vatMethod", "vatInterval", "chartOfAccounts",
      "aiContext", "aiConfidenceThreshold", "aiAutoApprove",
    ];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }

    const updated = await prisma.company.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
