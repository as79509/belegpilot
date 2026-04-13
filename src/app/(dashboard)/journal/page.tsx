"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ds";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, BookOpen, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate, formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const SOURCE_COLORS: Record<string, string> = {
  document: "bg-blue-100 text-blue-800",
  recurring: "bg-green-100 text-green-800",
  depreciation: "bg-amber-100 text-amber-800",
  manual: "bg-gray-100 text-gray-800",
  autopilot: "bg-purple-100 text-purple-800",
};

function entryToSource(e: any): string {
  if (e?.entryType === "document" || e?.documentId) return "document";
  if (e?.entryType === "recurring" || e?.isRecurring || e?.recurringId) return "recurring";
  if (e?.entryType === "depreciation") return "depreciation";
  if (e?.entryType === "autopilot") return "autopilot";
  return "manual";
}

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().split("T")[0],
    debitAccount: "", creditAccount: "", amount: "", vatAmount: "",
    description: "", reference: "", entryType: "manual",
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "200" });
    if (typeFilter) params.set("entryType", typeFilter);
    if (periodFilter) {
      // periodFilter format: YYYY-MM
      const [year, month] = periodFilter.split("-").map(Number);
      const from = new Date(Date.UTC(year, month - 1, 1));
      const to = new Date(Date.UTC(year, month, 0));
      params.set("dateFrom", from.toISOString().split("T")[0]);
      params.set("dateTo", to.toISOString().split("T")[0]);
    }
    try {
      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) { const d = await res.json(); setEntries(d.entries || []); }
    } catch {} finally { setLoading(false); }
  }, [typeFilter, periodFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Build period dropdown from entries (last 18 months relative to today)
  const periodOptions = useMemo(() => {
    const now = new Date();
    const opts: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("de-CH", { month: "long", year: "numeric" });
      opts.push({ value, label });
    }
    return opts;
  }, []);

  // Apply client-side source/search filters
  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (sourceFilter && entryToSource(e) !== sourceFilter) return false;
      if (term) {
        const haystack = [
          e.description || "",
          e.debitAccount || "",
          e.creditAccount || "",
          e.reference || "",
          String(e.amount ?? ""),
        ].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [entries, sourceFilter, search]);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), vatAmount: form.vatAmount ? parseFloat(form.vatAmount) : null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.journal.saveSuccess);
      setDialogOpen(false);
      setForm({ entryDate: new Date().toISOString().split("T")[0], debitAccount: "", creditAccount: "", amount: "", vatAmount: "", description: "", reference: "", entryType: "manual" });
      fetchEntries();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function toggleExpand(entry: any) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    if (history[entry.id]) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/audit-log/entity?entityType=journal_entry&entityId=${entry.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory((prev) => ({ ...prev, [entry.id]: data.entries || [] }));
      }
    } catch {} finally { setHistoryLoading(false); }
  }

  const total = filteredEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.journal.title}</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.journal.newEntry}</Button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">{de.journalDeep.filterByType}</Label>
          <select
            className="block border rounded-md px-3 py-1.5 text-sm bg-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">{de.journalDeep.allSources}</option>
            {Object.entries(de.journal.types).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{de.journalDeep.filterByPeriod}</Label>
          <select
            className="block border rounded-md px-3 py-1.5 text-sm bg-white"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="">{de.journalDeep.allPeriods}</option>
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{de.journalDeep.filterBySource}</Label>
          <select
            className="block border rounded-md px-3 py-1.5 text-sm bg-white"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">{de.journalDeep.allSources}</option>
            {Object.entries(de.journalDeep.sources).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">{de.documents.search}</Label>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={de.journalDeep.searchPlaceholder}
            className="text-sm"
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12"><BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{de.journal.noEntries}</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{de.journal.entryDate}</TableHead>
                  <TableHead>{de.journal.description}</TableHead>
                  <TableHead>{de.journal.debitAccount}</TableHead>
                  <TableHead>{de.journal.creditAccount}</TableHead>
                  <TableHead className="text-right">{de.journal.amount}</TableHead>
                  <TableHead>MwSt</TableHead>
                  <TableHead>{de.journalDeep.source}</TableHead>
                  <TableHead>{de.journalDeep.documentRef}</TableHead>
                  <TableHead>{de.journalDeep.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((e: any) => {
                  const source = entryToSource(e);
                  const sourceLabel = de.journalDeep.sources[source] || source;
                  const expanded = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleExpand(e)}
                      >
                        <TableCell>
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(e.entryDate)}</TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate">{e.description}</TableCell>
                        <TableCell className="font-mono text-xs">{e.debitAccount}</TableCell>
                        <TableCell className="font-mono text-xs">{e.creditAccount}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-right">{formatCurrency(e.amount, e.currency || "CHF")}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.vatAmount != null ? formatCurrency(e.vatAmount, e.currency || "CHF") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${SOURCE_COLORS[source] || ""}`}>
                            {sourceLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {e.documentId ? (
                            <Link
                              href={`/documents/${e.documentId}`}
                              className="text-blue-600 hover:underline font-mono"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {e.document?.documentNumber || "BP-" + String(e.documentId).slice(0, 8)}
                            </Link>
                          ) : source === "recurring" ? (
                            <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                              {de.journalDeep.sources.recurring}
                            </Badge>
                          ) : source === "depreciation" ? (
                            <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-800">
                              {de.journalDeep.sources.depreciation}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{de.journalDeep.noRef}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(e.createdAt)}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell></TableCell>
                          <TableCell colSpan={9} className="text-xs space-y-2 py-3">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                              <span>
                                {de.journalDeep.createdBy}: <strong>{e.user?.name || "—"}</strong>
                              </span>
                              <span>
                                {de.journalDeep.createdAt}: <strong>{formatDate(e.createdAt)}</strong>
                              </span>
                              {e.updatedAt && (
                                <span>
                                  {de.journalDeep.updatedAt}: <strong>{formatDate(e.updatedAt)}</strong>
                                </span>
                              )}
                              {e.reference && (
                                <span>
                                  {de.journal.reference}: <strong>{e.reference}</strong>
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">{de.journalDeep.changeHistory}</p>
                              {historyLoading && !history[e.id] ? (
                                <Skeleton className="h-4 w-48" />
                              ) : (history[e.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground">{de.journalDeep.noHistory}</p>
                              ) : (
                                <ul className="space-y-1">
                                  {(history[e.id] || []).map((h: any) => (
                                    <li key={h.id} className="text-xs text-muted-foreground">
                                      <span className="font-mono">{formatDate(h.createdAt)}</span>
                                      {" — "}
                                      <span>{h.user?.name || "—"}</span>
                                      {" — "}
                                      <span>
                                        {de.auditLog.actions[h.action] || h.action}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={5}>{de.journal.total}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(total, "CHF")}</TableCell>
                  <TableCell colSpan={4}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.journal.newEntry}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.journal.entryDate}</Label><Input type="date" value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)} /></div>
              <div><Label className="text-xs">{de.journal.entryType}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.entryType} onChange={(e) => set("entryType", e.target.value)}>
                  {Object.entries(de.journal.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.journal.debitAccount}</Label><Input value={form.debitAccount} onChange={(e) => set("debitAccount", e.target.value)} placeholder="6300" /></div>
              <div><Label className="text-xs">{de.journal.creditAccount}</Label><Input value={form.creditAccount} onChange={(e) => set("creditAccount", e.target.value)} placeholder="2000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.journal.amount}</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
              <div><Label className="text-xs">MwSt</Label><Input type="number" step="0.01" value={form.vatAmount} onChange={(e) => set("vatAmount", e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">{de.journal.description}</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div><Label className="text-xs">{de.journal.reference}</Label><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.debitAccount || !form.amount}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
