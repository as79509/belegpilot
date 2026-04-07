"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Workflow, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}
interface RuleAction {
  type: string;
  value?: string;
}
interface Rule {
  id: string;
  name: string;
  ruleType: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  isActive: boolean;
}

const FIELD_OPTIONS = Object.entries(de.rules.fields);
const OPERATOR_OPTIONS = Object.entries(de.rules.operators);
const ACTION_OPTIONS = Object.entries(de.rules.actionTypes);
const TYPE_OPTIONS = Object.entries(de.rules.types);

function emptyCondition(): RuleCondition {
  return { field: "supplierName", operator: "contains", value: "" };
}
function emptyAction(): RuleAction {
  return { type: "set_category", value: "" };
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("category_mapping");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formConditions, setFormConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [formActions, setFormActions] = useState<RuleAction[]>([emptyAction()]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/rules");
    if (res.ok) setRules(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  function openNew() {
    setEditingId(null);
    setFormName(""); setFormType("category_mapping"); setFormPriority(0); setFormActive(true);
    setFormConditions([emptyCondition()]); setFormActions([emptyAction()]);
    setDialogOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setFormName(rule.name); setFormType(rule.ruleType); setFormPriority(rule.priority); setFormActive(rule.isActive);
    setFormConditions(rule.conditions.length > 0 ? [...rule.conditions] : [emptyCondition()]);
    setFormActions(rule.actions.length > 0 ? [...rule.actions] : [emptyAction()]);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { name: formName, ruleType: formType, priority: formPriority, isActive: formActive, conditions: formConditions, actions: formActions };
      const url = editingId ? `/api/rules/${editingId}` : "/api/rules";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.rules.saveSuccess);
      setDialogOpen(false);
      fetchRules();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/rules/${deleteId}`, { method: "DELETE" });
    if (res.ok) { toast.success(de.rules.deleteSuccess); fetchRules(); }
    setDeleteId(null);
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchRules();
  }

  function updateCondition(idx: number, key: string, val: string) {
    setFormConditions(prev => prev.map((c, i) => i === idx ? { ...c, [key]: val } : c));
  }
  function updateAction(idx: number, key: string, val: string) {
    setFormActions(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.rules.title}</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{de.rules.newRule}</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <Table><TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{de.rules.noRules}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.rules.name}</TableHead>
                  <TableHead>{de.rules.type}</TableHead>
                  <TableHead>{de.rules.conditions}</TableHead>
                  <TableHead>{de.rules.priority}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {de.rules.types[rule.ruleType] || rule.ruleType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                      {(rule.conditions as RuleCondition[]).map(c =>
                        `${de.rules.fields[c.field] || c.field} ${de.rules.operators[c.operator] || c.operator} "${c.value}"`
                      ).join(", ")}
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <button onClick={() => toggleActive(rule)}>
                        <Badge variant="secondary" className={rule.isActive ? "bg-green-100 text-green-800" : "bg-gray-100"}>
                          {rule.isActive ? de.rules.active : de.rules.inactive}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(rule.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? de.rules.editRule : de.rules.newRule}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">{de.rules.name}</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.rules.type}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={formType} onChange={e => setFormType(e.target.value)}>
                  {TYPE_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">{de.rules.priority}</Label>
                <Input type="number" value={formPriority} onChange={e => setFormPriority(parseInt(e.target.value) || 0)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={formActive} onCheckedChange={c => setFormActive(!!c)} />{de.rules.active}
            </label>

            {/* Conditions builder */}
            <div>
              <Label className="text-xs font-medium">{de.rules.conditions}</Label>
              <div className="space-y-2 mt-1">
                {formConditions.map((cond, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={cond.field} onChange={e => updateCondition(i, "field", e.target.value)}>
                      {FIELD_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={cond.operator} onChange={e => updateCondition(i, "operator", e.target.value)}>
                      {OPERATOR_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <Input className="text-xs h-7 flex-1" value={cond.value} onChange={e => updateCondition(i, "value", e.target.value)} />
                    {formConditions.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFormConditions(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormConditions(prev => [...prev, emptyCondition()])}>
                  <Plus className="h-3 w-3 mr-1" />{de.rules.addCondition}
                </Button>
              </div>
            </div>

            {/* Actions builder */}
            <div>
              <Label className="text-xs font-medium">{de.rules.actions}</Label>
              <div className="space-y-2 mt-1">
                {formActions.map((act, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <select className="border rounded px-2 py-1 text-xs flex-1" value={act.type} onChange={e => updateAction(i, "type", e.target.value)}>
                      {ACTION_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {act.type !== "auto_approve" && (
                      <Input className="text-xs h-7 flex-1" value={act.value || ""} onChange={e => updateAction(i, "value", e.target.value)} placeholder="Wert" />
                    )}
                    {formActions.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFormActions(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFormActions(prev => [...prev, emptyAction()])}>
                  <Plus className="h-3 w-3 mr-1" />{de.rules.addAction}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {de.common.save}
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
