"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { GitCompareArrows, CheckCircle, XCircle } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";
import { EntityHeader, StatusBadge, EmptyState } from "@/components/ds";

interface CorrectionPattern {
  id: string;
  field: string;
  fromValue: string;
  toValue: string;
  occurrences: number;
  supplierId: string | null;
  supplierName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  status: string;
  promotedTo?: string | null;
  promotedEntityId?: string | null;
  promotedEntityName?: string | null;
  promotedAt?: string | null;
  dismissedAt?: string | null;
  dismissedReason?: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  accountCode: "Konto",
  expenseCategory: "Kategorie",
  costCenter: "Kostenstelle",
  vatRate: "MwSt",
};

export default function CorrectionsPage() {
  const [patterns, setPatterns] = useState<Record<string, CorrectionPattern[]>>({
    open: [], promoted: [], dismissed: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"open" | "promoted" | "dismissed">("open");
  const [dismissDialog, setDismissDialog] = useState<{ open: boolean; patternId: string | null }>({
    open: false, patternId: null,
  });
  const [dismissReason, setDismissReason] = useState("");

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, promotedRes, dismissedRes] = await Promise.all([
        fetch("/api/corrections/patterns?status=open"),
        fetch("/api/corrections/patterns?status=promoted"),
        fetch("/api/corrections/patterns?status=dismissed"),
      ]);
      const next: Record<string, CorrectionPattern[]> = { open: [], promoted: [], dismissed: [] };
      if (openRes.ok) next.open = (await openRes.json()).patterns || [];
      if (promotedRes.ok) next.promoted = (await promotedRes.json()).patterns || [];
      if (dismissedRes.ok) next.dismissed = (await dismissedRes.json()).patterns || [];
      setPatterns(next);
    } catch (err) {
      console.error("[Corrections] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  async function handlePromote(id: string, promoteTo: "rule" | "knowledge" | "supplier_default") {
    try {
      const res = await fetch(`/api/corrections/patterns/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoteTo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Fehler");
      }
      const successMsg =
        promoteTo === "rule" ? de.correctionsDashboard.ruleCreated
        : promoteTo === "knowledge" ? de.correctionsDashboard.knowledgeCreated
        : de.correctionsDashboard.defaultUpdated;
      toast.success(successMsg);
      loadPatterns();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDismiss() {
    if (!dismissDialog.patternId) return;
    try {
      const res = await fetch(`/api/corrections/patterns/${dismissDialog.patternId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: dismissReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Fehler");
      }
      toast.success(de.correctionsDashboard.patternDismissed);
      setDismissDialog({ open: false, patternId: null });
      setDismissReason("");
      loadPatterns();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const openCount = patterns.open.length;
  const actionableCount = patterns.open.filter((p) => p.occurrences >= 3).length;

  return (
    <div className="space-y-4">
      <EntityHeader
        title={de.correctionsDashboard.title}
        badge={
          openCount > 0 ? (
            <StatusBadge type="pattern" value="open" className="bg-amber-100 text-amber-800" />
          ) : undefined
        }
      />

      {!loading && (
        <p className="text-sm text-muted-foreground">
          <strong>{openCount}</strong> {de.correctionsDashboard.recurring}
          {actionableCount > 0 && <> · <strong>{actionableCount}</strong> {de.correctionsDashboard.actionable}</>}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="open">
            {de.correctionsDashboard.tabs.open}
            {openCount > 0 && <Badge variant="secondary" className="ml-2 text-xs">{openCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="promoted">
            {de.correctionsDashboard.tabs.promoted}
            {patterns.promoted.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{patterns.promoted.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dismissed">
            {de.correctionsDashboard.tabs.dismissed}
            {patterns.dismissed.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{patterns.dismissed.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          <PatternsTable
            patterns={patterns.open}
            loading={loading}
            mode="open"
            onPromote={handlePromote}
            onDismiss={(id) => setDismissDialog({ open: true, patternId: id })}
          />
        </TabsContent>

        <TabsContent value="promoted" className="mt-4">
          <PatternsTable patterns={patterns.promoted} loading={loading} mode="promoted" />
        </TabsContent>

        <TabsContent value="dismissed" className="mt-4">
          <PatternsTable patterns={patterns.dismissed} loading={loading} mode="dismissed" />
        </TabsContent>
      </Tabs>

      <Dialog open={dismissDialog.open} onOpenChange={(o) => setDismissDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.correctionsDashboard.dismiss}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder={de.correctionsDashboard.dismissReason}
            rows={3}
          />
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleDismiss} variant="destructive">
              {de.correctionsDashboard.dismiss}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatternsTable({
  patterns,
  loading,
  mode,
  onPromote,
  onDismiss,
}: {
  patterns: CorrectionPattern[];
  loading: boolean;
  mode: "open" | "promoted" | "dismissed";
  onPromote?: (id: string, promoteTo: "rule" | "knowledge" | "supplier_default") => void;
  onDismiss?: (id: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState icon={GitCompareArrows} title={de.correctionsDashboard.noPatterns} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{de.correctionsDashboard.supplier}</TableHead>
              <TableHead>{de.correctionsDashboard.field}</TableHead>
              <TableHead>{de.correctionsDashboard.aiValue} → {de.correctionsDashboard.correctedTo}</TableHead>
              <TableHead className="text-right">{de.correctionsDashboard.frequency}</TableHead>
              <TableHead>Erstmals</TableHead>
              <TableHead>Zuletzt</TableHead>
              {mode === "open" && <TableHead className="text-right">Aktionen</TableHead>}
              {mode === "promoted" && <TableHead>{de.correctionsDashboard.promoted}</TableHead>}
              {mode === "dismissed" && <TableHead>{de.correctionsDashboard.dismissedReason}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{p.supplierName || "—"}</TableCell>
                <TableCell className="text-sm">{FIELD_LABELS[p.field] || p.field}</TableCell>
                <TableCell className="text-sm">
                  <span className="text-muted-foreground line-through">{p.fromValue || "—"}</span>
                  {" → "}
                  <strong>{p.toValue}</strong>
                </TableCell>
                <TableCell className="text-sm text-right font-mono">
                  {p.occurrences}{de.correctionsDashboard.times}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(p.firstSeenAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(p.lastSeenAt)}</TableCell>
                {mode === "open" && (
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => onPromote?.(p.id, "rule")}>
                        {de.correctionsDashboard.promoteRule}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onPromote?.(p.id, "knowledge")}>
                        {de.correctionsDashboard.promoteKnowledge}
                      </Button>
                      {p.supplierId && (
                        <Button size="sm" variant="outline" onClick={() => onPromote?.(p.id, "supplier_default")}>
                          {de.correctionsDashboard.promoteDefault}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onDismiss?.(p.id)}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
                {mode === "promoted" && (
                  <TableCell className="text-xs">
                    <StatusBadge type="pattern" value="promoted" />
                    {p.promotedEntityName && (
                      <div className="text-muted-foreground mt-1">{p.promotedTo} · {p.promotedEntityName}</div>
                    )}
                  </TableCell>
                )}
                {mode === "dismissed" && (
                  <TableCell className="text-xs text-muted-foreground italic">
                    {p.dismissedReason || "—"}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
