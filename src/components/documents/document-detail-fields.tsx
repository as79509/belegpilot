import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DocumentStatusBadge } from "./document-status-badge";
import { de } from "@/lib/i18n/de";
import {
  formatCurrency,
  formatDate,
  formatConfidence,
  getConfidenceColor,
  formatRelativeTime,
} from "@/lib/i18n/format";

interface DocumentDetailFieldsProps {
  document: Record<string, any>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">
        {value || de.common.noData}
      </span>
    </div>
  );
}

export function DocumentDetailFields({
  document: doc,
}: DocumentDetailFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Supplier */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.supplier}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field label={de.detail.supplierRaw} value={doc.supplierNameRaw} />
          <Field
            label={de.detail.supplierNormalized}
            value={doc.supplierNameNormalized}
          />
          <Field
            label={de.detail.vatNumber}
            value={
              doc.aiResults?.[0]?.normalizedData?.supplier_vat_number
            }
          />
        </CardContent>
      </Card>

      {/* Invoice data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.invoiceData}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field
            label={de.detail.type}
            value={
              de.documentType[
                doc.documentType as keyof typeof de.documentType
              ] || doc.documentType
            }
          />
          <Field label={de.detail.invoiceNumber} value={doc.invoiceNumber} />
          <Field
            label={de.detail.invoiceDate}
            value={formatDate(doc.invoiceDate)}
          />
          <Field label={de.detail.dueDate} value={formatDate(doc.dueDate)} />
        </CardContent>
      </Card>

      {/* Amounts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.amounts}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field
            label={de.detail.netAmount}
            value={formatCurrency(doc.netAmount, doc.currency || "CHF")}
          />
          <Field
            label={de.detail.vatAmount}
            value={formatCurrency(doc.vatAmount, doc.currency || "CHF")}
          />
          <Separator className="my-1" />
          <Field
            label={de.detail.grossAmount}
            value={
              <span className="font-bold">
                {formatCurrency(doc.grossAmount, doc.currency || "CHF")}
              </span>
            }
          />
          {doc.vatRatesDetected &&
            Array.isArray(doc.vatRatesDetected) &&
            doc.vatRatesDetected.length > 0 && (
              <Field
                label={de.detail.vatRates}
                value={doc.vatRatesDetected
                  .map(
                    (r: { rate: number; amount: number }) =>
                      `${r.rate}%: ${formatCurrency(r.amount, doc.currency || "CHF")}`
                  )
                  .join(", ")}
              />
            )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.payment}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field label={de.detail.iban} value={doc.iban} />
          <Field
            label={de.detail.paymentReference}
            value={doc.paymentReference}
          />
        </CardContent>
      </Card>

      {/* Categorization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.categorization}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field
            label={de.detail.expenseCategory}
            value={doc.expenseCategory}
          />
          <Field label={de.detail.accountCode} value={doc.accountCode} />
          <Field label={de.detail.costCenter} value={doc.costCenter} />
        </CardContent>
      </Card>

      {/* Processing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.processing}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <Field
            label={de.detail.confidenceScore}
            value={
              <span className={getConfidenceColor(doc.confidenceScore)}>
                {formatConfidence(doc.confidenceScore)}
              </span>
            }
          />
          <Field
            label={de.documents.status}
            value={<DocumentStatusBadge status={doc.status} />}
          />
          <Field
            label={de.detail.createdAt}
            value={formatRelativeTime(doc.createdAt)}
          />
          <Field
            label={de.detail.updatedAt}
            value={formatRelativeTime(doc.updatedAt)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
