import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: session.user.id },
    include: {
      company: {
        select: {
          id: true, name: true, legalName: true, legalForm: true,
          industry: true, status: true, currency: true, vatNumber: true,
        },
      },
    },
  });

  return NextResponse.json({
    clients: userCompanies.map((uc) => ({ ...uc.company, role: uc.role })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(session.user.role, "system:admin")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Firmenname erforderlich" }, { status: 400 });

    // Extract onboarding-specific fields
    const { onboardingDraftId, onboardingFiles, ...companyData } = body;

    // Create the company
    const company = await prisma.company.create({
      data: {
        name: companyData.name,
        legalName: companyData.legalName || companyData.name,
        legalForm: companyData.legalForm,
        vatNumber: companyData.vatNumber,
        currency: companyData.currency || "CHF",
        industry: companyData.industry,
        subIndustry: companyData.subIndustry,
        businessModel: companyData.businessModel,
        employeeCount: companyData.employeeCount,
        fiscalYearStart: companyData.fiscalYearStart,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website,
        vatLiable: companyData.vatLiable ?? true,
        vatMethod: companyData.vatMethod,
        vatInterval: companyData.vatInterval,
        chartOfAccounts: companyData.chartOfAccounts,
        aiContext: companyData.aiContext,
        aiConfidenceThreshold: companyData.aiConfidenceThreshold,
        aiAutoApprove: companyData.aiAutoApprove ?? false,
      },
    });

    // Link the creating user to the new company
    await prisma.userCompany.create({
      data: { userId: session.user.id, companyId: company.id, role: "admin", isDefault: false },
    });

    // Migrate onboarding files to the company if provided
    if (onboardingFiles && Array.isArray(onboardingFiles) && onboardingFiles.length > 0) {
      await migrateOnboardingFilesToCompany(session.user.id, company.id, onboardingFiles);
    }

    // Mark the onboarding draft as completed if provided
    if (onboardingDraftId) {
      try {
        await prisma.onboardingDraft.update({
          where: { id: onboardingDraftId },
          data: {
            status: "completed",
            companyId: company.id,
            completedAt: new Date(),
          },
        });
      } catch (err) {
        // Don't fail company creation if draft update fails
        console.error("[TrusteeClients] Failed to mark draft as completed:", err);
      }
    }

    return NextResponse.json(company, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[TrusteeClients] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Migrate files from onboarding storage to company storage
 * and create Document records in the database
 */
async function migrateOnboardingFilesToCompany(
  userId: string,
  companyId: string,
  files: Array<{ id: string; name: string; type: string; size: number; url?: string; path?: string }>
) {
  const supabase = await createClient();

  for (const file of files) {
    try {
      // If we have a path, we could move the file in storage
      // For now, we just create document records pointing to the existing URLs
      if (file.url) {
        await prisma.document.create({
          data: {
            companyId,
            name: file.name,
            type: file.type.includes("pdf") ? "INVOICE" : "RECEIPT", // Simple categorization
            status: "UPLOADED",
            filePath: file.url,
            fileSize: file.size,
            originalFilename: file.name,
            mimeType: file.type,
            source: "ONBOARDING",
            metadata: {
              onboardingFileId: file.id,
              migratedAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch (err) {
      console.error(`[TrusteeClients] Failed to migrate file ${file.name}:`, err);
      // Continue with other files
    }
  }
}
