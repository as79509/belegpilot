import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { generatePrioritizedQuestions } from "@/lib/services/onboarding/business-chat";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
    if (!session) return NextResponse.json({ error: "Keine Onboarding-Session" }, { status: 404 });

    const questions = await generatePrioritizedQuestions(ctx.companyId, session.id);
    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error("[ChatQuestions] GET failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
