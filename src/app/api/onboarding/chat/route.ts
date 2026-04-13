import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  generatePrioritizedQuestions,
  extractInsightsFromAnswer,
} from "@/lib/services/onboarding/business-chat";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
    if (!session) return NextResponse.json({ error: "Keine Onboarding-Session" }, { status: 404 });

    const questions = await generatePrioritizedQuestions(ctx.companyId, session.id, ctx.session.user.role);
    const stepData = (session.stepData as Record<string, any>) || {};
    const answeredCount = (stepData["4"]?.answeredQuestions || []).length;

    return NextResponse.json({ questions, answeredCount, totalExpected: answeredCount + questions.length });
  } catch (error: any) {
    console.error("[Chat] GET failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:execute")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { questionId, answer } = body;

    if (!questionId || !answer?.trim()) {
      return NextResponse.json({ error: "Frage-ID und Antwort erforderlich" }, { status: 400 });
    }

    const session = await prisma.onboardingSession.findUnique({ where: { companyId: ctx.companyId } });
    if (!session) return NextResponse.json({ error: "Keine Onboarding-Session" }, { status: 404 });

    // Extract insights
    const result = await extractInsightsFromAnswer(ctx.companyId, session.id, questionId, answer);

    // Save answer in stepData
    const stepData = (session.stepData as Record<string, any>) || {};
    const step4Data = stepData["4"] || { answeredQuestions: [] };
    step4Data.answeredQuestions = [
      ...(step4Data.answeredQuestions || []),
      { id: questionId, answer, answeredAt: new Date().toISOString(), insightCount: result.insights.length },
    ];
    stepData["4"] = step4Data;

    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: { stepData: stepData as any, lastActiveAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Chat] POST failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
