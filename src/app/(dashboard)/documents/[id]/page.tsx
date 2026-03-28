"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DocumentDetailFields } from "@/components/documents/document-detail-fields";
import { de } from "@/lib/i18n/de";
import { formatDate } from "@/lib/i18n/format";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${params.id}/reprocess`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler");
      }
      toast.success("Verarbeitung gestartet");
      router.refresh();
      // Reload document data after a short delay
      setTimeout(() => {
        fetch(`/api/documents/${params.id}`)
          .then((r) => r.json())
          .then(setDoc);
      }, 1000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReprocessing(false);
    }
  }

  useEffect(() => {
    fetch(`/api/documents/${params.id}`)
      .then((r) => r.json())
      .then(setDoc)
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <Link
          href="/documents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
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
        <Link
          href="/documents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {de.detail.backToList}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {doc.file?.fileName || `Beleg ${doc.id.slice(0, 8)}`}
        </h1>
        <DocumentStatusBadge status={doc.status} />
        {["uploaded", "failed"].includes(doc.status) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReprocess}
            disabled={reprocessing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${reprocessing ? "animate-spin" : ""}`}
            />
            {reprocessing ? "Wird verarbeitet..." : "Erneut verarbeiten"}
          </Button>
        )}
      </div>

      {/* Main layout: PDF + Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <PdfViewer
            documentId={doc.id}
            mimeType={doc.file?.mimeType}
          />
        </div>
        <div className="lg:col-span-2">
          <DocumentDetailFields document={doc} />
        </div>
      </div>

      {/* Tabs: Raw data + History */}
      <Tabs defaultValue="ocr">
        <TabsList>
          <TabsTrigger value="ocr">{de.detail.rawOcr}</TabsTrigger>
          <TabsTrigger value="ai">{de.detail.rawAi}</TabsTrigger>
          <TabsTrigger value="history">
            {de.detail.processingHistory}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ocr" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                {doc.ocrResult
                  ? JSON.stringify(doc.ocrResult.rawPayload, null, 2)
                  : de.detail.noData}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                {doc.aiResults?.[0]
                  ? JSON.stringify(
                      doc.aiResults[0].normalizedData,
                      null,
                      2
                    )
                  : de.detail.noData}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {doc.processingSteps?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{de.detail.stepName}</TableHead>
                      <TableHead>{de.detail.stepStatus}</TableHead>
                      <TableHead>{de.detail.duration}</TableHead>
                      <TableHead>{de.detail.error}</TableHead>
                      <TableHead>{de.detail.timestamp}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doc.processingSteps.map((step: any) => (
                      <TableRow key={step.id}>
                        <TableCell>
                          {de.processingStep[
                            step.stepName as keyof typeof de.processingStep
                          ] || step.stepName}
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge
                            status={
                              step.status === "completed"
                                ? "ready"
                                : step.status === "failed"
                                  ? "failed"
                                  : "processing"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {step.durationMs != null
                            ? `${step.durationMs}ms`
                            : de.common.noData}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-red-600">
                          {step.errorMessage || ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(step.startedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {de.detail.noData}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
