"use client";

import { de } from "@/lib/i18n/de";

interface PdfViewerProps {
  documentId: string;
  mimeType?: string;
}

export function PdfViewer({ documentId, mimeType }: PdfViewerProps) {
  const fileUrl = `/api/documents/${documentId}/file`;

  if (mimeType?.startsWith("image/")) {
    return (
      <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt="Document"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={fileUrl}
        className="w-full h-full min-h-[600px] rounded-md border"
        title="PDF Preview"
      />
    );
  }

  return (
    <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-gray-100 rounded-md">
      <p className="text-muted-foreground text-sm">
        {de.detail.previewNotAvailable}
      </p>
    </div>
  );
}
