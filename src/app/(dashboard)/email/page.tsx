"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityHeader, EmptyState, InfoPanel } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import { formatRelativeTime } from "@/lib/i18n/format";
import { Mail, Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface EmailInbox {
  id: string;
  inboxAddress: string;
  label: string | null;
  isActive: boolean;
  autoProcess: boolean;
  allowedSenders: string[] | null;
  processedCount: number;
  lastReceivedAt: string | null;
  createdAt: string;
}

export default function EmailImportPage() {
  const [inboxes, setInboxes] = useState<EmailInbox[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingInbox, setEditingInbox] = useState<EmailInbox | null>(null);
  const [editForm, setEditForm] = useState({
    label: "", autoProcess: true, allowedSenders: "", isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/email/inboxes");
    if (res.ok) {
      const data = await res.json();
      setInboxes(data.inboxes || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = inboxes.filter((i) => i.isActive).length;

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/email/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: createLabel || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.emailImport.createSuccess);
      setCreateOpen(false);
      setCreateLabel("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(inbox: EmailInbox) {
    setEditingInbox(inbox);
    setEditForm({
      label: inbox.label || "",
      autoProcess: inbox.autoProcess,
      allowedSenders: inbox.allowedSenders ? inbox.allowedSenders.join("\n") : "",
      isActive: inbox.isActive,
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingInbox) return;
    const senders = editForm.allowedSenders.trim()
      ? editForm.allowedSenders.split("\n").map((s) => s.trim()).filter(Boolean)
      : null;
    const res = await fetch(`/api/email/inboxes/${editingInbox.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editForm.label || null,
        autoProcess: editForm.autoProcess,
        allowedSenders: senders,
        isActive: editForm.isActive,
      }),
    });
    if (res.ok) {
      toast.success(de.emailImport.saveSuccess);
      setEditOpen(false);
      await load();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "E-Mail-Eingang konnte nicht gespeichert werden");
    }
  }

  // Stats
  const totalProcessed = inboxes.reduce((s, i) => s + i.processedCount, 0);
  const lastReceived = inboxes
    .filter((i) => i.lastReceivedAt)
    .sort((a, b) => new Date(b.lastReceivedAt!).getTime() - new Date(a.lastReceivedAt!).getTime())[0]
    ?.lastReceivedAt;

  return (
    <div className="space-y-6 p-6">
      <EntityHeader
        title={de.emailImport.title}
        badge={
          activeCount > 0 ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {activeCount} {de.emailImport.activeInboxes}
            </Badge>
          ) : undefined
        }
        primaryAction={{
          label: de.emailImport.addInbox,
          icon: Plus,
          onClick: () => setCreateOpen(true),
        }}
      />

      {/* Stats Cards */}
      {inboxes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{de.emailImport.activeInboxes}</p>
              <p className="text-2xl font-bold mt-1">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{de.emailImport.processed}</p>
              <p className="text-2xl font-bold mt-1">{totalProcessed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{de.emailImport.lastReceived}</p>
              <p className="text-lg font-semibold mt-1">
                {lastReceived ? formatRelativeTime(lastReceived) : de.common.noData}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <InfoPanel tone="info" icon={Mail}>
        <strong>{de.emailImport.title}</strong>
        <p className="text-sm mt-1">{de.emailImport.webhookOnlyInfo}</p>
        <p className="text-sm mt-1">{de.emailImport.attachmentTruth}</p>
      </InfoPanel>

      {/* Inbox Table */}
      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{de.emailImport.inboxAddress}</TableHead>
              <TableHead>{de.emailImport.label}</TableHead>
              <TableHead>{de.emailImport.autoProcess}</TableHead>
              <TableHead>{de.emailImport.allowedSenders}</TableHead>
              <TableHead className="text-right">{de.emailImport.processed}</TableHead>
              <TableHead>{de.emailImport.lastEmail}</TableHead>
              <TableHead>{de.emailImport.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : inboxes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <div className="py-6 px-4">
                    <InfoPanel tone="info" icon={Mail}>
                      <strong>{de.emailImport.title}</strong>
                      <p className="text-sm mt-1">{de.emailImport.emptyHint}</p>
                    </InfoPanel>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              inboxes.map((inbox) => (
                <TableRow
                  key={inbox.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(inbox)}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs">{inbox.inboxAddress}</span>
                      <CopyButton text={inbox.inboxAddress} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{inbox.label || de.common.noData}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={inbox.autoProcess ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>
                      {inbox.autoProcess ? "An" : "Aus"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {inbox.allowedSenders && inbox.allowedSenders.length > 0
                      ? inbox.allowedSenders.join(", ")
                      : "Alle"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{inbox.processedCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inbox.lastReceivedAt ? formatRelativeTime(inbox.lastReceivedAt) : de.common.noData}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={inbox.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>
                      {inbox.isActive ? de.emailImport.active : de.emailImport.inactive}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.emailImport.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{de.emailImport.label}</Label>
              <Input
                placeholder="z. B. Haupteingang Rechnungen"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Eine eindeutige Empfangsadresse wird automatisch generiert.
            </p>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Erstelle..." : de.emailImport.addInbox}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.emailImport.editTitle}</DialogTitle>
          </DialogHeader>
          {editingInbox && (
            <div className="space-y-4 py-2">
              <div>
                <Label>{de.emailImport.inboxAddress}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{editingInbox.inboxAddress}</code>
                  <CopyButton text={editingInbox.inboxAddress} />
                </div>
              </div>
              <div>
                <Label>{de.emailImport.label}</Label>
                <Input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoProcess"
                  checked={editForm.autoProcess}
                  onChange={(e) => setEditForm({ ...editForm, autoProcess: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="autoProcess">{de.emailImport.autoProcess}</Label>
              </div>
              <div>
                <Label>{de.emailImport.allowedSenders}</Label>
                <Textarea
                  rows={3}
                  placeholder={de.emailImport.allowedSendersHint}
                  value={editForm.allowedSenders}
                  onChange={(e) => setEditForm({ ...editForm, allowedSenders: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive">{de.emailImport.active}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSaveEdit}>{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(de.emailImport.copied);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground p-0.5" title={de.emailImport.copyAddress}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
