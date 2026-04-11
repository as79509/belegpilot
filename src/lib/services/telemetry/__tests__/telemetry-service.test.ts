import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    document: { count: vi.fn(), findMany: vi.fn() },
    bookingSuggestion: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    autopilotEvent: { count: vi.fn(), findMany: vi.fn() },
    correctionEvent: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    correctionPattern: { count: vi.fn() },
    supplier: { findMany: vi.fn() },
    processingStep: { aggregate: vi.fn() },
  },
}));

import { computeTelemetry } from "../telemetry-service";
import { prisma } from "@/lib/db";

const mockDocCount = prisma.document.count as ReturnType<typeof vi.fn>;
const mockDocFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>;
const mockSuggCount = prisma.bookingSuggestion.count as ReturnType<typeof vi.fn>;
const mockSuggFindMany = prisma.bookingSuggestion.findMany as ReturnType<typeof vi.fn>;
const mockSuggGroupBy = prisma.bookingSuggestion.groupBy as ReturnType<typeof vi.fn>;
const mockApCount = prisma.autopilotEvent.count as ReturnType<typeof vi.fn>;
const mockApFindMany = prisma.autopilotEvent.findMany as ReturnType<typeof vi.fn>;
const mockCorrCount = prisma.correctionEvent.count as ReturnType<typeof vi.fn>;
const mockCorrFindMany = prisma.correctionEvent.findMany as ReturnType<typeof vi.fn>;
const mockPatternCount = prisma.correctionPattern.count as ReturnType<typeof vi.fn>;
const mockSupplierFindMany = prisma.supplier.findMany as ReturnType<typeof vi.fn>;
const mockProcessingStepAggregate = (prisma as any).processingStep.aggregate as ReturnType<typeof vi.fn>;

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";

function setEmptyDefaults() {
  mockDocCount.mockResolvedValue(0);
  mockDocFindMany.mockResolvedValue([]);
  mockSuggCount.mockResolvedValue(0);
  mockSuggFindMany.mockResolvedValue([]);
  mockSuggGroupBy.mockResolvedValue([]);
  mockApCount.mockResolvedValue(0);
  mockApFindMany.mockResolvedValue([]);
  mockCorrCount.mockResolvedValue(0);
  mockCorrFindMany.mockResolvedValue([]);
  mockPatternCount.mockResolvedValue(0);
  mockSupplierFindMany.mockResolvedValue([]);
  mockProcessingStepAggregate.mockResolvedValue({ _avg: { durationMs: null } });
}

describe("computeTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEmptyDefaults();
  });

  it("Leere DB → alle Werte 0 oder leere Arrays", async () => {
    const result = await computeTelemetry(COMPANY_ID);
    expect(result.pipeline.totalUploaded).toBe(0);
    expect(result.pipeline.totalProcessed).toBe(0);
    expect(result.pipeline.successRate).toBe(0);
    expect(result.pipeline.failedCount).toBe(0);
    expect(result.pipeline.stuckProcessing).toBe(0);
    expect(result.suggestions.totalExposed).toBe(0);
    expect(result.suggestions.acceptanceRate).toBe(0);
    expect(result.suggestions.coverage).toBe(0);
    expect(result.autopilot.totalEvents).toBe(0);
    expect(result.autopilot.eligibleRate).toBe(0);
    expect(result.autopilot.topBlockReasons).toEqual([]);
    expect(result.drift.alerts).toEqual([]);
    expect(result.calibration.isCalibrated).toBe(false);
    expect(result.corrections.totalEvents).toBe(0);
    expect(result.corrections.topCorrectedFields).toEqual([]);
    expect(result.corrections.topCorrectedSuppliers).toEqual([]);
  });

  it("10 uploaded, 8 processed → successRate 0.8", async () => {
    // count calls in order: totalUploaded, totalProcessed, failedCount, stuckProcessing
    mockDocCount
      .mockResolvedValueOnce(10) // totalUploaded
      .mockResolvedValueOnce(8)  // totalProcessed
      .mockResolvedValueOnce(0)  // failedCount
      .mockResolvedValueOnce(0); // stuckProcessing

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.pipeline.totalUploaded).toBe(10);
    expect(result.pipeline.totalProcessed).toBe(8);
    expect(result.pipeline.successRate).toBe(0.8);
  });

  it("5 Suggestions, 3 accepted, 1 modified → acceptanceRate 0.8", async () => {
    // count calls: totalSugg, accepted, rejected, modified
    mockSuggCount
      .mockResolvedValueOnce(5) // total
      .mockResolvedValueOnce(3) // accepted
      .mockResolvedValueOnce(1) // rejected
      .mockResolvedValueOnce(1); // modified

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.suggestions.totalExposed).toBe(5);
    expect(result.suggestions.acceptedCount).toBe(3);
    expect(result.suggestions.modifiedCount).toBe(1);
    expect(result.suggestions.rejectedCount).toBe(1);
    expect(result.suggestions.acceptanceRate).toBe(0.8);
    expect(result.suggestions.modifiedRate).toBe(0.2);
  });

  it("Autopilot: 10 events, 7 eligible → eligibleRate 0.7", async () => {
    // count order: apTotal, apEligible, apBlocked
    mockApCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(7)  // eligible
      .mockResolvedValueOnce(3); // blocked

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.autopilot.totalEvents).toBe(10);
    expect(result.autopilot.eligibleCount).toBe(7);
    expect(result.autopilot.blockedCount).toBe(3);
    expect(result.autopilot.eligibleRate).toBe(0.7);
  });

  it("Blocked events mit verschiedenen Gründen → topBlockReasons sortiert", async () => {
    mockApFindMany.mockResolvedValue([
      { blockedBy: "min_confidence" },
      { blockedBy: "min_confidence" },
      { blockedBy: "min_confidence" },
      { blockedBy: "kill_switch" },
      { blockedBy: "max_amount" },
      { blockedBy: "max_amount" },
    ]);

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.autopilot.topBlockReasons).toEqual([
      { reason: "min_confidence", count: 3 },
      { reason: "max_amount", count: 2 },
      { reason: "kill_switch", count: 1 },
    ]);
  });

  it("Calibration: high > medium > low → isCalibrated true", async () => {
    // findMany order: highSugg, medSugg, lowSugg
    // We need >=5 items in highSugg
    mockSuggFindMany
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
        { status: "modified" },
      ]) // high: 5/6 = 0.833
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "accepted" },
        { status: "modified" },
        { status: "modified" },
      ]) // medium: 2/4 = 0.5
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "rejected" },
        { status: "rejected" },
        { status: "modified" },
      ]); // low: 1/4 = 0.25

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.calibration.highConfidenceAccuracy).toBeCloseTo(5 / 6);
    expect(result.calibration.mediumConfidenceAccuracy).toBe(0.5);
    expect(result.calibration.lowConfidenceAccuracy).toBe(0.25);
    expect(result.calibration.isCalibrated).toBe(true);
  });

  it("Calibration: low accuracy > high → isCalibrated false", async () => {
    mockSuggFindMany
      .mockResolvedValueOnce([
        { status: "rejected" },
        { status: "rejected" },
        { status: "rejected" },
        { status: "rejected" },
        { status: "accepted" },
      ]) // high: 1/5 = 0.2
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "accepted" },
        { status: "rejected" },
      ]) // medium: 2/3 = 0.67
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "accepted" },
        { status: "accepted" },
      ]); // low: 3/3 = 1.0

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.calibration.highConfidenceAccuracy).toBe(0.2);
    expect(result.calibration.lowConfidenceAccuracy).toBe(1);
    expect(result.calibration.isCalibrated).toBe(false);
  });

  it("Calibration mit weniger als 5 high samples → isCalibrated false (auch bei guter Reihenfolge)", async () => {
    mockSuggFindMany
      .mockResolvedValueOnce([
        { status: "accepted" },
        { status: "accepted" },
      ]) // high: 2/2 = 1, aber nur 2 samples
      .mockResolvedValueOnce([{ status: "accepted" }]) // medium 1
      .mockResolvedValueOnce([{ status: "rejected" }]); // low 0

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.calibration.isCalibrated).toBe(false);
  });

  it("groupBy für Suggestion-Coverage wird genutzt", async () => {
    mockDocCount
      .mockResolvedValueOnce(10) // totalUploaded
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockSuggGroupBy.mockResolvedValue([
      { documentId: "d1" },
      { documentId: "d2" },
      { documentId: "d3" },
      { documentId: "d4" },
      { documentId: "d5" },
    ]);

    const result = await computeTelemetry(COMPANY_ID);
    expect(result.suggestions.coverage).toBe(0.5);
  });

  it("Periode-Felder von/bis sind gesetzt", async () => {
    const result = await computeTelemetry(COMPANY_ID, 30);
    expect(result.period.from).toBeInstanceOf(Date);
    expect(result.period.to).toBeInstanceOf(Date);
    const diffDays = (result.period.to.getTime() - result.period.from.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });
});
