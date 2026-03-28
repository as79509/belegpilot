"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";
import Link from "next/link";

interface UploadResult {
  documentId: string;
  fileName: string;
  status: "created" | "duplicate" | "error";
  existingDocumentId?: string;
  error?: string;
}

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<
    Array<{ name: string; status: "uploading" | "done" | "error" | "duplicate"; message?: string }>
  >([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;

      setUploading(true);
      setProgress(
        acceptedFiles.map((f) => ({ name: f.name, status: "uploading" }))
      );

      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append("files", file));

      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Upload fehlgeschlagen: ${res.status}`);
        }

        const results: UploadResult[] = data.results;

        setProgress(
          results.map((r) => ({
            name: r.fileName,
            status:
              r.status === "created"
                ? "done"
                : r.status === "duplicate"
                  ? "duplicate"
                  : "error",
            message:
              r.status === "duplicate"
                ? r.existingDocumentId
                : r.status === "error"
                  ? (r as any).error
                  : undefined,
          }))
        );

        const created = results.filter((r) => r.status === "created").length;
        const duplicates = results.filter(
          (r) => r.status === "duplicate"
        ).length;
        const errors = results.filter((r) => r.status === "error").length;

        if (created > 0) {
          toast.success(
            `${created} ${created === 1 ? "Beleg" : "Belege"} erfolgreich hochgeladen`
          );
        }
        if (duplicates > 0) {
          toast.warning(
            `${duplicates} ${duplicates === 1 ? "Duplikat" : "Duplikate"} erkannt`
          );
        }
        if (errors > 0) {
          toast.error(
            `${errors} ${errors === 1 ? "Datei" : "Dateien"} fehlgeschlagen`
          );
        }

        onUploadComplete?.();
      } catch (err) {
        setProgress((prev) =>
          prev.map((p) => ({
            ...p,
            status: "error" as const,
            message: de.documents.uploadError,
          }))
        );
        toast.error(de.documents.uploadError);
      } finally {
        setUploading(false);
        setTimeout(() => setProgress([]), 5000);
      }
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 20 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
          ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {uploading
            ? de.documents.uploading
            : de.documents.uploadZoneDescription}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {de.documents.uploadZoneFormats}
        </p>
      </div>

      {/* Upload progress */}
      {progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm p-2 rounded border bg-white"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{item.name}</span>
              {item.status === "uploading" && (
                <span className="text-amber-600 text-xs">
                  {de.documents.uploading}
                </span>
              )}
              {item.status === "done" && (
                <span className="text-green-600 text-xs">✓</span>
              )}
              {item.status === "duplicate" && (
                <span className="text-amber-600 text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {de.documents.duplicateWarning}
                  {item.message && (
                    <Link
                      href={`/documents/${item.message}`}
                      className="underline ml-1"
                    >
                      {de.documents.duplicateLink}
                    </Link>
                  )}
                </span>
              )}
              {item.status === "error" && (
                <span className="text-red-600 text-xs flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {item.message}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
