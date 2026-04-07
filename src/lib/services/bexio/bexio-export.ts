import { prisma } from "@/lib/db";
import { BexioClient } from "./bexio-client";

export interface BexioExportResult {
  success: boolean;
  bexioId?: string;
  error?: string;
}

export async function exportDocumentToBexio(
  companyId: string,
  documentId: string,
  force: boolean = false
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
  if (doc.status !== "ready" && doc.status !== "exported") {
    return { success: false, error: "Beleg ist nicht bereit zum Export" };
  }

  // 3. Duplicate check (unless force)
  if (!force) {
    const existingExport = await prisma.exportRecord.findFirst({
      where: { documentId, exportTarget: "bexio", status: "success" },
    });
    if (existingExport) {
      return { success: false, error: "Beleg wurde bereits an Bexio exportiert" };
    }
  }

  try {
    // 4. Find or create supplier contact in Bexio
    const supplierName = doc.supplierNameNormalized || doc.supplierNameRaw || "Unbekannt";
    let contactId: number | null = null;
    const ownerId = await client.getOwnerId();

    try {
      const contacts = await client.searchContacts(supplierName);
      if (contacts.length > 0) contactId = contacts[0].id;
    } catch {}

    if (!contactId) {
      try {
        const newContact = await client.createContact({
          name_1: supplierName,
          contact_type_id: 2,
          owner_id: ownerId,
        });
        contactId = newContact.id;
      } catch (e: any) {
        console.warn("[Bexio] Contact creation failed:", e.message);
      }
    }

    // 5. Resolve Bexio account IDs from account numbers
    const debitAccountNumber = doc.accountCode || "6300";
    const creditAccountNumber = "2000";

    let debitAccountId: number | null = null;
    let creditAccountId: number | null = null;

    try {
      const debitAcc = await client.searchAccountByNumber(debitAccountNumber);
      if (debitAcc) debitAccountId = debitAcc.id;
      const creditAcc = await client.searchAccountByNumber(creditAccountNumber);
      if (creditAcc) creditAccountId = creditAcc.id;
    } catch (e: any) {
      console.warn("[Bexio] Account lookup failed, using fallback:", e.message);
    }

    if (!debitAccountId) debitAccountId = parseInt(debitAccountNumber) || 6300;
    if (!creditAccountId) creditAccountId = parseInt(creditAccountNumber) || 2000;

    // 6. MwSt handling
    let taxId: number | null = null;
    let taxAmount: number | null = null;

    if (doc.vatAmount && Number(doc.vatAmount) > 0) {
      taxAmount = Number(doc.vatAmount);
      const vatRates = doc.vatRatesDetected as any[];
      if (vatRates?.length > 0) {
        const rate = vatRates[0].rate;
        try {
          const taxes = await client.getTaxes();
          const matchingTax = taxes.find(
            (t: any) => Math.abs(t.percentage - rate) < 0.1 && t.is_active
          );
          if (matchingTax) taxId = matchingTax.id;
        } catch {}
      }
    }

    // 7. Create manual journal entry
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
          debit_account_id: debitAccountId,
          credit_account_id: creditAccountId,
          amount,
          description: `${supplierName} - ${doc.invoiceNumber || ""}`,
          ...(taxId && { tax_id: taxId }),
          ...(taxAmount && { tax_amount: taxAmount }),
        },
      ],
    };

    const response = await client.createManualEntry(payload);
    const bexioId = String(response.id || response.entry_id || "");

    // 8. Record export
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
