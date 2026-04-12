"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityHeader, StatusBadge, EmptyState, InfoPanel } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { Receipt, Plus, AlertTriangle, Download, FileCode } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/lib/contexts/company-context";

// ── Types ──

interface VatReturn {
  id: string;
  year: number;
  quarter: number;
  periodType: string;
  status: string;
  ziffer200: string | number;
  ziffer205: string | number;
  ziffer220: string | number;
  ziffer221: string | number;
  ziffer225: string | number;
  ziffer230: string | number;
  ziffer235: string | number;
  ziffer302: string | number;
  ziffer312: string | number;
  ziffer342: string | number;
  ziffer382: string | number;
  steuer302: string | number;
  steuer312: string | number;
  steuer342: string | number;
  steuer382: string | number;
  ziffer400: string | number;
  ziffer405: string | number;
  ziffer410: string | number;
  ziffer415: string | number;
  ziffer420: string | number;
  warnings: Array<{ ziffer: string; message: string; severity: string }> | null;
  documentCount: number;
  journalCount: number;
  notes: string | null;
  createdAt: string;
}

function n(val: string | number | null | undefined): number {
  return Number(val || 0);
}

function fmtChf(val: number): string {
  return formatCurrency(val, "CHF");
}

function periodLabel(vr: VatReturn): string {
  if (vr.periodType === "semi_annual") return `H${vr.quarter}/${vr.year}`;
  return `Q${vr.quarter}/${vr.year}`;
}

// ── Page ──

export default function VatPage() {
  const { activeCompany } = useCompany();
  const vatInterval = (activeCompany as any)?.company?.vatInterval || "quarterly";

  const [vatReturns, setVatReturns] = useState<VatReturn[]>([]);
  const [selected, setSelected] = useState<VatReturn | null>(null);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [createQuarter, setCreateQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/vat");
    if (res.ok) {
      const data = await res.json();
      const returns = data.returns || data;
      setVatReturns(returns);
      // If something is selected, refresh it
      if (selected) {
        const updated = returns.find((v: VatReturn) => v.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: createYear, quarter: createQuarter }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created = await res.json();
      toast.success(de.vatReturn.createSuccess);
      setCreateOpen(false);
      await load();
      setSelected(created);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return;
    const res = await fetch(`/api/vat/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      toast.success(
        newStatus === "validated" ? de.vatReturn.validateSuccess :
        newStatus === "approved" ? de.vatReturn.approveSuccess :
        de.vatReturn.saveSuccess
      );
      await load();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  function openEditDialog() {
    if (!selected) return;
    const fields = [
      "ziffer200", "ziffer205", "ziffer220", "ziffer221", "ziffer225", "ziffer230", "ziffer235",
      "ziffer302", "ziffer312", "ziffer342", "ziffer382",
      "steuer302", "steuer312", "steuer342", "steuer382",
      "ziffer400", "ziffer405", "ziffer410", "ziffer415", "ziffer420",
    ];
    const form: Record<string, string> = {};
    for (const f of fields) {
      form[f] = String(n((selected as any)[f]));
    }
    form.notes = selected.notes || "";
    setEditForm(form);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!selected) return;
    const res = await fetch(`/api/vat/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      toast.success(de.vatReturn.saveSuccess);
      setEditOpen(false);
      await load();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  // ── Computed values ──
  const taxableRevenue = selected ? n(selected.ziffer200) - n(selected.ziffer205) - n(selected.ziffer220) - n(selected.ziffer221) - n(selected.ziffer225) - n(selected.ziffer230) - n(selected.ziffer235) : 0;
  const totalTax = selected ? n(selected.steuer302) + n(selected.steuer312) + n(selected.steuer342) + n(selected.steuer382) : 0;
  const totalInputVat = selected ? n(selected.ziffer400) + n(selected.ziffer405) + n(selected.ziffer410) + n(selected.ziffer415) - n(selected.ziffer420) : 0;
  const payable = totalTax - totalInputVat;

  return (
    <div className="space-y-6 p-6">
      <EntityHeader
        title={de.vatReturn.title}
        badge={selected ? <StatusBadge type="vatReturn" value={selected.status} /> : undefined}
        primaryAction={{
          label: de.vatReturn.createNew,
          icon: Plus,
          onClick: () => setCreateOpen(true),
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="lg:col-span-1">
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.vatReturn.period}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{de.vatReturn.payable}</TableHead>
                  <TableHead className="text-right">{de.vatReturn.documents}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : vatReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState icon={Receipt} title={de.vatReturn.noReturns} description="" />
                    </TableCell>
                  </TableRow>
                ) : (
                  vatReturns.map((vr) => {
                    const vrTax = n(vr.steuer302) + n(vr.steuer312) + n(vr.steuer342) + n(vr.steuer382);
                    const vrInput = n(vr.ziffer400) + n(vr.ziffer405) + n(vr.ziffer410) + n(vr.ziffer415) - n(vr.ziffer420);
                    const vrPayable = vrTax - vrInput;
                    return (
                      <TableRow
                        key={vr.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selected?.id === vr.id ? "bg-muted/30" : ""}`}
                        onClick={() => setSelected(vr)}
                      >
                        <TableCell className="font-medium">{periodLabel(vr)}</TableCell>
                        <TableCell><StatusBadge type="vatReturn" value={vr.status} size="sm" /></TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtChf(vrPayable)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">{vr.documentCount}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right: Detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="border rounded-md bg-white p-8 text-center text-muted-foreground">
              {de.vatReturn.noReturns}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Warnings */}
              {selected.warnings && selected.warnings.length > 0 && (
                <div className="space-y-2">
                  {selected.warnings.map((w, i) => (
                    <InfoPanel
                      key={i}
                      tone={w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info"}
                      title={`Ziffer ${w.ziffer}`}
                      icon={AlertTriangle}
                    >
                      {w.message}
                    </InfoPanel>
                  ))}
                </div>
              )}

              {/* Section 1: Umsatz */}
              <div className="border rounded-md bg-white">
                <div className="px-4 py-2 border-b bg-slate-50 font-semibold text-sm">{de.vatReturn.section.revenue}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ziffer</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="text-right w-40">{de.vatReturn.amount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <ZifferRow z="200" label={de.vatReturn.ziffer.z200} amount={n(selected.ziffer200)} />
                    <ZifferRow z="205" label={de.vatReturn.ziffer.z205} amount={n(selected.ziffer205)} subtract />
                    <ZifferRow z="220" label={de.vatReturn.ziffer.z220} amount={n(selected.ziffer220)} subtract />
                    <ZifferRow z="221" label={de.vatReturn.ziffer.z221} amount={n(selected.ziffer221)} subtract />
                    <ZifferRow z="225" label={de.vatReturn.ziffer.z225} amount={n(selected.ziffer225)} subtract />
                    <ZifferRow z="230" label={de.vatReturn.ziffer.z230} amount={n(selected.ziffer230)} subtract />
                    <ZifferRow z="235" label={de.vatReturn.ziffer.z235} amount={n(selected.ziffer235)} subtract />
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell />
                      <TableCell>{de.vatReturn.ziffer.taxableRevenue}</TableCell>
                      <TableCell className="text-right font-mono">{fmtChf(taxableRevenue)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Section 2: Steuerberechnung */}
              <div className="border rounded-md bg-white">
                <div className="px-4 py-2 border-b bg-slate-50 font-semibold text-sm">{de.vatReturn.section.tax}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ziffer</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="text-right w-36">{de.vatReturn.revenue}</TableHead>
                      <TableHead className="text-right w-36">{de.vatReturn.tax}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TaxRow z="302" label={de.vatReturn.ziffer.z302} base={n(selected.ziffer302)} tax={n(selected.steuer302)} />
                    <TaxRow z="312" label={de.vatReturn.ziffer.z312} base={n(selected.ziffer312)} tax={n(selected.steuer312)} />
                    <TaxRow z="342" label={de.vatReturn.ziffer.z342} base={n(selected.ziffer342)} tax={n(selected.steuer342)} />
                    <TaxRow z="382" label={de.vatReturn.ziffer.z382} base={n(selected.ziffer382)} tax={n(selected.steuer382)} />
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell />
                      <TableCell>{de.vatReturn.ziffer.totalTax}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">{fmtChf(totalTax)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Section 3: Vorsteuer */}
              <div className="border rounded-md bg-white">
                <div className="px-4 py-2 border-b bg-slate-50 font-semibold text-sm">{de.vatReturn.section.inputVat}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ziffer</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="text-right w-40">{de.vatReturn.amount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <ZifferRow z="400" label={de.vatReturn.ziffer.z400} amount={n(selected.ziffer400)} />
                    <ZifferRow z="405" label={de.vatReturn.ziffer.z405} amount={n(selected.ziffer405)} />
                    <ZifferRow z="410" label={de.vatReturn.ziffer.z410} amount={n(selected.ziffer410)} />
                    <ZifferRow z="415" label={de.vatReturn.ziffer.z415} amount={n(selected.ziffer415)} />
                    <ZifferRow z="420" label={de.vatReturn.ziffer.z420} amount={n(selected.ziffer420)} subtract />
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell />
                      <TableCell>{de.vatReturn.ziffer.totalInputVat}</TableCell>
                      <TableCell className="text-right font-mono">{fmtChf(totalInputVat)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Result Box */}
              <div className={`border rounded-md p-4 ${payable >= 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">
                    {payable >= 0 ? de.vatReturn.toPay : de.vatReturn.credit}
                  </span>
                  <span className={`text-2xl font-bold font-mono ${payable >= 0 ? "text-amber-800" : "text-green-700"}`}>
                    {fmtChf(Math.abs(payable))}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {selected.status === "draft" && (
                  <>
                    <Button onClick={() => handleStatusChange("validated")}>{de.vatReturn.validate}</Button>
                    <Button variant="outline" onClick={openEditDialog}>{de.vatReturn.edit}</Button>
                  </>
                )}
                {selected.status === "validated" && (
                  <Button onClick={() => handleStatusChange("approved")}>{de.vatReturn.approve}</Button>
                )}
                {selected.status === "approved" && (
                  <>
                    <a href={`/api/vat/${selected.id}/pdf`} download>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-1.5" />{de.vatReturn.downloadPdf}
                      </Button>
                    </a>
                    <span title="eCH-0217 in Vorbereitung">
                      <Button variant="outline" disabled>
                        <FileCode className="h-4 w-4 mr-1.5" />{de.vatReturn.exportXml}
                      </Button>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.vatReturn.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{de.vatReturn.year}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={createYear}
                onChange={(e) => setCreateYear(Number(e.target.value))}
              >
                {[createYear - 1, createYear, createYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{vatInterval === "semi_annual" ? de.vatReturn.halfYear : de.vatReturn.quarter}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={createQuarter}
                onChange={(e) => setCreateQuarter(Number(e.target.value))}
              >
                {vatInterval === "semi_annual" ? (
                  <>
                    <option value={1}>H1 (Jan–Jun)</option>
                    <option value={2}>H2 (Jul–Dez)</option>
                  </>
                ) : (
                  <>
                    <option value={1}>Q1 (Jan–Mär)</option>
                    <option value={2}>Q2 (Apr–Jun)</option>
                    <option value={3}>Q3 (Jul–Sep)</option>
                    <option value={4}>Q4 (Okt–Dez)</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Erstelle…" : de.vatReturn.createNew}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{de.vatReturn.editTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground">{de.vatReturn.section.revenue}</p>
            <EditField label="200" desc={de.vatReturn.ziffer.z200} value={editForm.ziffer200} onChange={(v) => setEditForm({ ...editForm, ziffer200: v })} />
            <EditField label="205" desc={de.vatReturn.ziffer.z205} value={editForm.ziffer205} onChange={(v) => setEditForm({ ...editForm, ziffer205: v })} />
            <EditField label="220" desc={de.vatReturn.ziffer.z220} value={editForm.ziffer220} onChange={(v) => setEditForm({ ...editForm, ziffer220: v })} />
            <EditField label="221" desc={de.vatReturn.ziffer.z221} value={editForm.ziffer221} onChange={(v) => setEditForm({ ...editForm, ziffer221: v })} />
            <EditField label="225" desc={de.vatReturn.ziffer.z225} value={editForm.ziffer225} onChange={(v) => setEditForm({ ...editForm, ziffer225: v })} />
            <EditField label="230" desc={de.vatReturn.ziffer.z230} value={editForm.ziffer230} onChange={(v) => setEditForm({ ...editForm, ziffer230: v })} />
            <EditField label="235" desc={de.vatReturn.ziffer.z235} value={editForm.ziffer235} onChange={(v) => setEditForm({ ...editForm, ziffer235: v })} />

            <p className="text-xs font-semibold text-muted-foreground pt-2">{de.vatReturn.section.tax}</p>
            <EditField label="302" desc={de.vatReturn.ziffer.z302} value={editForm.ziffer302} onChange={(v) => setEditForm({ ...editForm, ziffer302: v })} />
            <EditField label="302 Steuer" desc="Steuer Normalsatz" value={editForm.steuer302} onChange={(v) => setEditForm({ ...editForm, steuer302: v })} />
            <EditField label="312" desc={de.vatReturn.ziffer.z312} value={editForm.ziffer312} onChange={(v) => setEditForm({ ...editForm, ziffer312: v })} />
            <EditField label="312 Steuer" desc="Steuer red. Satz" value={editForm.steuer312} onChange={(v) => setEditForm({ ...editForm, steuer312: v })} />
            <EditField label="342" desc={de.vatReturn.ziffer.z342} value={editForm.ziffer342} onChange={(v) => setEditForm({ ...editForm, ziffer342: v })} />
            <EditField label="342 Steuer" desc="Steuer Sondersatz" value={editForm.steuer342} onChange={(v) => setEditForm({ ...editForm, steuer342: v })} />
            <EditField label="382" desc={de.vatReturn.ziffer.z382} value={editForm.ziffer382} onChange={(v) => setEditForm({ ...editForm, ziffer382: v })} />
            <EditField label="382 Steuer" desc="Steuer Bezugsteuer" value={editForm.steuer382} onChange={(v) => setEditForm({ ...editForm, steuer382: v })} />

            <p className="text-xs font-semibold text-muted-foreground pt-2">{de.vatReturn.section.inputVat}</p>
            <EditField label="400" desc={de.vatReturn.ziffer.z400} value={editForm.ziffer400} onChange={(v) => setEditForm({ ...editForm, ziffer400: v })} />
            <EditField label="405" desc={de.vatReturn.ziffer.z405} value={editForm.ziffer405} onChange={(v) => setEditForm({ ...editForm, ziffer405: v })} />
            <EditField label="410" desc={de.vatReturn.ziffer.z410} value={editForm.ziffer410} onChange={(v) => setEditForm({ ...editForm, ziffer410: v })} />
            <EditField label="415" desc={de.vatReturn.ziffer.z415} value={editForm.ziffer415} onChange={(v) => setEditForm({ ...editForm, ziffer415: v })} />
            <EditField label="420" desc={de.vatReturn.ziffer.z420} value={editForm.ziffer420} onChange={(v) => setEditForm({ ...editForm, ziffer420: v })} />
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSaveEdit}>{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper Components ──

function ZifferRow({ z, label, amount, subtract }: { z: string; label: string; amount: number; subtract?: boolean }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{z}</TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell className="text-right font-mono text-sm">
        {subtract && amount !== 0 ? "-" : ""}{fmtChf(Math.abs(amount))}
      </TableCell>
    </TableRow>
  );
}

function TaxRow({ z, label, base, tax }: { z: string; label: string; base: number; tax: number }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{z}</TableCell>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmtChf(base)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{fmtChf(tax)}</TableCell>
    </TableRow>
  );
}

function EditField({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm flex-1 truncate">{desc}</span>
      <Input
        type="number"
        step="0.01"
        className="w-36 text-right font-mono"
        value={value || "0"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
