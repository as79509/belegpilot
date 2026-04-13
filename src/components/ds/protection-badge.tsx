import { ShieldCheck, Lock, AlertTriangle, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type ProtectionType = "period_locked" | "autopilot_blocked" | "review_required" | "export_pending" | "escalated";

interface ProtectionBadgeProps {
  type: ProtectionType;
  detail?: string;
  className?: string;
}

const CONFIG: Record<ProtectionType, { icon: any; label: string; color: string }> = {
  period_locked:     { icon: Lock,          label: "Periode gesperrt",       color: "bg-slate-100 text-slate-700 border-slate-300" },
  autopilot_blocked: { icon: ShieldCheck,   label: "Autopilot blockiert",    color: "bg-amber-50 text-amber-800 border-amber-300" },
  review_required:   { icon: AlertTriangle, label: "Manuelle Prüfung nötig", color: "bg-blue-50 text-blue-800 border-blue-300" },
  export_pending:    { icon: CalendarCheck, label: "Export ausstehend",      color: "bg-violet-50 text-violet-800 border-violet-300" },
  escalated:         { icon: AlertTriangle, label: "Eskaliert",              color: "bg-red-50 text-red-800 border-red-300" },
};

export function ProtectionBadge({ type, detail, className }: ProtectionBadgeProps) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium", cfg.color, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{cfg.label}</span>
      {detail && <span className="opacity-60">— {detail}</span>}
    </div>
  );
}
