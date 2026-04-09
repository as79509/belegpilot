"use client";

import * as React from "react";
import {
  Info, AlertTriangle, AlertOctagon, CheckCircle2, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type InfoPanelTone = "info" | "warning" | "error" | "success";

export interface InfoPanelProps {
  tone?: InfoPanelTone;
  title?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

const TONE_CLASSES: Record<InfoPanelTone, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-red-50 border-red-200 text-red-900",
  success: "bg-green-50 border-green-200 text-green-900",
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
