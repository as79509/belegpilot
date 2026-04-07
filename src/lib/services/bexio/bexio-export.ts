import { prisma } from "@/lib/db";
import { BexioClient } from "./bexio-client";

export interface BexioExportResult {
  success: boolean;
  bexioId?: string;
  error?: string;
}

export async function exportDocumentToBexio(
  companyId: string,
  documentId: string
): Promise<BexioExportResult> {
  // 1. Load integration credentials
  const integration = await prisma.integration.findFirst({
    where: { companyId, providerType: "export", providerName: "bexio", isEnabled: true },
  });

  if (!integration?.credentials) {
    return { success: false, error: "Bexio nicht konfiguriert" };
  }

  const creds = integration.credentials as Record<string, any>;
  if (!creds.accessToken) {
    return { success: false, error: "Bexio Access Token fehlt" };
  }

  const client = new BexioClient(creds.accessToken);

  // 2. Load document
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { supplier: true },
  });

  if (!doc) return { success: false, error: "Beleg nicht gefunden" };
  if (doc.status !== "ready") return { success: false, error: "Beleg ist nicht bereit zum Export" };

  try {
    // 3. Find or create supplier contact in Bexio
    const supplierName = doc.supplierNameNormalized || doc.supplierNameRaw || "Unbekannt";
    let contactId: number | null = null;

    try {
      const contacts = await client.searchContacts(supplierName);
      if (contacts.length > 0) {
        contactId = contacts[0].id;
      }
    } catch {
      // Search failed — try to create
    }

    if (!contactId) {
      try {
        const newContact = await client.createContact({
          name_1: supplierName,
          contact_type_id: 2, // Lieferant
          owner_id: 1,
        });
        contactId = newContact.id;
      } catch (e: any) {
        console.error("[Bexio] Contact creation failed:", e.message);
      }
    }

    // 4. Create manual journal entry
    const debitAccount = doc.accountCode || "6300"; // Aufwand
    const creditAccount = "2000"; // Kreditoren
    const amount = doc.grossAmount ? Number(doc.grossAmount) : 0;

    const formatDate = (d: Date | null) => {
      if (!d) return new Date().toISOString().split("T")[0];
      return d.toISOString().split("T")[0];
    };

    const payload = {
      date: formatDate(doc.invoiceDate),
      reference_nr: doc.invoiceNumber || doc.documentNumber || "",
      entries: [
        {
          debit_account_id: parseInt(debitAccount) || 6300,
          credit_account_id: parseInt(creditAccount) || 2000,
          amount,
          description: `${supplierName} - ${doc.invoiceNumber || ""}`,
        },
      ],
    };

    const response = await client.createManualEntry(payload);
    const bexioId = String(response.id || response.entry_id || "");

    // 5. Record export
    await prisma.exportRecord.create({
      data: {
        documentId,
        exportTarget: "bexio",
        status: "success",
        externalId: bexioId,
        payloadSent: payload as any,
        responseReceived: response as any,
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { exportStatus: "exported", status: "exported" },
    });

    return { success: true, bexioId };
  } catch (error: any) {
    console.error("[Bexio] Export failed:", error.message);

    await prisma.exportRecord.create({
      data: {
        documentId,
        exportTarget: "bexio",
        status: "failed",
        errorMessage: error.message,
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { exportStatus: "export_failed" },
    });

    return { success: false, error: error.message };
  }
}
