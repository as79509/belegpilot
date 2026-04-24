"use client";

import { useState } from "react";

import { Field, PrimaryButton, SectionCard, SelectInput, TextInput } from "@/components/ui";
import { de } from "@/lib/i18n/de";

type ClientOption = { id: string; name: string };

export function ExportPanel(props: { clients: ClientOption[] }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`.padStart(2, "0")}`;
  const [clientId, setClientId] = useState(props.clients[0]?.id ?? "");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [onlyReviewed, setOnlyReviewed] = useState(true);
  const [preview, setPreview] = useState<{ fileName: string; count: number; content: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPreview() {
    setError("");
    setNotice("");

    const params = new URLSearchParams({
      clientId,
      from,
      to,
      onlyReviewed: onlyReviewed ? "1" : "0",
    });

    const response = await fetch(`/api/export?${params.toString()}`);
    const payload = (await response.json()) as { error?: string; fileName?: string; count?: number; content?: string };

    if (!response.ok || !payload.fileName) {
      setError(payload.error || "Vorschau konnte nicht erstellt werden.");
      return;
    }

    setPreview({
      fileName: payload.fileName,
      count: payload.count ?? 0,
      content: payload.content ?? "",
    });
  }

  async function createExport() {
    setError("");
    setNotice("");

    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        from,
        to,
        onlyReviewed,
        markAsExported: true,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Export konnte nicht erstellt werden.");
      return;
    }

    const blob = await response.blob();
    const fileName = response.headers.get("X-Export-Filename") || "banana_export.tsv";
    const file = new File([blob], fileName, { type: "text/tab-separated-values" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: fileName,
      });
      setNotice("Exportdatei geteilt.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Exportdatei heruntergeladen.");
  }

  return (
    <SectionCard className="space-y-4">
      <div className="grid gap-3">
        <Field label={de.common.mandant}>
          <SelectInput value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {props.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Von">
            <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="Bis">
            <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyReviewed}
            onChange={(event) => setOnlyReviewed(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {de.export.onlyReviewed}
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton type="button" disabled={!clientId} onClick={loadPreview}>
          {de.export.previewTitle}
        </PrimaryButton>
        <PrimaryButton type="button" disabled={!preview || !preview.count} className="bg-blue-700 hover:bg-blue-600" onClick={createExport}>
          {de.export.create}
        </PrimaryButton>
      </div>

      {preview ? (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {de.export.fileName}: {preview.fileName}
            </p>
            <span className="text-sm text-slate-500">
              {de.export.rows}: {preview.count}
            </span>
          </div>
          <pre className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
            {preview.content.split("\n").slice(0, 12).join("\n")}
          </pre>
        </div>
      ) : null}

      {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </SectionCard>
  );
}
