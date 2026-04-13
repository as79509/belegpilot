/**
 * Zentrale Design-Tokens für BelegPilot.
 *
 * EINE Quelle der Wahrheit für alle Status-, Risiko-, Confidence- und
 * Autopilot-Farben. Jede Komponente, die Status visualisiert, MUSS hier
 * lookup machen — niemals ad-hoc Tailwind-Klassen für Status-Farben.
 */

// ─── BelegPilot Design Language — Single Source of Truth ───
// Zielbild: Ruhig, erwachsen, präzise, hochwertig

// ─── Farben ───
export const colors = {
  primary: "hsl(213 94% 20%)",
  primaryLight: "hsl(213 80% 95%)",
  primaryHover: "hsl(213 90% 25%)",
  success: "hsl(142 71% 35%)",
  successLight: "hsl(142 71% 95%)",
  warning: "hsl(38 92% 50%)",
  warningLight: "hsl(38 92% 95%)",
  error: "hsl(0 84% 52%)",
  errorLight: "hsl(0 84% 96%)",
  info: "hsl(213 70% 50%)",
  infoLight: "hsl(213 70% 96%)",
  confidenceHigh: "hsl(142 60% 40%)",
  confidenceMedium: "hsl(38 80% 50%)",
  confidenceLow: "hsl(0 0% 60%)",
  autopilot: "hsl(259 60% 50%)",
  autopilotLight: "hsl(259 60% 96%)",
  suggestion: "hsl(213 70% 50%)",
  suggestionLight: "hsl(213 70% 96%)",
  banana: "hsl(45 93% 47%)",
  bananaLight: "hsl(45 93% 96%)",
  mandant: "hsl(172 66% 40%)",
  mandantLight: "hsl(172 66% 96%)",
  text: "hsl(222 47% 11%)",
  textMuted: "hsl(215 16% 47%)",
  textLight: "hsl(215 16% 65%)",
  border: "hsl(214 32% 91%)",
  borderLight: "hsl(214 20% 95%)",
  surface: "hsl(0 0% 100%)",
  surfaceMuted: "hsl(210 20% 98%)",
  background: "hsl(210 20% 98%)",
} as const;

// ─── Typografie ───
export const typography = {
  pageTitle:     { size: "text-2xl",    weight: "font-semibold", tracking: "tracking-tight" },
  sectionTitle:  { size: "text-lg",     weight: "font-semibold", tracking: "" },
  cardTitle:     { size: "text-base",   weight: "font-medium",   tracking: "" },
  body:          { size: "text-sm",     weight: "font-normal",   tracking: "" },
  bodySmall:     { size: "text-xs",     weight: "font-normal",   tracking: "" },
  label:         { size: "text-xs",     weight: "font-medium",   tracking: "uppercase tracking-wider" },
  status:        { size: "text-xs",     weight: "font-medium",   tracking: "" },
  micro:         { size: "text-[11px]", weight: "font-normal",   tracking: "" },
  tableHeader:   { size: "text-xs",     weight: "font-medium",   tracking: "text-muted-foreground" },
  tableCell:     { size: "text-sm",     weight: "font-normal",   tracking: "" },
  stat:          { size: "text-3xl",    weight: "font-bold",     tracking: "tracking-tight" },
  statLabel:     { size: "text-xs",     weight: "font-medium",   tracking: "text-muted-foreground" },
} as const;

// ─── Spacing ───
export const spacing = {
  page:        "px-6 py-6",
  section:     "space-y-6",
  card:        "p-5",
  cardCompact: "p-3",
  cardHeader:  "pb-3",
  stack:       "space-y-4",
  stackTight:  "space-y-2",
  inline:      "gap-3",
  inlineTight: "gap-1.5",
  grid2:       "grid grid-cols-1 md:grid-cols-2 gap-4",
  grid3:       "grid grid-cols-1 md:grid-cols-3 gap-4",
  grid4:       "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
} as const;

// ─── Schatten & Radien ───
export const elevation = {
  card:      "shadow-sm border rounded-lg",
  cardHover: "shadow-sm border rounded-lg hover:shadow-md transition-shadow",
  panel:     "shadow-md border rounded-lg",
  dropdown:  "shadow-lg border rounded-md",
} as const;

// ─── Helper: Tailwind-Klassen zusammenbauen ───
export function typo(key: keyof typeof typography): string {
  const t = typography[key];
  return [t.size, t.weight, t.tracking].filter(Boolean).join(" ");
}

// ─── Status-Farb-Map (für Backgrounds, Text, Borders) ───
export const statusColors = {
  success:    { bg: "bg-green-50",  text: "text-green-800",  border: "border-green-200" },
  warning:    { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-200" },
  error:      { bg: "bg-red-50",    text: "text-red-800",    border: "border-red-200" },
  info:       { bg: "bg-blue-50",   text: "text-blue-800",   border: "border-blue-200" },
  neutral:    { bg: "bg-slate-50",  text: "text-slate-700",  border: "border-slate-200" },
  autopilot:  { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200" },
  suggestion: { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  banana:     { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200" },
  mandant:    { bg: "bg-teal-50",   text: "text-teal-800",   border: "border-teal-200" },
} as const;

export type BadgeTone =
  | "blue"
  | "amber"
  | "green"
  | "green-dark"
  | "red"
  | "red-dark"
  | "slate";

/** Tailwind-Klassen pro Tone (background + text). Dezent, nicht aufdringlich. */
export const TONE_CLASSES: Record<BadgeTone, string> = {
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  "green-dark": "bg-emerald-200 text-emerald-900",
  red: "bg-red-100 text-red-800",
  "red-dark": "bg-red-200 text-red-900",
  slate: "bg-slate-100 text-slate-700",
};

/** Document Status → Tone */
export const DOCUMENT_STATUS_TONES: Record<string, BadgeTone> = {
  uploaded: "blue",
  processing: "blue",
  extracted: "blue",
  validated: "blue",
  needs_review: "amber",
  ready: "green",
  exported: "green-dark",
  export_failed: "red",
  rejected: "red",
  failed: "red",
  archived: "slate",
};

/** Review Status → Tone */
export const REVIEW_STATUS_TONES: Record<string, BadgeTone> = {
  pending: "slate",
  approved: "green",
  rejected: "red",
};

/** Period Status → Tone */
export const PERIOD_STATUS_TONES: Record<string, BadgeTone> = {
  open: "blue",
  incomplete: "amber",
  in_review: "amber",
  review_ready: "amber",
  closing: "amber",
  closed: "green",
  locked: "slate",
};

/** Task Status → Tone */
export const TASK_STATUS_TONES: Record<string, BadgeTone> = {
  open: "red",
  in_progress: "amber",
  completed: "green",
  done: "green",
  cancelled: "slate",
};

/** Export Status → Tone */
export const EXPORT_STATUS_TONES: Record<string, BadgeTone> = {
  not_exported: "slate",
  pending: "blue",
  exporting: "blue",
  exported: "green",
  completed: "green",
  failed: "red",
  export_failed: "red",
};

/** Autopilot Mode/Decision → Tone */
export const AUTOPILOT_TONES: Record<string, BadgeTone> = {
  shadow: "blue",
  prefill: "amber",
  auto_ready: "green",
  disabled: "slate",
  blocked: "red",
  eligible: "green",
};

/** Suggestion Confidence → Tone */
export const CONFIDENCE_TONES: Record<string, BadgeTone> = {
  high: "green",
  medium: "amber",
  low: "slate",
};

/** Risk Level → Tone */
export const RISK_TONES: Record<string, BadgeTone> = {
  ok: "green",
  low: "green",
  warning: "amber",
  medium: "amber",
  high: "red",
  critical: "red-dark",
};

/** Escalation State → Tone */
export const ESCALATION_TONES: Record<string, BadgeTone> = {
  active: "red",
  open: "red",
  resolved: "green",
  closed: "green",
};

/**
 * STATUS_COLORS: Hex-Werte für inline-Styles, Charts, Icons. CSS-Variablen
 * sind in globals.css definiert; diese Konstante spiegelt sie für TypeScript.
 */
export const STATUS_COLORS = {
  processing: "#3B82F6",
  review: "#F59E0B",
  ready: "#16A34A",
  exported: "#15803D",
  failed: "#DC2626",
} as const;

export const RISK_COLORS = {
  low: "#16A34A",
  medium: "#F59E0B",
  high: "#DC2626",
  critical: "#991B1B",
} as const;

export const AUTOPILOT_COLORS = {
  shadow: "#3B82F6",
  prefill: "#F59E0B",
  auto_ready: "#16A34A",
  blocked: "#DC2626",
  disabled: "#94A3B8",
} as const;

export const CONFIDENCE_COLORS = {
  high: "#16A34A",
  medium: "#F59E0B",
  low: "#94A3B8",
} as const;

/** Payment Status → Tone */
export const PAYMENT_STATUS_TONES: Record<string, BadgeTone> = {
  open: "slate",
  paid: "green",
  partial: "amber",
  unclear: "red",
};

/** Bank Match Method → Tone */
export const MATCH_METHOD_TONES: Record<string, BadgeTone> = {
  qr_reference: "green",
  amount_date_iban: "amber",
  manual: "slate",
};

/** VAT Return Status → Tone */
export const VAT_RETURN_STATUS_TONES: Record<string, BadgeTone> = {
  draft: "slate",
  validated: "blue",
  approved: "green",
  submitted: "green-dark",
};
