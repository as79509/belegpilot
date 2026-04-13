"use client";

import { Check, Sparkles } from "lucide-react";

interface AISuggestion {
  id: string;
  category: string;
  suggestion: string;
  status: "pending" | "accepted" | "rejected";
}

interface SummaryItem {
  label: string;
  value: string;
  onEdit: () => void;
}

interface FinalSummaryProps {
  items: SummaryItem[];
  acceptedSuggestions: AISuggestion[];
}

export function FinalSummary({ items, acceptedSuggestions }: FinalSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
          <p className="font-semibold text-slate-900">Zusammenfassung</p>
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((item, i) => (
            <SummaryRow key={i} {...item} />
          ))}
        </div>
      </div>

      {/* Accepted suggestions */}
      {acceptedSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100">
            <p className="font-semibold text-emerald-900 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Akzeptierte KI-Konfiguration
            </p>
          </div>
          <div className="p-5 space-y-3">
            {acceptedSuggestions.map((s) => (
              <div key={s.id} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.category}
                  </p>
                  <p className="text-sm text-slate-500">{s.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Bereit zum Start</p>
            <p className="text-sm text-slate-300 mt-1">
              Nach der Erstellung können Sie sofort Belege hochladen und die KI
              wird automatisch mit der Kategorisierung beginnen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
      >
        Bearbeiten
      </button>
    </div>
  );
}
