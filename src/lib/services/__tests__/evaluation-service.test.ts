import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("SuggestionEvaluation — Code Audit", () => {
  const servicesDir = path.resolve("src/lib/services");
  const apiDir = path.resolve("src/app/api");

  it("evaluateDocumentOutcome existiert in evaluation-service.ts", () => {
    const content = fs.readFileSync(
      path.join(servicesDir, "evaluation/evaluation-service.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function evaluateDocumentOutcome");
    expect(content).toContain("suggestionEvaluation.create");
    expect(content).toContain("fieldsEvaluated");
    expect(content).toContain("fieldsCorrect");
    expect(content).toContain("overallCorrect");
  });

  it("approve/route.ts ruft evaluateDocumentOutcome auf", () => {
    const content = fs.readFileSync(
      path.join(apiDir, "documents/[id]/approve/route.ts"),
      "utf-8"
    );
    expect(content).toContain("evaluateDocumentOutcome");
    expect(content).toContain("evaluation-service");
  });

  it("telemetry-service.ts nutzt suggestionEvaluation statt nur Proxy", () => {
    const content = fs.readFileSync(
      path.join(servicesDir, "telemetry/telemetry-service.ts"),
      "utf-8"
    );
    expect(content).toContain("suggestionEvaluation.findMany");
    expect(content).toContain("accountCorrect");
    expect(content).toContain("categoryCorrect");
    expect(content).toContain("costCenterCorrect");
  });

  it("SuggestionEvaluation model existiert im Prisma Schema", () => {
    const schema = fs.readFileSync(
      path.resolve("prisma/schema.prisma"),
      "utf-8"
    );
    expect(schema).toContain("model SuggestionEvaluation");
    expect(schema).toContain('@@map("suggestion_evaluations")');
    expect(schema).toContain("account_correct");
    expect(schema).toContain("category_correct");
    expect(schema).toContain("cost_center_correct");
  });
});
