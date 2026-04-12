import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { classifyBootstrapDocuments } from "@/lib/services/onboarding/document-classifier";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "onboarding:read")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const result = await classifyBootstrapDocuments(ctx.companyId);

  // Persist newKnownUnknowns if session exists
  if (result.newKnownUnknowns.length > 0) {
    const session = await prisma.onboardingSession.findUnique({
      where: { companyId: ctx.companyId },
      select: { id: true },
    });

    if (session) {
      for (const unk of result.newKnownUnknowns) {
        const existing = await prisma.onboardingKnownUnknown.findFirst({
          where: { sessionId: session.id, area: unk.area, description: unk.description },
        });
        if (!existing) {
          await prisma.onboardingKnownUnknown.create({
            data: {
              sessionId: session.id,
              companyId: ctx.companyId,
              area: unk.area,
              description: unk.description,
              criticality: unk.criticality,
              suggestedAction: unk.suggestedAction,
            },
          });
        }
      }
    }
  }

  return NextResponse.json(result);
}
