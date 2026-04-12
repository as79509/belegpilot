import { prisma } from "@/lib/db";

export interface SetupItem {
  id: string;
  label: string;
  description: string;
  status: "complete" | "incomplete" | "error" | "not_started";
  requiredFor: string[];
  setupUrl: string | null;
  helpText: string;
  errorMessage: string | null;
}

export interface SetupOverview {
  items: SetupItem[];
  completionRate: number;
  criticalMissing: string[];
}

export async function getSetupOverview(companyId: string): Promise<SetupOverview> {
  const [
    inboxCount,
    totalActiveAccounts,
    mappedAccounts,
    vatMappedCount,
    bankAccountCount,
    accountCount,
    bexioIntegration,
    documentCount,
  ] = await Promise.all([
    prisma.emailInbox.count({ where: { companyId } }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.account.count({ where: { companyId, isActive: true, bananaMappingStatus: "mapped" } }),
    prisma.vatCodeMapping.count({ where: { companyId, mappingStatus: "mapped" } }),
    prisma.bankAccount.count({ where: { companyId } }),
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.integration.findFirst({
      where: { companyId, providerName: "bexio", isEnabled: true },
    }),
    prisma.document.count({ where: { companyId } }),
  ]);

  const bananaMappingRate = totalActiveAccounts > 0 ? mappedAccounts / totalActiveAccounts : 0;

  const items: SetupItem[] = [
    {
      id: "first_documents",
      label: "Erste Belege",
      description: "Mindestens ein Beleg muss hochgeladen sein.",
      status: documentCount >= 1 ? "complete" : "incomplete",
      requiredFor: ["core_workflow"],
      setupUrl: "/documents",
      helpText: "Lade deinen ersten Beleg hoch unter Dokumente \u2192 Hochladen.",
      errorMessage: null,
    },
    {
      id: "chart_of_accounts",
      label: "Kontenplan",
      description: "Mindestens 10 aktive Konten im Kontenplan.",
      status: accountCount >= 10 ? "complete" : "incomplete",
      requiredFor: ["journal", "suggestions", "banana_export"],
      setupUrl: "/accounts",
      helpText: "Importiere deinen Kontenplan unter Kontenplan \u2192 Import oder erstelle Konten manuell.",
      errorMessage: null,
    },
    {
      id: "email_webhook",
      label: "E-Mail-Empfang",
      description: "Mindestens eine E-Mail-Inbox konfiguriert.",
      status: inboxCount > 0 ? "complete" : "incomplete",
      requiredFor: ["email_import"],
      setupUrl: "/email",
      helpText: "Erstelle eine Inbox unter E-Mail-Import. Konfiguriere dann deinen E-Mail-Dienst (Mailgun, SendGrid) mit der angezeigten Webhook-URL.",
      errorMessage: null,
    },
    {
      id: "bank_accounts",
      label: "Bankkonten",
      description: "Mindestens ein Bankkonto f\u00fcr die Abstimmung.",
      status: bankAccountCount > 0 ? "complete" : "incomplete",
      requiredFor: ["bank_reconciliation", "payment_matching"],
      setupUrl: "/bank",
      helpText: "Erstelle ein Bankkonto unter Bankabstimmung \u2192 Konten. Importiere dann camt.053-Ausz\u00fcge deiner Bank.",
      errorMessage: null,
    },
    {
      id: "banana_mapping",
      label: "Banana Kontenplan-Mapping",
      description: "Mindestens 80% der Konten mit Banana-Mapping.",
      status: bananaMappingRate >= 0.8 ? "complete" : "incomplete",
      requiredFor: ["banana_export", "banana_round_trip"],
      setupUrl: "/banana",
      helpText: "\u00d6ffne Banana-Harmonisierung und starte das Auto-Mapping. Pr\u00fcfe danach unsichere Zuordnungen manuell.",
      errorMessage: null,
    },
    {
      id: "banana_vat_mapping",
      label: "Banana MwSt-Code-Mapping",
      description: "MwSt-Codes f\u00fcr Banana zugeordnet.",
      status: vatMappedCount > 0 ? "complete" : "incomplete",
      requiredFor: ["banana_export"],
      setupUrl: "/banana",
      helpText: "\u00d6ffne Banana-Harmonisierung \u2192 MwSt-Code-Mapping und ordne die Schweizer Steuersa\u0308tze den Banana-Codes zu.",
      errorMessage: null,
    },
    {
      id: "bexio_connection",
      label: "Bexio-Verbindung",
      description: "Bexio-API-Integration konfiguriert und aktiv.",
      status: bexioIntegration ? "complete" : "not_started",
      requiredFor: ["bexio_export", "bexio_sync"],
      setupUrl: "/integrations",
      helpText: "Konfiguriere die Bexio-Verbindung unter Integrationen mit deinem API-Token.",
      errorMessage: null,
    },
  ];

  const completeCount = items.filter((i) => i.status === "complete").length;
  const completionRate = items.length > 0 ? completeCount / items.length : 0;

  // Critical = items required for core features that are incomplete
  const criticalFeatures = ["core_workflow", "journal", "suggestions"];
  const criticalMissing = items
    .filter((i) => i.status !== "complete" && i.requiredFor.some((f) => criticalFeatures.includes(f)))
    .map((i) => i.id);

  return { items, completionRate, criticalMissing };
}
