"use client";

import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Selection card for legal forms and industries
interface SelectionCardProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  icon?: string;
}

export function SelectionCard({
  selected,
  onSelect,
  label,
  description,
  icon,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative p-4 rounded-xl text-left transition-all",
        "bg-white border shadow-sm hover:shadow-md",
        selected
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      {icon && <span className="text-lg mb-1 block">{icon}</span>}
      <span className="font-medium text-slate-900 block">{label}</span>
      {description && (
        <span className="text-xs text-slate-500 mt-0.5 block">{description}</span>
      )}
    </button>
  );
}

// VAT settings section
interface VatSettingsProps {
  vatLiable: boolean;
  vatMethod: string;
  vatInterval: string;
  onVatLiableChange: (value: boolean) => void;
  onVatMethodChange: (value: string) => void;
  onVatIntervalChange: (value: string) => void;
}

const VAT_METHODS = [
  { value: "effektiv", label: "Effektiv", desc: "Voller Vorsteuerabzug" },
  { value: "saldo", label: "Saldosteuersatz", desc: "Vereinfacht" },
];

const VAT_INTERVALS = [
  { value: "quarterly", label: "Quartal" },
  { value: "semi_annual", label: "Halbjahr" },
  { value: "annual", label: "Jahr" },
];

export function VatSettings({
  vatLiable,
  vatMethod,
  vatInterval,
  onVatLiableChange,
  onVatMethodChange,
  onVatIntervalChange,
}: VatSettingsProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <label className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-colors">
        <Checkbox
          checked={vatLiable}
          onCheckedChange={(c) => onVatLiableChange(!!c)}
          className="h-5 w-5 rounded border-slate-300"
        />
        <div className="flex-1">
          <span className="font-medium text-slate-900 block">
            Mehrwertsteuerpflichtig
          </span>
          <p className="text-sm text-slate-500 mt-0.5">
            Das Unternehmen ist bei der ESTV registriert
          </p>
        </div>
      </label>

      {vatLiable && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/50"
        >
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Abrechnungsmethode
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {VAT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => onVatMethodChange(method.value)}
                  className={cn(
                    "p-3 rounded-xl text-left transition-all bg-white border",
                    vatMethod === method.value
                      ? "border-slate-900 ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="font-medium text-slate-900 text-sm block">
                    {method.label}
                  </span>
                  <span className="text-xs text-slate-500">{method.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Abrechnungsperiode
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {VAT_INTERVALS.map((interval) => (
                <button
                  key={interval.value}
                  type="button"
                  onClick={() => onVatIntervalChange(interval.value)}
                  className={cn(
                    "p-3 rounded-xl text-center text-sm font-medium transition-all bg-white border",
                    vatInterval === interval.value
                      ? "border-slate-900 ring-1 ring-slate-900 text-slate-900"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  )}
                >
                  {interval.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Fiscal year month selector
interface FiscalYearSelectorProps {
  value: number;
  onChange: (month: number) => void;
}

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function FiscalYearSelector({ value, onChange }: FiscalYearSelectorProps) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-3 block">
        Geschäftsjahr beginnt im
      </Label>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {MONTHS.map((month, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={cn(
              "p-3 rounded-xl text-center text-sm font-medium transition-all",
              "bg-white border shadow-sm",
              value === i + 1
                ? "border-slate-900 ring-1 ring-slate-900 text-slate-900"
                : "border-slate-200/80 hover:border-slate-300 text-slate-600"
            )}
          >
            {month}
          </button>
        ))}
      </div>
    </div>
  );
}

// Text input card
interface TextInputCardProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function TextInputCard({
  id,
  label,
  value,
  placeholder,
  onChange,
  autoFocus,
}: TextInputCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700 mb-2 block">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 text-base rounded-xl border-slate-200 focus:border-slate-400 focus:ring-slate-400"
        autoFocus={autoFocus}
      />
    </div>
  );
}

export { MONTHS };
