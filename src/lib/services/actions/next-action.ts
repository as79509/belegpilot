import { prisma } from "@/lib/db";

export interface NextAction {
  type: string;           // z.B. "verify_supplier", "create_rule", "ask_client", "close_period"
  priority: "high" | "medium" | "low";
  title: string;          // Deutsche Beschreibung
  detail: string;         // Kontext
  targetType: string;     // "document" | "supplier" | "period" | "task" | "rule"
  targetId: string;       // ID des Ziels
  targetUrl: string;      // Link zum Ziel
}

const PRIORITY_ORDER: Record<NextAction["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortByPriority(actions: NextAction[]): NextAction[] {
  return actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

// Pro Document: Was sollte als nächstes passieren?
export async function getDocumentActions(
  companyId: string,
  documentId: string
): Promise<NextAction[]> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, companyId },
    include: {
      bookingSuggestions: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!doc) return [];

  const actions: NextAction[] = [];

  // 1. Lieferant nicht verifiziert → "Lieferant verifizieren"
  if (doc.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: doc.supplierId },
      select: { isVerified: true, nameNormalized: true },
    });
    if (supplier && !supplier.isVerified) {
      actions.push({
        type: "verify_supplier",
        priority: "high",
        title: `Lieferant "${supplier.nameNormalized}" verifizieren`,
        detail: "Nicht verifizierte Lieferanten blockieren den Autopilot",
        targetType: "supplier",
        targetId: doc.supplierId,
        targetUrl: `/suppliers/${doc.supplierId}`,
      });
    }
  }

  // 2. Offene Korrekturmuster → "Regel anlegen"
  const patterns = await prisma.correctionPattern.findMany({
    where: {
      companyId,
      supplierId: doc.supplierId || "",
      status: "open",
      occurrences: { gte: 3 },
    },
    take: 1,
  });
  if (patterns.length > 0) {
    const p = patterns[0];
    actions.push({
      type: "create_rule",
      priority: "medium",
      title: `Regel anlegen: ${p.field} von "${p.fromValue}" → "${p.toValue}" (${p.occurrences}×)`,
      detail: "Wiederkehrendes Korrekturmuster erkannt",
      targetType: "rule",
      targetId: p.id,
      targetUrl: "/corrections",
    });
  }

  // 3. Suggestion vorhanden aber nicht bearbeitet → "Vorschlag prüfen"
  const suggestion = doc.bookingSuggestions?.[0];
  if (suggestion && suggestion.status === "pending") {
    actions.push({
      type: "review_suggestion",
      priority: "medium",
      title: `Buchungsvorschlag prüfen (${suggestion.confidenceLevel})`,
      detail: `Konto ${suggestion.suggestedAccount || "?"} vorgeschlagen`,
      targetType: "document",
      targetId: doc.id,
      targetUrl: `/documents/${doc.id}`,
    });
  }

  // 4. Offene Tasks für diesen Beleg → "Task erledigen"
  const openTasks = await prisma.task.count({
    where: {
      companyId,
      relatedDocumentId: documentId,
      status: { in: ["open", "in_progress"] },
    },
  });
  if (openTasks > 0) {
    actions.push({
      type: "resolve_task",
      priority: "high",
      title: `${openTasks} offene Aufgabe(n) erledigen`,
      detail: "Beleg hat unerledigte Pendenzen",
      targetType: "task",
      targetId: doc.id,
      targetUrl: `/tasks`,
    });
  }

  // 5. Status needs_review → "Beleg prüfen und freigeben"
  if (doc.status === "needs_review") {
    actions.push({
      type: "review_document",
      priority: "high",
      title: "Beleg prüfen und freigeben",
      detail: "Wartet auf manuelle Prüfung",
      targetType: "document",
      targetId: doc.id,
      targetUrl: `/documents/${doc.id}`,
    });
  }

  return sortByPriority(actions);
}

// Pro Periode: Was blockiert den Abschluss?
export async function getPeriodActions(
  companyId: string,
  periodId: string
): Promise<NextAction[]> {
  const period = await prisma.monthlyPeriod.findFirst({
    where: { id: periodId, companyId },
  });
  if (!period) return [];

  const actions: NextAction[] = [];

  const monthStart = new Date(period.year, period.month - 1, 1);
  const monthEnd = new Date(period.year, period.month, 1);

  // 1. Offene Belege in dieser Periode
  const openDocs = await prisma.document.count({
    where: {
      companyId,
      status: { in: ["needs_review", "processing"] },
      invoiceDate: { gte: monthStart, lt: monthEnd },
    },
  });
  if (openDocs > 0) {
    actions.push({
      type: "review_period_docs",
      priority: "high",
      title: `${openDocs} offene Belege in dieser Periode prüfen`,
      detail: "Belege müssen freigegeben werden vor Abschluss",
      targetType: "period",
      targetId: periodId,
      targetUrl: `/documents?period=${period.year}-${String(period.month).padStart(2, "0")}`,
    });
  }

  // 2. Offene Tasks in dieser Periode
  const openTasks = await prisma.task.count({
    where: {
      companyId,
      status: { in: ["open", "in_progress"] },
      createdAt: { gte: monthStart, lt: monthEnd },
    },
  });
  if (openTasks > 0) {
    actions.push({
      type: "resolve_period_tasks",
      priority: "high",
      title: `${openTasks} offene Aufgaben klären`,
      detail: "Pendenzen blockieren den Abschluss",
      targetType: "task",
      targetId: periodId,
      targetUrl: "/tasks",
    });
  }

  // 3. Wiederkehrende Buchungen nicht generiert
  const activeRecurring = await prisma.recurringEntry.count({
    where: { companyId, isActive: true },
  });
  const recurringJournalCount = await prisma.journalEntry.count({
    where: {
      companyId,
      entryDate: { gte: monthStart, lt: monthEnd },
      entryType: "recurring",
    },
  });
  if (activeRecurring > 0 && recurringJournalCount === 0) {
    actions.push({
      type: "generate_recurring",
      priority: "medium",
      title: "Wiederkehrende Buchungen generieren",
      detail: `${activeRecurring} aktive wiederkehrende Einträge`,
      targetType: "period",
      targetId: periodId,
      targetUrl: "/journal/recurring",
    });
  }

  // 4. Abschreibungen nicht verbucht
  const activeAssets = await prisma.asset.count({
    where: { companyId, status: "active" },
  });
  if (activeAssets > 0) {
    const depreciationEntries = await prisma.journalEntry.count({
      where: {
        companyId,
        entryType: "depreciation",
        entryDate: { gte: monthStart, lt: monthEnd },
      },
    });
    if (depreciationEntries === 0) {
      actions.push({
        type: "generate_depreciation",
        priority: "low",
        title: "Abschreibungen verbuchen",
        detail: `${activeAssets} aktive Anlagen`,
        targetType: "period",
        targetId: periodId,
        targetUrl: "/assets",
      });
    }
  }

  // 5. Periode abschliessbar?
  if (period.status === "open" && openDocs === 0 && openTasks === 0) {
    actions.push({
      type: "close_period",
      priority: "low",
      title: "Periode kann abgeschlossen werden",
      detail: "Alle Belege geprüft, keine offenen Pendenzen",
      targetType: "period",
      targetId: periodId,
      targetUrl: `/periods`,
    });
  }

  return sortByPriority(actions);
}

// Pro Company: Top-Blocker über alle Mandanten
export async function getCompanyActions(companyId: string): Promise<NextAction[]> {
  const actions: NextAction[] = [];

  // 1. Belege die Review brauchen
  const needsReview = await prisma.document.count({
    where: { companyId, status: "needs_review" },
  });
  if (needsReview > 0) {
    actions.push({
      type: "review_backlog",
      priority: "high",
      title: `${needsReview} Belege warten auf Prüfung`,
      detail: "Review-Queue abarbeiten",
      targetType: "document",
      targetId: companyId,
      targetUrl: "/documents?status=needs_review",
    });
  }

  // 2. Lieferanten zum Verifizieren
  const unverifiedSuppliers = await prisma.supplier.count({
    where: { companyId, isVerified: false },
  });
  if (unverifiedSuppliers > 0) {
    actions.push({
      type: "verify_suppliers",
      priority: "medium",
      title: `${unverifiedSuppliers} Lieferanten verifizieren`,
      detail: "Unverifizierte Lieferanten blockieren Autopilot",
      targetType: "supplier",
      targetId: companyId,
      targetUrl: "/suppliers?verified=false",
    });
  }

  // 3. Offene Korrekturmuster
  const openPatterns = await prisma.correctionPattern.count({
    where: { companyId, status: "open", occurrences: { gte: 3 } },
  });
  if (openPatterns > 0) {
    actions.push({
      type: "promote_patterns",
      priority: "medium",
      title: `${openPatterns} Korrekturmuster prüfen`,
      detail: "In Regeln oder Wissen umwandeln",
      targetType: "rule",
      targetId: companyId,
      targetUrl: "/corrections",
    });
  }

  // 4. Fehlgeschlagene Exporte
  const failedExports = await prisma.exportRecord.count({
    where: { document: { companyId }, status: "failed" },
  });
  if (failedExports > 0) {
    actions.push({
      type: "fix_exports",
      priority: "high",
      title: `${failedExports} fehlgeschlagene Exporte`,
      detail: "Exporte prüfen und wiederholen",
      targetType: "document",
      targetId: companyId,
      targetUrl: "/exports",
    });
  }

  // 5. Offene Tasks
  const openTasks = await prisma.task.count({
    where: { companyId, status: { in: ["open", "in_progress"] } },
  });
  if (openTasks > 0) {
    actions.push({
      type: "resolve_tasks",
      priority: "medium",
      title: `${openTasks} offene Aufgaben`,
      detail: "Pendenzen abarbeiten",
      targetType: "task",
      targetId: companyId,
      targetUrl: "/tasks",
    });
  }

  return sortByPriority(actions);
}
