"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Lightbulb, Workflow, Plus, Pencil, Trash2, X, Loader2, CheckCircle2, Zap } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

interface Rule {
  id: string; name: string; ruleType: string;
  conditions: any[]; actions: any[];
  priority: number; isActive: boolean;
}
interface Suggestion {
  supplierName: string; supplierId: string;
  pattern: string; value: string;
  documentCount: number; message: string;
}

const FIELD_OPTIONS = Object.entries(de.rules.fields);
const OPERATOR_OPTIONS = Object.entries(de.rules.operators);
const ACTION_OPTIONS = Object.entries(de.rules.actionTypes);
const TYPE_OPTIONS = Object.entries(de.rules.types);

const QUICK_ACTIONS = [
  { value: "set_category", label: "Kategorie" },
  { value: "set_account_code", label: "Kontonummer" },
  { value: "set_cost_center", label: "Kostenstelle" },
  { value: "auto_approve", label: "Auto-Genehmigung" },
];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quick rule state
  const [quickSupplier, setQuickSupplier] = useState("");
  const [quickAction, setQuickAction] = useState("set_category");
  const [quickValue, setQuickValue] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string }[]>([]);

  // Expert form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("category_mapping");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formConditions, setFormConditions] = useState<any[]>([{ field: "supplierName", operator: "contains", value: "" }]);
  const [formActions, setFormActions] = useState<any[]>([{ type: "set_category", value: "" }]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [rulesRes, sugRes] = await Promise.all([
      fetch("/api/rules").then((r) => r.json()).catch(() => []),
      fetch("/api/rules/suggestions").then((r) => r.json()).catch(() => ({ suggestions: [] })),
    ]);
    setRules(Array.isArray(rulesRes) ? rulesRes : []);
    setSuggestions(sugRes.suggestions || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Supplier autocomplete
  useEffect(() => {
    if (quickSupplier.length < 2) { setSupplierOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/suppliers/autocomplete?q=${encodeURIComponent(quickSupplier)}`)
        .then((r) => r.json())
        .then((d) => setSupplierOptions(d.suppliers || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [quickSupplier]);

  async function handleQuickCreate() {
    if (!quickSupplier.trim()) return;
    setQuickCreating(true);
    try {
      const res = await fetch("/api/rules/quick", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName: quickSupplier, actionType: quickAction, value: quickValue || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setQuickSupplier(""); setQuickValue("");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setQuickCreating(false); }
  }

  async function createFromSuggestion(sug: Suggestion) {
    const actionType = sug.pattern === "category" ? "set_category" : sug.pattern === "account" ? "set_account_code" : "set_cost_center";
    try {
      const res = await fetch("/api/rules/quick", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName: sug.supplierName, actionType, value: sug.value }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setSuggestions((prev) => prev.filter((s) => s.supplierId !== sug.supplierId));
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  }

  function openExpertEdit(rule: Rule) {
    setEditingId(rule.id);
    setFormName(rule.name); setFormType(rule.ruleType); setFormPriority(rule.priority); setFormActive(rule.isActive);
    setFormConditions(rule.conditions.length > 0 ? [...rule.conditions] : [{ field: "supplierName", operator: "contains", value: "" }]);
    setFormActions(rule.actions.length > 0 ? [...rule.actions] : [{ type: "set_category", value: "" }]);
    setDialogOpen(true);
  }

  function openExpertNew() {
    setEditingId(null);
    setFormName(""); setFormType("category_mapping"); setFormPriority(0); setFormActive(true);
    setFormConditions([{ field: "supplierName", operator: "contains", value: "" }]);
    setFormActions([{ type: "set_category", value: "" }]);
    setDialogOpen(true);
  }

  async function handleExpertSave() {
    setSaving(true);
    try {
      const body = { name: formName, ruleType: formType, priority: formPriority, isActive: formActive, conditions: formConditions, actions: formActions };
      const url = editingId ? `/api/rules/${editingId}` : "/api/rules";
      const res = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setDialogOpen(false); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/rules/${deleteId}`, { method: "DELETE" });
    toast.success(de.rules.deleteSuccess); setDeleteId(null); fetchData();
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !rule.isActive }) });
    fetchData();
  }

  function readableRule(rule: Rule): string {
    const conds = (rule.conditions as any[]).map((c) =>
      `${de.rules.fields[c.field] || c.field} ${de.rules.operators[c.operator] || c.operator} "${c.value}"`
    ).join(" & ");
    const acts = (rule.actions as any[]).map((a) =>
      a.type === "auto_approve" ? "Auto-Genehmigung" : `${de.rules.actionTypes[a.type] || a.type} = ${a.value || ""}`
    ).join(", ");
    return `Wenn ${conds} → ${acts}`;
  }

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{de.rules.title}</h1>
      <Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{de.rules.title}</h1>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />{de.rules.suggestions}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((sug) => (
              <Card key={sug.supplierId} className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <p className="text-sm flex-1">{sug.message}</p>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => createFromSuggestion(sug)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />{de.rules.createFromSuggestion}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSuggestions((p) => p.filter((s) => s !== sug))}>
                      {de.rules.ignoreSuggestion}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Rule Creator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />{de.rules.quickRule}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Label className="text-xs">{de.rules.quickRuleWhen}</Label>
              <Input
                value={quickSupplier}
                onChange={(e) => setQuickSupplier(e.target.value)}
                placeholder="Lieferantenname..."
              />
              {supplierOptions.length > 0 && quickSupplier.length >= 2 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {supplierOptions.map((s) => (
                    <button type="button" key={s.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted" onClick={() => { setQuickSupplier(s.name); setSupplierOptions([]); }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs">{de.rules.quickRuleThen}</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={quickAction} onChange={(e) => setQuickAction(e.target.value)}>
                {QUICK_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            {quickAction !== "auto_approve" && (
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">{de.rules.quickRuleTo}</Label>
                <Input value={quickValue} onChange={(e) => setQuickValue(e.target.value)} placeholder="Wert..." />
              </div>
            )}
            <Button onClick={handleQuickCreate} disabled={quickCreating || !quickSupplier.trim()}>
              {quickCreating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {de.rules.quickRuleCreate}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Workflow className="h-4 w-4" />{de.rules.activeRules}
            <Badge variant="secondary" className="text-xs">{rules.length}</Badge>
          </h2>
          <Button variant="outline" size="sm" onClick={openExpertNew}>
            {de.rules.expertMode}
          </Button>
        </div>

        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Workflow className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{de.rules.noRules}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.isActive ? "" : "opacity-50"}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-sm">{rule.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {de.rules.types[rule.ruleType] || rule.ruleType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{readableRule(rule)}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleActive(rule)}>
                      <Badge variant="secondary" className={`text-xs cursor-pointer ${rule.isActive ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
                        {rule.isActive ? de.rules.active : de.rules.inactive}
                      </Badge>
                    </button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openExpertEdit(rule)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteId(rule.id)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Expert Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? de.rules.editRule : de.rules.newRule}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">{de.rules.name}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.rules.type}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {TYPE_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">{de.rules.priority}</Label>
                <Input type="number" value={formPriority} onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={formActive} onCheckedChange={(c) => setFormActive(!!c)} />{de.rules.active}
            </label>
            <div>
              <Label className="text-xs font-medium">{de.rules.conditions}</Label>
              <div className="space-y-2 mt-1">
                {formConditions.map((cond, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={cond.field} onChange={(e) => setFormConditions((p) => p.map((c, j) => j === i ? { ...c, field: e.target.value } : c))}>
                      {FIELD_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={cond.operator} onChange={(e) => setFormConditions((p) => p.map((c, j) => j === i ? { ...c, operator: e.target.value } : c))}>
                      {OPERATOR_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <Input className="text-xs h-7 flex-1" value={cond.value} onChange={(e) => setFormConditions((p) => p.map((c, j) => j === i ? { ...c, value: e.target.value } : c))} />
                    {formConditions.length > 1 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFormConditions((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormConditions((p) => [...p, { field: "supplierName", operator: "contains", value: "" }])}>
                  <Plus className="h-3 w-3 mr-1" />{de.rules.addCondition}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">{de.rules.actions}</Label>
              <div className="space-y-2 mt-1">
                {formActions.map((act, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={act.type} onChange={(e) => setFormActions((p) => p.map((a, j) => j === i ? { ...a, type: e.target.value } : a))}>
                      {ACTION_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {act.type !== "auto_approve" && <Input className="text-xs h-7 flex-1" value={act.value || ""} onChange={(e) => setFormActions((p) => p.map((a, j) => j === i ? { ...a, value: e.target.value } : a))} placeholder="Wert" />}
                    {formActions.length > 1 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFormActions((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormActions((p) => [...p, { type: "set_category", value: "" }])}>
                  <Plus className="h-3 w-3 mr-1" />{de.rules.addAction}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleExpertSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.rules.deleteConfirm}</DialogTitle></DialogHeader>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}>{de.common.delete}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
