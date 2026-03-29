"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { de } from "@/lib/i18n/de";
import { formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Save, ChevronRight } from "lucide-react";

interface ReviewFormProps {
  document: Record<string, any>;
  onUpdate: (doc: Record<string, any>) => void;
  nextDocumentId?: string | null;
}

const DOC_TYPE_OPTIONS = [
  { value: "invoice", label: "Rechnung" },
  { value: "credit_note", label: "Gutschrift" },
  { value: "receipt", label: "Quittung" },
  { value: "reminder", label: "Mahnung" },
  { value: "other", label: "Sonstiges" },
];

const CURRENCY_OPTIONS = ["CHF", "EUR", "USD", "GBP"];

export function ReviewForm({ document: doc, onUpdate, nextDocumentId }: ReviewFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({
    supplierNameRaw: "",
    supplierNameNormalized: "",
    documentType: "other",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    currency: "CHF",
    netAmount: "",
    vatAmount: "",
    grossAmount: "",
    iban: "",
    paymentReference: "",
    expenseCategory: "",
    accountCode: "",
    costCenter: "",
    reviewNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  // Initialize form from document
  useEffect(() => {
    setForm({
      supplierNameRaw: doc.supplierNameRaw || "",
      supplierNameNormalized: doc.supplierNameNormalized || "",
      documentType: doc.documentType || "other",
      invoiceNumber: doc.invoiceNumber || "",
      invoiceDate: doc.invoiceDate?.split("T")[0] || "",
      dueDate: doc.dueDate?.split("T")[0] || "",
      currency: doc.currency || "CHF",
      netAmount: doc.netAmount ?? "",
      vatAmount: doc.vatAmount ?? "",
      grossAmount: doc.grossAmount ?? "",
      iban: doc.iban || "",
      paymentReference: doc.paymentReference || "",
      expenseCategory: doc.expenseCategory || "",
      accountCode: doc.accountCode || "",
      costCenter: doc.costCenter || "",
      reviewNotes: doc.reviewNotes || "",
    });
  }, [doc]);

  function set(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Validation results
  const validationChecks: any[] = doc.validationResults?.checks || [];
  const failedFields = new Set(
    validationChecks.filter((c: any) => !c.passed && c.field).map((c: any) => c.field)
  );

  function fieldClass(field: string) {
    if (failedFields.has(field)) return "border-red-300 bg-red-50/50";
    return "";
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      onUpdate(updated);
      toast.success(de.review.saveSuccess);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    // Save any pending changes first
    await handleSave();
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      onUpdate(updated);
      toast.success(de.review.approveSuccess);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      onUpdate(updated);
      toast.success(de.review.rejectSuccess);
      setRejectOpen(false);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleReprocess() {
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.review.reprocessSuccess);
      // Reload after short delay
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleApprove();
      } else if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && (e.key === "ArrowRight" || e.key === "n")) {
        e.preventDefault();
        if (nextDocumentId) router.push(`/documents/${nextDocumentId}`);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const isReviewable = ["needs_review", "ready", "extracted", "validated"].includes(doc.status);

  return (
    <div className="space-y-4 pb-24">
      {/* Supplier */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.supplier}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{de.detail.supplierRaw}</Label>
            <Input className={fieldClass("supplierNameRaw")} value={form.supplierNameRaw} onChange={(e) => set("supplierNameRaw", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.supplierNormalized}</Label>
            <Input value={form.supplierNameNormalized} onChange={(e) => set("supplierNameNormalized", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.vatNumber}</Label>
            <Input value={doc.aiResults?.[0]?.normalizedData?.supplier_vat_number || ""} readOnly className="bg-muted/50" />
          </div>
        </CardContent>
      </Card>

      {/* Invoice data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.invoiceData}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{de.detail.type}</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
              {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">{de.detail.invoiceNumber}</Label>
            <Input className={fieldClass("invoiceNumber")} value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.invoiceDate}</Label>
            <Input type="date" className={fieldClass("invoiceDate")} value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.dueDate}</Label>
            <Input type="date" className={fieldClass("dueDate")} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Amounts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.amounts}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{de.detail.amounts} — {de.common.noData}</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">{de.detail.netAmount}</Label>
            <Input type="number" step="0.01" value={form.netAmount} onChange={(e) => set("netAmount", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.vatAmount}</Label>
            <Input type="number" step="0.01" value={form.vatAmount} onChange={(e) => set("vatAmount", e.target.value)} />
          </div>
          <Separator />
          <div>
            <Label className="text-xs font-bold">{de.detail.grossAmount}</Label>
            <Input type="number" step="0.01" className={`text-lg font-bold ${fieldClass("grossAmount")}`} value={form.grossAmount} onChange={(e) => set("grossAmount", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.payment}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{de.detail.iban}</Label>
            <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.paymentReference}</Label>
            <Input value={form.paymentReference} onChange={(e) => set("paymentReference", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Categorization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.detail.categorization}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{de.detail.expenseCategory}</Label>
            <Input value={form.expenseCategory} onChange={(e) => set("expenseCategory", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.accountCode}</Label>
            <Input value={form.accountCode} onChange={(e) => set("accountCode", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{de.detail.costCenter}</Label>
            <Input value={form.costCenter} onChange={(e) => set("costCenter", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Validation checks */}
      {validationChecks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{de.validation.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {validationChecks.map((check: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  {check.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : check.severity === "error" ? (
                    <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className={!check.passed && check.severity === "error" ? "text-red-700" : ""}>{check.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{de.review.reviewNotes}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={de.review.reviewNotesPlaceholder}
            value={form.reviewNotes}
            onChange={(e) => set("reviewNotes", e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Sticky action buttons */}
      {isReviewable && (
        <div className="fixed bottom-0 right-0 left-0 lg:left-60 bg-white border-t p-3 flex items-center gap-2 z-30">
          <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {de.review.approve}
          </Button>

          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger>
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <XCircle className="h-4 w-4 mr-1" />
                {de.review.reject}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{de.review.rejectDialogTitle}</DialogTitle>
                <DialogDescription>{de.review.rejectDialogDescription}</DialogDescription>
              </DialogHeader>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={de.review.rejectReasonRequired}
                rows={3}
              />
              <DialogFooter>
                <DialogClose>
                  <Button variant="outline">{de.common.cancel}</Button>
                </DialogClose>
                <Button onClick={handleReject} disabled={!rejectReason.trim()} variant="destructive">
                  {de.review.reject}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleReprocess}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {de.review.reprocess}
          </Button>

          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? de.review.processing : de.review.saveChanges}
          </Button>

          <div className="flex-1" />

          {nextDocumentId && (
            <Button variant="ghost" onClick={() => router.push(`/documents/${nextDocumentId}`)}>
              {de.review.nextDocument}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          <span className="text-xs text-muted-foreground hidden md:block">
            {de.review.keyboardShortcuts}
          </span>
        </div>
      )}
    </div>
  );
}
