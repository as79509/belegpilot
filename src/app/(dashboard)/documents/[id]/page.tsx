"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { ReviewForm } from "@/components/review/review-form";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime } from "@/lib/i18n/format";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextDocId, setNextDocId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

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

        const queueRes = await fetch(`/api/documents?status=needs_review&pageSize=2&sortBy=confidenceScore&sortOrder=asc`).catch(() => null);
        if (queueRes?.ok) {
          const queue = await queueRes.json();
          const next = queue.documents?.find((d: any) => d.id !== params.id);
          setNextDocId(next?.id || null);
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
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{de.common.loading}</p>
      </div>
    );
  }

  if (!doc || doc.error) {
    return (
      <div className="space-y-4">
        <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">
          {de.detail.backToList}
        </Link>
        <p className="text-muted-foreground">Beleg nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">
          {de.detail.backToList}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {doc.file?.fileName || `Beleg ${doc.id.slice(0, 8)}`}
        </h1>
        <DocumentStatusBadge status={doc.status} />
      </div>

      {/* Main layout: PDF + Review Form */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <PdfViewer documentId={doc.id} mimeType={doc.file?.mimeType} />
        </div>
        <div className="lg:col-span-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <ReviewForm
            document={doc}
            onUpdate={setDoc}
            nextDocumentId={nextDocId}
          />
        </div>
      </div>

      {/* Tabs: Raw data, Validation, History + Audit */}
      <Tabs defaultValue="validation">
        <TabsList>
          <TabsTrigger value="validation">{de.validation.title}</TabsTrigger>
          <TabsTrigger value="ocr">{de.detail.rawOcr}</TabsTrigger>
          <TabsTrigger value="ai">{de.detail.rawAi}</TabsTrigger>
          <TabsTrigger value="history">{de.detail.processingHistory}</TabsTrigger>
        </TabsList>

        <TabsContent value="validation" className="mt-4">
          <Card>
            <CardContent className="pt-4">
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
              ) : (
                <p className="text-sm text-muted-foreground">{de.detail.noData}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocr" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                {doc.ocrResult ? JSON.stringify(doc.ocrResult.rawPayload, null, 2) : de.detail.noData}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                {doc.aiResults?.[0] ? JSON.stringify(doc.aiResults[0].normalizedData, null, 2) : de.detail.noData}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-6">
              {/* Processing steps */}
              {doc.processingSteps?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">{de.detail.processingHistory}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{de.detail.stepName}</TableHead>
                        <TableHead>{de.detail.stepStatus}</TableHead>
                        <TableHead>{de.detail.duration}</TableHead>
                        <TableHead>{de.detail.timestamp}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doc.processingSteps.map((step: any) => (
                        <TableRow key={step.id}>
                          <TableCell>{de.processingStep[step.stepName as keyof typeof de.processingStep] || step.stepName}</TableCell>
                          <TableCell>
                            <DocumentStatusBadge status={step.status === "completed" ? "ready" : step.status === "failed" ? "failed" : "processing"} />
                          </TableCell>
                          <TableCell>{step.durationMs != null ? `${step.durationMs}ms` : de.common.noData}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(step.startedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Audit log entries */}
              {auditEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">{de.auditLog.title}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{de.auditLog.timestamp}</TableHead>
                        <TableHead>{de.auditLog.user}</TableHead>
                        <TableHead>{de.auditLog.action}</TableHead>
                        <TableHead>{de.auditLog.details}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEntries.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">{formatRelativeTime(entry.createdAt)}</TableCell>
                          <TableCell className="text-xs">{entry.user?.name || de.common.noData}</TableCell>
                          <TableCell className="text-xs">
                            {de.auditLog.actions[entry.action as keyof typeof de.auditLog.actions] || entry.action}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {entry.changes ? JSON.stringify(entry.changes).substring(0, 100) : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
