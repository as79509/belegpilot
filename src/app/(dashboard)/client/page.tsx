"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EntityHeader, EmptyState, InfoPanel } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import { formatDate, formatRelativeTime } from "@/lib/i18n/format";
import {
  Home, ListTodo, FileWarning, FileText, Clock, Upload, Loader2,
  AlertTriangle, CheckCircle2, Calendar,
} from "lucide-react";
import { toast } from "sonner";

const t = de.clientPortal;

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-slate-100 text-slate-600",
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default function ClientPortalPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/client/dashboard");
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Upload fehlgeschlagen");
        }
      }
      toast.success(t.uploadSuccess);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const nextDeadline = data.upcomingDeadlines?.[0];
  const now = new Date();

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <EntityHeader
        title={`${t.welcome}, ${data.company.name}`}
        subtitle={`${MONTHS[now.getMonth()]} ${now.getFullYear()}`}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Open Tasks */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ListTodo className="h-3.5 w-3.5" />{t.openTasks}
            </div>
            <p className="text-2xl font-bold">{data.openTasks.length}</p>
          </CardContent>
        </Card>

        {/* Missing Documents */}
        <Card className={data.missingDocuments.length > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileWarning className="h-3.5 w-3.5" />{t.missingDocs}
            </div>
            <p className={`text-2xl font-bold ${data.missingDocuments.length > 0 ? "text-red-600" : ""}`}>
              {data.missingDocuments.length}
            </p>
          </CardContent>
        </Card>

        {/* Documents This Month */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3.5 w-3.5" />{t.documentsThisMonth}
            </div>
            <p className="text-2xl font-bold">{data.documentStatus.total}</p>
            {data.documentStatus.total > 0 && (
              <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 mt-2">
                <div className="bg-green-500" style={{ width: `${(data.documentStatus.ready / data.documentStatus.total) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(data.documentStatus.needsReview / data.documentStatus.total) * 100}%` }} />
                <div className="bg-blue-400" style={{ width: `${(data.documentStatus.processing / data.documentStatus.total) * 100}%` }} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Deadline */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3.5 w-3.5" />{t.nextDeadline}
            </div>
            {nextDeadline ? (
              <>
                <p className="text-sm font-medium mt-1">{nextDeadline.title}</p>
                <p className={`text-xs mt-0.5 ${nextDeadline.daysRemaining <= 7 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                  {nextDeadline.daysRemaining} {t.daysRemaining}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{t.noDeadlines}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ListTodo className="h-4 w-4" />{t.openTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t.noTasks}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>{t.priority}</TableHead>
                    <TableHead>{t.dueDate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.openTasks.slice(0, 8).map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="text-sm">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${priorityColors[task.priority] || ""}`}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {task.dueDate ? formatDate(task.dueDate) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Missing Documents */}
        <Card className={data.missingDocuments.length > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" />{t.missingDocs}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.missingDocuments.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 py-4">
                <CheckCircle2 className="h-4 w-4" />{t.noMissingDocs}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.description}</TableHead>
                    <TableHead>{t.supplier}</TableHead>
                    <TableHead className="text-right">{t.overdue}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.missingDocuments.map((doc: any) => (
                    <TableRow key={doc.id} className={doc.daysPastDue > 0 ? "bg-red-50" : ""}>
                      <TableCell className="text-sm">{doc.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.supplierName || "—"}</TableCell>
                      <TableCell className={`text-right text-sm ${doc.daysPastDue > 0 ? "text-red-600 font-medium" : ""}`}>
                        {doc.daysPastDue > 0 ? `${doc.daysPastDue} ${t.days}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document Upload */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" />{t.uploadDocument}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{de.common.loading}</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t.uploadDescription}</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      {data.upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />{t.nextDeadline}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.upcomingDeadlines.map((dl: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded text-sm ${dl.daysRemaining <= 7 ? "bg-red-50" : dl.daysRemaining <= 14 ? "bg-amber-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {(t.deadlineTypes as Record<string, string>)[dl.type] || dl.type}
                    </Badge>
                    <span>{dl.title}</span>
                  </div>
                  <span className={`text-xs ${dl.daysRemaining <= 7 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {dl.daysRemaining <= 0 ? t.overdue : `${dl.daysRemaining} ${t.daysRemaining}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />{t.recentActivity}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t.noActivity}</p>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.map((activity: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{activity.description}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(activity.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
