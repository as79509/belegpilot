"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ds";
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
import { Plus, ListTodo, Loader2, Send, Mail } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { de } from "@/lib/i18n/de";
import { formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";

const PRIO_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800", low: "bg-gray-100 text-gray-800",
};

const MESSAGE_TEMPLATES: Record<string, { subject: string; body: string }> = {
  missing_document: { subject: "Fehlender Beleg", body: "Guten Tag, für den Monat {monat} fehlt uns noch die Rechnung von {lieferant}. Könnten Sie diese bitte hochladen?" },
  unclear_receipt: { subject: "Unklarer Beleg", body: "Guten Tag, der Beleg {belegnr} von {lieferant} ist unklar. Bitte prüfen Sie: {grund}" },
  missing_contract: { subject: "Fehlender Vertrag", body: "Guten Tag, uns fehlt der Vertrag zu {lieferant}. Bitte laden Sie diesen hoch." },
  check_private_use: { subject: "Privatanteil prüfen", body: "Guten Tag, bitte bestätigen Sie den Privatanteil für {beschreibung}." },
  confirmation_needed: { subject: "Bestätigung nötig", body: "Guten Tag, bitte bestätigen Sie die Buchung {beschreibung} über {betrag}." },
  custom: { subject: "", body: "" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [msgDialogOpen, setMsgDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [form, setForm] = useState({ title: "", description: "", taskType: "custom", priority: "medium", dueDate: "" });
  const [msgForm, setMsgForm] = useState({ templateType: "missing_document", recipientEmail: "", subject: "", body: "" });

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

  function selectTemplate(templateType: string) {
    const tpl = MESSAGE_TEMPLATES[templateType];
    setMsgForm((p) => ({ ...p, templateType, subject: tpl?.subject || "", body: tpl?.body || "" }));
  }

  async function handleSendMessage() {
    setSaving(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.messages.sent);
      setMsgDialogOpen(false);
      setMsgForm({ templateType: "missing_document", recipientEmail: "", subject: "", body: "" });
      fetchTasks();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.tasksMgmt.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { selectTemplate("missing_document"); setMsgDialogOpen(true); }}><Send className="h-4 w-4 mr-2" />{de.messages.send}</Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.tasksMgmt.newTask}</Button>
        </div>
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
            <EmptyState icon={ListTodo} title={de.emptyStates.tasks.title} description={de.emptyStates.tasks.description} />
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>{de.tasksMgmt.dueDate}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
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
                    <TableCell>
                      {t.messageBody && <span title={t.messageSentAt ? de.messages.sent : de.messages.notSent}><Mail className="h-3.5 w-3.5 text-blue-500" /></span>}
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

      {/* Message Dialog */}
      <Dialog open={msgDialogOpen} onOpenChange={setMsgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{de.messages.send}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Template</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={msgForm.templateType} onChange={(e) => selectTemplate(e.target.value)}>
                {Object.entries(de.messages.templates).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{de.messages.recipient}</Label>
              <Input type="email" placeholder="email@beispiel.ch" value={msgForm.recipientEmail} onChange={(e) => setMsgForm((p) => ({ ...p, recipientEmail: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{de.messages.subject}</Label>
              <Input value={msgForm.subject} onChange={(e) => setMsgForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{de.messages.body}</Label>
              <Textarea rows={5} value={msgForm.body} onChange={(e) => setMsgForm((p) => ({ ...p, body: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSendMessage} disabled={saving || !msgForm.body}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {de.messages.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
