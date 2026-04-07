import { prisma } from "@/lib/db";

interface TrackedError {
  source: "api" | "inngest" | "bexio" | "ai" | "client";
  message: string;
  context?: Record<string, any>;
  companyId?: string;
  documentId?: string;
}

export async function trackError(error: TrackedError): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: error.companyId || "00000000-0000-0000-0000-000000000001",
        action: "system_error",
        entityType: error.source,
        entityId: error.documentId || "unknown",
        changes: {
          message: error.message,
          context: error.context,
          timestamp: new Date().toISOString(),
        } as any,
      },
    });
  } catch (e) {
    console.error("[ErrorTracker] Failed to log error:", e);
  }
}
