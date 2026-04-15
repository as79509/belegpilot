"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Link2, Upload, Check, X, Loader2 } from "lucide-react";
import { EntityHeader, EmptyState, InfoPanel, SectionCard } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

interface Provider {
  id: string;
  name: string;
  description: string;
  supportedActions: string[];
  icon: string;
  canImport: boolean;
  canExport: boolean;
  isConfigured: boolean;
  isEnabled: boolean;
}

const ICONS: Record<string, any> = { FileSpreadsheet, Link2 };
const t = de.integrations;

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialog, setImportDialog] = useState<{ providerId: string; action: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) { const data = await res.json(); setProviders(data.providers || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const configuredCount = providers.filter((provider) => provider.isConfigured).length;
  const importReadyCount = providers.filter((provider) => provider.canImport && provider.isConfigured && provider.isEnabled).length;
  const activationOpenCount = providers.filter((provider) => !provider.isConfigured || !provider.isEnabled).length;

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!importDialog) return;
    setImporting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("action", importDialog.action);
    try {
      const res = await fetch("/api/integrations/" + importDialog.providerId + "/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || data.result?.errors?.[0]?.message || t.importFailed);
      } else if (data.result?.success !== false) {
        const successMessage = t.csvImport.success.replace("{count}", String(data.result?.imported || 0));
        const skippedMessage = data.result?.skipped
          ? `, ${t.csvImport.skipped.replace("{count}", String(data.result.skipped))}`
          : "";
        toast.success(successMessage + skippedMessage);
      } else {
        toast.error(`${t.importFailed}: ${data.result?.errors?.[0]?.message || de.common.error}`);
      }
      setImportDialog(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setImporting(false); }
  }

  const actionLabels: Record<string, string> = t.actions as any;

  return (
    <div className="space-y-6 p-6">
      <EntityHeader title={t.title} subtitle={t.subtitle} />

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!loading && providers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard bodyClassName="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.available}</p>
            <p className="text-3xl font-semibold tracking-tight">{providers.length}</p>
            <p className="text-sm text-muted-foreground">{t.title}</p>
          </SectionCard>

          <SectionCard bodyClassName="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.readyToImport}</p>
            <p className="text-3xl font-semibold tracking-tight">{importReadyCount}</p>
            <p className="text-sm text-muted-foreground">
              {configuredCount} {t.configured.toLowerCase()}
            </p>
          </SectionCard>

          <SectionCard bodyClassName="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.activationOpen}</p>
            <p className="text-3xl font-semibold tracking-tight">{activationOpenCount}</p>
            <p className="text-sm text-muted-foreground">{t.activationRequired}</p>
          </SectionCard>
        </div>
      )}

      <InfoPanel tone="info" icon={Link2}>
        <p className="text-sm">{t.activationRequired}</p>
      </InfoPanel>

      {!loading && providers.length === 0 && (
        <SectionCard bodyClassName="p-0">
          <EmptyState icon={Link2} title={t.noIntegrations} description={t.subtitle} />
        </SectionCard>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const Icon = ICONS[p.icon] || FileSpreadsheet;
            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <CardTitle className="text-base">{p.name}</CardTitle>
                    </div>
                    {p.isConfigured ? (
                      <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" />{t.configured}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><X className="h-3 w-3" />{t.notConfigured}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.supportedActions.map((a) => (
                      <span key={a} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{actionLabels[a] || a}</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {p.canImport && p.supportedActions.filter((a) => a.startsWith("import_")).map((action) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="sm"
                        disabled={!p.isConfigured || !p.isEnabled}
                        onClick={() => setImportDialog({ providerId: p.id, action })}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />{actionLabels[action] || action}
                      </Button>
                    ))}
                    {p.id === "bexio" && (
                      <Button variant="outline" size="sm" onClick={() => { window.location.href = "/settings?tab=integrations"; }}>{t.configure}</Button>
                    )}
                  </div>
                  {!p.isConfigured || !p.isEnabled ? (
                    <p className="text-xs text-muted-foreground">{t.activationRequired}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {importDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setImportDialog(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>{t.csvImport.title}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t.importType}</label>
                  <p className="text-sm text-muted-foreground">{actionLabels[importDialog.action]}</p>
                </div>
                <div>
                  <label htmlFor="integration-import-file" className="text-sm font-medium">{t.csvImport.selectFile}</label>
                  <input id="integration-import-file" type="file" name="file" accept=".csv,.txt,.tsv" required className="mt-1 block w-full text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">{t.csvImport.formatHint}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setImportDialog(null)}>{de.common.cancel}</Button>
                  <Button type="submit" disabled={importing}>
                    {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {importing ? t.csvImport.importing : t.csvImport.import}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
