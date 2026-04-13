import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { z } from "zod";

/**
 * Client Onboarding API
 * 
 * GET - Get the current onboarding draft (stored in OnboardingDraft table)
 * POST - Create/update onboarding draft
 * 
 * This API powers the Airbnb-style client onboarding wizard.
 * Draft data is persisted so users can continue later.
 */

const DraftSchema = z.object({
  step: z.number().min(0).max(6),
  data: z.object({
    // Step 1: Business basics
    name: z.string().optional(),
    legalForm: z.string().optional(),
    industry: z.string().optional(),
    // Step 2: Accounting setup
    vatNumber: z.string().optional(),
    vatLiable: z.boolean().optional(),
    vatMethod: z.string().optional(),
    vatInterval: z.string().optional(),
    fiscalYearStart: z.number().optional(),
    // Step 3: Documents (IDs of uploaded docs)
    uploadedDocumentIds: z.array(z.string()).optional(),
    // Step 4: Business questions
    chatHistory: z.array(z.object({
      id: z.string(),
      role: z.enum(["assistant", "user"]),
      content: z.string(),
      timestamp: z.string().optional(),
    })).optional(),
    answeredQuestionIds: z.array(z.string()).optional(),
    // Step 5: AI suggestions
    suggestions: z.array(z.object({
      id: z.string(),
      category: z.string(),
      suggestion: z.string(),
      confidence: z.number(),
      status: z.enum(["pending", "accepted", "rejected"]),
    })).optional(),
  }),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    // Find the most recent draft for this user
    const draft = await prisma.onboardingDraft.findFirst({
      where: { 
        userId: session.user.id,
        status: "in_progress",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!draft) {
      // Return empty draft structure
      return NextResponse.json({
        id: null,
        step: 0,
        data: {
          name: "",
          legalForm: "",
          industry: "",
          vatNumber: "",
          vatLiable: true,
          vatMethod: "effektiv",
          vatInterval: "quarterly",
          fiscalYearStart: 1,
          uploadedDocumentIds: [],
          chatHistory: [],
          answeredQuestionIds: [],
          suggestions: [],
        },
        createdAt: null,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      id: draft.id,
      step: draft.currentStep,
      data: draft.data,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
  } catch (error: any) {
    console.error("[ClientOnboarding] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, ...payload } = body;

    // Handle different actions
    switch (action) {
      case "save_draft": {
        const parsed = DraftSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json({ error: "Ungültige Daten", details: parsed.error.issues }, { status: 400 });
        }

        // Upsert draft
        const existingDraft = await prisma.onboardingDraft.findFirst({
          where: { userId: session.user.id, status: "in_progress" },
        });

        const draft = existingDraft 
          ? await prisma.onboardingDraft.update({
              where: { id: existingDraft.id },
              data: {
                currentStep: parsed.data.step,
                data: parsed.data.data as any,
                updatedAt: new Date(),
              },
            })
          : await prisma.onboardingDraft.create({
              data: {
                userId: session.user.id,
                currentStep: parsed.data.step,
                data: parsed.data.data as any,
                status: "in_progress",
              },
            });

        return NextResponse.json({ 
          success: true, 
          draftId: draft.id,
          savedAt: draft.updatedAt,
        });
      }

      case "submit": {
        // Final submission - create the actual client/company
        const draft = await prisma.onboardingDraft.findFirst({
          where: { userId: session.user.id, status: "in_progress" },
        });

        if (!draft) {
          return NextResponse.json({ error: "Kein Entwurf gefunden" }, { status: 404 });
        }

        const draftData = draft.data as any;
        
        if (!draftData.name?.trim()) {
          return NextResponse.json({ error: "Firmenname erforderlich" }, { status: 400 });
        }

        // Check permission to create clients
        if (!hasPermission(session.user.role, "system:admin")) {
          return NextResponse.json({ error: "Keine Berechtigung zum Erstellen von Mandanten" }, { status: 403 });
        }

        // Create the company
        const company = await prisma.company.create({
          data: {
            name: draftData.name,
            legalName: draftData.name,
            legalForm: draftData.legalForm || null,
            industry: draftData.industry || null,
            vatNumber: draftData.vatNumber || null,
            vatLiable: draftData.vatLiable ?? true,
            vatMethod: draftData.vatMethod || null,
            vatInterval: draftData.vatInterval || null,
            fiscalYearStart: draftData.fiscalYearStart || 1,
            currency: "CHF",
            status: "onboarding",
          },
        });

        // Link user to company
        await prisma.userCompany.create({
          data: {
            userId: session.user.id,
            companyId: company.id,
            role: "admin",
            isDefault: false,
          },
        });

        // Create onboarding session for further setup
        await prisma.onboardingSession.create({
          data: {
            companyId: company.id,
            currentStep: 1,
            status: "in_progress",
            stepData: {
              "1": draftData,
              uploadedDocumentIds: draftData.uploadedDocumentIds || [],
              chatHistory: draftData.chatHistory || [],
              suggestions: draftData.suggestions || [],
            },
          },
        });

        // Move any uploaded documents to the new company
        if (draftData.uploadedDocumentIds?.length > 0) {
          await prisma.document.updateMany({
            where: { id: { in: draftData.uploadedDocumentIds } },
            data: { companyId: company.id },
          });
        }

        // Mark draft as completed
        await prisma.onboardingDraft.update({
          where: { id: draft.id },
          data: { status: "completed", completedAt: new Date() },
        });

        return NextResponse.json({
          success: true,
          companyId: company.id,
          message: "Mandant erfolgreich erstellt",
        });
      }

      case "discard": {
        // Delete the draft
        await prisma.onboardingDraft.deleteMany({
          where: { userId: session.user.id, status: "in_progress" },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[ClientOnboarding] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
