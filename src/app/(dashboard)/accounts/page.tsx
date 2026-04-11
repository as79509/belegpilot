"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Landmark, Plus, Upload, Pencil, Check, Minus, ChevronRight, ChevronDown, Loader2, ArrowUpDown,
} from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, FilterBar, EmptyState } from "@/components/ds";
import { useCompany } from "@/lib/contexts/company-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  accountNumber: string;
  name: string;
  accountType: string;
  category: string | null;
  parentNumber: string | null;
  aiGovernance: string;
  allowedDocTypes: string[] | null;
  allowedVatCodes: string[] | null;
  bananaAccountNumber: string | null;
  bananaDescription: string | null;
  isActive: boolean;
  notes: string | null;
  bclass: number | null;
  groupCode: string | null;
  currency: string | null;
  sortOrder: number | null;
}

interface AccountStats {
  accountNumber: string;
  name: string;
  accountType: string;
  aiGovernance: string;
  documentCount: number;
  journalCount: number;
  suggestionCount: number;
  correctionCount: number;
  lastUsedAt: string | null;
}

type SortKey = "documentCount" | "journalCount" | "suggestionCount" | "correctionCount" | "lastUsedAt" | null;

const GOVERNANCE_BADGE: Record<string, { label: string; className: string }> = {
  ai_suggest: { label: de.accounts.governance.ai_suggest, className: "bg-green-100 text-green-800" },
  ai_autopilot: { label: de.accounts.governance.ai_autopilot, className: "bg-blue-100 text-blue-800" },
  manual_only: { label: de.accounts.governance.manual_only, className: "bg-amber-100 text-amber-800" },
  locked: { label: de.accounts.governance.locked, className: "bg-red-100 text-red-800" },
};

const TYPE_OPTIONS = [
  { value: "asset", label: de.accounts.types.asset },
  { value: "liability", label: de.accounts.types.liability },
  { value: "equity", label: de.accounts.types.equity },
  { value: "revenue", label: de.accounts.types.revenue },
  { value: "expense", label: de.accounts.types.expense },
];

const GOVERNANCE_OPTIONS = [
  { value: "ai_suggest", label: de.accounts.governance.ai_suggest },
  { value: "ai_autopilot", label: de.accounts.governance.ai_autopilot },
  { value: "manual_only", label: de.accounts.governance.manual_only },
  { value: "locked", label: de.accounts.governance.locked },
];

const DOC_TYPES = [
  { value: "invoice", label: de.documentType.invoice },
  { value: "credit_note", label: de.documentType.credit_note },
  { value: "receipt", label: de.documentType.receipt },
  { value: "reminder", label: de.documentType.reminder },
  { value: "other", label: de.documentType.other },
];

const VAT_CODES = ["8.1", "2.6", "3.8", "0.0"];

export default function AccountsPage() {
  const { activeCompany, capabilities } = useCompany();
  const role = activeCompany?.role || "";
  const canMutate = capabilities?.canMutate?.accounts ?? (role === "admin");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [governanceFilter, setGovernanceFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [treeView, setTreeView] = useState(false);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [statsMap, setStatsMap] = useState<Record<string, AccountStats>>({});
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    accountNumber: "",
    name: "",
    accountType: "expense",
    category: "",
    parentNumber: "",
    aiGovernance: "ai_suggest",
    allowedDocTypes: [] as string[],
    allowedVatCodes: [] as string[],
    bananaAccountNumber: "",
    bananaDescription: "",
    notes: "",
  });

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: any[] } | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (governanceFilter) params.set("governance", governanceFilter);
    if (!showInactive) params.set("active", "true");
    try {
      const res = await fetch(`/api/accounts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("[Accounts] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, governanceFilter, showInactive]);

  const fetchDocCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts/doc-counts");
      if (res.ok) {
        const data = await res.json();
        setDocCounts(data.counts || {});
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts/stats");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, AccountStats> = {};
        for (const s of data.accounts) {
          map[s.accountNumber] = s;
        }
        setStatsMap(map);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchDocCounts(); }, [fetchDocCounts]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  function openCreate() {
    setEditAccount(null);
    setForm({
      accountNumber: "", name: "", accountType: "expense", category: "",
      parentNumber: "", aiGovernance: "ai_suggest", allowedDocTypes: [],
      allowedVatCodes: [], bananaAccountNumber: "", bananaDescription: "", notes: "",
    });
    setEditOpen(true);
  }

  function openEdit(acc: Account) {
    setEditAccount(acc);
    setForm({
      accountNumber: acc.accountNumber,
      name: acc.name,
      accountType: acc.accountType,
      category: acc.category || "",
      parentNumber: acc.parentNumber || "",
      aiGovernance: acc.aiGovernance,
      allowedDocTypes: acc.allowedDocTypes || [],
      allowedVatCodes: acc.allowedVatCodes || [],
      bananaAccountNumber: acc.bananaAccountNumber || "",
      bananaDescription: acc.bananaDescription || "",
      notes: acc.notes || "",
    });
    setEditOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        accountType: form.accountType,
        category: form.category || null,
        parentNumber: form.parentNumber || null,
        aiGovernance: form.aiGovernance,
        allowedDocTypes: form.allowedDocTypes.length > 0 ? form.allowedDocTypes : null,
        allowedVatCodes: form.allowedVatCodes.length > 0 ? form.allowedVatCodes : null,
        bananaAccountNumber: form.bananaAccountNumber || null,
        bananaDescription: form.bananaDescription || null,
        notes: form.notes || null,
      };

      let res: Response;
      if (editAccount) {
        res = await fetch(`/api/accounts/${editAccount.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.accountNumber = form.accountNumber;
        res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast.success(de.accounts.saveSuccess);
        setEditOpen(false);
        fetchAccounts();
      } else {
        const err = await res.json();
        toast.error(err.error || "Fehler beim Speichern");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/accounts/import", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        toast.success(`${de.accounts.import.success}: ${data.created} ${de.accounts.import.created}, ${data.updated} ${de.accounts.import.updated}`);
        fetchAccounts();
      } else {
        toast.error(data.error || "Import fehlgeschlagen");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  function toggleDocType(val: string) {
    setForm(f => ({
      ...f,
      allowedDocTypes: f.allowedDocTypes.includes(val)
        ? f.allowedDocTypes.filter(v => v !== val)
        : [...f.allowedDocTypes, val],
    }));
  }

  function toggleVatCode(val: string) {
    setForm(f => ({
      ...f,
      allowedVatCodes: f.allowedVatCodes.includes(val)
        ? f.allowedVatCodes.filter(v => v !== val)
        : [...f.allowedVatCodes, val],
    }));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SIX_MONTHS_AGO = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const sortedAccounts = sortKey
    ? [...accounts].sort((a, b) => {
        const sa = statsMap[a.accountNumber];
        const sb = statsMap[b.accountNumber];
        let va: number | string = 0;
        let vb: number | string = 0;
        if (sortKey === "lastUsedAt") {
          va = sa?.lastUsedAt || "";
          vb = sb?.lastUsedAt || "";
        } else {
          va = sa?.[sortKey] || 0;
          vb = sb?.[sortKey] || 0;
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
    : accounts;

  // Tree grouping
  const grouped = treeView
    ? (() => {
        const roots: Account[] = [];
        const children: Record<string, Account[]> = {};
        for (const acc of sortedAccounts) {
          if (acc.parentNumber) {
            if (!children[acc.parentNumber]) children[acc.parentNumber] = [];
            children[acc.parentNumber].push(acc);
          } else {
            roots.push(acc);
          }
        }
        return { roots, children };
      })()
    : null;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleExpand(num: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  }

  function renderRow(acc: Account, indent = 0, hasChildren = false) {
    const gov = GOVERNANCE_BADGE[acc.aiGovernance] || GOVERNANCE_BADGE.ai_suggest;
    const hasBanana = !!acc.bananaAccountNumber;
    const stats = statsMap[acc.accountNumber];
    const docCount = stats?.documentCount ?? docCounts[acc.accountNumber] ?? 0;
    const journalCount = stats?.journalCount ?? 0;
    const suggestionCount = stats?.suggestionCount ?? 0;
    const correctionCount = stats?.correctionCount ?? 0;
    const lastUsedAt = stats?.lastUsedAt ?? null;
    const typeLabel = TYPE_OPTIONS.find(t => t.value === acc.accountType)?.label || acc.accountType;
    const isExpanded = expandedGroups.has(acc.accountNumber);
    const isHighCorrection = correctionCount > 3;
    const isUnused = !lastUsedAt || lastUsedAt < SIX_MONTHS_AGO;

    return (
      <TableRow
        key={acc.id}
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          !acc.isActive && "opacity-50",
          isHighCorrection && "bg-amber-50",
          !isHighCorrection && isUnused && docCount === 0 && "bg-muted/30"
        )}
        onClick={() => canMutate && openEdit(acc)}
      >
        <TableCell>
          <div className="flex items-center" style={{ paddingLeft: indent * 20 }}>
            {treeView && hasChildren && (
              <button
                type="button"
                className="mr-1 p-0.5 hover:bg-muted rounded"
                onClick={(e) => { e.stopPropagation(); toggleExpand(acc.accountNumber); }}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {treeView && !hasChildren && <span className="w-5" />}
            <span className="font-mono text-sm">{acc.accountNumber}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm">{acc.name}</TableCell>
        <TableCell className="text-xs">{typeLabel}</TableCell>
        <TableCell>
          <Badge variant="secondary" className={cn("text-xs font-medium", gov.className)}>
            {gov.label}
          </Badge>
        </TableCell>
        <TableCell className="text-center text-sm">{docCount}</TableCell>
        <TableCell className="text-center text-sm">{journalCount}</TableCell>
        <TableCell className="text-center text-sm">{suggestionCount}</TableCell>
        <TableCell className={cn("text-center text-sm", isHighCorrection && "text-amber-700 font-medium")}>
          {correctionCount}
        </TableCell>
        <TableCell className="text-center text-xs text-muted-foreground">
          {lastUsedAt
            ? new Date(lastUsedAt).toLocaleDateString("de-CH")
            : <span className="text-muted-foreground/60">Ungenutzt</span>
          }
        </TableCell>
        <TableCell className="text-center">
          {hasBanana ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
        </TableCell>
        <TableCell className="text-center">
          {acc.isActive ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
        </TableCell>
      </TableRow>
    );
  }

  function renderTreeRows() {
    if (!grouped) return null;
    const rows: React.ReactNode[] = [];
    for (const root of grouped.roots) {
      const kids = grouped.children[root.accountNumber];
      rows.push(renderRow(root, 0, !!kids?.length));
      if (kids?.length && expandedGroups.has(root.accountNumber)) {
        for (const child of kids) {
          rows.push(renderRow(child, 1, false));
        }
      }
    }
    return rows;
  }

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setGovernanceFilter("");
    setShowInactive(false);
  };

  return (
    <div className="space-y-6">
      <EntityHeader
        title={de.accounts.title}
        badge={<Badge variant="secondary">{accounts.length} Konten</Badge>}
        primaryAction={canMutate ? { label: de.accounts.addAccount, onClick: openCreate, icon: Plus } : undefined}
        secondaryActions={canMutate ? [{ label: de.accounts.import.title, onClick: () => { setImportFile(null); setImportResult(null); setImportOpen(true); }, icon: Upload }] : undefined}
      />

      <FilterBar
        searchValue={search}
        onSearchChange={(v) => setSearch(v)}
        searchPlaceholder={de.accounts.search}
        filters={[
          {
            key: "type",
            label: de.accounts.accountType,
            options: TYPE_OPTIONS,
            value: typeFilter,
            onChange: setTypeFilter,
          },
          {
            key: "governance",
            label: de.accounts.aiGovernance,
            options: GOVERNANCE_OPTIONS,
            value: governanceFilter,
            onChange: setGovernanceFilter,
          },
        ]}
        onClear={clearFilters}
        rightExtra={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(!!v)} />
              Inaktive zeigen
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={treeView} onCheckedChange={(v) => setTreeView(!!v)} />
              Hierarchie
            </label>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead><TableHead>Bezeichnung</TableHead>
                  <TableHead>Typ</TableHead><TableHead>AI</TableHead>
                  <TableHead className="text-center">Belege</TableHead>
                  <TableHead className="text-center">Buchungen</TableHead>
                  <TableHead className="text-center">Vorschl.</TableHead>
                  <TableHead className="text-center">Korr.</TableHead>
                  <TableHead className="text-center">Letzte Nutzung</TableHead>
                  <TableHead className="text-center">Banana</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title={de.accounts.noAccounts}
              action={canMutate ? { label: de.accounts.import.title, onClick: () => { setImportFile(null); setImportResult(null); setImportOpen(true); }, icon: Upload } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>AI</TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("documentCount")}>
                    <span className="inline-flex items-center gap-1">Belege <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("journalCount")}>
                    <span className="inline-flex items-center gap-1">Buchungen <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("suggestionCount")}>
                    <span className="inline-flex items-center gap-1">Vorschl. <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("correctionCount")}>
                    <span className="inline-flex items-center gap-1">Korr. <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("lastUsedAt")}>
                    <span className="inline-flex items-center gap-1">Letzte Nutzung <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="text-center">Banana</TableHead>
                  <TableHead className="text-center">Aktiv</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treeView
                  ? renderTreeRows()
                  : sortedAccounts.map((acc) => renderRow(acc))
                }
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editAccount ? de.accounts.editAccount : de.accounts.addAccount}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <Label>{de.accounts.accountNumber}</Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                disabled={!!editAccount}
                className="font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{de.accounts.name}</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{de.accounts.accountType}</Label>
                <select className="h-9 border rounded-md px-2 text-sm bg-white w-full" value={form.accountType} onChange={(e) => setForm(f => ({ ...f, accountType: e.target.value }))}>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>{de.accounts.category}</Label>
                <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{de.accounts.parentNumber}</Label>
              <Input value={form.parentNumber} onChange={(e) => setForm(f => ({ ...f, parentNumber: e.target.value }))} placeholder="z.B. 6000" className="font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label>{de.accounts.aiGovernance}</Label>
              <div className="flex flex-col gap-1.5">
                {GOVERNANCE_OPTIONS.map(o => (
                  <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="governance" value={o.value} checked={form.aiGovernance === o.value} onChange={() => setForm(f => ({ ...f, aiGovernance: o.value }))} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{de.accounts.allowedDocTypes}</Label>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map(d => (
                  <label key={d.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.allowedDocTypes.includes(d.value)} onCheckedChange={() => toggleDocType(d.value)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{de.accounts.allowedVatCodes}</Label>
              <div className="flex flex-wrap gap-2">
                {VAT_CODES.map(v => (
                  <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.allowedVatCodes.includes(v)} onCheckedChange={() => toggleVatCode(v)} />
                    {v}%
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{de.accounts.bananaMapping}</Label>
                <Input value={form.bananaAccountNumber} onChange={(e) => setForm(f => ({ ...f, bananaAccountNumber: e.target.value }))} placeholder="Banana-Kontonr." className="font-mono" />
              </div>
              <div className="grid gap-1.5">
                <Label>Banana-Bezeichnung</Label>
                <Input value={form.bananaDescription} onChange={(e) => setForm(f => ({ ...f, bananaDescription: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notizen</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{de.accounts.import.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{de.accounts.import.description}</p>
          <div className="grid gap-3 py-2">
            <Input
              type="file"
              accept=".txt,.csv,.tsv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            {importResult && (
              <div className="text-sm space-y-1 p-3 bg-muted rounded-md">
                <p>{importResult.created} {de.accounts.import.created}, {importResult.updated} {de.accounts.import.updated}</p>
                {importResult.errors.length > 0 && (
                  <p className="text-destructive">{importResult.errors.length} {de.accounts.import.errors}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button onClick={handleImport} disabled={importing || !importFile}>
              {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
