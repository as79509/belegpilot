"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, BookOpen, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate, formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const TYPE_COLORS: Record<string, string> = {
  manual: "bg-blue-100 text-blue-800",
  recurring: "bg-purple-100 text-purple-800",
  depreciation: "bg-amber-100 text-amber-800",
  document: "bg-green-100 text-green-800",
};

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().split("T")[0],
    debitAccount: "", creditAccount: "", amount: "", vatAmount: "",
    description: "", reference: "", entryType: "manual",
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (typeFilter) params.set("entryType", typeFilter);
    try {
      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) { const d = await res.json(); setEntries(d.entries || []); }
    } catch {} finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

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

  const total = entries.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.journal.title}</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.journal.newEntry}</Button>
      </div>

      <div className="flex gap-2">
        <select className="border rounded-md px-3 py-1.5 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Alle Typen</option>
          {Object.entries(de.journal.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12"><BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{de.journal.noEntries}</p></div>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{de.journal.entryDate}</TableHead>
                  <TableHead>{de.journal.debitAccount}</TableHead>
                  <TableHead>{de.journal.creditAccount}</TableHead>
                  <TableHead>{de.journal.amount}</TableHead>
                  <TableHead>{de.journal.description}</TableHead>
                  <TableHead>{de.journal.entryType}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{formatDate(e.entryDate)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.debitAccount}</TableCell>
                      <TableCell className="font-mono text-xs">{e.creditAccount}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatCurrency(e.amount, e.currency || "CHF")}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell><Badge variant="secondary" className={`text-xs ${TYPE_COLORS[e.entryType] || ""}`}>{de.journal.types[e.entryType] || e.entryType}</Badge></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>{de.journal.total}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(total, "CHF")}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
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
