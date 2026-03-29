"use client";

import { useState, useEffect } from "react";
import { de } from "@/lib/i18n/de";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  { key: "", label: "Alle" },
  { key: "needs_review", label: de.status.needs_review, color: "bg-orange-100 text-orange-800" },
  { key: "ready", label: de.status.ready, color: "bg-green-100 text-green-800" },
  { key: "failed", label: de.status.failed, color: "bg-red-100 text-red-800" },
];

export default function DocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => setCounts(data))
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {de.documents.title}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          <Upload className="h-4 w-4 mr-2" />
          {de.documents.upload}
        </Button>
      </div>

      {showUpload && (
        <UploadZone onUploadComplete={() => setRefreshKey((k) => k + 1)} />
      )}

      {/* Quick filter buttons */}
      <div className="flex gap-2">
        {QUICK_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={statusFilter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(f.key)}
            className={cn(statusFilter === f.key ? "" : "text-muted-foreground")}
          >
            {f.label}
            {f.key && counts[f.key] != null && (
              <Badge variant="secondary" className={cn("ml-1.5 text-xs px-1.5", f.color)}>
                {counts[f.key]}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <DocumentTable
        refreshKey={refreshKey}
        initialStatus={statusFilter}
        key={statusFilter} // remount on filter change to reset pagination
      />
    </div>
  );
}
