import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!vatReturn) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json(
    {
      error: "Der XML-Export ist noch nicht produktiv verfügbar.",
      implementationStatus: "not_available",
      vatReturnId: vatReturn.id,
    },
    {
      status: 409,
      headers: {
        "X-Implementation-Status": "not_available",
      },
    }
  );
}
