export interface CockpitAlert {
  type: "error" | "warning";
  key: string;
  message: string;
  count: number;
  href: string;
}

export function buildAlerts(data: {
  failedDocs: number;
  overdueContracts: number;
  failedExports: number;
  overdueTasks: number;
  stuckProcessing: number;
  needsReview: number;
  expiringContracts: number;
}): CockpitAlert[] {
  const alerts: CockpitAlert[] = [];
  if (data.failedDocs > 0) alerts.push({ type: "error", key: "failed_docs", message: `${data.failedDocs} fehlgeschlagene Belege`, count: data.failedDocs, href: "/documents?status=failed" });
  if (data.overdueContracts > 0) alerts.push({ type: "error", key: "overdue_contracts", message: `${data.overdueContracts} fehlende Standardbelege`, count: data.overdueContracts, href: "/contracts" });
  if (data.failedExports > 0) alerts.push({ type: "error", key: "failed_exports", message: `${data.failedExports} fehlgeschlagene Exporte`, count: data.failedExports, href: "/exports" });
  if (data.overdueTasks > 0) alerts.push({ type: "error", key: "overdue_tasks", message: `${data.overdueTasks} überfällige Pendenzen`, count: data.overdueTasks, href: "/tasks" });
  if (data.stuckProcessing > 0) alerts.push({ type: "warning", key: "stuck", message: `${data.stuckProcessing} Belege hängen`, count: data.stuckProcessing, href: "/documents?status=processing" });
  if (data.needsReview > 0) alerts.push({ type: "warning", key: "needs_review", message: `${data.needsReview} Belege zur Prüfung`, count: data.needsReview, href: "/documents?status=needs_review" });
  if (data.expiringContracts > 0) alerts.push({ type: "warning", key: "expiring", message: `${data.expiringContracts} Verträge laufen aus`, count: data.expiringContracts, href: "/contracts" });
  return alerts;
}
