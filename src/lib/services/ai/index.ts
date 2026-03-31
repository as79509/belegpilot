import type { AiNormalizerService } from "./ai-normalizer.interface";
import { ClaudeNormalizer } from "./claude-normalizer";
import { MockNormalizer } from "./mock-normalizer";

export function getAiNormalizer(): AiNormalizerService {
  const provider = process.env.AI_PROVIDER || "mock";

  switch (provider) {
    case "claude":
      return new ClaudeNormalizer();
    case "mock":
    default:
      return new MockNormalizer();
  }
}

export type {
  AiNormalizerService,
  NormalizedInvoiceData,
  AiNormalizerResult,
} from "./ai-normalizer.interface";
