"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { toast } from "sonner";


export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/trustee/clients/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setForm({
          name: data.name || "", legalName: data.legalName || "",
          legalForm: data.legalForm || "", vatNumber: data.vatNumber || "",
          currency: data.currency || "CHF", industry: data.industry || "",
          businessModel: data.businessModel || "", phone: data.phone || "",
          email: data.email || "", website: data.website || "",
          vatLiable: data.vatLiable ?? true, vatMethod: data.vatMethod || "",
          vatInterval: data.vatInterval || "", chartOfAccounts: data.chartOfAccounts || "",
          aiContext: data.aiContext || "", aiConfidenceThreshold: data.aiConfidenceThreshold ?? 0.65,
          aiAutoApprove: data.aiAutoApprove ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);



  function set(f: string, v: any) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/trustee/clients/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.settings.saved);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (!client) return <p className="py-12 text-center text-muted-foreground">Nicht gefunden</p>;

  return (
    <div className="space-y-4">
      <Link href="/trustee/clients" className="text-sm text-muted-foreground hover:text-foreground">← {de.clients.title}</Link>
      <h1 className="text-xl font-semibold">{client.name}</h1>



      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{de.clients.details}</TabsTrigger>
          <TabsTrigger value="accounting">{de.clients.accountingTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Grunddaten</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.onboarding.companyName}</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div><Label className="text-xs">{de.onboarding.legalForm}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.legalForm} onChange={(e) => set("legalForm", e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(de.onboarding.legalForms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">UID</Label><Input value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} /></div>
              <div><Label className="text-xs">{de.onboarding.industry}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(de.onboarding.industries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label className="text-xs">E-Mail</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </CardContent>
          </Card>
          <div><Label className="text-xs">{de.onboarding.businessModel}</Label>
            <Textarea value={form.businessModel} onChange={(e) => set("businessModel", e.target.value)} rows={3} /></div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{de.common.save}
          </Button>
        </TabsContent>

        <TabsContent value="accounting" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">MwSt & Buchhaltung</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.onboarding.vatMethod}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.vatMethod} onChange={(e) => set("vatMethod", e.target.value)}>
                  <option value="effective">{de.onboarding.vatEffective}</option><option value="flat_rate">{de.onboarding.vatFlatRate}</option>
                </select></div>
              <div><Label className="text-xs">{de.onboarding.chartOfAccounts}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.chartOfAccounts} onChange={(e) => set("chartOfAccounts", e.target.value)}>
                  <option value="KMU">KMU</option><option value="Käfer">Käfer</option><option value="custom">Individuell</option>
                </select></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">KI-Einstellungen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">{de.onboarding.aiContext}</Label>
                <Textarea value={form.aiContext} onChange={(e) => set("aiContext", e.target.value)} rows={3} placeholder={de.onboarding.aiContextPlaceholder} /></div>
            </CardContent>
          </Card>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{de.common.save}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
