import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "bank:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { documentId, noMatch } = body;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!tx) return NextResponse.json({ error: "Transaktion nicht gefunden" }, { status: 404 });

  if (noMatch) {
    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: {
        matchStatus: "no_match",
        matchedDocumentId: null,
        matchConfidence: null,
        matchMethod: null,
        matchedAt: new Date(),
        matchedBy: ctx.session.user.id,
      },
    });
    return NextResponse.json(updated);
  }

  if (!documentId) {
    return NextResponse.json({ error: "documentId oder noMatch erforderlich" }, { status: 400 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, companyId: ctx.companyId },
  });
  if (!doc) return NextResponse.json({ error: "Beleg nicht gefunden" }, { status: 404 });

  const updated = await prisma.bankTransaction.update({
    where: { id },
    data: {
      matchStatus: "manual_matched",
      matchedDocumentId: documentId,
      matchConfidence: 1.0,
      matchMethod: "manual",
      matchedAt: new Date(),
      matchedBy: ctx.session.user.id,
    },
  });

  return NextResponse.json(updated);
}
