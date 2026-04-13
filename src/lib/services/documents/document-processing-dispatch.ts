import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { trackError } from "@/lib/services/error-tracker";

type PrismaLike = typeof prisma;
type InngestLike = Pick<typeof inngest, "send">;

interface DispatchDeps {
  prismaClient?: PrismaLike;
  inngestClient?: InngestLike;
  trackErrorFn?: typeof trackError;
}

interface DispatchArgs {
  companyId: string;
  documentId: string;
  source: "upload" | "reprocess" | "bulk_reprocess" | "reset_stuck" | "email";
}

interface DispatchResult {
  ok: boolean;
  error?: string;
}

export async function dispatchDocumentProcessing(
  args: DispatchArgs,
  deps: DispatchDeps = {}
): Promise<DispatchResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const inngestClient = deps.inngestClient ?? inngest;
  const trackErrorFn = deps.trackErrorFn ?? trackError;

  try {
    await inngestClient.send({
      name: "document/uploaded",
      data: { documentId: args.documentId },
    });
    return { ok: true };
  } catch (error: any) {
    const message = error?.message || "Inngest konnte nicht erreicht werden";
    const userMessage = `Verarbeitung konnte nicht gestartet werden: ${message}`;

    await prismaClient.document.update({
      where: { id: args.documentId },
      data: {
        status: "failed",
        processingDecision: "failed",
      },
    });

    await prismaClient.processingStep.create({
      data: {
        documentId: args.documentId,
        stepName: "processing",
        status: "failed",
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: userMessage,
        metadata: {
          source: args.source,
          stage: "queue",
        } as any,
      },
    });

    await trackErrorFn({
      source: "inngest",
      message: userMessage,
      documentId: args.documentId,
    }).catch(() => {});

    return {
      ok: false,
      error: userMessage,
    };
  }
}
