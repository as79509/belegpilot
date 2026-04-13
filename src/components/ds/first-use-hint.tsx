"use client";
import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface FirstUseHintProps {
  id: string;
  title: string;
  description: string;
  className?: string;
}

export function FirstUseHint({ id, title, description, className }: FirstUseHintProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const key = `belegpilot-hint-${id}`;
      const wasDismissed = window.sessionStorage.getItem(key);
      if (!wasDismissed) setDismissed(false);
    } catch { /* SSR/privacy */ }
  }, [id]);

  function dismiss() {
    setDismissed(true);
    try { window.sessionStorage.setItem(`belegpilot-hint-${id}`, "1"); } catch {}
  }

  if (dismissed) return null;

  return (
    <div className={cn("bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3", className)}>
      <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900">{title}</p>
        <p className="text-xs text-blue-700 mt-0.5">{description}</p>
      </div>
      <button onClick={dismiss} className="text-blue-400 hover:text-blue-600 shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
