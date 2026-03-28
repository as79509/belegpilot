"use client";

import { useState } from "react";
import { de } from "@/lib/i18n/de";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function DocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

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
        <UploadZone
          onUploadComplete={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <DocumentTable refreshKey={refreshKey} />
    </div>
  );
}
