import Link from "next/link";

import { CreateClientCard } from "@/components/client-forms";
import { EmptyState, PageSection, SectionCard } from "@/components/ui";
import { getClients } from "@/lib/data";
import { de } from "@/lib/i18n/de";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <PageSection title={de.clients.title} subtitle="Mandanten anlegen, Stammdaten pflegen und Kontenplan aufbereiten.">
        <CreateClientCard />
      </PageSection>

      <PageSection title={de.clients.detailTitle} subtitle="Vorhandene Mandanten">
        {clients.length ? (
          <div className="space-y-3">
            {clients.map((client) => (
              <Link key={client.id} href={`/mandanten/${client.id}`}>
                <SectionCard className="space-y-2 transition hover:-translate-y-0.5 hover:border-blue-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{client.name}</h3>
                      <p className="text-sm text-slate-500">
                        {client.shortName.toUpperCase()} · {client.currency}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {client._count.documents} Belege
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {client._count.accounts} aktive Konten · Gegenkonto {client.defaultCreditAccount} · Fallback {client.defaultExpenseAccount}
                  </p>
                </SectionCard>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={de.clients.noClients}
            description="Lege den ersten Mandanten an und hinterlege direkt einen einfachen Kontenplan."
          />
        )}
      </PageSection>
    </div>
  );
}
