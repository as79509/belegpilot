import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { analyzeNewClient } from "@/lib/services/onboarding/onboarding-analyzer";

export async function POST(_request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Permission check: admin or trustee
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "trustee"].includes(user.role)) {
    return NextResponse.json(
      { error: "Nur Administratoren und Treuh\u00e4nder k\u00f6nnen Onboarding-Analysen durchf\u00fchren" },
      { status: 403 }
    );
  }

  const analysis = await analyzeNewClient(ctx.companyId);

  return NextResponse.json({ analysis });
}
