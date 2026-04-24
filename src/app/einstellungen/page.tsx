import { SettingsEditor } from "@/components/settings-editor";
import { PageSection } from "@/components/ui";
import { getClients, getDatabaseStatus } from "@/lib/data";
import { de } from "@/lib/i18n/de";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, dbStatus, clients] = await Promise.all([
    getAppSettings(),
    getDatabaseStatus(),
    getClients(),
  ]);

  return (
    <PageSection title={de.settings.title} subtitle="Globale App-, AI- und Export-Einstellungen für den MVP.">
      <SettingsEditor
        settings={{
          appName: settings.appName,
          defaultCurrency: settings.defaultCurrency,
          aiBaseUrl: settings.aiBaseUrl,
          aiApiKey: settings.aiApiKey,
          aiModel: settings.aiModel,
          aiOcrModel: settings.aiOcrModel,
          aiTimeoutMs: settings.aiTimeoutMs,
          exportDefaultCreditAccount: settings.exportDefaultCreditAccount,
          exportDefaultExpenseAccount: settings.exportDefaultExpenseAccount,
          defaultDateBehavior: settings.defaultDateBehavior,
          globalExternalReferencePrefix: settings.globalExternalReferencePrefix,
        }}
        dbStatus={dbStatus}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
      />
    </PageSection>
  );
}
