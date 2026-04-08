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
import { Plus, ListTodo, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";

const PRIO_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800", low: "bg-gray-100 text-gray-800",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [form, setForm] = useState({ title: "", description: "", taskType: "custom", priority: "medium", dueDate: "" });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) setTasks(await res.json());
    } catch {} finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Task erstellt");
      setDialogOpen(false);
      setForm({ title: "", description: "", taskType: "custom", priority: "medium", dueDate: "" });
      fetchTasks();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "open" ? "in_progress" : current === "in_progress" ? "done" : "open";
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    fetchTasks();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.tasksMgmt.title}</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.tasksMgmt.newTask}</Button>
      </div>

      <div className="flex gap-2">
        {Object.entries(de.tasksMgmt.statusLabels).map(([k, v]) => (
          <Button key={k} variant={statusFilter === k ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(k)}>{v}</Button>
        ))}
        <Button variant={statusFilter === "" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("")}>Alle</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12"><ListTodo className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{de.tasksMgmt.noTasks}</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>{de.tasksMgmt.dueDate}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tasks.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.title}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{de.tasksMgmt.taskTypes[t.taskType] || t.taskType}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className={`text-xs ${PRIO_COLORS[t.priority] || ""}`}>{de.tasksMgmt.priorities[t.priority] || t.priority}</Badge></TableCell>
                    <TableCell className="text-xs">{t.dueDate ? formatDate(t.dueDate) : "—"}</TableCell>
                    <TableCell>
                      <button type="button" onClick={() => toggleStatus(t.id, t.status)}>
                        <Badge variant="secondary" className={`text-xs cursor-pointer ${t.status === "done" ? "bg-green-100 text-green-800" : t.status === "in_progress" ? "bg-blue-100 text-blue-800" : ""}`}>
                          {de.tasksMgmt.statusLabels[t.status] || t.status}
                        </Badge>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.tasksMgmt.newTask}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titel *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Typ</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.taskType} onChange={(e) => set("taskType", e.target.value)}>
                  {Object.entries(de.tasksMgmt.taskTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">Priorität</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                  {Object.entries(de.tasksMgmt.priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            <div><Label className="text-xs">{de.tasksMgmt.dueDate}</Label><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
