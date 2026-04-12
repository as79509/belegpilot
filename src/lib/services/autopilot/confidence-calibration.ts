import { prisma } from "@/lib/db";

export interface CalibrationResult {
  levels: {
    high: { threshold: number; count: number; actualAccuracy: number; calibrated: boolean };
    medium: { threshold: number; count: number; actualAccuracy: number; calibrated: boolean };
    low: { threshold: number; count: number; actualAccuracy: number; calibrated: boolean };
  };
  overallCalibration: number;
  recommendation: string | null;
}

export async function calibrateConfidence(companyId: string): Promise<CalibrationResult> {
  const d90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const evaluations = await prisma.suggestionEvaluation.findMany({
    where: {
      companyId,
      createdAt: { gte: d90 },
      confidenceLevel: { not: null },
    },
    select: { confidenceLevel: true, overallCorrect: true },
  });

  function calcLevel(level: string, expectedAccuracy: number) {
    const items = evaluations.filter((e) => e.confidenceLevel === level);
    const count = items.length;
    const correct = items.filter((e) => e.overallCorrect).length;
    const actualAccuracy = count > 0 ? correct / count : 0;
    return {
      threshold: expectedAccuracy,
      count,
      actualAccuracy,
      calibrated: count >= 3 && actualAccuracy >= expectedAccuracy,
    };
  }

  const high = calcLevel("high", 0.85);
  const medium = calcLevel("medium", 0.6);
  const low = calcLevel("low", 0.3);

  // Weighted overall calibration (high 3x, medium 2x, low 1x)
  const totalWeight = (high.count > 0 ? 3 : 0) + (medium.count > 0 ? 2 : 0) + (low.count > 0 ? 1 : 0);
  const overallCalibration = totalWeight > 0
    ? (
        (high.count > 0 ? Math.min(high.actualAccuracy / high.threshold, 1) * 3 : 0) +
        (medium.count > 0 ? Math.min(medium.actualAccuracy / medium.threshold, 1) * 2 : 0) +
        (low.count > 0 ? Math.min(low.actualAccuracy / low.threshold, 1) * 1 : 0)
      ) / totalWeight
    : 0;

  let recommendation: string | null = null;
  if (high.count >= 5 && high.actualAccuracy < 0.75) {
    recommendation = "Konfidenz-Schwellwert f\u00fcr \u201ahoch\u2018 zu niedrig \u2014 System \u00fcbersch\u00e4tzt sich";
  } else if (low.count >= 5 && low.actualAccuracy > 0.7) {
    recommendation = "Konfidenz-Schwellwert f\u00fcr \u201aniedrig\u2018 zu hoch \u2014 System untersch\u00e4tzt sich";
  }

  return {
    levels: { high, medium, low },
    overallCalibration,
    recommendation,
  };
}
