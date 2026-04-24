"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Field, PrimaryButton, SecondaryButton, SectionCard, SelectInput, TextArea, TextInput } from "@/components/ui";
import { de } from "@/lib/i18n/de";
import type { StructuredAccount } from "@/lib/types";

type ClientPayload = {
  id: string;
  name: string;
  shortName: string;
  companyName: string | null;
  uid: string | null;
  currency: string;
  defaultCreditAccount: string;
  defaultExpenseAccount: string;
  externalReferencePrefix: string;
  bookingMethodNote: string | null;
  chartOfAccountsRawText: string | null;
  accounts: StructuredAccount[];
};

export function CreateClientCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    companyName: "",
    uid: "",
    currency: "CHF",
    defaultCreditAccount: "2000",
    defaultExpenseAccount: "4200",
    externalReferencePrefix: "BPL",
    bookingMethodNote: "",
    chartOfAccountsRawText: "",
  });

  async function submit() {
    setError("");
    setMessage("");

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; client?: { id: string } };
    if (!response.ok || !payload.client) {
      setError(payload.error || "Mandant konnte nicht angelegt werden.");
      return;
    }

    setMessage("Mandant angelegt.");
    startTransition(() => {
      router.push(`/mandanten/${payload.client!.id}`);
      router.refresh();
    });
  }

  return (
    <SectionCard className="space-y-4">
      <div className="grid gap-3">
        <Field label={de.clients.name}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Muster AG"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={de.clients.shortName}>
            <TextInput
              value={form.shortName}
              onChange={(event) => setForm((current) => ({ ...current, shortName: event.target.value }))}
              placeholder="muster"
            />
          </Field>
          <Field label={de.clients.currency}>
            <TextInput
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              placeholder="CHF"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={de.clients.companyName}>
            <TextInput
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
            />
          </Field>
          <Field label={de.clients.uid}>
            <TextInput
              value={form.uid}
              onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={de.clients.creditAccount}>
            <TextInput
              value={form.defaultCreditAccount}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultCreditAccount: event.target.value }))
              }
            />
          </Field>
          <Field label={de.clients.expenseAccount}>
            <TextInput
              value={form.defaultExpenseAccount}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultExpenseAccount: event.target.value }))
              }
            />
          </Field>
        </div>
        <Field label={de.clients.externalPrefix}>
          <TextInput
            value={form.externalReferencePrefix}
            onChange={(event) =>
              setForm((current) => ({ ...current, externalReferencePrefix: event.target.value.toUpperCase() }))
            }
          />
        </Field>
        <Field label={de.clients.bookingMethodNote}>
          <TextArea
            value={form.bookingMethodNote}
            onChange={(event) => setForm((current) => ({ ...current, bookingMethodNote: event.target.value }))}
          />
        </Field>
        <Field label={de.clients.chartRaw}>
          <TextArea
            value={form.chartOfAccountsRawText}
            onChange={(event) =>
              setForm((current) => ({ ...current, chartOfAccountsRawText: event.target.value }))
            }
            placeholder={"1000 Kasse\n1020 Bank\n2000 Kreditoren\n4200 Bueromaterial"}
          />
        </Field>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}

      <PrimaryButton type="button" disabled={isPending || !form.name || !form.shortName} onClick={submit}>
        {isPending ? de.common.laden : de.clients.newTitle}
      </PrimaryButton>
    </SectionCard>
  );
}

export function ClientDetailEditor(props: { client: ClientPayload }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: props.client.name,
    shortName: props.client.shortName,
    companyName: props.client.companyName ?? "",
    uid: props.client.uid ?? "",
    currency: props.client.currency,
    defaultCreditAccount: props.client.defaultCreditAccount,
    defaultExpenseAccount: props.client.defaultExpenseAccount,
    externalReferencePrefix: props.client.externalReferencePrefix,
    bookingMethodNote: props.client.bookingMethodNote ?? "",
    chartOfAccountsRawText: props.client.chartOfAccountsRawText ?? "",
  });
  const [accounts, setAccounts] = useState(props.client.accounts);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [manualAccount, setManualAccount] = useState({
    accountNo: "",
    name: "",
    kind: "expense",
  });

  async function saveClient() {
    setError("");
    setNotice("");

    const response = await fetch(`/api/clients/${props.client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Mandant konnte nicht gespeichert werden.");
      return;
    }

    setNotice("Mandant gespeichert.");
    startTransition(() => router.refresh());
  }

  async function parseChartOfAccounts() {
    setError("");
    setNotice("");

    const upload = fileInputRef.current?.files?.[0];
    const body = new FormData();
    body.append("rawText", form.chartOfAccountsRawText);
    if (upload) {
      body.append("file", upload);
    }

    const response = await fetch(`/api/clients/${props.client.id}/chart/structure`, {
      method: "POST",
      body,
    });

    const payload = (await response.json()) as {
      error?: string;
      accounts?: StructuredAccount[];
      rawText?: string;
      usedAi?: boolean;
    };

    if (!response.ok || !payload.accounts) {
      setError(payload.error || "Kontenplan konnte nicht strukturiert werden.");
      return;
    }

    setAccounts(payload.accounts);
    setForm((current) => ({
      ...current,
      chartOfAccountsRawText: payload.rawText ?? current.chartOfAccountsRawText,
    }));
    setNotice(payload.usedAi ? "Kontenplan mit AI strukturiert." : "Kontenplan heuristisch strukturiert.");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    startTransition(() => router.refresh());
  }

  async function addManualAccount() {
    setError("");
    setNotice("");

    const response = await fetch(`/api/clients/${props.client.id}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualAccount),
    });

    const payload = (await response.json()) as { error?: string; account?: StructuredAccount };
    if (!response.ok || !payload.account) {
      setError(payload.error || "Konto konnte nicht hinzugefügt werden.");
      return;
    }

    const createdAccount = payload.account;
    setAccounts((current) =>
      [...current, createdAccount].sort((left, right) => left.accountNo.localeCompare(right.accountNo)),
    );
    setManualAccount({ accountNo: "", name: "", kind: "expense" });
    setNotice("Konto ergänzt.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <SectionCard className="space-y-4">
        <div className="grid gap-3">
          <Field label={de.clients.name}>
            <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.clients.shortName}>
              <TextInput
                value={form.shortName}
                onChange={(event) => setForm((current) => ({ ...current, shortName: event.target.value }))}
              />
            </Field>
            <Field label={de.clients.currency}>
              <TextInput
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.clients.companyName}>
              <TextInput
                value={form.companyName}
                onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              />
            </Field>
            <Field label={de.clients.uid}>
              <TextInput value={form.uid} onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={de.clients.creditAccount}>
              <TextInput
                value={form.defaultCreditAccount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultCreditAccount: event.target.value }))
                }
              />
            </Field>
            <Field label={de.clients.expenseAccount}>
              <TextInput
                value={form.defaultExpenseAccount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultExpenseAccount: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field label={de.clients.externalPrefix}>
            <TextInput
              value={form.externalReferencePrefix}
              onChange={(event) =>
                setForm((current) => ({ ...current, externalReferencePrefix: event.target.value.toUpperCase() }))
              }
            />
          </Field>
          <Field label={de.clients.bookingMethodNote}>
            <TextArea
              value={form.bookingMethodNote}
              onChange={(event) => setForm((current) => ({ ...current, bookingMethodNote: event.target.value }))}
            />
          </Field>
        </div>

        <PrimaryButton type="button" disabled={isPending} onClick={saveClient}>
          {de.common.speichern}
        </PrimaryButton>
      </SectionCard>

      <SectionCard className="space-y-4">
        <Field label={de.clients.chartRaw}>
          <TextArea
            value={form.chartOfAccountsRawText}
            onChange={(event) =>
              setForm((current) => ({ ...current, chartOfAccountsRawText: event.target.value }))
            }
          />
        </Field>

        <Field label={de.clients.chartUpload}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.pdf"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </Field>

        <SecondaryButton type="button" disabled={isPending} onClick={parseChartOfAccounts}>
          {de.clients.chartParse}
        </SecondaryButton>
      </SectionCard>

      <SectionCard className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <Field label="Konto">
            <TextInput
              value={manualAccount.accountNo}
              onChange={(event) => setManualAccount((current) => ({ ...current, accountNo: event.target.value }))}
            />
          </Field>
          <Field label="Bezeichnung">
            <TextInput
              value={manualAccount.name}
              onChange={(event) => setManualAccount((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Typ">
            <SelectInput
              value={manualAccount.kind}
              onChange={(event) => setManualAccount((current) => ({ ...current, kind: event.target.value }))}
            >
              <option value="expense">expense</option>
              <option value="asset">asset</option>
              <option value="creditor">creditor</option>
              <option value="revenue">revenue</option>
              <option value="tax">tax</option>
              <option value="account">account</option>
            </SelectInput>
          </Field>
          <div className="flex items-end">
            <PrimaryButton
              type="button"
              disabled={!manualAccount.accountNo || !manualAccount.name}
              onClick={addManualAccount}
            >
              {de.clients.chartAddManual}
            </PrimaryButton>
          </div>
        </div>
      </SectionCard>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

      <SectionCard>
        {accounts.length ? (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.accountNo}
                className="grid grid-cols-[110px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 px-3 py-3"
              >
                <span className="text-sm font-semibold text-slate-950">{account.accountNo}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{account.name}</p>
                  <p className="text-xs text-slate-500">{account.kind || "account"}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  aktiv
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{de.clients.noAccounts}</p>
        )}
      </SectionCard>
    </div>
  );
}
