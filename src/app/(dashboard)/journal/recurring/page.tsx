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
import { Plus, RefreshCw, Loader2, Repeat } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";

export default function RecurringPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    name: "", debitAccount: "", creditAccount: "", amount: "",
    description: "", frequency: "monthly", dayOfMonth: "1",
    startDate: new Date().toISOString().split("T")[0],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recurring");
      if (res.ok) setTemplates(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/recurring", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), dayOfMonth: parseInt(form.dayOfMonth) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.journal.saveSuccess);
      setDialogOpen(false);
      setForm({ name: "", debitAccount: "", creditAccount: "", amount: "", description: "", frequency: "monthly", dayOfMonth: "1", startDate: new Date().toISOString().split("T")[0] });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/recurring/generate", { method: "POST" });
      const data = await res.json();
      toast.success(`${data.generated} ${de.recurring.generated}`);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/recurring/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.recurring.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {de.recurring.generate}
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.recurring.newTemplate}</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Repeat className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{de.recurring.noTemplates}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} className={t.isActive ? "" : "opacity-50"}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {de.recurring.frequencies[t.frequency] || t.frequency}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.debitAccount} → {t.creditAccount} · {formatCurrency(t.amount, t.currency || "CHF")}
                </div>
                <p className="text-xs">{t.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{de.recurring.nextExecution}: Tag {t.dayOfMonth}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => toggleActive(t.id, t.isActive)}>
                      <Badge variant="secondary" className={`text-xs cursor-pointer ${t.isActive ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
                        {t.isActive ? de.rules.active : de.rules.inactive}
                      </Badge>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.recurring.newTemplate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.recurring.name}</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.journal.debitAccount}</Label><Input value={form.debitAccount} onChange={(e) => set("debitAccount", e.target.value)} /></div>
              <div><Label className="text-xs">{de.journal.creditAccount}</Label><Input value={form.creditAccount} onChange={(e) => set("creditAccount", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.journal.amount}</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
              <div><Label className="text-xs">{de.recurring.frequency}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                  {Object.entries(de.recurring.frequencies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.recurring.dayOfMonth}</Label><Input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => set("dayOfMonth", e.target.value)} /></div>
              <div><Label className="text-xs">{de.recurring.startDate}</Label><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">{de.journal.description}</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.amount}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
