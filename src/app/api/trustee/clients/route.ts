import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    include: {
      company: {
        select: {
          id: true, name: true, legalName: true, legalForm: true,
          industry: true, status: true, currency: true, vatNumber: true,
        },
      },
    },
  });

  return NextResponse.json({
    clients: userCompanies.map((uc) => ({ ...uc.company, role: uc.role })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Firmenname erforderlich" }, { status: 400 });

    const company = await prisma.company.create({
      data: {
        name: body.name,
        legalName: body.legalName || body.name,
        legalForm: body.legalForm,
        vatNumber: body.vatNumber,
        currency: body.currency || "CHF",
        industry: body.industry,
        subIndustry: body.subIndustry,
        businessModel: body.businessModel,
        employeeCount: body.employeeCount,
        fiscalYearStart: body.fiscalYearStart,
        phone: body.phone,
        email: body.email,
        website: body.website,
        vatLiable: body.vatLiable ?? true,
        vatMethod: body.vatMethod,
        vatInterval: body.vatInterval,
        chartOfAccounts: body.chartOfAccounts,
        aiContext: body.aiContext,
        aiConfidenceThreshold: body.aiConfidenceThreshold,
        aiAutoApprove: body.aiAutoApprove ?? false,
      },
    });

    // Link the creating user to the new company
    await prisma.userCompany.create({
      data: { userId: session.user.id, companyId: company.id, role: "admin", isDefault: false },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
