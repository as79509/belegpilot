import type { IntegrationAdapter, IntegrationAction, ExportResult } from "../integration-provider";
import { registerAdapter } from "../provider-registry";
import { prisma } from "@/lib/db";

const bexioAdapter: IntegrationAdapter = {
  provider: {
    id: "bexio",
    name: "Bexio",
    description: "Schweizer Cloud-Buchhaltung. Export von Buchungen und Synchronisation des Kontenplans.",
    supportedActions: ["export_journal", "sync_accounts"],
    icon: "Link2",
    canExport: true,
    canImport: false,
    canSync: true,
    requiresApiKey: true,
    configFields: [
      { key: "accessToken", label: "Access Token", type: "password", required: true, placeholder: "Bexio API Token eingeben" },
    ],
  },

  async executeExport(companyId: string, action: IntegrationAction): Promise<ExportResult> {
    const integration = await prisma.integration.findFirst({
      where: { companyId, providerType: "export", providerName: "bexio", isEnabled: true },
    });

    if (!integration?.credentials) {
      return { success: false, format: "json", data: "", filename: "", recordCount: 0, warnings: ["Bexio nicht konfiguriert"] };
    }

    if (action === "export_journal") {
      const { exportDocumentToBexio } = await import("@/lib/services/bexio/bexio-export");
      const docs = await prisma.document.findMany({
        where: { companyId, status: "ready", exportStatus: "not_exported" },
        select: { id: true },
        take: 50,
      });
      let exported = 0;
      const warnings: string[] = [];
      for (const doc of docs) {
        const result = await exportDocumentToBexio(companyId, doc.id);
        if (result.success) exported++;
        else if (result.error) warnings.push(result.error);
      }
      return { success: exported > 0, format: "json", data: JSON.stringify({ exported }), filename: "bexio-export.json", recordCount: exported, warnings };
    }

    if (action === "sync_accounts") {
      const creds = integration.credentials as Record<string, any>;
      const { BexioClient } = await import("@/lib/services/bexio/bexio-client");
      const client = new BexioClient(creds.accessToken);
      try {
        const accounts = await client.getAccounts();
        return { success: true, format: "json", data: JSON.stringify(accounts), filename: "bexio-accounts.json", recordCount: Array.isArray(accounts) ? accounts.length : 0, warnings: [] };
      } catch (err: any) {
        return { success: false, format: "json", data: "", filename: "", recordCount: 0, warnings: [err.message] };
      }
    }

    return { success: false, format: "json", data: "", filename: "", recordCount: 0, warnings: ["Aktion nicht unterst\u00fctzt"] };
  },
};

registerAdapter(bexioAdapter);
export { bexioAdapter };
