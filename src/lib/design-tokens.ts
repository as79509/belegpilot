/**
 * Zentrale Design-Tokens für BelegPilot.
 *
 * EINE Quelle der Wahrheit für alle Status-, Risiko-, Confidence- und
 * Autopilot-Farben. Jede Komponente, die Status visualisiert, MUSS hier
 * lookup machen — niemals ad-hoc Tailwind-Klassen für Status-Farben.
 */

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
