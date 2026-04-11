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
  ArrowLeftRight, Zap, AlertTriangle, CheckCircle2, XCircle, Pencil,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, EmptyState, InfoPanel } from "@/components/ds";
import { useCompany } from "@/lib/contexts/company-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState<"accounts" | "vat">("accounts");
  const [accountFilter, setAccountFilter] = useState<"" | "unmapped" | "uncertain" | "mapped">("");

  // Inline edit state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editBananaNum, setEditBananaNum] = useState("");
  const [editBananaDesc, setEditBananaDesc] = useState("");
  const [editingVatId, setEditingVatId] = useState<string | null>(null);
  const [editVatCode, setEditVatCode] = useState("");
  const [editVatLabel, setEditVatLabel] = useState("");

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
      </div>

      {/* Tab 1: Account Mapping */}
      {activeTab === "accounts" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant={accountFilter === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountFilter("")}
              >
                {de.banana.allAccounts}
              </Button>
              <Button
                variant={accountFilter === "unmapped" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountFilter("unmapped")}
              >
                {de.banana.mappingStatus.unmapped}
              </Button>
              <Button
                variant={accountFilter === "uncertain" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountFilter("uncertain")}
              >
                {de.banana.mappingStatus.uncertain}
              </Button>
              <Button
                variant={accountFilter === "mapped" ? "default" : "outline"}
                size="sm"
                onClick={() => setAccountFilter("mapped")}
              >
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
                    <TableHead>Konto</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>{de.banana.bananaAccountNumber}</TableHead>
                    <TableHead>{de.banana.bananaDescription}</TableHead>
                    <TableHead>Status</TableHead>
                    {canMutate && <TableHead>Aktion</TableHead>}
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
                            <Input
                              value={editBananaNum}
                              onChange={(e) => setEditBananaNum(e.target.value)}
                              className="h-8 font-mono text-sm w-28"
                            />
                          ) : (
                            <span className="font-mono text-sm">{acc.bananaAccountNumber || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editBananaDesc}
                              onChange={(e) => setEditBananaDesc(e.target.value)}
                              className="h-8 text-sm w-40"
                            />
                          ) : (
                            <span className="text-sm">{acc.bananaDescription || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs font-medium", badge.className)}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        {canMutate && (
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="default" onClick={() => saveAccountMapping(acc.id, "mapped")}>
                                  {de.banana.setMapping}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => saveAccountMapping(acc.id, "uncertain")}>
                                  {de.banana.markUncertain}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingAccountId(null)}>
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEditAccount(acc)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>{de.banana.bananaVatCode}</TableHead>
                    <TableHead>{de.banana.bananaVatLabel}</TableHead>
                    <TableHead>Status</TableHead>
                    {canMutate && <TableHead>Aktion</TableHead>}
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
                            <Input
                              value={editVatCode}
                              onChange={(e) => setEditVatCode(e.target.value)}
                              className="h-8 font-mono text-sm w-24"
                            />
                          ) : (
                            <span className="font-mono text-sm">{vat.bananaVatCode || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editVatLabel}
                              onChange={(e) => setEditVatLabel(e.target.value)}
                              className="h-8 text-sm w-48"
                            />
                          ) : (
                            <span className="text-sm">{vat.bananaVatLabel || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs font-medium", badge.className)}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        {canMutate && (
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="default" onClick={() => saveVatMapping(vat.id)}>
                                  {de.banana.setMapping}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingVatId(null)}>
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEditVat(vat)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
    </div>
  );
}
