"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { ReviewForm } from "@/components/review/review-form";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextDocId, setNextDocId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [queuePosition, setQueuePosition] = useState<{ current: number; total: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const docRes = await fetch(`/api/documents/${params.id}`);
        if (docRes.ok) setDoc(await docRes.json());

        const auditRes = await fetch(`/api/documents/${params.id}/audit`).catch(() => null);
        if (auditRes?.ok) {
          const audit = await auditRes.json();
          setAuditEntries(Array.isArray(audit) ? audit : []);
        }

        // Fetch review queue for position + next document
        const queueRes = await fetch(`/api/documents?status=needs_review&pageSize=100&sortBy=confidenceScore&sortOrder=asc`).catch(() => null);
        if (queueRes?.ok) {
          const queue = await queueRes.json();
          const docs = queue.documents || [];
          const idx = docs.findIndex((d: any) => d.id === params.id);
          if (idx >= 0) {
            setQueuePosition({ current: idx + 1, total: docs.length });
            const nextDoc = docs[idx + 1];
            setNextDocId(nextDoc?.id || null);
          } else {
            const next = docs[0];
            setNextDocId(next?.id || null);
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

  return (
    <div className="space-y-4">
      {/* Enhanced header */}
      <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">{de.detail.backToList}</Link>

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
          {doc.status === "ready" && (
            <Button size="sm" variant="outline" disabled={exporting} onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/bexio/export", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ documentId: doc.id }),
                });
                const data = await res.json();
                if (data.results?.[0]?.success) {
                  toast.success(de.bexio.exportSuccess);
                  const r = await fetch(`/api/documents/${doc.id}`);
                  if (r.ok) setDoc(await r.json());
                } else {
                  toast.error(data.results?.[0]?.error || de.bexio.exportFailed);
                }
              } catch { toast.error(de.bexio.exportFailed); }
              finally { setExporting(false); }
            }}>
              {exporting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
              {de.bexio.exportToBexio}
            </Button>
          )}
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
    </div>
  );
}
