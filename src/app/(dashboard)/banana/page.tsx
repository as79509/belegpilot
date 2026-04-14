"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeftRight, Zap, AlertTriangle, CheckCircle2, XCircle, Pencil, Download, Search, Upload, RefreshCw,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, EmptyState, InfoPanel } from "@/components/ds";
import { FirstUseHint } from "@/components/ds/first-use-hint";
import { useCompany } from "@/lib/contexts/company-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RoundTripResult {
  totalRows: number;
  matched: number;
  modified: number;
  newInBanana: number;
  unmatched: number;
  importBatchId: string;
  deltas: Array<{ journalEntryId: string | null; field: string; bpValue: string | null; bananaValue: string | null }>;
  learnSignals: Array<{ type: string; message: string; frequency: number; suggestRuleUpdate: boolean }>;
}

interface RoundTripBatch {
  importBatchId: string;
  importedAt: string;
  totalRows: number;
  matched: number;
  modified: number;
  newInBanana: number;
  unmatched: number;
}

interface MappingOverview {
  accounts: {
    total: number; mapped: number; unmapped: number; uncertain: number; blocked: number; mappingRate: number;
  };
  vatCodes: {
    total: number; mapped: number; unmapped: number; uncertain: number; mappingRate: number;
  };
  exportReady: boolean;
  issues: Array<{
    type: string; message: string; accountNumber?: string; rate?: number; severity: "error" | "warning";
  }>;
}

interface MappingAccount {
  id: string;
  accountNumber: string;
  name: string;
  accountType: string;
  bananaAccountNumber: string | null;
  bananaDescription: string | null;
  bananaMappingStatus: string;
  bananaMappingNotes: string | null;
}

interface VatCode {
  id: string;
  internalRate: number;
  internalLabel: string;
  bananaVatCode: string | null;
  bananaVatLabel: string | null;
  mappingStatus: string;
  isDefault: boolean;
  notes: string | null;
}

interface ExportReadiness {
  ready: number;
  blocked: number;
  total: number;
  readyRate: number;
  issues: Array<{
    journalEntryId: string; entryDate: string; description: string;
    debitAccount: string; creditAccount: string; amount: number;
    reason: string; severity: "error";
  }>;
  topBlockReasons: Array<{ reason: string; count: number }>;
}



const BLOCK_REASON_LABEL: Record<string, string> = {
  debit_account_unmapped: de.banana.export.blockReasons.debit_account_unmapped,
  credit_account_unmapped: de.banana.export.blockReasons.credit_account_unmapped,
  vat_code_unmapped: de.banana.export.blockReasons.vat_code_unmapped,
  period_locked: de.banana.export.blockReasons.period_locked,
  entry_incomplete: de.banana.export.blockReasons.entry_incomplete,
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  mapped: { label: de.banana.mappingStatus.mapped, className: "bg-green-100 text-green-800" },
  unmapped: { label: de.banana.mappingStatus.unmapped, className: "bg-red-100 text-red-800" },
  uncertain: { label: de.banana.mappingStatus.uncertain, className: "bg-amber-100 text-amber-800" },
  blocked: { label: de.banana.mappingStatus.blocked, className: "bg-slate-100 text-slate-700" },
};

export default function BananaPage() {
  const { activeCompany, capabilities } = useCompany();
  const role = activeCompany?.role || "";
  const canMutate = capabilities?.canMutate?.integrations ?? (role === "admin" || role === "trustee");

  const [overview, setOverview] = useState<MappingOverview | null>(null);
  const [accounts, setAccounts] = useState<MappingAccount[]>([]);
  const [vatCodes, setVatCodes] = useState<VatCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoMapping, setAutoMapping] = useState(false);
  const [activeTab, setActiveTab] = useState<"accounts" | "vat" | "export" | "roundtrip">("export");
  const [accountFilter, setAccountFilter] = useState<"" | "unmapped" | "uncertain" | "mapped">("");

  // Inline edit state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editBananaNum, setEditBananaNum] = useState("");
  const [editBananaDesc, setEditBananaDesc] = useState("");
  const [editingVatId, setEditingVatId] = useState<string | null>(null);
  const [editVatCode, setEditVatCode] = useState("");
  const [editVatLabel, setEditVatLabel] = useState("");

  // Round Trip state
  const [rtImporting, setRtImporting] = useState(false);
  const [rtResult, setRtResult] = useState<RoundTripResult | null>(null);
  const [rtBatches, setRtBatches] = useState<RoundTripBatch[]>([]);
  const [rtLoadingBatches, setRtLoadingBatches] = useState(false);

  // Export tab state
  const now = new Date();
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/banana/mapping");
      if (res.ok) setOverview(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchAccounts = useCallback(async () => {
    const params = new URLSearchParams();
    if (accountFilter) params.set("status", accountFilter);
    try {
      const res = await fetch(`/api/banana/mapping/accounts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch { /* non-critical */ }
  }, [accountFilter]);

  const fetchVatCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/banana/mapping/vat-codes");
      if (res.ok) {
        const data = await res.json();
        setVatCodes(data.vatCodes);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOverview(), fetchAccounts(), fetchVatCodes()]);
    setLoading(false);
  }, [fetchOverview, fetchAccounts, fetchVatCodes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  async function handleAutoMap() {
    setAutoMapping(true);
    try {
      const res = await fetch("/api/banana/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_map" }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(
          de.banana.autoMapSuccess
            .replace("{mapped}", String(result.mapped))
            .replace("{skipped}", String(result.skipped))
        );
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error || "Auto-Mapping fehlgeschlagen");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAutoMapping(false);
    }
  }

  async function saveAccountMapping(accountId: string, status: "mapped" | "uncertain") {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bananaAccountNumber: editBananaNum || null,
          bananaDescription: editBananaDesc || null,
          bananaMappingStatus: status,
        }),
      });
      if (res.ok) {
        toast.success(de.banana.setMapping);
        setEditingAccountId(null);
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveVatMapping(vatId: string) {
    try {
      const res = await fetch("/api/banana/mapping/vat-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vatId,
          bananaVatCode: editVatCode || null,
          bananaVatLabel: editVatLabel || null,
          mappingStatus: editVatCode ? "mapped" : "unmapped",
        }),
      });
      if (res.ok) {
        toast.success(de.banana.setMapping);
        setEditingVatId(null);
        fetchAll();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function startEditAccount(acc: MappingAccount) {
    setEditingAccountId(acc.id);
    setEditBananaNum(acc.bananaAccountNumber || "");
    setEditBananaDesc(acc.bananaDescription || "");
  }

  function startEditVat(vat: VatCode) {
    setEditingVatId(vat.id);
    setEditVatCode(vat.bananaVatCode || "");
    setEditVatLabel(vat.bananaVatLabel || "");
  }

  async function handleCheckReadiness() {
    setCheckingReadiness(true);
    setReadiness(null);
    try {
      const res = await fetch(`/api/banana/export/readiness?year=${exportYear}&month=${exportMonth}`);
      if (res.ok) {
        setReadiness(await res.json());
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingReadiness(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/banana/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: exportYear, month: exportMonth }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const exportedCount = res.headers.get("X-Export-Count") || "0";
        const skippedCount = res.headers.get("X-Skipped-Count") || "0";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `banana-export-${exportYear}-${String(exportMonth).padStart(2, "0")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(
          de.banana.export.exportSuccess
            .replace("{count}", exportedCount)
            .replace("{skipped}", skippedCount)
        );
        handleCheckReadiness();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function fetchRoundTripBatches() {
    setRtLoadingBatches(true);
    try {
      const res = await fetch("/api/banana/round-trip");
      if (res.ok) {
        const data = await res.json();
        setRtBatches(data.batches);
      }
    } catch { /* non-critical */ }
    finally { setRtLoadingBatches(false); }
  }

  async function handleRoundTripImport(file: File) {
    setRtImporting(true);
    setRtResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/banana/round-trip", { method: "POST", body: formData });
      if (res.ok) {
        const result = await res.json();
        setRtResult(result);
        toast.success(de.banana.roundTrip.matched.replace("{count}", String(result.matched)) + " / " + de.banana.roundTrip.modified.replace("{count}", String(result.modified)));
        fetchRoundTripBatches();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRtImporting(false);
    }
  }

  const pct = (rate: number) => `${Math.round(rate * 100)}%`;

  const exportBadge = overview?.exportReady
    ? <Badge className="bg-green-100 text-green-800">{de.banana.exportReady}</Badge>
    : <Badge className="bg-amber-100 text-amber-800">{de.banana.exportNotReady}</Badge>;

  return (
    <div className="space-y-6">
      <EntityHeader
        title={de.banana.title}
        badge={overview ? exportBadge : undefined}
        primaryAction={canMutate && !autoMapping ? {
          label: de.banana.autoMap,
          onClick: handleAutoMap,
          icon: Zap,
        } : undefined}
      />

      <FirstUseHint
        id="banana-intro"
        title={de.banana.introTitle}
        description={de.banana.introDescription}
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : overview ? (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">{de.banana.accountMapping}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{overview.accounts.mapped}</span>
                  <span className="text-sm text-muted-foreground">/ {overview.accounts.total}</span>
                  <span className="text-sm font-medium">{de.banana.mappingStatus.mapped}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: pct(overview.accounts.mappingRate) }}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                  {overview.accounts.uncertain > 0 && (
                    <span className="text-amber-600">{overview.accounts.uncertain} {de.banana.mappingStatus.uncertain}</span>
                  )}
                  {overview.accounts.unmapped > 0 && (
                    <span className="text-red-600">{overview.accounts.unmapped} {de.banana.mappingStatus.unmapped}</span>
                  )}
                  {overview.accounts.blocked > 0 && (
                    <span>{overview.accounts.blocked} {de.banana.mappingStatus.blocked}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">{de.banana.vatCodeMapping}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{overview.vatCodes.mapped}</span>
                  <span className="text-sm text-muted-foreground">/ {overview.vatCodes.total}</span>
                  <span className="text-sm font-medium">{de.banana.mappingStatus.mapped}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: pct(overview.vatCodes.mappingRate) }}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                  {overview.vatCodes.uncertain > 0 && (
                    <span className="text-amber-600">{overview.vatCodes.uncertain} {de.banana.mappingStatus.uncertain}</span>
                  )}
                  {overview.vatCodes.unmapped > 0 && (
                    <span className="text-red-600">{overview.vatCodes.unmapped} {de.banana.mappingStatus.unmapped}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">{de.banana.exportReadiness}</h3>
                <div className="mt-2 flex items-center gap-2">
                  {overview.exportReady ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <span className="text-lg font-semibold text-green-700">{de.banana.exportReady}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-amber-600" />
                      <span className="text-lg font-semibold text-amber-700">{de.banana.exportNotReady}</span>
                    </>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p>{de.banana.accountMapping}: {pct(overview.accounts.mappingRate)}</p>
                  <p>{de.banana.vatCodeMapping}: {pct(overview.vatCodes.mappingRate)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues Panel */}
          {overview.issues.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold mb-3">{de.banana.issues.title}</h3>
                <div className="space-y-2">
                  {overview.issues.map((issue, i) => (
                    <InfoPanel
                      key={i}
                      tone={issue.severity === "error" ? "error" : "warning"}
                      icon={AlertTriangle}
                    >
                      {issue.message}
                    </InfoPanel>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {overview.issues.length === 0 && (
            <InfoPanel tone="success" icon={CheckCircle2}>
              {de.banana.issues.noIssues}
            </InfoPanel>
          )}
        </>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "accounts" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("accounts")}
        >
          {de.banana.accountMapping}
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "vat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("vat")}
        >
          {de.banana.vatCodeMapping}
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "export" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("export")}
        >
          {de.banana.export.title}
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "roundtrip" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setActiveTab("roundtrip"); fetchRoundTripBatches(); }}
        >
          {de.banana.roundTrip.title}
        </button>
      </div>

      {/* Tab 1: Account Mapping */}
      {activeTab === "accounts" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant={accountFilter === "" ? "default" : "outline"} size="sm" onClick={() => setAccountFilter("")}>
                {de.banana.allAccounts}
              </Button>
              <Button variant={accountFilter === "unmapped" ? "default" : "outline"} size="sm" onClick={() => setAccountFilter("unmapped")}>
                {de.banana.mappingStatus.unmapped}
              </Button>
              <Button variant={accountFilter === "uncertain" ? "default" : "outline"} size="sm" onClick={() => setAccountFilter("uncertain")}>
                {de.banana.mappingStatus.uncertain}
              </Button>
              <Button variant={accountFilter === "mapped" ? "default" : "outline"} size="sm" onClick={() => setAccountFilter("mapped")}>
                {de.banana.mappingStatus.mapped}
              </Button>
            </div>

            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : accounts.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title={de.banana.unmappedOnly} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{de.banana.accountLabel}</TableHead>
                    <TableHead>{de.banana.nameLabel}</TableHead>
                    <TableHead>{de.banana.bananaAccountNumber}</TableHead>
                    <TableHead>{de.banana.bananaDescription}</TableHead>
                    <TableHead>{de.banana.statusLabel}</TableHead>
                    {canMutate && <TableHead>{de.banana.actionLabel}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => {
                    const badge = STATUS_BADGE[acc.bananaMappingStatus] ?? STATUS_BADGE.unmapped;
                    const isEditing = editingAccountId === acc.id;
                    return (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-sm">{acc.accountNumber}</TableCell>
                        <TableCell className="text-sm">{acc.name}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editBananaNum} onChange={(e) => setEditBananaNum(e.target.value)} className="h-8 font-mono text-sm w-28" />
                          ) : (
                            <span className="font-mono text-sm">{acc.bananaAccountNumber || "\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editBananaDesc} onChange={(e) => setEditBananaDesc(e.target.value)} className="h-8 text-sm w-40" />
                          ) : (
                            <span className="text-sm">{acc.bananaDescription || "\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs font-medium", badge.className)}>{badge.label}</Badge>
                        </TableCell>
                        {canMutate && (
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="default" onClick={() => saveAccountMapping(acc.id, "mapped")}>{de.banana.setMapping}</Button>
                                <Button size="sm" variant="outline" onClick={() => saveAccountMapping(acc.id, "uncertain")}>{de.banana.markUncertain}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingAccountId(null)}>{de.common.cancel}</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEditAccount(acc)}><Pencil className="h-3.5 w-3.5" /></Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: VAT Code Mapping */}
      {activeTab === "vat" && (
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : vatCodes.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title={de.banana.vatCodeMapping} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{de.banana.internalRate}</TableHead>
                    <TableHead>{de.banana.nameLabel}</TableHead>
                    <TableHead>{de.banana.bananaVatCode}</TableHead>
                    <TableHead>{de.banana.bananaVatLabel}</TableHead>
                    <TableHead>{de.banana.statusLabel}</TableHead>
                    {canMutate && <TableHead>{de.banana.actionLabel}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vatCodes.map((vat) => {
                    const badge = STATUS_BADGE[vat.mappingStatus] ?? STATUS_BADGE.unmapped;
                    const isEditing = editingVatId === vat.id;
                    return (
                      <TableRow key={vat.id}>
                        <TableCell className="font-mono text-sm">{vat.internalRate}%</TableCell>
                        <TableCell className="text-sm">{vat.internalLabel}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editVatCode} onChange={(e) => setEditVatCode(e.target.value)} className="h-8 font-mono text-sm w-24" />
                          ) : (
                            <span className="font-mono text-sm">{vat.bananaVatCode || "\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editVatLabel} onChange={(e) => setEditVatLabel(e.target.value)} className="h-8 text-sm w-48" />
                          ) : (
                            <span className="text-sm">{vat.bananaVatLabel || "\u2014"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs font-medium", badge.className)}>{badge.label}</Badge>
                        </TableCell>
                        {canMutate && (
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="default" onClick={() => saveVatMapping(vat.id)}>{de.banana.setMapping}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingVatId(null)}>{de.common.cancel}</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEditVat(vat)}><Pencil className="h-3.5 w-3.5" /></Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Export */}
      {activeTab === "export" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-end gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{de.banana.export.selectPeriod}</label>
                  <div className="flex gap-2">
                    <select className="h-9 border rounded-md px-2 text-sm bg-white w-24" value={exportMonth} onChange={(e) => setExportMonth(parseInt(e.target.value, 10))}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{(i + 1).toString().padStart(2, "0")}</option>
                      ))}
                    </select>
                    <select className="h-9 border rounded-md px-2 text-sm bg-white w-28" value={exportYear} onChange={(e) => setExportYear(parseInt(e.target.value, 10))}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const y = now.getFullYear() - 2 + i;
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <Button onClick={handleCheckReadiness} variant="outline">
                  <Search className="h-4 w-4 mr-1.5" />
                  {de.banana.export.checkReadiness}
                </Button>
              </div>
            </CardContent>
          </Card>

          {checkingReadiness && (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          )}

          {readiness && !checkingReadiness && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">{de.banana.export.ready.replace("{count}", String(readiness.ready))}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      {readiness.blocked > 0 ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      <span className={cn("text-sm font-medium", readiness.blocked > 0 && "text-red-700")}>
                        {de.banana.export.blocked.replace("{count}", String(readiness.blocked))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground mb-1">{de.banana.export.exportRate}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">{pct(readiness.readyRate)}</span>
                      <span className="text-xs text-muted-foreground">{readiness.ready} / {readiness.total}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-2 rounded-full transition-all", readiness.readyRate >= 0.9 ? "bg-green-500" : readiness.readyRate >= 0.5 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: pct(readiness.readyRate) }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {readiness.topBlockReasons.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-sm font-semibold mb-2">{de.banana.export.topBlockReasons}</h3>
                    <div className="flex flex-wrap gap-2">
                      {readiness.topBlockReasons.map((r) => (
                        <Badge key={r.reason} variant="secondary" className="bg-red-100 text-red-800">
                          {BLOCK_REASON_LABEL[r.reason] || r.reason} ({r.count})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {readiness.issues.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="text-sm font-semibold mb-3">{de.banana.issues.title}</h3>
                    <div className="max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{de.banana.dateLabel}</TableHead>
                            <TableHead>{de.banana.nameLabel}</TableHead>
                            <TableHead>{de.banana.debitLabel}</TableHead>
                            <TableHead>{de.banana.creditLabel}</TableHead>
                            <TableHead className="text-right">{de.vatReturn.amount}</TableHead>
                            <TableHead>{de.banana.reasonLabel}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {readiness.issues.slice(0, 50).map((issue, i) => (
                            <TableRow key={`${issue.journalEntryId}-${issue.reason}-${i}`}>
                              <TableCell className="text-sm">{issue.entryDate}</TableCell>
                              <TableCell className="text-sm max-w-48 truncate">{issue.description}</TableCell>
                              <TableCell className="font-mono text-sm">{issue.debitAccount}</TableCell>
                              <TableCell className="font-mono text-sm">{issue.creditAccount}</TableCell>
                              <TableCell className="text-sm text-right">{issue.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                                  {BLOCK_REASON_LABEL[issue.reason] || issue.reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {readiness.issues.length > 50 && (
                      <p className="text-xs text-muted-foreground mt-2">{de.banana.moreIssues.replace("{count}", String(readiness.issues.length - 50))}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {readiness.total === 0 && (
                <EmptyState icon={ArrowLeftRight} title={de.banana.export.noEntries} />
              )}

              {readiness.ready > 0 && canMutate && (
                <div className="flex justify-end">
                  <Button onClick={handleExport} size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? de.banana.exporting : de.banana.export.generate}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 4: Round Trip */}
      {activeTab === "roundtrip" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-semibold mb-3">{de.banana.roundTrip.import}</h3>
              <p className="text-xs text-muted-foreground mb-3">{de.banana.roundTrip.importHint}</p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRoundTripImport(f); e.target.value = ""; }} disabled={rtImporting || !canMutate} />
                <span className={cn("inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium", rtImporting || !canMutate ? "bg-primary/50 text-primary-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
                  <Upload className="h-4 w-4" />
                  {rtImporting ? de.banana.roundTrip.importing : de.banana.roundTrip.import}
                </span>
              </label>
            </CardContent>
          </Card>

          {rtResult && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-sm font-medium">{de.banana.roundTrip.matched.replace("{count}", String(rtResult.matched))}</span></div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><RefreshCw className={cn("h-5 w-5", rtResult.modified > 0 ? "text-amber-600" : "text-green-600")} /><span className={cn("text-sm font-medium", rtResult.modified > 0 && "text-amber-700")}>{de.banana.roundTrip.modified.replace("{count}", String(rtResult.modified))}</span></div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">{de.banana.roundTrip.newInBanana.replace("{count}", String(rtResult.newInBanana))}</span></div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="flex items-center gap-2">{rtResult.unmatched > 0 ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}<span className={cn("text-sm font-medium", rtResult.unmatched > 0 && "text-red-700")}>{de.banana.roundTrip.unmatched.replace("{count}", String(rtResult.unmatched))}</span></div></CardContent></Card>
              </div>
              {rtResult.deltas.length > 0 && (
                <Card><CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-3">{de.banana.roundTrip.deltas}</h3>
                  <div className="max-h-80 overflow-y-auto">
                    <Table><TableHeader><TableRow><TableHead>{de.banana.roundTrip.field}</TableHead><TableHead>{de.banana.roundTrip.bpValue}</TableHead><TableHead>{de.banana.roundTrip.bananaValue}</TableHead></TableRow></TableHeader>
                      <TableBody>{rtResult.deltas.map((d, i) => (<TableRow key={i}><TableCell className="text-sm font-medium">{d.field}</TableCell><TableCell className="font-mono text-sm">{d.bpValue || "\u2014"}</TableCell><TableCell className="font-mono text-sm">{d.bananaValue || "\u2014"}</TableCell></TableRow>))}</TableBody>
                    </Table>
                  </div>
                </CardContent></Card>
              )}
              {rtResult.learnSignals.length > 0 && (
                <Card><CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-3">{de.banana.roundTrip.learnSignals}</h3>
                  <div className="space-y-2">
                    {rtResult.learnSignals.map((signal, i) => (
                      <InfoPanel key={i} tone={signal.suggestRuleUpdate ? "warning" : "info"} icon={AlertTriangle}>
                        <div className="flex items-center justify-between w-full">
                          <span>{signal.message}</span>
                          {signal.suggestRuleUpdate && <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs ml-2">{de.banana.roundTrip.suggestRuleUpdate}</Badge>}
                        </div>
                      </InfoPanel>
                    ))}
                  </div>
                </CardContent></Card>
              )}
            </>
          )}

          <Card><CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">{de.banana.roundTrip.importHistory}</h3>
            <InfoPanel tone="info" icon={RefreshCw}>
              {de.banana.roundTrip.importHistoryHint}
            </InfoPanel>
            {rtLoadingBatches ? <Skeleton className="h-20 w-full" /> : rtBatches.length === 0 ? <EmptyState icon={RefreshCw} title={de.banana.roundTrip.noImports} /> : (
              <Table><TableHeader><TableRow><TableHead>{de.banana.roundTrip.batch}</TableHead><TableHead>{de.banana.dateLabel}</TableHead><TableHead>{de.banana.roundTrip.rows}</TableHead><TableHead>{de.banana.roundTrip.matched.replace("{count}", "").trim()}</TableHead><TableHead>{de.banana.roundTrip.modified.replace("{count}", "").trim()}</TableHead><TableHead>{de.banana.roundTrip.unmatched.replace("{count}", "").trim()}</TableHead></TableRow></TableHeader>
                <TableBody>{rtBatches.map((batch) => (
                  <TableRow key={batch.importBatchId}>
                    <TableCell className="font-mono text-xs">{batch.importBatchId.slice(0, 8)}\u2026</TableCell>
                    <TableCell className="text-sm">{new Date(batch.importedAt).toLocaleDateString("de-CH")}</TableCell>
                    <TableCell className="text-sm">{batch.totalRows}</TableCell>
                    <TableCell><Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">{batch.matched}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-xs", batch.modified > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800")}>{batch.modified}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-xs", batch.unmatched > 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")}>{batch.unmatched}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
