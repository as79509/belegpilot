"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
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
import { DetailPageSkeleton } from "@/components/ds/page-skeleton";
import { Button } from "@/components/ui/button";
import {
  Link2, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  SkipForward, ClipboardList, MessageSquare, BookOpen, Lightbulb,
  Keyboard, ChevronDown, ChevronUp, GitBranch, Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { ReviewForm } from "@/components/review/review-form";
import { ConfidenceBadge } from "@/components/ds/confidence-badge";
import { StatusBadge } from "@/components/ds/status-badge";
import { SectionCard } from "@/components/ds/section-card";
import { TrustSignal } from "@/components/ds/trust-signal";
import { ProtectionBadge } from "@/components/ds/protection-badge";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime, formatConfidence, formatCurrency, getConfidenceColor } from "@/lib/i18n/format";
import { useRecentItems } from "@/lib/hooks/use-recent-items";
import { useReviewShortcuts } from "@/lib/hooks/use-review-shortcuts";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addRecent } = useRecentItems();
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
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Suggestion
  const [suggestion, setSuggestion] = useState<any>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Autopilot Event
  const [autopilotEvent, setAutopilotEvent] = useState<any>(null);

  // Decision Replay
  const [decisionReplay, setDecisionReplay] = useState<any>(null);

  // Next Actions
  const [nextActions, setNextActions] = useState<any[]>([]);

  // Supplier context (Phase 8.8.1: Review-Kontext)
  const [supplierContext, setSupplierContext] = useState<any>(null);

  // Payment status
  const [paymentStatus, setPaymentStatus] = useState<any>(null);

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

        // Fetch decision replay
        const drRes = await fetch(`/api/documents/${params.id}/decision-replay`).catch(() => null);
        if (drRes?.ok) {
          const drData = await drRes.json();
          if (drData && !drData.error) setDecisionReplay(drData);
        }

        // Fetch next actions for this document
        const naRes = await fetch(`/api/next-actions?scope=document&id=${params.id}`).catch(() => null);
        if (naRes?.ok) {
          const naData = await naRes.json();
          setNextActions(Array.isArray(naData?.actions) ? naData.actions : []);
        }

        // Fetch payment status
        const payRes = await fetch(`/api/documents/${params.id}/payment-status`).catch(() => null);
        if (payRes?.ok) {
          const payData = await payRes.json();
          setPaymentStatus(payData);
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

          // Fetch supplier context (defaults / pattern) for Review-Kontext panel
          const ctxRes = await fetch(`/api/suppliers/${supplierIdForPatterns}/suggest-defaults`).catch(() => null);
          if (ctxRes?.ok) {
            const ctxData = await ctxRes.json();
            if (ctxData?.pattern) setSupplierContext(ctxData);
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

  // Track in recent items when doc loads
  useEffect(() => {
    if (doc?.id) {
      const title = doc.documentNumber || doc.invoiceNumber || "Beleg";
      const supplierName = doc.supplierNameNormalized || doc.supplierNameRaw;
      const fullTitle = supplierName ? `${title} · ${supplierName}` : title;
      addRecent("document", doc.id, fullTitle, `/documents/${doc.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  // Load review queue for navigation
  useEffect(() => {
    fetch("/api/documents?status=needs_review&pageSize=50")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.documents) {
          const ids = data.documents.map((d: any) => d.id);
          setReviewQueue(ids);
          setCurrentIndex(ids.indexOf(params.id));
        }
      })
      .catch(() => {});
  }, [params.id]);

  // --- Review toolbar actions ---
  const handleToolbarApprove = useCallback(async () => {
    if (approving || !doc) return;
    setApproving(true);
    const prevStatus = doc.status;
    setDoc((prev: any) => prev ? { ...prev, status: "approved" } : null);
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
    } catch (err: any) {
      setDoc((prev: any) => prev ? { ...prev, status: prevStatus } : null);
      toast.error(err.message || de.errors.serverError);
    }
    finally { setApproving(false); }
  }, [doc, nextDocId, approving, router, suggestion]);

  const handleToolbarReject = useCallback(async () => {
    if (!rejectReason.trim() || !doc) return;
    setRejecting(true);
    const prevStatus = doc.status;
    setDoc((prev: any) => prev ? { ...prev, status: "rejected" } : null);
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
    } catch (err: any) {
      setDoc((prev: any) => prev ? { ...prev, status: prevStatus } : null);
      toast.error(err.message);
    }
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

  // --- Keyboard shortcuts via reusable hook ---
  useReviewShortcuts({
    onApprove: handleToolbarApprove,
    onReject: () => setRejectDialogOpen(true),
    onNext: () => {
      if (currentIndex < reviewQueue.length - 1) router.push(`/documents/${reviewQueue[currentIndex + 1]}`);
      else if (nextDocId) router.push(`/documents/${nextDocId}`);
    },
    onPrevious: () => {
      if (currentIndex > 0) router.push(`/documents/${reviewQueue[currentIndex - 1]}`);
      else if (prevDocId) router.push(`/documents/${prevDocId}`);
    },
    onSkip: handleSkip,
    enabled: reviewQueue.length > 0 || !!nextDocId || !!prevDocId,
  });

  if (loading) return <DetailPageSkeleton />;

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
        <div className="space-y-2">
          {/* Queue navigation bar */}
          {reviewQueue.length > 1 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={currentIndex <= 0}
                  onClick={() => currentIndex > 0 && router.push(`/documents/${reviewQueue[currentIndex - 1]}`)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Vorheriger
                </Button>
                <span className="text-muted-foreground">
                  {currentIndex + 1} von {reviewQueue.length} zur Prüfung
                </span>
                <Button variant="ghost" size="sm" disabled={currentIndex >= reviewQueue.length - 1}
                  onClick={() => currentIndex < reviewQueue.length - 1 && router.push(`/documents/${reviewQueue[currentIndex + 1]}`)}>
                  Nächster <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">A</kbd> Genehmigen
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] ml-2">R</kbd> Ablehnen
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] ml-2">J</kbd>/<kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">K</kbd> Navigation
              </div>
            </div>
          )}

          {/* Action toolbar */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={approving} onClick={handleToolbarApprove}>
              {approving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {de.reviewCockpit.approve}
              <kbd className="ml-2 px-1 py-0.5 bg-green-700 rounded text-[10px]">A</kbd>
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-1.5" />{de.reviewCockpit.reject}
              <kbd className="ml-2 px-1 py-0.5 bg-red-700 rounded text-[10px]">R</kbd>
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

      {/* Autopilot Event Hint */}
      <AutopilotEventBox event={autopilotEvent} />

      {/* Next Action Hint */}
      <NextActionHint actions={nextActions} />

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

      {/* Trust & Protection Signals */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Trust level based on suggestion */}
        {suggestion && suggestion.status === "pending" && (
          <TrustSignal
            level={suggestion.confidenceScore >= 0.85 ? "ai_confirmed" : "ai_suggested"}
            confidence={suggestion.confidenceScore}
            reason={suggestion.reasoning || "KI-basierte Kontierung"}
            source={suggestion.ruleId ? `Regel` : suggestion.supplierDefault ? "Lieferanten-Default" : "KI-Analyse"}
          />
        )}
        {suggestion && suggestion.status === "accepted" && (
          <TrustSignal level="ai_confirmed" reason="Vorschlag übernommen" />
        )}
        {doc.recordReviewStatus === "approved" && (
          <TrustSignal level="manual" reason="Manuell genehmigt" />
        )}
        {doc.recordReviewStatus === "rejected" && (
          <TrustSignal level="blocked" reason={doc.rejectionReason || "Abgelehnt"} />
        )}
        {autopilotEvent && autopilotEvent.decision === "auto_ready" && (
          <TrustSignal level="ai_confirmed" reason="Autopilot hat automatisch genehmigt" source="Autopilot" confidence={autopilotEvent.confidenceScore} />
        )}
        {autopilotEvent && autopilotEvent.decision === "blocked" && (
          <ProtectionBadge type="autopilot_blocked" detail={autopilotEvent.blockedBy || undefined} />
        )}
        {doc.status === "needs_review" && (
          <ProtectionBadge type="review_required" />
        )}
        {doc.isEscalated && (
          <ProtectionBadge type="escalated" />
        )}
      </div>

      {/* Review-Kontext Panel (Phase 8.8.1) */}
      <ReviewContextPanel
        doc={doc}
        supplierContext={supplierContext}
        similarDocs={similarDocs}
      />

      {/* Payment Status (Phase 9.2.2) */}
      <PaymentStatusPanel paymentStatus={paymentStatus} currency={doc.currency || "CHF"} />

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
          <TabsTrigger value="replay">{de.decisionReplay.title}</TabsTrigger>
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

        <TabsContent value="replay" className="mt-4">
          <DecisionReplayPanel replay={decisionReplay} />
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

function AutopilotEventBox({ event }: { event: any }) {
  if (!event) return null;

  // Snapshot kann das alte Format ({checkName: {...}}) oder neue Format
  // ({checks, suggestion, action, mode, ...}) haben.
  const snapshot = event.safetyChecks || {};
  const isNewFormat =
    snapshot && typeof snapshot === "object" && "checks" in snapshot;
  const checks = isNewFormat ? snapshot.checks : snapshot;
  const checksArray = checks && typeof checks === "object" ? Object.values(checks) : [];
  const passedCount = checksArray.filter((c: any) => c?.passed).length;
  const totalCount = checksArray.length;

  const action = isNewFormat ? snapshot.action : null;
  const mode = event.mode as string;
  const eligible = event.decision === "eligible";
  const blockedByKey = event.blockedBy as string | null;

  const suggestionSnap = isNewFormat ? snapshot.suggestion : null;
  const suggestedAccount = suggestionSnap?.suggestedAccount || event.suggestedAccount;
  const suggestedCategory = suggestionSnap?.suggestedCategory;

  // Auto-Ready
  if (action === "auto_ready" || (mode === "auto_ready" && eligible)) {
    return (
      <div className="px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-sm flex items-start gap-2">
        <span>✅</span>
        <div>
          <strong>{de.autopilot.title}: {de.autopilot.pipeline.autoReady}</strong>
          <span className="text-xs text-muted-foreground ml-2">
            ({de.autopilot.pipeline.allChecksPassed}: {passedCount}/{totalCount})
          </span>
          {(suggestedAccount || suggestedCategory) && (
            <div className="text-xs mt-0.5">
              {suggestedAccount && <>Konto <strong>{suggestedAccount}</strong></>}
              {suggestedAccount && suggestedCategory && <span className="text-muted-foreground"> · </span>}
              {suggestedCategory && <>Kategorie <strong>{suggestedCategory}</strong></>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Prefill
  if (action === "prefill" || (mode === "prefill" && eligible)) {
    return (
      <div className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm flex items-start gap-2">
        <span>⚡</span>
        <div>
          <strong>{de.autopilot.title}: {de.autopilot.pipeline.prefilled}</strong>
          {(suggestedAccount || suggestedCategory) && (
            <span className="text-xs text-muted-foreground ml-2">
              ({suggestedAccount ? `Konto ${suggestedAccount}` : ""}
              {suggestedAccount && suggestedCategory ? ", " : ""}
              {suggestedCategory ? `Kategorie ${suggestedCategory}` : ""})
            </span>
          )}
        </div>
      </div>
    );
  }

  // Shadow + eligible
  if (mode === "shadow" && eligible) {
    return (
      <div className="px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-sm flex items-start gap-2">
        <span>👁</span>
        <div>
          <strong>{de.autopilot.title} ({de.autopilot.pipeline.shadow}):</strong>{" "}
          {de.autopilot.pipeline.wouldBeEligible}
          <span className="text-xs text-muted-foreground ml-2">
            ({de.autopilot.pipeline.allChecksPassed})
          </span>
        </div>
      </div>
    );
  }

  // Blocked
  if (!eligible && blockedByKey) {
    const blockedDetail = (checks as any)?.[blockedByKey]?.detail || blockedByKey;
    return (
      <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm flex items-start gap-2">
        <span>🔒</span>
        <div>
          <strong>{de.autopilot.title}: {de.autopilot.pipeline.blocked}</strong>
          <span className="text-xs text-muted-foreground ml-2">
            {de.autopilot.pipeline.blockedByCheck} &quot;{blockedDetail}&quot;
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function NextActionHint({ actions }: { actions: any[] }) {
  if (!actions || actions.length === 0) return null;
  const primary = actions[0];
  const alternative = actions[1];

  return (
    <div className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm space-y-1">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-blue-900">{de.nextActions.recommended}: </span>
          <span className="text-blue-800">{primary.title}</span>
          <Link
            href={primary.targetUrl}
            className="inline-flex items-center gap-1 ml-2 text-xs text-blue-700 hover:text-blue-900 underline whitespace-nowrap"
          >
            {de.nextActions.goTo}
          </Link>
        </div>
      </div>
      {alternative && (
        <div className="flex items-start gap-2 pl-6">
          <span className="text-xs text-blue-700">
            {de.nextActions.alternative}: {alternative.title}
          </span>
          <Link
            href={alternative.targetUrl}
            className="text-xs text-blue-700 hover:text-blue-900 underline whitespace-nowrap"
          >
            {de.nextActions.goTo}
          </Link>
        </div>
      )}
    </div>
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

// Phase 8.9.1: Decision Replay — full pipeline reconstruction
function DecisionReplayPanel({ replay }: { replay: any }) {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());

  if (!replay) {
    return (
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">{de.decisionReplay.noSteps}</p>
        </CardContent>
      </Card>
    );
  }

  const timeline = (replay.timeline || []) as Array<{
    step: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    metadata: any;
    errorMessage?: string | null;
  }>;

  function toggleStep(idx: number) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function stepLabel(name: string): string {
    const map = de.decisionReplay.pipelineSteps as Record<string, string>;
    return map[name] || (de.processingStep as Record<string, string>)[name] || name;
  }

  function statusDot(status: string): string {
    if (status === "completed") return "bg-green-500";
    if (status === "failed") return "bg-red-500";
    return "bg-gray-300";
  }

  const suggestion = replay.suggestion;
  const autopilot = replay.autopilot;
  const corrections = (replay.corrections || []) as Array<any>;
  const rules = (replay.rulesApplied || []) as Array<any>;

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <SectionCard title={de.decisionReplay.title} icon={GitBranch}>
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">{de.decisionReplay.noSteps}</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3 pl-4 max-h-[480px] overflow-y-auto">
            {timeline.map((s, idx) => {
              const isOpen = openSteps.has(idx);
              const hasMeta =
                (s.metadata && typeof s.metadata === "object" && Object.keys(s.metadata).length > 0) ||
                !!s.errorMessage;
              return (
                <li key={`${s.step}-${idx}`} className="relative">
                  <span
                    className={`absolute -left-[1.42rem] mt-1.5 w-2.5 h-2.5 rounded-full ${statusDot(s.status)}`}
                  />
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => hasMeta && toggleStep(idx)}
                  >
                    <span className="text-sm font-medium">{stepLabel(s.step)}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.durationMs != null ? `${s.durationMs}ms` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(s.startedAt)}
                    </span>
                    {hasMeta && (
                      isOpen ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )
                    )}
                  </div>
                  {isOpen && hasMeta && (
                    <div className="mt-1 ml-1 text-xs space-y-1 bg-muted/40 rounded p-2">
                      {s.errorMessage && (
                        <div className="text-red-700">{s.errorMessage}</div>
                      )}
                      {s.metadata && typeof s.metadata === "object" && (
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
                          {Object.entries(s.metadata as Record<string, any>).map(([k, v]) => (
                            <Fragment key={k}>
                              <dt className="text-muted-foreground font-mono">{k}</dt>
                              <dd className="font-mono break-all">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </dd>
                            </Fragment>
                          ))}
                        </dl>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>

      {/* Suggestion */}
      {suggestion && (
        <SectionCard title={de.decisionReplay.suggestion} icon={Lightbulb}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Konfidenz:</span>
              <strong>{Math.round((suggestion.confidenceScore || 0) * 100)}%</strong>
              <span className="text-muted-foreground">({suggestion.confidenceLevel})</span>
              <span className="text-muted-foreground ml-auto">{suggestion.status}</span>
            </div>
            <div className="flex items-center gap-2">
              {suggestion.suggestedAccount && (
                <span>{de.suggestions.panel.account}: <strong>{suggestion.suggestedAccount}</strong></span>
              )}
              {suggestion.suggestedCategory && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>{de.suggestions.panel.category}: <strong>{suggestion.suggestedCategory}</strong></span>
                </>
              )}
            </div>
            {Array.isArray(suggestion.sources) && suggestion.sources.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-muted-foreground">{de.decisionReplay.sources}:</span>
                <ul className="space-y-0.5">
                  {suggestion.sources.map((src: any, i: number) => (
                    <li key={i} className="flex gap-1.5">
                      <span>•</span>
                      <span><strong>{src.type}</strong>: {src.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Autopilot */}
      {autopilot && (
        <SectionCard title={de.decisionReplay.autopilotDecision} icon={GitBranch}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Modus:</span>
              <strong>{autopilot.mode}</strong>
              <span className="text-muted-foreground">·</span>
              <span className={autopilot.decision === "eligible" ? "text-green-700" : "text-amber-700"}>
                {autopilot.decision === "eligible" ? de.decisionReplay.passed : de.decisionReplay.blocked}
              </span>
              {autopilot.blockedBy && (
                <span className="text-muted-foreground ml-auto">→ {autopilot.blockedBy}</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">{de.decisionReplay.safetyChecks}:</span>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(autopilot.safetyChecks || {}).map(([key, val]: [string, any]) => {
                  const passed =
                    val === true ||
                    (val && typeof val === "object" && val.passed === true);
                  const detail =
                    val && typeof val === "object" && typeof val.detail === "string" ? val.detail : null;
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <span className={passed ? "text-green-600" : "text-red-600"}>
                        {passed ? "✓" : "✗"}
                      </span>
                      <span className="font-mono">{key}</span>
                      {detail && <span className="text-muted-foreground">— {detail}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <SectionCard title={de.decisionReplay.correctionsApplied}>
          <ul className="space-y-1 text-xs">
            {corrections.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
                <span className="font-mono">{c.field}</span>
                <span className="text-muted-foreground line-through">{c.originalValue || "—"}</span>
                <span>→</span>
                <strong>{c.correctedValue}</strong>
                <span className="text-muted-foreground ml-auto">{c.source}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Rules applied */}
      {rules.length > 0 && (
        <SectionCard title={de.decisionReplay.rulesApplied}>
          <ul className="space-y-1 text-xs">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link href={`/rules`} className="text-blue-600 hover:underline font-medium">
                  {r.name}
                </Link>
                <span className="text-muted-foreground font-mono">{r.ruleType}</span>
                {r.actions && (
                  <span className="text-muted-foreground truncate">
                    {typeof r.actions === "object" ? JSON.stringify(r.actions) : String(r.actions)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

// Phase 8.8.1: Review-Kontext Panel — supplier history at a glance
function ReviewContextPanel({
  doc,
  supplierContext,
  similarDocs,
}: {
  doc: any;
  supplierContext: any;
  similarDocs: any[];
}) {
  if (!doc?.supplierId && !supplierContext) {
    return null;
  }

  const pattern = supplierContext?.pattern;
  const supplierName = doc?.supplierNameNormalized || doc?.supplierNameRaw || "—";

  // Build "last 3 decisions" from similar docs filtered to same supplier
  const sameSupplierDocs = (similarDocs || [])
    .filter((d) => d.supplierName === (doc?.supplierNameNormalized || doc?.supplierNameRaw))
    .filter((d) => ["approved", "rejected", "modified"].includes(d.reviewStatus || ""))
    .slice(0, 3);

  // Compute deviations vs pattern
  const currentAmount = doc?.grossAmount != null ? Number(doc.grossAmount) : null;
  const typicalAmount = pattern?.typicalAmount != null ? Number(pattern.typicalAmount) : null;
  const amountDeviationPct =
    currentAmount != null && typicalAmount != null && typicalAmount > 0
      ? Math.round(((currentAmount - typicalAmount) / typicalAmount) * 100)
      : null;
  const amountDeviates =
    amountDeviationPct != null && Math.abs(amountDeviationPct) >= 50;

  // Detect VAT deviation
  const docVatRates = Array.isArray(doc?.vatRatesDetected)
    ? (doc.vatRatesDetected as any[])
    : [];
  const currentVatRate =
    docVatRates.length > 0 && typeof docVatRates[0]?.rate === "number"
      ? Number(docVatRates[0].rate)
      : null;
  const dominantVatRate = pattern?.dominantVatRate != null ? Number(pattern.dominantVatRate) : null;
  const vatDeviates =
    currentVatRate != null && dominantVatRate != null && currentVatRate !== dominantVatRate;

  function daysSince(dateStr: string | Date | null | undefined): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const lastBookingDays = daysSince(pattern?.lastBookingDate);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{de.reviewContext.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Supplier context line */}
        {pattern ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
            <span className="font-medium">{supplierName}</span>
            <StatusBadge type="supplier" value={pattern.isVerified} size="sm" />
            <span className="text-muted-foreground">·</span>
            <span>
              <strong>{pattern.totalApprovedDocs}</strong> {de.reviewContext.approvedDocs}
            </span>
            {pattern.accountStability != null && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  {de.reviewContext.stability}: <strong>{Math.round(pattern.accountStability * 100)}%</strong>
                </span>
              </>
            )}
            {pattern.dominantAccount && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  {de.reviewContext.dominantAccount}: <strong>{pattern.dominantAccount}</strong>
                </span>
              </>
            )}
            {dominantVatRate != null && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  MwSt: <strong>{dominantVatRate}%</strong>
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{de.reviewContext.noContext}</p>
        )}

        {pattern && (typicalAmount != null || lastBookingDays != null) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {lastBookingDays != null && (
              <span>
                {de.reviewContext.lastBooking}: {de.reviewContext.daysAgo.replace("{n}", String(lastBookingDays))}
              </span>
            )}
            {typicalAmount != null && (
              <>
                {lastBookingDays != null && <span>·</span>}
                <span>
                  {de.reviewContext.typicalAmount}: <strong>{formatCurrency(typicalAmount, doc?.currency || "CHF")}</strong>
                  {pattern.amountStdDeviation != null && pattern.isAmountStable && (
                    <> ± {formatCurrency(Number(pattern.amountStdDeviation), doc?.currency || "CHF")}</>
                  )}
                </span>
              </>
            )}
          </div>
        )}

        {/* Deviation hints */}
        {amountDeviates && (
          <div className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            ⚠ {de.reviewContext.amountDeviation}: {formatCurrency(currentAmount!, doc?.currency || "CHF")} {de.reviewContext.typicalAmount.toLowerCase()} {formatCurrency(typicalAmount!, doc?.currency || "CHF")} ({amountDeviationPct! > 0 ? "+" : ""}{amountDeviationPct}%)
          </div>
        )}
        {vatDeviates && (
          <div className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            ⚠ {de.reviewContext.vatDeviation}: {currentVatRate}% — {de.reviewContext.typicalVat}: {dominantVatRate}%
          </div>
        )}

        {/* Last decisions */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{de.reviewContext.lastDocs}</p>
          {sameSupplierDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{de.reviewContext.noDecisions}</p>
          ) : (
            <ul className="space-y-1">
              {sameSupplierDocs.map((d) => {
                const days = daysSince(d.createdAt);
                return (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <Link
                      href={`/documents/${d.id}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {d.documentNumber || d.id.slice(0, 8)}
                    </Link>
                    <StatusBadge type="review" value={d.reviewStatus || ""} size="sm" />
                    {d.accountCode && (
                      <span className="text-muted-foreground">
                        {de.reviewContext.dominantAccount} {d.accountCode}
                      </span>
                    )}
                    {days != null && (
                      <span className="text-muted-foreground ml-auto">
                        {de.reviewContext.daysAgo.replace("{n}", String(days))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Confidence dot */}
        {doc?.confidenceScore != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ConfidenceBadge score={doc.confidenceScore} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Phase 9.2.2: Payment Status Panel
function PaymentStatusPanel({ paymentStatus, currency }: { paymentStatus: any; currency: string }) {
  if (!paymentStatus) return null;

  const statusColors: Record<string, string> = {
    paid: "text-green-600",
    open: "text-slate-500",
    partial: "text-amber-600",
    unclear: "text-red-600",
  };

  const statusDots: Record<string, string> = {
    paid: "bg-green-500",
    open: "bg-slate-400",
    partial: "bg-amber-500",
    unclear: "bg-red-500",
  };

  return (
    <SectionCard title={de.payment.title} icon={Landmark}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${statusDots[paymentStatus.status] || "bg-slate-400"}`} />
          <span className={`font-medium ${statusColors[paymentStatus.status] || ""}`}>
            {(de.payment.status as Record<string, string>)[paymentStatus.status] || paymentStatus.status}
          </span>
        </div>
        {paymentStatus.transactions && paymentStatus.transactions.length > 0 && (
          <div className="space-y-1.5 mt-2">
            <p className="text-xs font-medium text-muted-foreground">{de.payment.details}</p>
            {paymentStatus.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  {formatDate(tx.bookingDate)} · {formatCurrency(tx.amount, currency)} · {tx.bankAccountName}
                  {tx.matchMethod && (
                    <span className="ml-1">
                      · <StatusBadge type="matchMethod" value={tx.matchMethod} size="sm" />
                    </span>
                  )}
                </div>
                <Link href={`/bank`} className="text-blue-600 hover:underline text-xs">
                  {de.payment.openTransaction} →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
