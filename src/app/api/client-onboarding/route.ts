import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

/**
 * Client Onboarding API
 * 
 * GET - Get the current onboarding draft
 * POST - Create new draft
 * PATCH - Update existing draft
 * 
 * This API powers the Airbnb-style client onboarding wizard.
 * Draft data is persisted so users can continue later.
 */

const DraftDataSchema = z.object({
  currentStep: z.number().min(0).max(6).optional(),
  formData: z.object({
    name: z.string().optional(),
    legalForm: z.string().optional(),
    industry: z.string().optional(),
    vatNumber: z.string().optional(),
    vatLiable: z.boolean().optional(),
    vatMethod: z.string().optional(),
    vatInterval: z.string().optional(),
    fiscalYearStart: z.number().optional(),
  }).optional(),
  uploadedFiles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    url: z.string().optional(),
    status: z.enum(["uploading", "uploaded", "error"]),
  })).optional(),
  chatMessages: z.array(z.object({
    id: z.string(),
    role: z.enum(["assistant", "user"]),
    content: z.string(),
  })).optional(),
  aiSuggestions: z.array(z.object({
    id: z.string(),
    category: z.string(),
    suggestion: z.string(),
    confidence: z.number(),
    status: z.enum(["pending", "accepted", "rejected"]),
    field: z.string().optional(),
    value: z.string().optional(),
  })).optional(),
  // For completing draft
  status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
  companyId: z.string().optional(),
});

// GET - Retrieve current draft
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    // Find the most recent in-progress draft for this user
    const draft = await prisma.onboardingDraft.findFirst({
      where: { 
        userId: session.user.id,
        status: "in_progress",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    // Parse stored data
    const data = draft.data as Record<string, unknown>;

    return NextResponse.json({
      draft: {
        id: draft.id,
        currentStep: draft.currentStep,
        formData: data.formData || {
          name: "",
          legalForm: "",
          industry: "",
          vatNumber: "",
          vatLiable: true,
          vatMethod: "effektiv",
          vatInterval: "quarterly",
          fiscalYearStart: 1,
        },
        uploadedFiles: data.uploadedFiles || [],
        chatMessages: data.chatMessages || [],
        aiSuggestions: data.aiSuggestions || [],
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create new draft
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = DraftDataSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Ungültige Daten", 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const { currentStep = 0, formData, uploadedFiles, chatMessages, aiSuggestions } = parsed.data;

    // Check if there's already an in-progress draft
    const existingDraft = await prisma.onboardingDraft.findFirst({
      where: { userId: session.user.id, status: "in_progress" },
    });

    if (existingDraft) {
      // Update existing draft instead
      const updatedDraft = await prisma.onboardingDraft.update({
        where: { id: existingDraft.id },
        data: {
          currentStep,
          data: {
            formData,
            uploadedFiles,
            chatMessages,
            aiSuggestions,
          },
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ 
        id: updatedDraft.id,
        message: "Entwurf aktualisiert",
      });
    }

    // Create new draft
    const draft = await prisma.onboardingDraft.create({
      data: {
        userId: session.user.id,
        currentStep,
        data: {
          formData,
          uploadedFiles,
          chatMessages,
          aiSuggestions,
        },
        status: "in_progress",
      },
    });

    return NextResponse.json({ 
      id: draft.id,
      message: "Entwurf erstellt",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update existing draft
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Draft ID erforderlich" }, { status: 400 });
    }

    const parsed = DraftDataSchema.safeParse(updates);
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Ungültige Daten", 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    // Verify ownership
    const existingDraft = await prisma.onboardingDraft.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingDraft) {
      return NextResponse.json({ error: "Entwurf nicht gefunden" }, { status: 404 });
    }

    const { status, companyId, currentStep, formData, uploadedFiles, chatMessages, aiSuggestions } = parsed.data;

    // Handle completion
    if (status === "completed") {
      await prisma.onboardingDraft.update({
        where: { id },
        data: {
          status: "completed",
          companyId: companyId || null,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: "Entwurf abgeschlossen" });
    }

    // Normal update
    const existingData = existingDraft.data as Record<string, unknown>;
    
    const updatedDraft = await prisma.onboardingDraft.update({
      where: { id },
      data: {
        currentStep: currentStep ?? existingDraft.currentStep,
        data: {
          formData: formData ?? existingData.formData,
          uploadedFiles: uploadedFiles ?? existingData.uploadedFiles,
          chatMessages: chatMessages ?? existingData.chatMessages,
          aiSuggestions: aiSuggestions ?? existingData.aiSuggestions,
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      id: updatedDraft.id,
      message: "Entwurf aktualisiert",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding] PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Discard draft
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Delete specific draft
      await prisma.onboardingDraft.deleteMany({
        where: { id, userId: session.user.id },
      });
    } else {
      // Delete all in-progress drafts for user
      await prisma.onboardingDraft.deleteMany({
        where: { userId: session.user.id, status: "in_progress" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[ClientOnboarding] DELETE error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
