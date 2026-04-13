"use client";

import * as React from "react";
import {
  Info, AlertTriangle, AlertOctagon, CheckCircle2, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design-tokens";

export type InfoPanelTone = "info" | "warning" | "error" | "success";

export interface InfoPanelProps {
  tone?: InfoPanelTone;
  title?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

const TONE_CLASSES: Record<InfoPanelTone, string> = {
  info: `${statusColors.info.bg} ${statusColors.info.border} ${statusColors.info.text}`,
  warning: `${statusColors.warning.bg} ${statusColors.warning.border} ${statusColors.warning.text}`,
  error: `${statusColors.error.bg} ${statusColors.error.border} ${statusColors.error.text}`,
  success: `${statusColors.success.bg} ${statusColors.success.border} ${statusColors.success.text}`,
};

const TONE_ICONS: Record<InfoPanelTone, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertOctagon,
  success: CheckCircle2,
};

const TONE_ICON_COLORS: Record<InfoPanelTone, string> = {
  info: "text-blue-600",
  warning: "text-amber-600",
  error: "text-red-600",
  success: "text-green-600",
};

export function InfoPanel({
  tone = "info",
  title,
  children,
  icon,
  className,
}: InfoPanelProps) {
  const Icon = icon || TONE_ICONS[tone];

  return (
    <div className={cn("flex items-start gap-2 px-3 py-2 rounded-lg border text-sm", TONE_CLASSES[tone], className)}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", TONE_ICON_COLORS[tone])} />
      <div className="flex-1 min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={title ? "text-xs mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
