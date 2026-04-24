import { ExportPanel } from "@/components/export-panel";
import { PageSection } from "@/components/ui";
import { getExportContext } from "@/lib/data";
import { de } from "@/lib/i18n/de";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const { clients } = await getExportContext();

  return (
    <PageSection title={de.export.title} subtitle={de.export.hint}>
      <ExportPanel clients={clients.map((client) => ({ id: client.id, name: client.name }))} />
    </PageSection>
  );
}
