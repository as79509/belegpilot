"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Zap, Database } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";

export default function SettingsPage() {
  const [company, setCompany] = useState<any>(null);
  const [form, setForm] = useState({ name: "", legalName: "", vatNumber: "", currency: "CHF" });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  useEffect(() => {
    // Load company data from dashboard stats (simple approach)
    fetch("/api/dashboard/stats").then((r) => r.json()).then(() => {
      // For now, hardcode the demo company values — full company API is Phase 5
      setForm({ name: "BelegPilot Demo", legalName: "BelegPilot Demo GmbH", vatNumber: "CHE-123.456.789", currency: "CHF" });
    });
  }, []);

  async function testAiConnection() {
    setTestStatus("testing");
    try {
      // Simple test: call the normalizer with an empty request
      const res = await fetch("/api/test-ai", { method: "POST" });
      setTestStatus(res.ok ? "ok" : "error");
    } catch {
      setTestStatus("error");
    }
  }

  const aiProvider = typeof window !== "undefined" ? "Claude (Anthropic)" : "—";
  const storageBucket = "Documents (Supabase Storage)";

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
              <Button onClick={() => toast.success(de.settings.saved)}>
                <Save className="h-4 w-4 mr-2" />{de.common.save}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          {/* AI Provider */}
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

          {/* Storage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />{de.settings.storage}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm">{de.settings.storageBucket}:</span>
                <Badge variant="secondary">{storageBucket}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
