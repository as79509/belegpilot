"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Save, ChevronRight, Loader2 } from "lucide-react";

interface ReviewFormProps {
  document: Record<string, any>;
  onUpdate: (doc: Record<string, any>) => void;
  nextDocumentId?: string | null;
  queuePosition?: { current: number; total: number } | null;
}

const DOC_TYPE_OPTIONS = [
  { value: "invoice", label: "Rechnung" },
  { value: "credit_note", label: "Gutschrift" },
  { value: "receipt", label: "Quittung" },
  { value: "reminder", label: "Mahnung" },
  { value: "other", label: "Sonstiges" },
];
const CURRENCY_OPTIONS = ["CHF", "EUR", "USD", "GBP"];

export function ReviewForm({ document: doc, onUpdate, nextDocumentId, queuePosition }: ReviewFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({
    supplierNameRaw: "", supplierNameNormalized: "", documentType: "other",
    invoiceNumber: "", invoiceDate: "", dueDate: "", currency: "CHF",
    netAmount: "", vatAmount: "", grossAmount: "", iban: "",
    paymentReference: "", expenseCategory: "", accountCode: "",
    costCenter: "", reviewNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [dupDoc, setDupDoc] = useState<any>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);

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

  const validationChecks: any[] = doc.validationResults?.checks || [];
  const failedFields = new Set(
    validationChecks.filter((c: any) => !c.passed && c.field).map((c: any) => c.field)
  );

  function fieldClass(field: string) {
    return failedFields.has(field) ? "border-red-300 bg-red-50/50" : "";
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
      toast.success("Änderungen gespeichert ✓");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleApprove() {
    setApproving(true);
    await handleSave();
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      onUpdate(updated);
      toast.success(de.review.approveSuccess);

      // Check if supplier has no defaults set
      const hasSupplier = updated.supplierId && updated.supplier;
      const supplierMissingDefaults = hasSupplier && (!updated.supplier?.defaultCategory || !updated.supplier?.defaultAccountCode);
      if (supplierMissingDefaults && (form.expenseCategory || form.accountCode)) {
        setDefaultsDialogOpen(true);
      } else if (nextDocumentId) {
        setTimeout(() => router.push(`/documents/${nextDocumentId}`), 500);
      }
    } catch (err: any) { toast.error(err.message || de.errors.serverError); }
    finally { setApproving(false); }
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
      onUpdate(await res.json());
      toast.success(de.review.rejectSuccess);
      setRejectOpen(false);
      setRejectReason("");
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.review.reprocessSuccess);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) { toast.error(err.message); }
    finally { setReprocessing(false); }
  }

  function handleNextDocument() {
    if (nextDocumentId) {
      router.push(`/documents/${nextDocumentId}`);
    } else {
      toast.success("Alle Belege geprüft! ✓");
      router.push("/documents?status=needs_review");
    }
  }

  // Supplier verification
  async function handleVerifySupplier() {
    if (!doc.supplierId) return;
    try {
      await fetch(`/api/suppliers/${doc.supplierId}/verify`, { method: "POST" });
      toast.success("Lieferant verifiziert");
      // Reload doc to update supplier state
      const res = await fetch(`/api/documents/${doc.id}`);
      if (res.ok) onUpdate(await res.json());
    } catch { toast.error(de.errors.serverError); }
  }

  // Update supplier defaults after approval
  async function handleUpdateSupplierDefaults() {
    if (!doc.supplierId) return;
    try {
      await fetch(`/api/suppliers/${doc.supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCategory: form.expenseCategory || undefined,
          defaultAccountCode: form.accountCode || undefined,
          defaultCostCenter: form.costCenter || undefined,
        }),
      });
      toast.success("Lieferanten-Standardwerte aktualisiert");
    } catch {}
    setDefaultsDialogOpen(false);
    if (nextDocumentId) router.push(`/documents/${nextDocumentId}`);
  }

  // Duplicate popup handler — uses metadata.duplicateDocumentId from validation check
  async function openDuplicatePopup(duplicateDocumentId: string) {
    try {
      const res = await fetch(`/api/documents/${duplicateDocumentId}`);
      if (res.ok) {
        setDupDoc(await res.json());
        setDupOpen(true);
      }
    } catch {}
  }

  async function confirmDuplicate() {
    if (!dupDoc) return;
    const reason = `Duplikat von ${dupDoc.documentNumber || dupDoc.id.slice(0, 8)}`;
    try {
      const res = await fetch(`/api/documents/${doc.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        onUpdate(await res.json());
        toast.success(de.review.rejectSuccess);
        setDupOpen(false);
      }
    } catch {}
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleApprove(); }
      else if (e.ctrlKey && e.key === "s") { e.preventDefault(); handleSave(); }
      else if (e.ctrlKey && (e.key === "ArrowRight" || e.key === "n")) { e.preventDefault(); handleNextDocument(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const isReviewable = ["needs_review", "ready", "extracted", "validated"].includes(doc.status);

  const supplierUnverified = doc.supplier && doc.supplier.isVerified === false;

  return (
    <div className="space-y-4 pb-24">
      {/* Unverified supplier banner */}
      {supplierUnverified && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 flex-1">{de.suppliers.supplierNotVerified}</span>
          <Button variant="outline" size="sm" onClick={handleVerifySupplier}>
            {de.suppliers.verify}
          </Button>
        </div>
      )}

      {/* Supplier */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.detail.supplier}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">{de.detail.supplierRaw}</Label>
            <Input className={fieldClass("supplierNameRaw")} value={form.supplierNameRaw} onChange={(e) => set("supplierNameRaw", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.supplierNormalized}</Label>
            <Input value={form.supplierNameNormalized} onChange={(e) => set("supplierNameNormalized", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Invoice data */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.detail.invoiceData}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">{de.detail.type}</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.documentType} onChange={(e) => set("documentType", e.target.value)}>
              {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></div>
          <div><Label className="text-xs">{de.detail.invoiceNumber}</Label>
            <Input className={fieldClass("invoiceNumber")} value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.invoiceDate}</Label>
            <Input type="date" className={fieldClass("invoiceDate")} value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.dueDate}</Label>
            <Input type="date" className={fieldClass("dueDate")} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Amounts */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.detail.amounts}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Währung</Label>
            <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><Label className="text-xs">{de.detail.netAmount}</Label>
            <Input type="number" step="0.01" value={form.netAmount} onChange={(e) => set("netAmount", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.vatAmount}</Label>
            <Input type="number" step="0.01" value={form.vatAmount} onChange={(e) => set("vatAmount", e.target.value)} /></div>
          <Separator />
          <div><Label className="text-xs font-bold">{de.detail.grossAmount}</Label>
            <Input type="number" step="0.01" className={`text-lg font-bold ${fieldClass("grossAmount")}`} value={form.grossAmount} onChange={(e) => set("grossAmount", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.detail.payment}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">{de.detail.iban}</Label>
            <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.paymentReference}</Label>
            <Input value={form.paymentReference} onChange={(e) => set("paymentReference", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Categorization */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.detail.categorization}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">{de.detail.expenseCategory}</Label>
            <Input value={form.expenseCategory} onChange={(e) => set("expenseCategory", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.accountCode}</Label>
            <Input value={form.accountCode} onChange={(e) => set("accountCode", e.target.value)} /></div>
          <div><Label className="text-xs">{de.detail.costCenter}</Label>
            <Input value={form.costCenter} onChange={(e) => set("costCenter", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Validation checks with duplicate popup */}
      {validationChecks.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{de.validation.title}</CardTitle></CardHeader>
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
                  {check.checkName === "duplicate_by_fields" && !check.passed && check.metadata?.duplicateDocumentId ? (
                    <button
                      className="text-red-700 underline hover:text-red-900"
                      onClick={() => openDuplicatePopup(check.metadata!.duplicateDocumentId)}
                    >
                      {check.message}
                    </button>
                  ) : (
                    <span className={!check.passed && check.severity === "error" ? "text-red-700" : ""}>{check.message}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review notes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.review.reviewNotes}</CardTitle></CardHeader>
        <CardContent>
          <Textarea placeholder={de.review.reviewNotesPlaceholder} value={form.reviewNotes} onChange={(e) => set("reviewNotes", e.target.value)} rows={3} />
        </CardContent>
      </Card>

      {/* Duplicate comparison popup */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Duplikat-Vergleich</DialogTitle></DialogHeader>
          {dupDoc && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Aktueller Beleg</p>
                <p>Belegnr.: {doc.documentNumber || "—"}</p>
                <p>Lieferant: {doc.supplierNameNormalized || doc.supplierNameRaw || "—"}</p>
                <p>Rechnungsnr.: {doc.invoiceNumber || "—"}</p>
                <p>Datum: {formatDate(doc.invoiceDate)}</p>
                <p>Betrag: {formatCurrency(doc.grossAmount, doc.currency || "CHF")}</p>
              </div>
              <div>
                <p className="font-medium mb-2">Vermutetes Duplikat</p>
                <p>Belegnr.: {dupDoc.documentNumber || "—"}</p>
                <p>Lieferant: {dupDoc.supplierNameNormalized || dupDoc.supplierNameRaw || "—"}</p>
                <p>Rechnungsnr.: {dupDoc.invoiceNumber || "—"}</p>
                <p>Datum: {formatDate(dupDoc.invoiceDate)}</p>
                <p>Betrag: {formatCurrency(dupDoc.grossAmount, dupDoc.currency || "CHF")}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose><Button variant="outline">Kein Duplikat</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDuplicate}>Duplikat bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier defaults dialog (shown after approval) */}
      <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standardwerte für {doc.supplierNameNormalized || doc.supplierNameRaw} festlegen?</DialogTitle>
            <DialogDescription>
              Kategorie: {form.expenseCategory || "—"} | Konto: {form.accountCode || "—"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDefaultsDialogOpen(false); if (nextDocumentId) router.push(`/documents/${nextDocumentId}`); }}>
              Nein, überspringen
            </Button>
            <Button onClick={handleUpdateSupplierDefaults}>
              Ja, übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky action buttons */}
      {isReviewable && (
        <div className="fixed bottom-0 right-0 left-0 lg:left-60 bg-white border-t p-3 flex items-center gap-2 z-30">
          <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
            {approving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            {de.review.approve}
          </Button>

          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger>
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <XCircle className="h-4 w-4 mr-1" />{de.review.reject}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{de.review.rejectDialogTitle}</DialogTitle>
                <DialogDescription>{de.review.rejectDialogDescription}</DialogDescription>
              </DialogHeader>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={de.review.rejectReasonRequired} rows={3} />
              <DialogFooter>
                <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
                <Button onClick={handleReject} disabled={!rejectReason.trim()} variant="destructive">{de.review.reject}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleReprocess} disabled={reprocessing}>
            {reprocessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {de.review.reprocess}
          </Button>

          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {de.review.saveChanges}
          </Button>

          <div className="flex-1" />

          {queuePosition && (
            <span className="text-xs text-muted-foreground hidden md:block mr-2">
              Beleg {queuePosition.current} von {queuePosition.total}
            </span>
          )}

          <Button variant="ghost" onClick={handleNextDocument}>
            {de.review.nextDocument}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <span className="text-xs text-muted-foreground hidden lg:block">
            {de.review.keyboardShortcuts}
          </span>
        </div>
      )}
    </div>
  );
}
