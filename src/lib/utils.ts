import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { de as dateLocale } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null, currency = "CHF") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return format(date, "dd.MM.yyyy", { locale: dateLocale });
}

export function toInputDate(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
}

export function parseDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseAmountInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[’' ]/g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isNaN(amount) ? null : amount;
}

export function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function documentStatusTone(status: string) {
  const normalized = status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  switch (normalized) {
    case "geprueft":
    case "gepruft":
      return "success";
    case "exportiert":
      return "muted";
    case "gelesen":
      return "warning";
    default:
      return "info";
  }
}

export function buildExternalReference(prefix: string, documentId: string) {
  const shortId = documentId.slice(-8).toUpperCase();
  const stamp = format(new Date(), "yyyyMMdd");
  return `${prefix}-${stamp}-${shortId}`;
}

export function isImageMimeType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(mimeType);
}

export function isPdfMimeType(mimeType: string) {
  return mimeType === "application/pdf";
}

export function resolvePostingDate(options: {
  documentDate?: Date | null;
  invoiceDate?: Date | null;
  createdAt?: Date | null;
  defaultDateBehavior?: string | null;
}) {
  const { documentDate, invoiceDate, createdAt, defaultDateBehavior } = options;

  if (defaultDateBehavior === "invoice_first") {
    return invoiceDate ?? documentDate ?? createdAt ?? new Date();
  }

  if (defaultDateBehavior === "created_at") {
    return createdAt ?? documentDate ?? invoiceDate ?? new Date();
  }

  return documentDate ?? invoiceDate ?? createdAt ?? new Date();
}

export function takeFirstLine(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? "";
}
