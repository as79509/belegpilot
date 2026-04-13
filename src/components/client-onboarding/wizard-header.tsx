"use client";

import { motion } from "framer-motion";
import { ChevronLeft, X, Loader2, Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  icon: LucideIcon;
}

interface WizardHeaderProps {
  steps: Step[];
  currentStep: number;
  isSaving: boolean;
  onBack: () => void;
  onExit: () => void;
}

export function WizardHeader({
  steps,
  currentStep,
  isSaving,
  onBack,
  onExit,
}: WizardHeaderProps) {
  const progress = (currentStep / (steps.length - 1)) * 100;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80">
      <div className="max-w-5xl mx-auto">
        {/* Top bar with logo and exit */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">B</span>
              </div>
              <span className="font-semibold text-slate-900 hidden sm:block">
                BelegPilot
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Speichern...
              </span>
            )}
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="hidden sm:inline">Speichern & Beenden</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-slate-900 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {currentStep + 1}/{steps.length}
            </span>
          </div>
        </div>

        {/* Step indicators */}
        <div className="px-4 pb-4 md:px-6">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  i === currentStep
                    ? "bg-slate-900 text-white"
                    : i < currentStep
                      ? "bg-slate-100 text-slate-600"
                      : "text-slate-400"
                )}
              >
                {i < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="w-4 text-center">{i + 1}</span>
                )}
                <span className="hidden md:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
