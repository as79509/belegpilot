import { notFound } from "next/navigation";

import { ClientDetailEditor } from "@/components/client-forms";
import { PageSection } from "@/components/ui";
import { getClientById } from "@/lib/data";
import { de } from "@/lib/i18n/de";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const client = await getClientById(id);

  if (!client) {
    notFound();
  }

  return (
    <PageSection
      title={`${client.name}`}
      subtitle={`${client._count.documents} Belege · ${client.accounts.length} strukturierte Konten`}
    >
      <ClientDetailEditor
        client={{
          id: client.id,
          name: client.name,
          shortName: client.shortName,
          companyName: client.companyName,
          uid: client.uid,
          currency: client.currency,
          defaultCreditAccount: client.defaultCreditAccount,
          defaultExpenseAccount: client.defaultExpenseAccount,
          externalReferencePrefix: client.externalReferencePrefix,
          bookingMethodNote: client.bookingMethodNote,
          chartOfAccountsRawText: client.chartOfAccountsRawText,
          accounts: client.accounts.map((account) => ({
            accountNo: account.accountNo,
            name: account.name,
            kind: account.kind,
            isActive: account.isActive,
          })),
        }}
      />
    </PageSection>
  );
}
