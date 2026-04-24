"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Field, PrimaryButton, SecondaryButton, SectionCard, SelectInput, TextInput } from "@/components/ui";
import { de } from "@/lib/i18n/de";

type SettingsPayload = {
  appName: string;
  defaultCurrency: string;
  aiBaseUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiOcrModel: string | null;
  aiTimeoutMs: number;
  exportDefaultCreditAccount: string | null;
  exportDefaultExpenseAccount: string | null;
  defaultDateBehavior: string;
  globalExternalReferencePrefix: string;
};

export function SettingsEditor(props: {
  settings: SettingsPayload;
  dbStatus: { clientCount: number; documentCount: number; accountCount: number };
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState(props.clients[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    appName: props.settings.appName,
    defaultCurrency: props.settings.defaultCurrency,
    aiBaseUrl: props.settings.aiBaseUrl ?? "",
    aiApiKey: props.settings.aiApiKey ?? "",
    aiModel: props.settings.aiModel ?? "",
    aiOcrModel: props.settings.aiOcrModel ?? "",
    aiTimeoutMs: String(props.settings.aiTimeoutMs),
    exportDefaultCreditAccount: props.settings.exportDefaultCreditAccount ?? "",
    exportDefaultExpenseAccount: props.settings.exportDefaultExpenseAccount ?? "",
    defaultDateBehavior: props.settings.defaultDateBehavior,
    globalExternalReferencePrefix: props.settings.globalExternalReferencePrefix,
  });

  async function save() {
    setError("");
    setNotice("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Einstellungen konnten nicht gespeichert werden.");
      return;
    }

    setNotice("Einstellungen gespeichert.");
    startTransition(() => router.refresh());
  }

  async function testConnection() {
    setError("");
    setNotice("");

    const response = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(payload.error || "Verbindungstest fehlgeschlagen.");
      return;
    }

    setNotice(payload.message || "Verbindung erfolgreich.");
  }

  async function createDemoData() {
    setError("");
    setNotice("");

    const response = await fetch("/api/demo", { method: "POST" });
    const payload = (await response.json()) as { error?: string; clientId?: string };
    if (!response.ok || !payload.clientId) {
      setError(payload.error || "Demo Daten konnten nicht angelegt werden.");
      return;
    }

    startTransition(() => router.push(`/mandanten/${payload.clientId}`));
  }

  async function clearDocuments() {
    if (!selectedClientId || !window.confirm("Alle Belege dieses Mandanten wirklich löschen?")) {
      return;
    }

    const response = await fetch(`/api/clients/${selectedClientId}/documents`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(payload.error || "Belege konnten nicht gelöscht werden.");
      return;
    }

    setNotice(payload.message || "Belege gelöscht.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <SectionCard className="space-y-4">
        <Field label={de.settings.appName}>
          <TextInput value={form.appName} onChange={(event) => setForm((current) => ({ ...current, appName: event.target.value }))} />
        </Field>
        <Field label={de.clients.currency}>
          <TextInput value={form.defaultCurrency} onChange={(event) => setForm((current) => ({ ...current, defaultCurrency: event.target.value.toUpperCase() }))} />
        </Field>
      </SectionCard>

      <SectionCard className="space-y-4">
        <Field label={de.settings.aiBaseUrl}>
          <TextInput value={form.aiBaseUrl} onChange={(event) => setForm((current) => ({ ...current, aiBaseUrl: event.target.value }))} />
        </Field>
        <Field label={de.settings.aiApiKey}>
          <TextInput type="password" value={form.aiApiKey} onChange={(event) => setForm((current) => ({ ...current, aiApiKey: event.target.value }))} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={de.settings.aiModel}>
            <TextInput value={form.aiModel} onChange={(event) => setForm((current) => ({ ...current, aiModel: event.target.value }))} />
          </Field>
          <Field label={de.settings.aiOcrModel}>
            <TextInput value={form.aiOcrModel} onChange={(event) => setForm((current) => ({ ...current, aiOcrModel: event.target.value }))} />
          </Field>
        </div>
        <Field label={de.settings.aiTimeout}>
          <TextInput value={form.aiTimeoutMs} onChange={(event) => setForm((current) => ({ ...current, aiTimeoutMs: event.target.value }))} />
        </Field>
        <SecondaryButton type="button" onClick={testConnection}>
          {de.common.verbindungTesten}
        </SecondaryButton>
      </SectionCard>

      <SectionCard className="space-y-4">
        <Field label={de.settings.exportCreditAccount}>
          <TextInput
            value={form.exportDefaultCreditAccount}
            onChange={(event) => setForm((current) => ({ ...current, exportDefaultCreditAccount: event.target.value }))}
          />
        </Field>
        <Field label={de.settings.exportExpenseAccount}>
          <TextInput
            value={form.exportDefaultExpenseAccount}
            onChange={(event) => setForm((current) => ({ ...current, exportDefaultExpenseAccount: event.target.value }))}
          />
        </Field>
        <Field label={de.settings.defaultDateBehavior}>
          <SelectInput
            value={form.defaultDateBehavior}
            onChange={(event) => setForm((current) => ({ ...current, defaultDateBehavior: event.target.value }))}
          >
            <option value="document_first">{de.settings.dateDocumentFirst}</option>
            <option value="invoice_first">{de.settings.dateInvoiceFirst}</option>
            <option value="created_at">{de.settings.dateCreatedAt}</option>
          </SelectInput>
        </Field>
        <Field label={de.settings.globalPrefix}>
          <TextInput
            value={form.globalExternalReferencePrefix}
            onChange={(event) =>
              setForm((current) => ({ ...current, globalExternalReferencePrefix: event.target.value.toUpperCase() }))
            }
          />
        </Field>
      </SectionCard>

      <SectionCard className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p>{de.settings.databaseStatus}</p>
          <p className="mt-2">
            {props.dbStatus.clientCount} Mandanten, {props.dbStatus.documentCount} Belege, {props.dbStatus.accountCount} Konten
          </p>
        </div>
        <SecondaryButton type="button" onClick={createDemoData}>
          {de.common.demo}
        </SecondaryButton>
        <Field label={de.settings.clearClientDocuments}>
          <SelectInput value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
            {props.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <SecondaryButton type="button" className="text-rose-600" onClick={clearDocuments}>
          {de.settings.clearAction}
        </SecondaryButton>
      </SectionCard>

      <PrimaryButton type="button" disabled={isPending} onClick={save}>
        {de.common.speichern}
      </PrimaryButton>

      {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
