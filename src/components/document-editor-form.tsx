"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Field, PrimaryButton, SecondaryButton, SectionCard, SelectInput, TextArea, TextInput } from "@/components/ui";
import { de } from "@/lib/i18n/de";
import { toInputDate } from "@/lib/utils";

type DocumentEditorProps = {
  document: {
    id: string;
    status: string;
    supplierName: string | null;
    documentDate: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    invoiceNumber: string | null;
    currency: string | null;
    grossAmount: number | null;
    taxHint: string | null;
    description: string | null;
    suggestedExpenseAccountNo: string | null;
    confirmedExpenseAccountNo: string | null;
    creditAccountNo: string | null;
    externalReference: string;
    aiReasoningShort: string | null;
    aiRawJson: string | null;
  };
  accounts: Array<{ accountNo: string; name: string }>;
};

export function DocumentEditorForm(props: DocumentEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    supplierName: props.document.supplierName ?? "",
    documentDate: props.document.documentDate ? toInputDate(props.document.documentDate) : "",
    invoiceDate: props.document.invoiceDate ? toInputDate(props.document.invoiceDate) : "",
    dueDate: props.document.dueDate ? toInputDate(props.document.dueDate) : "",
    invoiceNumber: props.document.invoiceNumber ?? "",
    currency: props.document.currency ?? "CHF",
    grossAmount: props.document.grossAmount?.toFixed(2) ?? "",
    taxHint: props.document.taxHint ?? "",
    description: props.document.description ?? "",
    confirmedExpenseAccountNo:
      props.document.confirmedExpenseAccountNo ?? props.document.suggestedExpenseAccountNo ?? "",
    creditAccountNo: props.document.creditAccountNo ?? "",
    status: props.document.status,
  });

  async function save() {
    await persist(form.status);
  }

  async function persist(status: string) {
    setError("");
    setNotice("");

    const response = await fetch(`/api/documents/${props.document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Beleg konnte nicht gespeichert werden.");
      return;
    }

    setNotice("Beleg gespeichert.");
    startTransition(() => router.refresh());
  }

  async function deleteDocument() {
    if (!window.confirm(de.documents.deleteConfirm)) {
      return;
    }

    const response = await fetch(`/api/documents/${props.document.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Beleg konnte nicht gelöscht werden.");
      return;
    }

    startTransition(() => router.push("/belege"));
  }

  return (
    <div className="space-y-4">
      <SectionCard className="space-y-4">
        <div className="grid gap-3">
          <Field label={de.documents.supplierName}>
            <TextInput value={form.supplierName} onChange={(event) => setForm((current) => ({ ...current, supplierName: event.target.value }))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.documents.documentDate}>
              <TextInput type="date" value={form.documentDate} onChange={(event) => setForm((current) => ({ ...current, documentDate: event.target.value }))} />
            </Field>
            <Field label={de.documents.invoiceDate}>
              <TextInput type="date" value={form.invoiceDate} onChange={(event) => setForm((current) => ({ ...current, invoiceDate: event.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.documents.dueDate}>
              <TextInput type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </Field>
            <Field label={de.documents.invoiceNumber}>
              <TextInput value={form.invoiceNumber} onChange={(event) => setForm((current) => ({ ...current, invoiceNumber: event.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.documents.currency}>
              <TextInput value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
            </Field>
            <Field label={de.documents.grossAmount}>
              <TextInput value={form.grossAmount} onChange={(event) => setForm((current) => ({ ...current, grossAmount: event.target.value }))} />
            </Field>
          </div>
          <Field label={de.documents.taxHint}>
            <TextInput value={form.taxHint} onChange={(event) => setForm((current) => ({ ...current, taxHint: event.target.value }))} />
          </Field>
          <Field label={de.documents.description}>
            <TextArea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <Field label={de.documents.confirmedExpenseAccount}>
            <TextInput
              list="accounts-list"
              value={form.confirmedExpenseAccountNo}
              onChange={(event) =>
                setForm((current) => ({ ...current, confirmedExpenseAccountNo: event.target.value }))
              }
            />
          </Field>
          <Field label={de.documents.creditAccount}>
            <TextInput
              list="accounts-list"
              value={form.creditAccountNo}
              onChange={(event) => setForm((current) => ({ ...current, creditAccountNo: event.target.value }))}
            />
          </Field>
          <Field label={de.common.status}>
            <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="neu">{de.statuses.neu}</option>
              <option value="gelesen">{de.statuses.gelesen}</option>
              <option value="geprueft">{de.statuses.geprueft}</option>
              <option value="exportiert">{de.statuses.exportiert}</option>
            </SelectInput>
          </Field>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{de.documents.aiReasoning}</p>
            <p className="mt-1">{props.document.aiReasoningShort || "Keine AI Begründung gespeichert."}</p>
            <p className="mt-2 text-xs text-slate-500">
              {de.documents.externalReference}: {props.document.externalReference}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton type="button" disabled={isPending} onClick={save}>
            {de.common.speichern}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={isPending}
            onClick={() => {
              setForm((current) => ({ ...current, status: "geprueft" }));
              void persist("geprueft");
            }}
          >
            {de.documents.markReviewed}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={isPending}
            onClick={() => {
              setForm((current) => ({ ...current, status: "gelesen" }));
              void persist("gelesen");
            }}
          >
            {de.documents.markRead}
          </SecondaryButton>
          <SecondaryButton type="button" disabled={isPending} className="text-rose-600" onClick={deleteDocument}>
            {de.common.loeschen}
          </SecondaryButton>
        </div>

        {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

        <datalist id="accounts-list">
          {props.accounts.map((account) => (
            <option key={account.accountNo} value={account.accountNo}>
              {account.name}
            </option>
          ))}
        </datalist>
      </SectionCard>

      <details className="rounded-3xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">AI Rohdaten</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">
          {props.document.aiRawJson || "Keine Rohdaten vorhanden."}
        </pre>
      </details>
    </div>
  );
}
