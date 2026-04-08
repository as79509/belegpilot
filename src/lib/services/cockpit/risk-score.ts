export interface RiskFactors {
  needsReview: number;
  overdueTasks: number;
  overdueContracts: number;
  periodStatus: string;
}

const WEIGHTS = {
  needsReview: 3,
  overdueTasks: 2,
  overdueContracts: 5,
  periodOpen: 10,
  periodPartial: 5,
  periodDone: 0,
};

export function computeRiskScore(factors: RiskFactors): number {
  let periodPenalty = WEIGHTS.periodOpen;
  if (factors.periodStatus === "locked" || factors.periodStatus === "closed") periodPenalty = WEIGHTS.periodDone;
  else if (factors.periodStatus !== "open") periodPenalty = WEIGHTS.periodPartial;

  return factors.needsReview * WEIGHTS.needsReview
       + factors.overdueTasks * WEIGHTS.overdueTasks
       + factors.overdueContracts * WEIGHTS.overdueContracts
       + periodPenalty;
}

export function riskLevel(score: number): "ok" | "warning" | "critical" {
  if (score <= 5) return "ok";
  if (score <= 15) return "warning";
  return "critical";
}
