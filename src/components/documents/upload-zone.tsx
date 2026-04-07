"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, AlertTriangle, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";
import Link from "next/link";

const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

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

type FileProgress = { name: string; status: "waiting" | "uploading" | "done" | "error" | "duplicate"; message?: string };

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<FileProgress[]>([]);
  const [uploadStats, setUploadStats] = useState<{ done: number; total: number } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Upload files in batches of 3
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setProgress(files.map((f) => ({ name: f.name, status: "waiting" })));
    setUploadStats({ done: 0, total: files.length });

    let doneCount = 0;
    const BATCH_SIZE = 3;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (file, batchIdx) => {
        const globalIdx = i + batchIdx;
        setProgress((prev) => prev.map((p, j) => j === globalIdx ? { ...p, status: "uploading" } : p));

        const formData = new FormData();
        formData.append("files", file);

        try {
          const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Fehler");

          const result: UploadResult = data.results[0];
          const status = result.status === "created" ? "done" : result.status === "duplicate" ? "duplicate" : "error";
          setProgress((prev) => prev.map((p, j) => j === globalIdx ? {
            ...p,
            status: status as any,
            message: result.status === "duplicate" ? result.existingDocumentId : result.error,
          } : p));
        } catch (err: any) {
          setProgress((prev) => prev.map((p, j) => j === globalIdx ? { ...p, status: "error", message: err.message } : p));
        }

        doneCount++;
        setUploadStats({ done: doneCount, total: files.length });
      });
      await Promise.all(promises);
    }

    // Summary toast
    setProgress((prev) => {
      const created = prev.filter((p) => p.status === "done").length;
      const dups = prev.filter((p) => p.status === "duplicate").length;
      const errs = prev.filter((p) => p.status === "error").length;
      if (created > 0) toast.success(`${created} ${created === 1 ? "Beleg" : "Belege"} hochgeladen`);
      if (dups > 0) toast.warning(`${dups} ${dups === 1 ? "Duplikat" : "Duplikate"} erkannt`);
      if (errs > 0) toast.error(`${errs} fehlgeschlagen`);
      return prev;
    });

    setUploading(false);
    setUploadStats(null);
    onUploadComplete?.();
    setTimeout(() => setProgress([]), 8000);
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => uploadFiles(acceptedFiles),
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 20 * 1024 * 1024,
    disabled: uploading,
  });

  // Folder upload handler
  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files || []);
    const supported = allFiles.filter((f) =>
      SUPPORTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const unsupported = allFiles.length - supported.length;

    if (unsupported > 0) {
      toast.info(`${supported.length} Dateien gefunden (${unsupported} nicht unterstützt)`);
    }

    if (supported.length > 0) {
      uploadFiles(supported);
    } else {
      toast.warning("Keine unterstützten Dateien im Ordner gefunden");
    }

    // Reset input so same folder can be selected again
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Drag-drop zone */}
        <div
          {...getRootProps()}
          className={`flex-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
            ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">
            {uploading ? de.documents.uploading : de.documents.uploadZoneDescription}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{de.documents.uploadZoneFormats}</p>
        </div>

        {/* Folder upload button */}
        <div className="flex flex-col items-center justify-center">
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error — webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => folderInputRef.current?.click()}
            className="h-full px-6"
          >
            <FolderOpen className="h-5 w-5 mr-2" />
            Ordner hochladen
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploadStats && (
        <div className="text-sm font-medium text-blue-700">
          {uploadStats.done} von {uploadStats.total} Dateien hochgeladen
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(uploadStats.done / uploadStats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {progress.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {progress.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm p-1.5 rounded border bg-white">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 text-xs">{item.name}</span>
              {item.status === "waiting" && <span className="text-gray-400 text-xs">⏳</span>}
              {item.status === "uploading" && <Loader2 className="h-3 w-3 text-amber-600 animate-spin" />}
              {item.status === "done" && <span className="text-green-600 text-xs">✓</span>}
              {item.status === "duplicate" && (
                <span className="text-amber-600 text-xs">⚠ Duplikat</span>
              )}
              {item.status === "error" && (
                <span className="text-red-600 text-xs">✗ {item.message?.slice(0, 30)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
