"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Link2, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  SkipForward, ClipboardList, MessageSquare, BookOpen, Lightbulb,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { ReviewForm } from "@/components/review/review-form";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime, formatConfidence, formatCurrency, getConfidenceColor } from "@/lib/i18n/format";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextDocId, setNextDocId] = useState<string | null>(null);
  const [prevDocId, setPrevDocId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [queuePosition, setQueuePosition] = useState<{ current: number; total: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [similarDocs, setSimilarDocs] = useState<any[]>([]);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Suggestion
  const [suggestion, setSuggestion] = useState<any>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Autopilot Event
  const [autopilotEvent, setAutopilotEvent] = useState<any>(null);

  // Correction patterns for this supplier
  const [correctionPattern, setCorrectionPattern] = useState<any>(null);
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [modifyAccount, setModifyAccount] = useState("");
  const [modifyCategory, setModifyCategory] = useState("");
  const [modifyCostCenter, setModifyCostCenter] = useState("");
  const [modifyVatCode, setModifyVatCode] = useState("");

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("review_needed");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("booking_rule");
  const [knowledgeContent, setKnowledgeContent] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const docRes = await fetch(`/api/documents/${params.id}`);
        let loadedDoc: any = null;
        if (docRes.ok) {
          loadedDoc = await docRes.json();
          setDoc(loadedDoc);
        }

        const auditRes = await fetch(`/api/documents/${params.id}/audit`).catch(() => null);
        if (auditRes?.ok) {
          const audit = await auditRes.json();
          setAuditEntries(Array.isArray(audit) ? audit : []);
        }

        // Fetch neighbors via dedicated API
        const neighborsRes = await fetch(`/api/documents/${params.id}/neighbors?filter=needs_review`).catch(() => null);
        if (neighborsRes?.ok) {
          const neighbors = await neighborsRes.json();
          setPrevDocId(neighbors.previousId);
          setNextDocId(neighbors.nextId);
          if (neighbors.currentPosition > 0) {
            setQueuePosition({ current: neighbors.currentPosition, total: neighbors.totalInQueue });
          }
        }

        // Fetch similar documents
        const similarRes = await fetch(`/api/documents/${params.id}/similar`).catch(() => null);
        if (similarRes?.ok) {
          const data = await similarRes.json();
          setSimilarDocs(data.similar || []);
        }

        // Fetch booking suggestion
        const suggRes = await fetch(`/api/documents/${params.id}/suggestion`).catch(() => null);
        if (suggRes?.ok) {
          const suggData = await suggRes.json();
          if (suggData && suggData.id) setSuggestion(suggData);
        }

        // Fetch autopilot event
        const apRes = await fetch(`/api/documents/${params.id}/autopilot-event`).catch(() => null);
        if (apRes?.ok) {
          const apData = await apRes.json();
          if (apData?.event) setAutopilotEvent(apData.event);
        }

        // Fetch correction patterns for this supplier
        const supplierIdForPatterns = loadedDoc?.supplierId;
        if (supplierIdForPatterns) {
          const patternsRes = await fetch(`/api/corrections/patterns?supplierId=${supplierIdForPatterns}&status=open`).catch(() => null);
          if (patternsRes?.ok) {
            const patternsData = await patternsRes.json();
            const patterns = patternsData.patterns || [];
            if (patterns.length > 0) {
              const top = patterns.sort((a: any, b: any) => b.occurrences - a.occurrences)[0];
              setCorrectionPattern(top);
            }
          }
        }
      } catch (err) {
        console.error("[DocumentDetail] Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);

  // --- Review toolbar actions ---
  const handleToolbarApprove = useCallback(async () => {
    if (approving || !doc) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setDoc(updated);
      // Auto-accept pending suggestion on approve
      if (suggestion?.status === "pending") {
        fetch(`/api/documents/${doc.id}/suggestion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accepted" }),
        }).then(r => r.ok ? r.json() : null).then(s => { if (s) setSuggestion(s); }).catch(() => {});
      }
      toast.success(de.review.approveSuccess);
      if (nextDocId) setTimeout(() => router.push(`/documents/${nextDocId}`), 400);
    } catch (err: any) { toast.error(err.message || de.errors.serverError); }
    finally { setApproving(false); }
  }, [doc, nextDocId, approving, router, suggestion]);

  const handleToolbarReject = useCallback(async () => {
    if (!rejectReason.trim() || !doc) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDoc(await res.json());
      // Auto-reject pending suggestion on reject
      if (suggestion?.status === "pending") {
        fetch(`/api/documents/${doc.id}/suggestion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rejected" }),
        }).then(r => r.ok ? r.json() : null).then(s => { if (s) setSuggestion(s); }).catch(() => {});
      }
      toast.success(de.review.rejectSuccess);
      setRejectDialogOpen(false);
      setRejectReason("");
      if (nextDocId) setTimeout(() => router.push(`/documents/${nextDocId}`), 400);
    } catch (err: any) { toast.error(err.message); }
    finally { setRejecting(false); }
  }, [doc, rejectReason, nextDocId, router, suggestion]);

  const handleSuggestionAction = useCallback(async (action: "accepted" | "rejected" | "modified", modifiedTo?: any) => {
    if (!doc || suggestionLoading) return;
    setSuggestionLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, modifiedTo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setSuggestion(updated);
      if (action === "accepted") {
        toast.success(de.suggestions.accepted);
        const docRes = await fetch(`/api/documents/${doc.id}`);
        if (docRes.ok) setDoc(await docRes.json());
      } else if (action === "rejected") {
        toast.success(de.suggestions.rejected);
      } else if (action === "modified") {
        toast.success(de.suggestions.accepted);
        const docRes = await fetch(`/api/documents/${doc.id}`);
        if (docRes.ok) setDoc(await docRes.json());
        setModifyDialogOpen(false);
      }
    } catch (err: any) { toast.error(err.message || de.errors.serverError); }
    finally { setSuggestionLoading(false); }
  }, [doc, suggestionLoading]);

  const handlePromoteCorrection = useCallback(async () => {
    if (!correctionPattern) return;
    try {
      const res = await fetch(`/api/corrections/patterns/${correctionPattern.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoteTo: "rule" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.correctionsDashboard.ruleCreated);
      setCorrectionPattern(null);
    } catch (err: any) { toast.error(err.message); }
  }, [correctionPattern]);

  const handleDismissCorrection = useCallback(async () => {
    if (!correctionPattern) return;
    try {
      const res = await fetch(`/api/corrections/patterns/${correctionPattern.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.correctionsDashboard.patternDismissed);
      setCorrectionPattern(null);
    } catch (err: any) { toast.error(err.message); }
  }, [correctionPattern]);

  const handleSkip = useCallback(() => {
    if (nextDocId) router.push(`/documents/${nextDocId}`);
    else { toast.success("Alle Belege geprüft!"); router.push("/documents?status=needs_review"); }
  }, [nextDocId, router]);

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !doc) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          taskType,
          priority: taskPriority,
          relatedDocumentId: doc.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Task erstellt");
      setTaskDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSendMessage = async () => {
    if (!messageBody.trim() || !doc) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Rückfrage zu Beleg ${doc.documentNumber || doc.id.slice(0, 8)}`,
          body: messageBody,
          relatedDocumentId: doc.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.messages.sent);
      setMessageDialogOpen(false);
      setMessageBody("");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateRule = async () => {
    if (!doc) return;
    try {
      const res = await fetch("/api/rules/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: doc.supplierNameNormalized || doc.supplierNameRaw || "",
          actionType: "set_category",
          value: doc.expenseCategory || "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`${de.reviewCockpit.ruleCreated}: ${ruleName}`);
      setRuleDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateKnowledge = async () => {
    if (!knowledgeContent.trim() || !doc) return;
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: knowledgeTitle,
          category: knowledgeCategory,
          content: knowledgeContent,
          relatedSupplier: doc.supplierNameNormalized || doc.supplierNameRaw || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.reviewCockpit.knowledgeCreated);
      setKnowledgeDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  // Open dialogs with prefilled values
  function openTaskDialog() {
    if (!doc) return;
    setTaskTitle(`${doc.supplierNameNormalized || doc.supplierNameRaw || "Beleg"} prüfen`);
    setTaskType("review_needed");
    setTaskPriority("medium");
    setTaskDialogOpen(true);
  }

  function openMessageDialog() {
    if (!doc) return;
    setMessageBody(`Bezug: Beleg ${doc.documentNumber || doc.id.slice(0, 8)} von ${doc.supplierNameNormalized || doc.supplierNameRaw || "unbekannt"}\n\n`);
    setMessageDialogOpen(true);
  }

  function openRuleDialog() {
    if (!doc) return;
    const supplier = doc.supplierNameNormalized || doc.supplierNameRaw || "";
    const cat = doc.expenseCategory || "";
    setRuleName(`${supplier} → ${cat}`);
    setRuleDialogOpen(true);
  }

  function openKnowledgeDialog() {
    if (!doc) return;
    setKnowledgeTitle(`${doc.supplierNameNormalized || doc.supplierNameRaw || "Beleg"}`);
    setKnowledgeContent(`Beleg ${doc.documentNumber || doc.id.slice(0, 8)} von ${doc.supplierNameNormalized || doc.supplierNameRaw || "unbekannt"}: `);
    setKnowledgeCategory("booking_rule");
    setKnowledgeDialogOpen(true);
  }

  // --- Keyboard shortcuts (Task 5) ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft" && prevDocId) {
        e.preventDefault();
        router.push(`/documents/${prevDocId}`);
      } else if (e.key === "ArrowRight" && nextDocId) {
        e.preventDefault();
        router.push(`/documents/${nextDocId}`);
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleToolbarApprove();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRejectDialogOpen(true);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSkip();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevDocId, nextDocId, handleToolbarApprove, handleSkip, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Skeleton className="lg:col-span-3 h-[600px]" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!doc || doc.error) {
    return (
      <div className="space-y-4">
        <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">{de.detail.backToList}</Link>
        <p className="text-muted-foreground">Beleg nicht gefunden.</p>
      </div>
    );
  }

  const isReviewable = doc && ["needs_review", "ready", "extracted", "validated"].includes(doc.status);

  return (
    <div className="space-y-4">
      {/* Enhanced header */}
      <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">{de.detail.backToList}</Link>

      {/* Review toolbar */}
      {isReviewable && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg">
          <Button variant="outline" size="sm" disabled={!prevDocId} onClick={() => prevDocId && router.push(`/documents/${prevDocId}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" />{de.reviewCockpit.previous}
          </Button>

          {queuePosition && (
            <span className="text-sm text-muted-foreground px-2">
              {de.reviewCockpit.position} {queuePosition.current} {de.reviewCockpit.of} {queuePosition.total} {de.reviewCockpit.inQueue}
            </span>
          )}

          <Button variant="outline" size="sm" disabled={!nextDocId} onClick={() => nextDocId && router.push(`/documents/${nextDocId}`)}>
            {de.reviewCockpit.next}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={approving} onClick={handleToolbarApprove}>
            {approving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            {de.reviewCockpit.approve}
          </Button>
          <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setRejectDialogOpen(true)}>
            <XCircle className="h-4 w-4 mr-1" />{de.reviewCockpit.reject}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" />{de.reviewCockpit.skip}
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button size="sm" variant="ghost" onClick={openTaskDialog}>
            <ClipboardList className="h-4 w-4 mr-1" />{de.reviewCockpit.createTask}
          </Button>
          <Button size="sm" variant="ghost" onClick={openMessageDialog}>
            <MessageSquare className="h-4 w-4 mr-1" />{de.reviewCockpit.askClient}
          </Button>
          <Button size="sm" variant="ghost" onClick={openRuleDialog}>
            <Lightbulb className="h-4 w-4 mr-1" />{de.reviewCockpit.createRule}
          </Button>
          <Button size="sm" variant="ghost" onClick={openKnowledgeDialog}>
            <BookOpen className="h-4 w-4 mr-1" />{de.reviewCockpit.createKnowledge}
          </Button>
        </div>
      )}

      {/* Correction Pattern Hint */}
      {correctionPattern && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          <div className="flex items-start gap-2">
            <span>⚡</span>
            <div>
              <strong>{de.correctionsDashboard.patternHint}:</strong>{" "}
              Bei {correctionPattern.supplierName || "diesem Lieferanten"} wurde &quot;{correctionPattern.field}&quot; {correctionPattern.occurrences}× von {correctionPattern.fromValue || "—"} auf {correctionPattern.toValue} korrigiert.
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handlePromoteCorrection}>
              {de.correctionsDashboard.promoteRule}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismissCorrection}>
              {de.correctionsDashboard.dismiss}
            </Button>
          </div>
        </div>
      )}

      {/* Suggestion Panel */}
      <SuggestionPanel
        suggestion={suggestion}
        loading={suggestionLoading}
        onAccept={() => handleSuggestionAction("accepted")}
        onReject={() => handleSuggestionAction("rejected")}
        onModify={() => {
          if (suggestion) {
            setModifyAccount(suggestion.suggestedAccount || "");
            setModifyCategory(suggestion.suggestedCategory || "");
            setModifyCostCenter(suggestion.suggestedCostCenter || "");
            setModifyVatCode(suggestion.suggestedVatCode || "");
            setModifyDialogOpen(true);
          }
        }}
      />

      {/* Modify suggestion dialog */}
      <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.suggestions.panel.adjustDialog}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{de.suggestions.panel.account}</Label>
              <Input value={modifyAccount} onChange={(e) => setModifyAccount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{de.suggestions.panel.category}</Label>
              <Input value={modifyCategory} onChange={(e) => setModifyCategory(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{de.suggestions.panel.costCenter}</Label>
              <Input value={modifyCostCenter} onChange={(e) => setModifyCostCenter(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{de.suggestions.panel.vatCode}</Label>
              <Input value={modifyVatCode} onChange={(e) => setModifyVatCode(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={() => handleSuggestionAction("modified", {
              account: modifyAccount, category: modifyCategory,
              costCenter: modifyCostCenter, vatCode: modifyVatCode,
            })} disabled={suggestionLoading}>
              {suggestionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {de.suggestions.accept}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between">
        <div>
          {doc.documentNumber && (
            <span className="text-lg font-mono font-semibold text-blue-700">{doc.documentNumber}</span>
          )}
          <h1 className="text-sm text-muted-foreground">
            {doc.file?.fileName || `Beleg ${doc.id.slice(0, 8)}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <DocumentStatusBadge status={doc.status} />
          <span className={`text-sm font-medium ${getConfidenceColor(doc.confidenceScore)}`}>
            {formatConfidence(doc.confidenceScore)}
          </span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(doc.createdAt)}</span>
          {/* Bexio export status */}
          {doc.exportStatus === "exported" ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">{de.bexio.alreadyExported} ✓</Badge>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={async () => {
                if (!confirm(de.bexio.reExportConfirm)) return;
                setExporting(true);
                try {
                  const res = await fetch("/api/bexio/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: doc.id, force: true }) });
                  const data = await res.json();
                  if (data.results?.[0]?.success) { toast.success(de.bexio.exportSuccess); const r = await fetch(`/api/documents/${doc.id}`); if (r.ok) setDoc(await r.json()); }
                  else toast.error(data.results?.[0]?.error || de.bexio.exportFailed);
                } catch { toast.error(de.bexio.exportFailed); } finally { setExporting(false); }
              }}>{de.bexio.reExport}</button>
            </div>
          ) : doc.exportStatus === "export_failed" ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">{de.bexio.exportFailed}</Badge>
              <Button size="sm" variant="outline" disabled={exporting} onClick={async () => {
                setExporting(true);
                try {
                  const res = await fetch("/api/bexio/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: doc.id, force: true }) });
                  const data = await res.json();
                  if (data.results?.[0]?.success) { toast.success(de.bexio.exportSuccess); const r = await fetch(`/api/documents/${doc.id}`); if (r.ok) setDoc(await r.json()); }
                  else toast.error(data.results?.[0]?.error || de.bexio.exportFailed);
                } catch { toast.error(de.bexio.exportFailed); } finally { setExporting(false); }
              }}>
                {exporting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                {de.bexio.retryExport}
              </Button>
            </div>
          ) : doc.status === "ready" ? (
            <Button size="sm" variant="outline" disabled={exporting} onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/bexio/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: doc.id }) });
                const data = await res.json();
                if (data.results?.[0]?.success) { toast.success(de.bexio.exportSuccess); const r = await fetch(`/api/documents/${doc.id}`); if (r.ok) setDoc(await r.json()); }
                else toast.error(data.results?.[0]?.error || de.bexio.exportFailed);
              } catch { toast.error(de.bexio.exportFailed); } finally { setExporting(false); }
            }}>
              {exporting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
              {de.bexio.exportToBexio}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Main layout: PDF + Review Form */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <PdfViewer documentId={doc.id} mimeType={doc.file?.mimeType} />
        </div>
        <div className="lg:col-span-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <ReviewForm document={doc} onUpdate={setDoc} nextDocumentId={nextDocId} queuePosition={queuePosition} />
        </div>
      </div>

      {/* Decision Transparency */}
      <DecisionReasonsPanel reasons={doc.decisionReasons} />

      {/* Similar Documents Panel (Task 4) */}
      <SimilarDocsPanel similarDocs={similarDocs} currentDoc={doc} />

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.review.rejectDialogTitle}</DialogTitle>
            <DialogDescription>{de.review.rejectDialogDescription}</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={de.review.rejectReasonRequired} rows={3} />
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleToolbarReject} disabled={!rejectReason.trim() || rejecting} variant="destructive">
              {rejecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {de.review.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task creation dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.reviewCockpit.createTask}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Titel</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Typ</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {Object.entries(de.tasksMgmt.taskTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Priorität</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                {Object.entries(de.tasksMgmt.priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleCreateTask} disabled={!taskTitle.trim()}>{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.reviewCockpit.askClient}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{de.messages.body}</Label>
              <Textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSendMessage} disabled={!messageBody.trim()}>{de.messages.send}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule from correction dialog (Task 3) */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.reviewCockpit.createRuleFromDoc}</DialogTitle>
            <DialogDescription>
              Condition: supplierName contains &quot;{doc.supplierNameNormalized || doc.supplierNameRaw}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Action: set_category = &quot;{doc.expenseCategory || "—"}&quot;</p>
              {doc.accountCode && <p>Action: set_account_code = &quot;{doc.accountCode}&quot;</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleCreateRule}>{de.reviewCockpit.createRule}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge entry dialog (Task 3) */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{de.reviewCockpit.createKnowledge}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Titel</Label>
              <Input value={knowledgeTitle} onChange={(e) => setKnowledgeTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={knowledgeCategory} onChange={(e) => setKnowledgeCategory(e.target.value)}>
                {Object.entries(de.knowledge.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{de.knowledge.content}</Label>
              <Textarea value={knowledgeContent} onChange={(e) => setKnowledgeContent(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleCreateKnowledge} disabled={!knowledgeContent.trim()}>{de.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="validation">
        <TabsList>
          <TabsTrigger value="validation">{de.validation.title}</TabsTrigger>
          <TabsTrigger value="ocr">{de.detail.rawOcr}</TabsTrigger>
          <TabsTrigger value="ai">{de.detail.rawAi}</TabsTrigger>
          <TabsTrigger value="history">{de.detail.processingHistory}</TabsTrigger>
        </TabsList>

        <TabsContent value="validation" className="mt-4">
          <Card><CardContent className="pt-4">
            {doc.validationResults?.checks?.length > 0 ? (
              <div className="space-y-2">
                {doc.validationResults.checks.map((check: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded ${!check.passed ? (check.severity === "error" ? "bg-red-50" : "bg-amber-50") : ""}`}>
                    <span className={`mt-0.5 ${check.passed ? "text-green-600" : check.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
                      {check.passed ? "✓" : check.severity === "error" ? "✗" : "⚠"}
                    </span>
                    <div>
                      <span className="font-medium">{check.checkName}</span>
                      <p className="text-muted-foreground text-xs">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{de.detail.noData}</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ocr" className="mt-4">
          <Card><CardContent className="pt-4">
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
              {doc.ocrResult ? JSON.stringify(doc.ocrResult.rawPayload, null, 2) : de.detail.noData}
            </pre>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card><CardContent className="pt-4">
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
              {doc.aiResults?.[0] ? JSON.stringify(doc.aiResults[0].normalizedData, null, 2) : de.detail.noData}
            </pre>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="pt-4 space-y-6">
            {doc.processingSteps?.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{de.detail.stepName}</TableHead>
                  <TableHead>{de.detail.stepStatus}</TableHead>
                  <TableHead>{de.detail.duration}</TableHead>
                  <TableHead>{de.detail.timestamp}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {doc.processingSteps.map((step: any) => (
                    <TableRow key={step.id}>
                      <TableCell>{de.processingStep[step.stepName as keyof typeof de.processingStep] || step.stepName}</TableCell>
                      <TableCell><DocumentStatusBadge status={step.status === "completed" ? "ready" : step.status === "failed" ? "failed" : "processing"} /></TableCell>
                      <TableCell>{step.durationMs != null ? `${step.durationMs}ms` : de.common.noData}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(step.startedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {auditEntries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">{de.auditLog.title}</h3>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{de.auditLog.timestamp}</TableHead>
                    <TableHead>{de.auditLog.user}</TableHead>
                    <TableHead>{de.auditLog.action}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {auditEntries.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs">{formatRelativeTime(entry.createdAt)}</TableCell>
                        <TableCell className="text-xs">{entry.user?.name || de.common.noData}</TableCell>
                        <TableCell className="text-xs">{de.auditLog.actions[entry.action] || entry.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Keyboard shortcuts hint (Task 5) */}
      {isReviewable && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Keyboard className="h-3.5 w-3.5" />
          <span>{de.reviewCockpit.keyboardShortcuts} | S Zurückstellen</span>
        </div>
      )}
    </div>
  );
}

function SimilarDocsPanel({ similarDocs, currentDoc }: { similarDocs: any[]; currentDoc: any }) {
  if (similarDocs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{de.reviewCockpit.similarDocs}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{de.reviewCockpit.noSimilar}</p>
        </CardContent>
      </Card>
    );
  }

  // Check for consistent booking pattern
  const sameSupplierDocs = similarDocs.filter(
    (d) => d.supplierName === (currentDoc.supplierNameNormalized || currentDoc.supplierNameRaw)
  );
  const accountCodes = new Set(sameSupplierDocs.map((d) => d.accountCode).filter(Boolean));
  const hasConsistentPattern = sameSupplierDocs.length >= 5 && accountCodes.size === 1;
  const hasVaryingPattern = sameSupplierDocs.length >= 2 && accountCodes.size > 1;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{de.reviewCockpit.similarDocs}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {hasConsistentPattern && (
          <div className="text-xs px-2 py-1.5 rounded bg-green-50 text-green-700 border border-green-200">
            {de.reviewCockpit.consistentPattern}
          </div>
        )}
        {hasVaryingPattern && (
          <div className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {de.reviewCockpit.varyingPattern}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Belegnr.</TableHead>
              <TableHead className="text-xs">{de.documents.supplier}</TableHead>
              <TableHead className="text-xs">{de.documents.amount}</TableHead>
              <TableHead className="text-xs">Konto</TableHead>
              <TableHead className="text-xs">{de.documents.status}</TableHead>
              <TableHead className="text-xs">{de.documents.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {similarDocs.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-xs font-mono">
                  <Link href={`/documents/${d.id}`} className="text-blue-600 hover:underline">
                    {d.documentNumber || "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">{d.supplierName || "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatCurrency(d.grossAmount, "CHF")}</TableCell>
                <TableCell className="text-xs">{d.accountCode || "—"}</TableCell>
                <TableCell><DocumentStatusBadge status={d.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const sourceIcons: Record<string, string> = {
  history: "🟢",
  rule: "🔵",
  knowledge: "🟣",
  supplier_default: "⚪",
};

function SuggestionPanel({
  suggestion,
  loading,
  onAccept,
  onReject,
  onModify,
}: {
  suggestion: any;
  loading: boolean;
  onAccept: () => void;
  onReject: () => void;
  onModify: () => void;
}) {
  if (!suggestion) return null;

  // Already handled
  if (suggestion.status !== "pending") {
    const statusText = suggestion.status === "accepted" ? de.suggestions.accepted
      : suggestion.status === "rejected" ? de.suggestions.rejected
      : de.suggestions.accepted;
    const handledDate = suggestion.acceptedAt || suggestion.rejectedAt || suggestion.updatedAt;
    return (
      <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/50 rounded-md">
        {statusText} {handledDate ? `am ${new Date(handledDate).toLocaleDateString("de-CH")}` : ""}
      </div>
    );
  }

  const level = suggestion.confidenceLevel as "high" | "medium" | "low";
  const borderColor = level === "high" ? "border-green-300" : level === "medium" ? "border-amber-300" : "border-gray-300";
  const badgeColor = level === "high" ? "bg-green-100 text-green-800" : level === "medium" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700";
  const sources = suggestion.reasoning?.sources || [];

  return (
    <Card className={`border-2 ${borderColor}`}>
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span className="text-sm font-medium">{de.suggestions.title}</span>
          </div>
          <Badge className={`text-xs ${badgeColor}`}>
            {de.suggestions.confidence[level]} ({Math.round(suggestion.confidenceScore * 100)}%)
          </Badge>
        </div>

        <div className="text-sm text-foreground">
          {suggestion.suggestedAccount && <span>{de.suggestions.panel.account}: <strong>{suggestion.suggestedAccount}</strong></span>}
          {suggestion.suggestedCategory && <><span className="text-muted-foreground mx-1">·</span><span>{de.suggestions.panel.category}: <strong>{suggestion.suggestedCategory}</strong></span></>}
          {suggestion.suggestedVatCode && <><span className="text-muted-foreground mx-1">·</span><span>{de.suggestions.panel.vatCode}: <strong>{suggestion.suggestedVatCode}%</strong></span></>}
          {suggestion.suggestedCostCenter && <><span className="text-muted-foreground mx-1">·</span><span>{de.suggestions.panel.costCenter}: <strong>{suggestion.suggestedCostCenter}</strong></span></>}
        </div>

        {sources.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{de.suggestions.reasoning}:</span>
            {sources.map((s: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                <span>{sourceIcons[s.type] || "•"}</span>
                <span>{s.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {de.suggestions.consistencyRate}: {Math.round(suggestion.consistencyRate * 100)}% · {de.suggestions.basedOn} {suggestion.matchedDocCount} {de.suggestions.matchedDocs}
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={loading} onClick={onAccept}>
            {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            {de.suggestions.accept}
          </Button>
          <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={loading} onClick={onReject}>
            <XCircle className="h-3 w-3 mr-1" />{de.suggestions.reject}
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={onModify}>
            {de.suggestions.modify}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionReasonsPanel({ reasons }: { reasons: any }) {
  if (!reasons) {
    return (
      <Card>
        <CardContent className="py-3">
          <p className="text-sm font-medium mb-1">{de.decisionReasons.title}</p>
          <p className="text-xs text-muted-foreground">{de.decisionReasons.noDetails}</p>
        </CardContent>
      </Card>
    );
  }

  const r = reasons as {
    confidence?: number;
    threshold?: number;
    escalations?: string[];
    appliedRules?: string[];
    knowledgeUsed?: string[];
    validationErrors?: string[];
    validationWarnings?: string[];
    decision?: string;
    decidedAt?: string;
  };

  const aboveThreshold = (r.confidence ?? 0) >= (r.threshold ?? 0.65);

  return (
    <Card>
      <CardContent className="py-3 space-y-3">
        <p className="text-sm font-medium">{de.decisionReasons.title}</p>

        {/* Confidence vs Threshold */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span>
            {de.decisionReasons.confidence}:{" "}
            <span className={`font-bold ${aboveThreshold ? "text-green-700" : "text-red-700"}`}>
              {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—"}
            </span>
          </span>
          <span className="text-muted-foreground">
            ({de.decisionReasons.threshold}: {r.threshold != null ? `${Math.round(r.threshold * 100)}%` : "—"})
          </span>
          {r.decision && (
            <Badge variant={r.decision === "auto_ready" ? "secondary" : "destructive"} className="text-xs">
              {de.status[r.decision as keyof typeof de.status] || r.decision}
            </Badge>
          )}
          {r.decidedAt && (
            <span className="text-muted-foreground">
              {de.decisionReasons.decidedAt}: {new Date(r.decidedAt).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Tag groups */}
        <div className="flex flex-wrap gap-2">
          {r.escalations?.map((e, i) => (
            <span key={`esc-${i}`} className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">{e}</span>
          ))}
          {r.validationErrors?.map((e, i) => (
            <span key={`err-${i}`} className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">{e}</span>
          ))}
          {r.validationWarnings?.map((w, i) => (
            <span key={`warn-${i}`} className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">{w}</span>
          ))}
          {r.appliedRules?.map((rule, i) => (
            <span key={`rule-${i}`} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">{rule}</span>
          ))}
          {r.knowledgeUsed?.map((k, i) => (
            <span key={`know-${i}`} className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">{k}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
