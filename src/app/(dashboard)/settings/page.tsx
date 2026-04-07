"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Zap, Database, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", legalName: "", vatNumber: "", currency: "CHF" });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/company")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setForm({
            name: data.name || "",
            legalName: data.legalName || "",
            vatNumber: data.vatNumber || "",
            currency: data.currency || "CHF",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.settings.saved);
    } catch (err: any) {
      toast.error(err.message || de.errors.serverError);
    } finally {
      setSaving(false);
    }
  }

  async function testAiConnection() {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/dashboard/ai-costs");
      setTestStatus(res.ok ? "ok" : "error");
    } catch {
      setTestStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{de.settings.title}</h1>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{de.settings.company}</TabsTrigger>
          <TabsTrigger value="integrations">{de.settings.integrations}</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{de.settings.company}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" />
                  <Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" />
                  <Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">{de.settings.companyName}</Label>
                    <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">{de.settings.legalName}</Label>
                    <Input value={form.legalName} onChange={(e) => setForm(f => ({ ...f, legalName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">{de.settings.vatNumber}</Label>
                    <Input value={form.vatNumber} onChange={(e) => setForm(f => ({ ...f, vatNumber: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">{de.settings.defaultCurrency}</Label>
                    <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="CHF">CHF</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {de.common.save}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />{de.settings.aiProvider}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Claude (Anthropic)</span>
                <Badge variant="secondary" className={testStatus === "ok" ? "bg-green-100 text-green-800" : testStatus === "error" ? "bg-red-100 text-red-800" : "bg-gray-100"}>
                  {testStatus === "ok" ? de.settings.connected : testStatus === "error" ? de.settings.notConnected : "—"}
                </Badge>
              </div>
              <div>
                <Label className="text-xs">{de.settings.apiKey}</Label>
                <Input type="password" value="••••••••••••" readOnly className="bg-muted/50" />
              </div>
              <Button variant="outline" size="sm" onClick={testAiConnection} disabled={testStatus === "testing"}>
                {testStatus === "testing" ? de.settings.testing : de.settings.testConnection}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />{de.settings.storage}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm">{de.settings.storageBucket}:</span>
                <Badge variant="secondary">Documents (Supabase Storage)</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
