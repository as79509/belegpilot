import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const contractType = searchParams.get("contractType");
  const status = searchParams.get("status");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (contractType) where.contractType = contractType;
  if (status) where.status = status;

  const contracts = await prisma.contract.findMany({
    where: where as any,
    include: {
      supplier: { select: { nameNormalized: true } },
      _count: {
        select: {
          relatedTasks: { where: { status: { in: ["open", "in_progress"] } } },
          expectedDocuments: { where: { isActive: true } },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Lifecycle berechnen: expiring wenn endDate innerhalb reminderDays
  const now = Date.now();
  const enriched = contracts.map((c) => {
    let lifecycleStatus = c.status;
    let daysUntilExpiry: number | null = null;
    if (c.endDate) {
      const days = Math.floor((c.endDate.getTime() - now) / 86400000);
      daysUntilExpiry = days;
      if (days < 0) lifecycleStatus = "expired";
      else if (days <= c.reminderDays) lifecycleStatus = "expiring";
    }
    return {
      ...c,
      lifecycleStatus,
      daysUntilExpiry,
      openTaskCount: (c as any)._count?.relatedTasks ?? 0,
      expectedDocumentCount: (c as any)._count?.expectedDocuments ?? 0,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const body = await request.json();

    const contract = await prisma.contract.create({
      data: {
        companyId: ctx.companyId,
        name: body.name,
        contractType: body.contractType,
        counterparty: body.counterparty,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        noticePeriod: body.noticePeriod || null,
        autoRenew: body.autoRenew ?? false,
        monthlyAmount: parseFloat(body.monthlyAmount),
        currency: body.currency || "CHF",
        frequency: body.frequency || "monthly",
        debitAccount: body.debitAccount || null,
        vatRate: body.vatRate ? parseFloat(body.vatRate) : null,
        linkedSupplierId: body.linkedSupplierId || null,
        linkedAssetId: body.linkedAssetId || null,
        depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : null,
        notes: body.notes || null,
        reminderDays: body.reminderDays ?? 30,
      },
    });

    await logAudit({ companyId: ctx.companyId, userId: ctx.session.user.id, action: "contract_created", entityType: "contract", entityId: contract.id });

    return NextResponse.json(contract, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
