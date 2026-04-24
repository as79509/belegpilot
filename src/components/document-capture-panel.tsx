"use client";

import { Camera, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Field, PrimaryButton, SecondaryButton, SectionCard, SelectInput } from "@/components/ui";
import { de } from "@/lib/i18n/de";
import { cn } from "@/lib/utils";

type ClientOption = {
  id: string;
  name: string;
};

type UploadResult = {
  documents: Array<{ id: string }>;
};

async function startBackgroundProcessing(documentIds: string[]) {
  await Promise.all(
    documentIds.map((documentId) =>
      fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      }).catch(() => undefined),
    ),
  );
}

function Scanner(props: { disabled: boolean; onUpload: (files: File[]) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    async function openCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setError(de.documents.cameraUnavailable);
      }
    }

    void openCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function capture() {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewUrl(dataUrl);
    setTimeout(() => setPreviewUrl(""), 900);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;

    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    await props.onUpload([file]);
  }

  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900">
        <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Vorschau"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <div className="flex items-center gap-3">
        <PrimaryButton type="button" className="flex-1 bg-white text-slate-950 hover:bg-slate-100" disabled={props.disabled} onClick={capture}>
          {de.documents.capture}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function DocumentCapturePanel(props: {
  clients: ClientOption[];
  selectedClientId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState(props.selectedClientId);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function uploadFiles(files: File[]) {
    if (!selectedClientId) {
      setError("Bitte zuerst einen Mandanten wählen.");
      return;
    }

    setError("");
    setMessage("");

    const body = new FormData();
    body.append("clientId", selectedClientId);
    files.forEach((file) => body.append("files", file));

    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body,
    });

    const payload = (await response.json()) as { error?: string } & UploadResult;
    if (!response.ok || !payload.documents?.length) {
      setError(payload.error || "Belege konnten nicht gespeichert werden.");
      return;
    }

    setMessage(`${payload.documents.length} Beleg(e) gespeichert. AI verarbeitet jetzt im Hintergrund.`);
    void startBackgroundProcessing(payload.documents.map((document) => document.id));
    setTimeout(() => {
      startTransition(() => router.refresh());
    }, 700);
  }

  return (
    <SectionCard className="space-y-4">
      <Field label={de.common.mandant}>
        <SelectInput
          value={selectedClientId}
          onChange={(event) => {
            setSelectedClientId(event.target.value);
            startTransition(() => router.push(`/belege?clientId=${event.target.value}`));
          }}
        >
          <option value="">Mandant wählen</option>
          {props.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-6 text-center"
        >
          <Upload className="h-8 w-8 text-blue-600" />
          <span className="text-base font-semibold text-slate-950">{de.common.hochladen}</span>
          <span className="text-sm text-slate-500">JPG, PNG oder PDF mehrfach hochladen</span>
        </button>
        <button
          type="button"
          onClick={() => setScannerOpen((current) => !current)}
          className={cn(
            "flex min-h-28 flex-col items-center justify-center gap-3 rounded-3xl border px-4 py-6 text-center",
            scannerOpen
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-950",
          )}
        >
          <Camera className="h-8 w-8" />
          <span className="text-base font-semibold">{de.common.scannen}</span>
          <span className={cn("text-sm", scannerOpen ? "text-slate-200" : "text-slate-500")}>
            Rueckkamera mit schnellem Capture
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="hidden"
        onChange={async (event) => {
          const selectedFiles = Array.from(event.target.files ?? []);
          if (selectedFiles.length) {
            await uploadFiles(selectedFiles);
          }
          event.target.value = "";
        }}
      />

      {scannerOpen ? <Scanner disabled={isPending} onUpload={uploadFiles} /> : null}
      {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </SectionCard>
  );
}
