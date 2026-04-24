import { notFound } from "next/navigation";

import { DocumentEditorForm } from "@/components/document-editor-form";
import { PageSection, SectionCard } from "@/components/ui";
import { getDocumentById } from "@/lib/data";
import { de } from "@/lib/i18n/de";
import { formatDate, isImageMimeType, isPdfMimeType } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const document = await getDocumentById(id);

  if (!document) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageSection
        title={document.supplierName || document.originalFilename}
        subtitle={`${document.client.name} · ${formatDate(document.documentDate || document.createdAt)}`}
      >
        <SectionCard className="overflow-hidden">
          {isPdfMimeType(document.mimeType) ? (
            <iframe
              src={`/api/documents/${document.id}/file`}
              title="PDF Vorschau"
              className="h-[28rem] w-full rounded-2xl border-0 bg-slate-100"
            />
          ) : isImageMimeType(document.mimeType) ? (
            <img
              src={`/api/documents/${document.id}/file`}
              alt={document.originalFilename}
              className="w-full rounded-2xl bg-slate-100 object-contain"
            />
          ) : (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Vorschau für diesen Dateityp nicht verfügbar.
            </div>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title={de.documents.detail} subtitle="Felder prüfen, Konto anpassen und Status setzen.">
        <DocumentEditorForm
          document={{
            id: document.id,
            status: document.status,
            supplierName: document.supplierName,
            documentDate: document.documentDate?.toISOString() ?? null,
            invoiceDate: document.invoiceDate?.toISOString() ?? null,
            dueDate: document.dueDate?.toISOString() ?? null,
            invoiceNumber: document.invoiceNumber,
            currency: document.currency,
            grossAmount: document.grossAmount,
            taxHint: document.taxHint,
            description: document.description,
            suggestedExpenseAccountNo: document.suggestedExpenseAccountNo,
            confirmedExpenseAccountNo: document.confirmedExpenseAccountNo,
            creditAccountNo: document.creditAccountNo,
            externalReference: document.externalReference,
            aiReasoningShort: document.aiReasoningShort,
            aiRawJson: document.aiRawJson,
          }}
          accounts={document.client.accounts.map((account) => ({
            accountNo: account.accountNo,
            name: account.name,
          }))}
        />
      </PageSection>
    </div>
  );
}
