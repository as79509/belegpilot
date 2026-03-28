import { de } from "./de";

/** Format a number as German style: 1.234,56 */
export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
  if (value == null) return de.common.noData;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return de.common.noData;
  return num.toLocaleString("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a currency amount: CHF 1.234,56 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = "CHF"
): string {
  if (value == null) return de.common.noData;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return de.common.noData;
  return `${currency} ${formatNumber(num)}`;
}

/** Format a date as DD.MM.YYYY */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return de.common.noData;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return de.common.noData;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Format a date as relative time in German */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return de.common.noData;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return de.common.noData;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMinutes < 1) return de.time.justNow;
  if (diffMinutes < 60) return de.time.minutesAgo(diffMinutes);
  if (diffHours < 24) return de.time.hoursAgo(diffHours);
  if (diffDays < 7) return de.time.daysAgo(diffDays);
  if (diffWeeks < 4) return de.time.weeksAgo(diffWeeks);
  return formatDate(d);
}

/** Format confidence as percentage string */
export function formatConfidence(value: number | null | undefined): string {
  if (value == null) return de.common.noData;
  return `${Math.round(value * 100)}%`;
}

/** Get confidence color class */
export function getConfidenceColor(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 0.8) return "text-green-600";
  if (value >= 0.5) return "text-amber-600";
  return "text-red-600";
}
