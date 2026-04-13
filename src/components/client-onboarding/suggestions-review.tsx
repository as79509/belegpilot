"use client";

import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  confidenceLevel?: "high" | "needs_review" | "manual";
  source?: "chat" | "document" | "form" | "rule";
  reason?: string;
  status: "pending" | "accepted" | "rejected";
}

interface SuggestionsReviewProps {
  suggestions: AISuggestion[];
  isLoading: boolean;
  error: string | null;
  onUpdate: (id: string, status: "accepted" | "rejected") => void;
  onReset: () => void;
  onRetry: () => void;
}

const LEVEL_CONFIG = {
  high: {
    label: "Empfohlen",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  needs_review: {
    label: "Prüfung empfohlen",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  manual: {
    label: "Manuelle Entscheidung",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  chat: "Aus Gespräch",
  document: "Aus Dokument",
  form: "Aus Formular",
  rule: "Regel",
};

export function SuggestionsReview({
  suggestions,
  isLoading,
  error,
  onUpdate,
  onReset,
  onRetry,
}: SuggestionsReviewProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-7 w-7 text-slate-500 animate-spin" />
        </div>
        <p className="text-lg font-medium text-slate-900">
          Analysiere Ihre Daten...
        </p>
        <p className="text-slate-500 mt-1">
          Die KI erstellt Vorschläge basierend auf Ihren Angaben
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-900 font-medium">{error}</p>
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  const reviewedCount = suggestions.filter((s) => s.status !== "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-500">
          {reviewedCount} von {suggestions.length} bewertet
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-slate-500 hover:text-slate-700"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Zurücksetzen
        </Button>
      </div>

      {(["high", "needs_review", "manual"] as const).map((level) => {
        const levelSuggestions = suggestions.filter(
          (s) =>
            s.confidenceLevel === level ||
            (!s.confidenceLevel && level === "needs_review")
        );

        if (levelSuggestions.length === 0) return null;

        const config = LEVEL_CONFIG[level];

        return (
          <div key={level} className="space-y-3">
            <div
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border",
                config.color
              )}
            >
              {config.label} ({levelSuggestions.length})
            </div>

            {levelSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onUpdate,
}: {
  suggestion: AISuggestion;
  onUpdate: (id: string, status: "accepted" | "rejected") => void;
}) {
  return (
    <div
      className={cn(
        "bg-white p-5 rounded-2xl shadow-sm border transition-all",
        suggestion.status === "accepted" && "border-emerald-300 bg-emerald-50/50",
        suggestion.status === "rejected" && "border-red-300 bg-red-50/50",
        suggestion.status === "pending" && "border-slate-200/80"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
              {suggestion.category}
            </span>
            {suggestion.source && (
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  suggestion.source === "chat" && "bg-blue-50 text-blue-600",
                  suggestion.source === "document" && "bg-purple-50 text-purple-600",
                  suggestion.source === "form" && "bg-slate-50 text-slate-500",
                  suggestion.source === "rule" && "bg-slate-50 text-slate-500"
                )}
              >
                {SOURCE_LABELS[suggestion.source] || suggestion.source}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
          <p className="font-medium text-slate-900">{suggestion.suggestion}</p>
          {suggestion.reason && (
            <p className="text-sm text-slate-500 mt-1">{suggestion.reason}</p>
          )}
        </div>

        {suggestion.status === "pending" ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onUpdate(suggestion.id, "rejected")}
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <ThumbsDown className="h-4 w-4 text-slate-500" />
            </button>
            <button
              onClick={() => onUpdate(suggestion.id, "accepted")}
              className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
              suggestion.status === "accepted" ? "bg-emerald-500" : "bg-red-500"
            )}
          >
            {suggestion.status === "accepted" ? (
              <ThumbsUp className="h-4 w-4 text-white" />
            ) : (
              <ThumbsDown className="h-4 w-4 text-white" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
