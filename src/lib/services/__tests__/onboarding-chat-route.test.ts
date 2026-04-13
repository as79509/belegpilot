import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getActiveCompanyMock = vi.fn();
const hasPermissionMock = vi.fn();
const extractInsightsFromAnswerMock = vi.fn();

const prismaMock = {
  onboardingSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/get-active-company", () => ({
  getActiveCompany: getActiveCompanyMock,
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: hasPermissionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/services/onboarding/business-chat", () => ({
  generatePrioritizedQuestions: vi.fn(),
  extractInsightsFromAnswer: extractInsightsFromAnswerMock,
}));

describe("onboarding chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveCompanyMock.mockResolvedValue({
      companyId: "company-1",
      session: { user: { role: "admin" } },
    });
    hasPermissionMock.mockReturnValue(true);
    prismaMock.onboardingSession.findUnique.mockResolvedValue({
      id: "session-1",
      stepData: {},
    });
    prismaMock.onboardingSession.update.mockResolvedValue({});
  });

  it("speichert Antworten nur bei verwertbarem oder leerem Ergebnis", async () => {
    extractInsightsFromAnswerMock.mockResolvedValue({
      status: "success",
      message: "Erkenntnisse wurden erkannt und gespeichert.",
      insights: [{ id: "i1", type: "revenue_model", content: "Abo", confidence: "high", source: "chat", confirmed: false }],
      suggestedRules: [],
      suggestedKnowledge: [],
      suggestedExpectedDocs: [],
      resolvedUnknowns: [],
      newUnknowns: [],
      followUpQuestions: [],
    });

    const { POST } = await import("@/app/api/onboarding/chat/route");
    const request = new NextRequest("http://localhost/api/onboarding/chat", {
      method: "POST",
      body: JSON.stringify({ questionId: "q-revenue", answer: "Wir verkaufen Software-Abos." }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recorded).toBe(true);
    expect(prismaMock.onboardingSession.update).toHaveBeenCalledOnce();
    expect(prismaMock.onboardingSession.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "session-1" },
    });
  });

  it("liefert degraded mit 503 und speichert die Antwort nicht", async () => {
    extractInsightsFromAnswerMock.mockResolvedValue({
      status: "degraded",
      message: "Die KI-Auswertung ist derzeit nicht verf\u00fcgbar. Ihre Antwort wurde noch nicht gespeichert.",
      insights: [],
      suggestedRules: [],
      suggestedKnowledge: [],
      suggestedExpectedDocs: [],
      resolvedUnknowns: [],
      newUnknowns: [],
      followUpQuestions: [],
    });

    const { POST } = await import("@/app/api/onboarding/chat/route");
    const request = new NextRequest("http://localhost/api/onboarding/chat", {
      method: "POST",
      body: JSON.stringify({ questionId: "q-revenue", answer: "Wir verkaufen Software-Abos." }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.recorded).toBe(false);
    expect(prismaMock.onboardingSession.update).not.toHaveBeenCalled();
  });
});
