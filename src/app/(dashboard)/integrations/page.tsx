"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Link2, Upload, Check, X, Loader2 } from "lucide-react";
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

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!importDialog) return;
    setImporting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("action", importDialog.action);
    try {
      const res = await fetch("/api/integrations/" + importDialog.providerId + "/import", { method: "POST", body: formData });
      const data = await res.json();
      if (data.result?.success !== false) {
        toast.success((data.result?.imported || 0) + " importiert" + (data.result?.skipped ? ", " + data.result.skipped + " \u00fcbersprungen" : ""));
      } else {
        toast.error("Import fehlgeschlagen: " + (data.result?.errors?.[0]?.message || "Unbekannter Fehler"));
      }
      setImportDialog(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setImporting(false); }
  }

  const actionLabels: Record<string, string> = t.actions as any;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.title}</h1>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!loading && providers.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t.noIntegrations}</CardContent></Card>
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
                      <Button key={action} variant="outline" size="sm" onClick={() => setImportDialog({ providerId: p.id, action })}>
                        <Upload className="h-3.5 w-3.5 mr-1" />{actionLabels[action] || action}
                      </Button>
                    ))}
                    {p.id === "bexio" && (
                      <Button variant="outline" size="sm" onClick={() => { window.location.href = "/settings?tab=integrations"; }}>Konfigurieren</Button>
                    )}
                  </div>
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
                  <label className="text-sm font-medium">Import-Typ</label>
                  <p className="text-sm text-muted-foreground">{actionLabels[importDialog.action]}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t.csvImport.selectFile}</label>
                  <input type="file" name="file" accept=".csv,.txt,.tsv" required className="mt-1 block w-full text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">{t.csvImport.formatHint}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setImportDialog(null)}>Abbrechen</Button>
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
