import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit, computeChanges } from "@/lib/services/audit/audit-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId: session.user.companyId },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, documentNumber: true, status: true, invoiceNumber: true,
          invoiceDate: true, grossAmount: true, currency: true, createdAt: true,
        },
      },
    },
  });

  if (!supplier) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(supplier);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!["admin", "reviewer"].includes(session.user.role))
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const supplier = await prisma.supplier.findFirst({
      where: { id, companyId: session.user.companyId },
    });
    if (!supplier) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const fields = [
      "nameNormalized", "nameVariants", "vatNumber", "iban", "address", "country",
      "email", "phone", "website", "contactPerson", "street", "zip", "city",
      "bankName", "bic", "paymentTermDays", "notes",
      "defaultCategory", "defaultAccountCode", "defaultCostCenter", "defaultVatCode",
    ];
    const updateData: Record<string, any> = {};
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const changes = computeChanges(supplier as any, updateData, fields);

    const updated = await prisma.supplier.update({ where: { id }, data: updateData });

    if (changes) {
      await logAudit({
        companyId: session.user.companyId,
        userId: session.user.id,
        action: "supplier_edited",
        entityType: "supplier",
        entityId: id,
        changes,
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
