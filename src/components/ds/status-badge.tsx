"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Lock,
} from "lucide-react";
import {
  AUTOPILOT_TONES,
  CONFIDENCE_TONES,
  DOCUMENT_STATUS_TONES,
  ESCALATION_TONES,
  EXPORT_STATUS_TONES,
  PERIOD_STATUS_TONES,
  REVIEW_STATUS_TONES,
  RISK_TONES,
  TASK_STATUS_TONES,
  TONE_CLASSES,
  type BadgeTone,
} from "@/lib/design-tokens";

export type StatusBadgeType =
  | "document"
  | "supplier"
  | "period"
  | "pattern"
  | "task"
  | "export"
  | "review"
  | "autopilot"
  | "suggestion"
  | "risk"
  | "escalation";

export interface StatusBadgeProps {
  type: StatusBadgeType;
  value: string | boolean;
  className?: string;
  icon?: boolean;
  size?: "sm" | "md";
}

interface BadgeConfig {
  label: string;
  className: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

function fromTone(tone: BadgeTone, label: string): BadgeConfig {
  return { label, className: TONE_CLASSES[tone] };
}

function configFor(type: StatusBadgeType, value: string | boolean): BadgeConfig {
  const v = String(value);

  switch (type) {
    case "document": {
      const tone = DOCUMENT_STATUS_TONES[v] ?? "slate";
      const label = (de.status as Record<string, string>)[v] || v;
      return fromTone(tone, label);
    }
    case "review": {
      const tone = REVIEW_STATUS_TONES[v] ?? "slate";
      const label = (de.reviewStatus as Record<string, string>)[v] || v;
      return fromTone(tone, label);
    }
    case "period": {
      const tone = PERIOD_STATUS_TONES[v] ?? "slate";
      const label = (de.periods.status as Record<string, string>)[v] || v;
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        locked: Lock,
        closed: CheckCircle2,
      };
      return { ...fromTone(tone, label), Icon: iconMap[v] };
    }
    case "task": {
      const tone = TASK_STATUS_TONES[v] ?? "slate";
      const label = (de.tasksMgmt.statusLabels as Record<string, string>)[v] || v;
      return fromTone(tone, label);
    }
    case "export": {
      const tone = EXPORT_STATUS_TONES[v] ?? "slate";
      const label = (de.exportStatus as Record<string, string>)[v] || v;
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        exported: CheckCircle2,
        completed: CheckCircle2,
        export_failed: XCircle,
        failed: XCircle,
      };
      return { ...fromTone(tone, label), Icon: iconMap[v] };
    }
    case "autopilot": {
      const tone = AUTOPILOT_TONES[v] ?? "slate";
      const modeMap = de.autopilot.mode as Record<string, string>;
      const ap = de.autopilot as Record<string, any>;
      const label = modeMap[v] || (typeof ap[v] === "string" ? ap[v] : v);
      return fromTone(tone, label);
    }
    case "suggestion": {
      const tone = CONFIDENCE_TONES[v] ?? "slate";
      const label = (de.suggestions.confidence as Record<string, string>)[v] || v;
      return fromTone(tone, label);
    }
    case "risk": {
      const tone = RISK_TONES[v] ?? "slate";
      const labels: Record<string, string> = {
        ok: "OK", low: "Niedrig", warning: "Warnung",
        medium: "Mittel", high: "Hoch", critical: "Kritisch",
      };
      return fromTone(tone, labels[v] ?? v);
    }
    case "escalation": {
      const tone = ESCALATION_TONES[v] ?? "slate";
      const labels: Record<string, string> = {
        active: "Aktiv", open: "Offen", resolved: "Erledigt", closed: "Erledigt",
      };
      return fromTone(tone, labels[v] ?? v);
    }
    case "supplier": {
      const verified = value === true || value === "verified";
      return verified
        ? {
            label: de.suppliers.verified,
            className: TONE_CLASSES.green,
            Icon: CheckCircle2,
          }
        : {
            label: de.suppliers.unverified,
            className: TONE_CLASSES.amber,
            Icon: AlertTriangle,
          };
    }
    case "pattern": {
      const map: Record<string, BadgeConfig> = {
        open: { label: "Offen", className: TONE_CLASSES.amber, Icon: Clock },
        promoted: { label: "Umgewandelt", className: TONE_CLASSES.green, Icon: CheckCircle2 },
        dismissed: { label: "Verworfen", className: TONE_CLASSES.slate, Icon: XCircle },
      };
      return map[v] || { label: v, className: TONE_CLASSES.slate };
    }
  }
}

export function StatusBadge({
  type,
  value,
  className,
  icon = true,
  size = "md",
}: StatusBadgeProps) {
  const cfg = configFor(type, value);
  const Icon = cfg.Icon;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium inline-flex items-center",
        cfg.className,
        size === "sm" ? "text-[0.65rem] h-4 px-1.5" : "text-xs",
        className
      )}
    >
      {icon && Icon && <Icon className="h-3 w-3 mr-1" />}
      {cfg.label}
    </Badge>
  );
}
