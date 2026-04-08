"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus, Shield, Brain, Loader2, Trash2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

export default function AiSettingsPage() {
  const [escRules, setEscRules] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [escDialogOpen, setEscDialogOpen] = useState(false);
  const [knDialogOpen, setKnDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [escForm, setEscForm] = useState({ name: "", condition: "new_supplier", threshold: "" });
  const [knForm, setKnForm] = useState({ title: "", category: "supplier_note", content: "", relatedSupplier: "", relatedAccount: "", usableByAi: true });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [escRes, knRes] = await Promise.all([
        fetch("/api/escalation-rules").then((r) => r.json()),
        fetch("/api/knowledge").then((r) => r.json()),
      ]);
      setEscRules(Array.isArray(escRes) ? escRes : []);
      setKnowledge(Array.isArray(knRes) ? knRes : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveEscRule() {
    setSaving(true);
    try {
      const res = await fetch("/api/escalation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(escForm) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setEscDialogOpen(false);
      setEscForm({ name: "", condition: "new_supplier", threshold: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function saveKnItem() {
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(knForm) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setKnDialogOpen(false);
      setKnForm({ title: "", category: "supplier_note", content: "", relatedSupplier: "", relatedAccount: "", usableByAi: true });
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function toggleEsc(id: string, isActive: boolean) {
    await fetch(`/api/escalation-rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    fetchData();
  }

  async function deleteEsc(id: string) {
    await fetch(`/api/escalation-rules/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function toggleKnAi(id: string, usableByAi: boolean) {
    await fetch(`/api/knowledge/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usableByAi: !usableByAi }) });
    fetchData();
  }

  async function deleteKn(id: string) {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    fetchData();
  }

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

  return (
    <div className="space-y-8">
      {/* Escalation Rules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5" />{de.escalation.title}</h2>
          <Button size="sm" onClick={() => setEscDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />{de.escalation.newRule}</Button>
        </div>
        {escRules.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{de.escalation.noRules}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {escRules.map((r: any) => (
              <Card key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{de.escalation.conditions[r.condition] || r.condition}</Badge>
                      {r.threshold && <Badge variant="secondary" className="text-xs bg-amber-100">{de.escalation.threshold}: {r.threshold}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => toggleEsc(r.id, r.isActive)}>
                      <Badge variant="secondary" className={`text-xs cursor-pointer ${r.isActive ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>{r.isActive ? de.rules.active : de.rules.inactive}</Badge>
                    </button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteEsc(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Brain className="h-5 w-5" />{de.knowledge.title}</h2>
          <Button size="sm" onClick={() => setKnDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />{de.knowledge.newItem}</Button>
        </div>
        {knowledge.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{de.knowledge.noItems}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {knowledge.map((k: any) => (
              <Card key={k.id}>
                <CardContent className="py-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-sm">{k.title}</span>
                    <Badge variant="secondary" className="text-xs">{de.knowledge.categories[k.category] || k.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{k.content}</p>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox checked={k.usableByAi} onCheckedChange={() => toggleKnAi(k.id, k.usableByAi)} />
                      {de.knowledge.usableByAi}
                    </label>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteKn(k.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Escalation dialog */}
      <Dialog open={escDialogOpen} onOpenChange={setEscDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.escalation.newRule}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.rules.name}</Label><Input value={escForm.name} onChange={(e) => setEscForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs">{de.rules.type}</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={escForm.condition} onChange={(e) => setEscForm(f => ({ ...f, condition: e.target.value }))}>
                {Object.entries(de.escalation.conditions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            {(escForm.condition === "amount_above" || escForm.condition === "asset_suspected") && (
              <div><Label className="text-xs">{de.escalation.threshold}</Label><Input type="number" value={escForm.threshold} onChange={(e) => setEscForm(f => ({ ...f, threshold: e.target.value }))} /></div>
            )}
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={saveEscRule} disabled={saving || !escForm.name}>{saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge dialog */}
      <Dialog open={knDialogOpen} onOpenChange={setKnDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.knowledge.newItem}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.rules.name}</Label><Input value={knForm.title} onChange={(e) => setKnForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label className="text-xs">{de.assets.category}</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={knForm.category} onChange={(e) => setKnForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(de.knowledge.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><Label className="text-xs">{de.knowledge.content}</Label><Textarea value={knForm.content} onChange={(e) => setKnForm(f => ({ ...f, content: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.knowledge.relatedSupplier}</Label><Input value={knForm.relatedSupplier} onChange={(e) => setKnForm(f => ({ ...f, relatedSupplier: e.target.value }))} /></div>
              <div><Label className="text-xs">{de.knowledge.relatedAccount}</Label><Input value={knForm.relatedAccount} onChange={(e) => setKnForm(f => ({ ...f, relatedAccount: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={knForm.usableByAi} onCheckedChange={(c) => setKnForm(f => ({ ...f, usableByAi: !!c }))} />{de.knowledge.usableByAi}</label>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={saveKnItem} disabled={saving || !knForm.title || !knForm.content}>{saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
