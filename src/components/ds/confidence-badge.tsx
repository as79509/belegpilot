"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design-tokens";

export type ConfidenceLevel = "high" | "medium" | "low" | null | undefined;

export interface ConfidenceBadgeProps {
  level?: ConfidenceLevel;
  score?: number | null;
  className?: string;
  compact?: boolean;
}

function levelFromScore(score: number | null | undefined): ConfidenceLevel {
  if (score == null) return null;
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

const LEVEL_CLASS: Record<NonNullable<ConfidenceLevel>, string> = {
  high: `${statusColors.success.bg} ${statusColors.success.text}`,
  medium: `${statusColors.warning.bg} ${statusColors.warning.text}`,
  low: `${statusColors.error.bg} ${statusColors.error.text}`,
};

const LEVEL_LABEL: Record<NonNullable<ConfidenceLevel>, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

const LEVEL_DOT: Record<NonNullable<ConfidenceLevel>, string> = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-red-500",
};

export function ConfidenceBadge({
  level,
  score,
  className,
  compact = false,
}: ConfidenceBadgeProps) {
  const resolved = level ?? levelFromScore(score);
  if (!resolved) {
    return <span className={cn("text-[var(--text-muted)] text-xs", className)}>—</span>;
  }

  if (compact) {
    return (
      <span
        className={cn("text-base leading-none", LEVEL_DOT[resolved], className)}
        title={`${LEVEL_LABEL[resolved]}${score != null ? ` (${Math.round(score * 100)}%)` : ""}`}
      >
        ●
      </span>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn("text-xs font-medium", LEVEL_CLASS[resolved], className)}
    >
      {LEVEL_LABEL[resolved]}
      {score != null && ` (${Math.round(score * 100)}%)`}
    </Badge>
  );
}
