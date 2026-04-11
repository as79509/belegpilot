import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    autopilotConfig: { findUnique: vi.fn() },
    autopilotEvent: { create: vi.fn() },
    account: { findFirst: vi.fn() },
  },
}));

vi.mock("../safety-check", () => ({
  runSafetyChecks: vi.fn(),
}));

vi.mock("@/lib/services/suggestions/suggestion-engine", () => ({
  generateSuggestion: vi.fn(),
}));

import { evaluateAutopilot } from "../autopilot-decision";
import { prisma } from "@/lib/db";
import { runSafetyChecks } from "../safety-check";
import { generateSuggestion } from "@/lib/services/suggestions/suggestion-engine";

const mockConfigFind = prisma.autopilotConfig.findUnique as ReturnType<typeof vi.fn>;
const mockEventCreate = prisma.autopilotEvent.create as ReturnType<typeof vi.fn>;
const mockAccountFind = (prisma as any).account.findFirst as ReturnType<typeof vi.fn>;
const mockRunSafety = runSafetyChecks as ReturnType<typeof vi.fn>;
const mockGenerateSuggestion = generateSuggestion as ReturnType<typeof vi.fn>;

const baseDoc = {
  id: "doc-1",
  supplierNameNormalized: "Swisscom",
  supplierId: "sup-1",
  grossAmount: 100,
  currency: "CHF",
  documentType: "invoice",
  invoiceDate: new Date("2026-01-01"),
  confidenceScore: 0.9,
  decisionReasons: {},
  expenseCategory: "Telekommunikation",
  vatRatesDetected: [{ rate: 8.1 }],
};

function makeConfig(overrides: any = {}) {
  return {
    id: "cfg-1",
    companyId: "comp-1",
    enabled: true,
    mode: "shadow",
    minHistoryMatches: 5,
    minStabilityScore: 0.8,
    maxAmount: null,
    minConfidence: 0.85,
    allowedDocTypes: null,
    allowedCurrencies: null,
    supplierAllowlist: null,
    killSwitchActive: false,
    killSwitchBy: null,
    killSwitchAt: null,
    killSwitchReason: null,
    ...overrides,
  };
}

const eligibleSafety = { eligible: true, checks: { ok: { passed: true, detail: "ok" } }, blockedBy: null };
const blockedSafety = { eligible: false, checks: { fail: { passed: false, detail: "no" } }, blockedBy: "fail" };
const mockSuggestion = { suggestedAccount: "6500", confidenceLevel: "high", confidenceScore: 0.95 };

describe("evaluateAutopilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventCreate.mockResolvedValue({});
    // Default: suggested account is approved for autopilot
    mockAccountFind.mockResolvedValue({ aiGovernance: "ai_autopilot", accountNumber: "6500" });
  });

  it("Config disabled → mode 'disabled', action 'none'", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ enabled: false }));
    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("disabled");
    expect(result.action).toBe("none");
    expect(result.eligible).toBe(false);
    expect(mockRunSafety).not.toHaveBeenCalled();
  });

  it("Kein Config → mode 'disabled'", async () => {
    mockConfigFind.mockResolvedValue(null);
    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("disabled");
    expect(result.action).toBe("none");
  });

  it("Kill Switch aktiv → mode 'disabled'", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ killSwitchActive: true }));
    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("disabled");
    expect(result.action).toBe("none");
    expect(mockRunSafety).not.toHaveBeenCalled();
  });

  it("Shadow Mode + eligible → action 'none' (nur beobachten)", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "shadow" }));
    mockRunSafety.mockResolvedValue(eligibleSafety);
    mockGenerateSuggestion.mockResolvedValue(mockSuggestion);

    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("shadow");
    expect(result.eligible).toBe(true);
    expect(result.action).toBe("none");
    expect(result.suggestion).toEqual(mockSuggestion);
  });

  it("Prefill Mode + eligible → action 'prefill'", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "prefill" }));
    mockRunSafety.mockResolvedValue(eligibleSafety);
    mockGenerateSuggestion.mockResolvedValue(mockSuggestion);

    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("prefill");
    expect(result.action).toBe("prefill");
  });

  it("Auto-Ready Mode + eligible → action 'auto_ready'", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "auto_ready" }));
    mockRunSafety.mockResolvedValue(eligibleSafety);
    mockGenerateSuggestion.mockResolvedValue(mockSuggestion);

    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.mode).toBe("auto_ready");
    expect(result.action).toBe("auto_ready");
  });

  it("Safety blocked → action 'none', eligible false", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "auto_ready" }));
    mockRunSafety.mockResolvedValue(blockedSafety);

    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.eligible).toBe(false);
    expect(result.action).toBe("none");
    expect(mockGenerateSuggestion).not.toHaveBeenCalled();
  });

  it("Kein Suggestion → action 'none' trotz eligible", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "auto_ready" }));
    mockRunSafety.mockResolvedValue(eligibleSafety);
    mockGenerateSuggestion.mockResolvedValue(null);

    const result = await evaluateAutopilot("comp-1", baseDoc);
    expect(result.eligible).toBe(true);
    expect(result.action).toBe("none");
    expect(result.suggestion).toBeNull();
  });

  it("AutopilotEvent wird bei eligible erstellt", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "prefill" }));
    mockRunSafety.mockResolvedValue(eligibleSafety);
    mockGenerateSuggestion.mockResolvedValue(mockSuggestion);

    await evaluateAutopilot("comp-1", baseDoc);
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "comp-1",
        documentId: "doc-1",
        mode: "prefill",
        decision: "eligible",
        suggestedAccount: "6500",
      }),
    });
  });

  it("AutopilotEvent wird bei blocked erstellt", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ mode: "auto_ready" }));
    mockRunSafety.mockResolvedValue(blockedSafety);

    await evaluateAutopilot("comp-1", baseDoc);
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: "blocked",
        blockedBy: "fail",
      }),
    });
  });

  it("AutopilotEvent wird NICHT bei disabled erstellt", async () => {
    mockConfigFind.mockResolvedValue(makeConfig({ enabled: false }));
    await evaluateAutopilot("comp-1", baseDoc);
    expect(mockEventCreate).not.toHaveBeenCalled();
  });
});
