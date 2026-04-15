"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ds";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileSignature, Loader2, Search, CheckCircle2, AlertTriangle, XCircle, Clock, FileText, ListTodo } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate, formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800", expiring: "bg-amber-100 text-amber-800",
  terminated: "bg-gray-100 text-gray-800", expired: "bg-red-100 text-red-800",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", contractType: "software", counterparty: "",
    startDate: new Date().toISOString().split("T")[0], endDate: "",
    noticePeriod: "", autoRenew: false, monthlyAmount: "",
    currency: "CHF", frequency: "monthly", debitAccount: "",
    reminderDays: "30", notes: "",
  });

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) setContracts(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  // Auto-load completeness check, sodass Lifecycle-Status & fehlende Rechnungen sofort sichtbar sind
  const autoCheck = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts/check");
      if (res.ok) setCheckResult(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchContracts(); autoCheck(); }, [fetchContracts, autoCheck]);

  // Map contractId → check entry für schnellen Lookup
  const checkByContract = new Map<string, any>(
    (checkResult?.contracts || []).map((c: any) => [c.id, c])
  );

  function set(f: string, v: any) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reminderDays: parseInt(form.reminderDays) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.contracts.saveSuccess);
      setDialogOpen(false);
      setForm({ name: "", contractType: "software", counterparty: "", startDate: new Date().toISOString().split("T")[0], endDate: "", noticePeriod: "", autoRenew: false, monthlyAmount: "", currency: "CHF", frequency: "monthly", debitAccount: "", reminderDays: "30", notes: "" });
      fetchContracts();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/contracts/check");
      if (res.ok) setCheckResult(await res.json());
    } catch {} finally { setChecking(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.contracts.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            {de.contracts.checkCompleteness}
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.contracts.newContract}</Button>
        </div>
      </div>

      {/* Check results */}
      {checkResult && (
        <div className="flex gap-3">
          {checkResult.overdueCount > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-800 text-sm px-3 py-1">
              <XCircle className="h-3 w-3 mr-1" />{checkResult.overdueCount} {de.contracts.overdue}
            </Badge>
          )}
          {checkResult.expiringCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-sm px-3 py-1">
              <AlertTriangle className="h-3 w-3 mr-1" />{checkResult.expiringCount} {de.contracts.expiring}
            </Badge>
          )}
          {checkResult.overdueCount === 0 && checkResult.expiringCount === 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-sm px-3 py-1">
              <CheckCircle2 className="h-3 w-3 mr-1" />{de.contracts.allComplete}
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : contracts.length === 0 ? (
            <EmptyState icon={FileSignature} title={de.emptyStates.contracts.title} description={de.emptyStates.contracts.description} />
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{de.contracts.name}</TableHead>
                <TableHead>{de.contracts.contractType}</TableHead>
                <TableHead>{de.contracts.counterparty}</TableHead>
                <TableHead>{de.contracts.monthlyAmount}</TableHead>
                <TableHead>{de.contractsDeep.paymentCycle}</TableHead>
                <TableHead>Laufzeit</TableHead>
                <TableHead>{de.contractsDeep.lifecycle}</TableHead>
                <TableHead>{de.contractsDeep.linkedExpectedDocs}</TableHead>
                <TableHead>{de.contractsDeep.linkedTasks}</TableHead>
                <TableHead>{de.contractsDeep.missingInvoiceShort}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contracts.map((c: any) => {
                  const check = checkByContract.get(c.id);
                  const lifecycleStatus = c.lifecycleStatus || c.status;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{de.contracts.types[c.contractType] || c.contractType}</Badge></TableCell>
                      <TableCell className="text-xs">{c.counterparty}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatCurrency(c.monthlyAmount, c.currency || "CHF")}</TableCell>
                      <TableCell className="text-xs">{de.recurring.frequencies[c.frequency] || c.frequency}</TableCell>
                      <TableCell className="text-xs">{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : " – unbefristet"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[lifecycleStatus] || ""}`}>{lifecycleStatus}</Badge>
                          {c.daysUntilExpiry != null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= c.reminderDays && (
                            <span className="text-[0.65rem] text-amber-700 inline-flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {de.contractsDeep.expiringIn.replace("{days}", String(c.daysUntilExpiry))}
                            </span>
                          )}
                          {c.daysUntilExpiry != null && c.daysUntilExpiry < 0 && (
                            <span className="text-[0.65rem] text-red-700">{de.contractsDeep.expired}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.expectedDocumentCount > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-2.5 w-2.5 mr-0.5" />{c.expectedDocumentCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.openTaskCount > 0 ? (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                            <ListTodo className="h-2.5 w-2.5 mr-0.5" />{c.openTaskCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {check?.invoiceStatus === "overdue" ? (
                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" />
                            {de.contractsDeep.missingInvoice.replace(
                              "{period}",
                              check.expectedDate
                                ? new Date(check.expectedDate).toLocaleDateString("de-CH", { month: "short", year: "numeric" })
                                : ""
                            )}
                          </Badge>
                        ) : check?.invoiceStatus === "received" ? (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />OK
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New contract dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{de.contracts.newContract}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.contracts.name} *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.contracts.contractType}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.contractType} onChange={(e) => set("contractType", e.target.value)}>
                  {Object.entries(de.contracts.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">{de.contracts.counterparty} *</Label><Input value={form.counterparty} onChange={(e) => set("counterparty", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.contracts.startDate}</Label><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
              <div><Label className="text-xs">{de.contracts.endDate}</Label><Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{de.contracts.monthlyAmount} *</Label><Input type="number" step="0.01" value={form.monthlyAmount} onChange={(e) => set("monthlyAmount", e.target.value)} /></div>
              <div><Label className="text-xs">{de.contracts.frequency}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                  {Object.entries(de.recurring.frequencies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">{de.contracts.reminderDays}</Label><Input type="number" value={form.reminderDays} onChange={(e) => set("reminderDays", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.contracts.noticePeriod}</Label><Input value={form.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value)} placeholder="z.B. 3 Monate" /></div>
              <div><Label className="text-xs">Soll-Konto</Label><Input value={form.debitAccount} onChange={(e) => set("debitAccount", e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.autoRenew} onCheckedChange={(c) => set("autoRenew", !!c)} />{de.contracts.autoRenew}</label>
            <div><Label className="text-xs">Notizen</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {de.common.cancel}
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.counterparty || !form.monthlyAmount}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
