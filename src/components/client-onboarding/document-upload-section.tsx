"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  status: "uploading" | "uploaded" | "error";
}

interface DocumentUploadSectionProps {
  files: UploadedFile[];
  onFilesSelect: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onRetryUpload: (file: UploadedFile) => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return File;
}

export function DocumentUploadSection({
  files,
  onFilesSelect,
  onRemoveFile,
  onRetryUpload,
}: DocumentUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFilesSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "bg-white border-2 border-dashed rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all shadow-sm",
          isDragging
            ? "border-slate-400 bg-slate-50"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => onFilesSelect(e.target.files)}
        />
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-7 w-7 text-slate-500" />
        </div>
        <p className="font-medium text-slate-900 text-lg">
          Belege hierher ziehen
        </p>
        <p className="text-slate-500 mt-1">oder klicken zum Auswählen</p>
        <p className="text-xs text-slate-400 mt-4">
          PDF, JPG, PNG - max. 10MB pro Datei
        </p>
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">
              {files.length} Datei{files.length > 1 ? "en" : ""}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      file.status === "error" ? "bg-red-100" : "bg-slate-100"
                    )}
                  >
                    {file.status === "uploading" ? (
                      <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
                    ) : file.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      file.status === "error" ? "text-red-600" : "text-slate-700"
                    )}
                  >
                    {file.name}
                  </span>
                  {file.status === "uploaded" && (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  {file.status === "error" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryUpload(file);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                    >
                      Erneut
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(file.id);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 text-center">
        Sie können diesen Schritt überspringen und später Belege hochladen
      </p>
    </div>
  );
}
