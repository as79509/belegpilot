"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Loader2,
  Upload,
} from "lucide-react";
import { InfoPanel } from "@/components/ds/info-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic"];
const SUPPORTED_TYPE_BADGES = ["PDF", "JPG", "PNG", "HEIC"];

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
          if (!res.ok) throw new Error(data.error || de.common.error);

          const result: UploadResult = data.results[0];
          const status: FileProgress["status"] =
            result.status === "created"
              ? "done"
              : result.status === "duplicate"
                ? "duplicate"
                : "error";
          setProgress((prev) => prev.map((p, j) => j === globalIdx ? {
            ...p,
            status,
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
      if (created > 0) toast.success(
        (created === 1 ? de.documents.uploadZone.uploadedSingle : de.documents.uploadZone.uploadedMultiple)
          .replace("{count}", String(created))
      );
      if (dups > 0) toast.warning(
        (dups === 1 ? de.documents.uploadZone.duplicateSingle : de.documents.uploadZone.duplicateMultiple)
          .replace("{count}", String(dups))
      );
      if (errs > 0) toast.error(
        de.documents.uploadZone.failedCount.replace("{count}", String(errs))
      );
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
      "image/heic": [".heic"],
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
      toast.info(de.documents.uploadZone.folderUnsupportedFound
        .replace("{supported}", String(supported.length))
        .replace("{unsupported}", String(unsupported)));
    }

    if (supported.length > 0) {
      uploadFiles(supported);
    } else {
      toast.warning(de.documents.uploadZone.folderNoSupported);
    }

    // Reset input so same folder can be selected again
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
        <div
          {...getRootProps()}
          className={`relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-6 transition-colors
            ${isDragActive ? "border-blue-500 bg-blue-50/80" : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"}
            ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_55%)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3 text-left">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200">
                  <Upload className="h-5 w-5 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {uploading
                      ? de.documents.uploading
                      : isDragActive
                        ? de.documents.uploadZone.dropActive
                        : de.documents.uploadZoneDescription}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDragActive ? de.documents.uploadZone.dropHint : de.documents.uploadZoneFormats}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_TYPE_BADGES.map((type) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="rounded-full border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">{de.documents.uploadZone.supportedTypes}</span>
              <span>{de.documents.uploadZone.dropHint}</span>
            </div>
          </div>
        </div>

        {/* Folder upload button */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{de.documents.uploadZone.folderUpload}</p>
                <p className="mt-1 text-sm text-muted-foreground">{de.documents.uploadZone.folderHint}</p>
              </div>
            </div>
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
            className="w-full justify-center"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {de.documents.uploadZone.folderUpload}
          </Button>
            <InfoPanel tone="info" title={de.documents.uploadZone.supportedTypes}>
              {SUPPORTED_TYPE_BADGES.join(" / ")}
            </InfoPanel>
          </div>
        </div>
      </div>

      {uploadStats && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-blue-900">{de.documents.uploading}</p>
              <p className="text-blue-700">
                {de.documents.uploadZone.progress
                  .replace("{done}", String(uploadStats.done))
                  .replace("{total}", String(uploadStats.total))}
              </p>
            </div>
            <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">
              {`${uploadStats.done}/${uploadStats.total}`}
            </Badge>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-blue-100">
            <div
              className="h-1.5 rounded-full bg-blue-600 transition-all"
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
              {item.status === "waiting" && (
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  <Clock3 className="h-3 w-3" />
                  {de.documents.uploadZone.waitingShort}
                </Badge>
              )}
              {item.status === "uploading" && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {de.documents.uploading}
                </Badge>
              )}
              {item.status === "done" && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {de.documents.uploadZone.doneShort}
                </Badge>
              )}
              {item.status === "duplicate" && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {de.documents.uploadZone.duplicateBadge}
                </Badge>
              )}
              {item.status === "error" && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {de.documents.uploadZone.errorShort}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
