"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Lightbulb, Loader2, AlertTriangle, ArrowRight, Info, CheckCircle2,
} from "lucide-react";
import { de } from "@/lib/i18n/de";

interface Explanation {
  currentState: string;
  criticalItems: string[];
  nextSteps: string[];
  insights: string[];
}

function resolvePageFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "dashboard") return "dashboard";
  if (segments[0] === "documents") return "documents";
  if (segments[0] === "periods") return "periods";
  if (segments[0] === "vat") return "vat";
  if (segments[0] === "bank") return "bank";
  if (segments[0] === "suppliers") return "suppliers";
  if (segments[0] === "email") return "email";
  if (segments[0] === "client") return "dashboard";
  return segments[0] || "dashboard";
}

export function ExplainButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchExplanation = useCallback(async () => {
    if (explanation) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    setError(false);
    try {
      const page = resolvePageFromPath(pathname);
      const res = await fetch(`/api/explain?page=${page}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExplanation(data.explanation);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [pathname, explanation]);

  return (
    <>
      <button
        onClick={fetchExplanation}
        className="p-1.5 rounded-md hover:bg-accent transition-colors"
        title={de.explain.buttonLabel}
      >
        <Lightbulb className="h-4 w-4 text-[var(--text-secondary)]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-96 sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              {de.explain.title}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{de.explain.loading}</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 py-4 text-center">{de.explain.error}</div>
            )}

            {explanation && !loading && (
              <>
                {/* Current State */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {de.explain.currentState}
                  </h3>
                  <p className="text-sm leading-relaxed">{explanation.currentState}</p>
                </section>

                {/* Critical Items */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {de.explain.criticalItems}
                  </h3>
                  {explanation.criticalItems.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {de.explain.noCritical}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {explanation.criticalItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm bg-red-50 rounded-md p-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-red-800">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Next Steps */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {de.explain.nextSteps}
                  </h3>
                  {explanation.nextSteps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{de.explain.noNextSteps}</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {explanation.nextSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                {/* Insights */}
                {explanation.insights.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {de.explain.insights}
                    </h3>
                    <div className="space-y-1.5">
                      {explanation.insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm bg-blue-50 rounded-md p-2">
                          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <span className="text-blue-800">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
