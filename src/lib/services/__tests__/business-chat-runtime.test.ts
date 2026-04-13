import { beforeEach, describe, expect, it, vi } from "vitest";

const anthropicCreateMock = vi.fn();

const prismaMock = {
  company: { findUniqueOrThrow: vi.fn() },
  onboardingSession: { findUniqueOrThrow: vi.fn() },
  onboardingKnownUnknown: { findMany: vi.fn(), updateMany: vi.fn() },
  document: { count: vi.fn() },
  supplier: { count: vi.fn(), findMany: vi.fn() },
  expectedDocument: { count: vi.fn() },
  contract: { count: vi.fn() },
  businessProfile: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = {
      create: anthropicCreateMock,
    };
  },
}));

describe("business-chat runtime behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.company.findUniqueOrThrow.mockResolvedValue({
      industry: "IT",
      legalForm: "GmbH",
      vatMethod: "effektiv",
      businessModel: null,
      vatLiable: true,
    });
    prismaMock.onboardingSession.findUniqueOrThrow.mockResolvedValue({ stepData: {} });
    prismaMock.onboardingKnownUnknown.findMany.mockResolvedValue([
      { id: "unknown-1", area: "business", description: "Gesch\u00e4ftsmodell unklar" },
    ]);
    prismaMock.document.count.mockResolvedValue(3);
    prismaMock.supplier.count.mockResolvedValue(1);
    prismaMock.expectedDocument.count.mockResolvedValue(0);
    prismaMock.contract.count.mockResolvedValue(0);
    prismaMock.supplier.findMany.mockResolvedValue([]);
    prismaMock.businessProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      insights: [],
      suggestedRules: [],
      suggestedKnowledge: [],
      suggestedExpectedDocs: [],
      revenueModel: null,
      riskFactors: [],
      criticalDeadlines: [],
    });
    prismaMock.onboardingKnownUnknown.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.businessProfile.update.mockResolvedValue({});
    prismaMock.businessProfile.create.mockResolvedValue({});
  });

  it("liefert success und speichert Erkenntnisse bei echter Extraktion", async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          insights: [{ type: "revenue_model", content: "Abo-Modell", confidence: "high" }],
          suggestedRules: [{ type: "supplier_to_account", description: "Regel", confidence: "medium" }],
          suggestedKnowledge: [],
          suggestedExpectedDocs: [],
          followUpQuestions: [],
          resolvedTopics: ["Gesch\u00e4ftsmodell"],
        }),
      }],
    });

    const { extractInsightsFromAnswer } = await import("@/lib/services/onboarding/business-chat");
    const result = await extractInsightsFromAnswer("company-1", "session-1", "q-revenue", "Wir verkaufen Software-Abos.");

    expect(result.status).toBe("success");
    expect(result.insights).toHaveLength(1);
    expect(prismaMock.businessProfile.update).toHaveBeenCalledOnce();
    expect(prismaMock.onboardingKnownUnknown.updateMany).toHaveBeenCalledOnce();
  });

  it("liefert empty ohne Placebo-Speicherung bei leerer KI-Antwort", async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          insights: [],
          suggestedRules: [],
          suggestedKnowledge: [],
          suggestedExpectedDocs: [],
          followUpQuestions: [],
          resolvedTopics: [],
        }),
      }],
    });

    const { extractInsightsFromAnswer } = await import("@/lib/services/onboarding/business-chat");
    const result = await extractInsightsFromAnswer("company-1", "session-1", "q-revenue", "Wir machen vieles.");

    expect(result.status).toBe("empty");
    expect(result.insights).toHaveLength(0);
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.businessProfile.create).not.toHaveBeenCalled();
  });

  it("liefert degraded bei Upstream-KI-Fehler und schreibt nichts weg", async () => {
    anthropicCreateMock.mockRejectedValue(new Error("Claude nicht erreichbar"));

    const { extractInsightsFromAnswer } = await import("@/lib/services/onboarding/business-chat");
    const result = await extractInsightsFromAnswer("company-1", "session-1", "q-revenue", "Wir verkaufen Software-Abos.");

    expect(result.status).toBe("degraded");
    expect(result.message).toContain("nicht verf");
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.businessProfile.create).not.toHaveBeenCalled();
    expect(prismaMock.onboardingKnownUnknown.updateMany).not.toHaveBeenCalled();
  });
});
