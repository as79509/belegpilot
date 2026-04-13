"use client";
import { ShieldCheck, Brain, Eye, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type TrustLevel = "ai_confirmed" | "ai_suggested" | "manual" | "protected" | "blocked" | "unknown";

interface TrustSignalProps {
  level: TrustLevel;
  reason?: string;
  source?: string;
  confidence?: number;
  compact?: boolean;
  className?: string;
}

const CONFIG: Record<TrustLevel, { icon: any; label: string; color: string; bg: string }> = {
  ai_confirmed:  { icon: Brain,         label: "KI-bestätigt",    color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  ai_suggested:  { icon: Brain,         label: "KI-Vorschlag",    color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  manual:        { icon: Eye,           label: "Manuell geprüft", color: "text-slate-700",  bg: "bg-slate-50 border-slate-200" },
  protected:     { icon: ShieldCheck,   label: "Geschützt",       color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  blocked:       { icon: Lock,          label: "Gesperrt",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  unknown:       { icon: AlertTriangle, label: "Unbekannt",       color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
};

export function TrustSignal({ level, reason, source, confidence, compact = false, className }: TrustSignalProps) {
  const cfg = CONFIG[level];
  const Icon = cfg.icon;
  const title = [reason, source ? `Quelle: ${source}` : ""].filter(Boolean).join(" — ");

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium cursor-default", cfg.bg, cfg.color, className)}
      title={title || undefined}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {!compact && <span>{cfg.label}</span>}
      {confidence != null && !compact && (
        <span className="opacity-60">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}
