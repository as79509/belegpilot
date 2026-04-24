import Link from "next/link";

import { DocumentCapturePanel } from "@/components/document-capture-panel";
import { EmptyState, PageSection, SectionCard, SelectInput, StatusPill, TextInput } from "@/components/ui";
import { getClients, listDocuments } from "@/lib/data";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate, parseDateInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const clients = await getClients();
  const selectedClientId =
    (typeof searchParams.clientId === "string" ? searchParams.clientId : undefined) ?? clients[0]?.id ?? "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "alle";
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const from = typeof searchParams.from === "string" ? searchParams.from : "";
  const to = typeof searchParams.to === "string" ? searchParams.to : "";
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "createdAt";

  const documents = await listDocuments({
    clientId: selectedClientId || undefined,
    status,
    query,
    from: parseDateInput(from),
    to: parseDateInput(to),
    sort: sort === "documentDate" ? "documentDate" : "createdAt",
  });

  return (
    <div className="space-y-6">
      <PageSection title={de.documents.title} subtitle={de.documents.listHint}>
        <DocumentCapturePanel
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          selectedClientId={selectedClientId}
        />
      </PageSection>

      <PageSection title="Filter" subtitle="Status, Zeitraum und Suche für den aktuellen Mandanten.">
        <SectionCard>
          <form className="grid gap-3">
            <input type="hidden" name="clientId" value={selectedClientId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{de.documents.filterStatus}</span>
                <SelectInput name="status" defaultValue={status}>
                  <option value="alle">Alle</option>
                  <option value="neu">{de.statuses.neu}</option>
                  <option value="gelesen">{de.statuses.gelesen}</option>
                  <option value="geprueft">{de.statuses.geprueft}</option>
                  <option value="exportiert">{de.statuses.exportiert}</option>
                </SelectInput>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{de.documents.sortBy}</span>
                <SelectInput name="sort" defaultValue={sort}>
                  <option value="createdAt">{de.documents.sortCreated}</option>
                  <option value="documentDate">{de.documents.sortDate}</option>
                </SelectInput>
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">{de.common.suchen}</span>
              <TextInput name="q" defaultValue={query} placeholder="Lieferant oder Rechnungsnummer" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{de.documents.filterFrom}</span>
                <TextInput type="date" name="from" defaultValue={from} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{de.documents.filterTo}</span>
                <TextInput type="date" name="to" defaultValue={to} />
              </label>
            </div>
            <button className="h-12 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white">
              {de.common.aktualisieren}
            </button>
          </form>
        </SectionCard>
      </PageSection>

      <PageSection title="Liste" subtitle={`${documents.length} Belege gefunden`}>
        {documents.length ? (
          <div className="space-y-3">
            {documents.map((document) => (
              <Link key={document.id} href={`/belege/${document.id}`}>
                <SectionCard className="space-y-3 transition hover:-translate-y-0.5 hover:border-blue-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {document.supplierName || document.originalFilename}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {document.client.name} · {formatDate(document.documentDate || document.createdAt)}
                      </p>
                    </div>
                    <StatusPill status={de.statuses[document.status as keyof typeof de.statuses]} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {document.description || "Noch keine Beschreibung"}
                  </p>
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span>{document.invoiceNumber || "Keine Rechnungsnummer"}</span>
                    <span className="font-semibold">
                      {formatCurrency(document.grossAmount, document.currency || document.client.currency)}
                    </span>
                  </div>
                </SectionCard>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={de.documents.noDocuments}
            description="Der ausgewählte Mandant hat in diesem Filter noch keine passenden Belege."
          />
        )}
      </PageSection>
    </div>
  );
}
