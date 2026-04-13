"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === "saving" || state === "error") {
      setVisible(true);
    } else if (state === "saved") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [state]);

  if (!visible) return null;

  return (
    <div className={cn("flex items-center gap-1.5 text-xs transition-opacity duration-300", className,
      state === "saving" && "text-muted-foreground",
      state === "saved" && "text-green-600",
      state === "error" && "text-red-600",
    )}>
      {state === "saving" && <><Loader2 className="h-3 w-3 animate-spin" />Speichern...</>}
      {state === "saved" && <><CheckCircle2 className="h-3 w-3" />Gespeichert</>}
      {state === "error" && <><AlertCircle className="h-3 w-3" />Fehler beim Speichern</>}
    </div>
  );
}

// Hook für Autosave-Pattern
export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");

  async function save(fn: () => Promise<void>) {
    setState("saving");
    try {
      await fn();
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return { state, save, setState };
}
