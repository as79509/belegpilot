"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2, Rocket, AlertCircle } from "lucide-react";

interface WizardFooterProps {
  isLastStep: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  validationMessage: string | null;
  onNext: () => void;
  onSubmit: () => void;
}

export function WizardFooter({
  isLastStep,
  canProceed,
  isSubmitting,
  validationMessage,
  onNext,
  onSubmit,
}: WizardFooterProps) {
  return (
    <footer className="sticky bottom-0 bg-white border-t border-slate-200/80">
      <div className="flex items-center justify-between px-4 py-4 md:px-6 max-w-xl mx-auto">
        {/* Validation message */}
        <div className="text-sm text-slate-500">
          {!canProceed && validationMessage && (
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {validationMessage}
            </span>
          )}
        </div>

        {isLastStep ? (
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-8 h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                Mandant erstellen
                <Rocket className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onNext}
            disabled={!canProceed}
            className="px-8 h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300"
          >
            Weiter
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </footer>
  );
}
