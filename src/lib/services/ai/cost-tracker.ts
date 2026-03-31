import { prisma } from "@/lib/db";

// Claude Sonnet 4 pricing (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

export async function recordAiUsage(params: {
  companyId: string;
  documentId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const pricing = PRICING[params.model] || DEFAULT_PRICING;
  const costUsd =
    (params.inputTokens * pricing.input) / 1_000_000 +
    (params.outputTokens * pricing.output) / 1_000_000;

  await prisma.aiUsage.create({
    data: {
      companyId: params.companyId,
      documentId: params.documentId,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostUsd: costUsd,
    },
  });
}

export async function getMonthlyUsage(
  companyId: string,
  year: number,
  month: number
): Promise<{
  documentCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await prisma.aiUsage.aggregate({
    where: {
      companyId,
      createdAt: { gte: startDate, lt: endDate },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      estimatedCostUsd: true,
    },
    _count: true,
  });

  return {
    documentCount: result._count,
    totalInputTokens: result._sum.inputTokens || 0,
    totalOutputTokens: result._sum.outputTokens || 0,
    totalCostUsd: result._sum.estimatedCostUsd
      ? Number(result._sum.estimatedCostUsd)
      : 0,
  };
}
