"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Landmark, Loader2, Calculator } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatDate, formatCurrency } from "@/lib/i18n/format";
import { toast } from "sonner";

const CAT_COLORS: Record<string, string> = {
  vehicles: "bg-blue-100 text-blue-800", machinery: "bg-purple-100 text-purple-800",
  it_hardware: "bg-cyan-100 text-cyan-800", software: "bg-indigo-100 text-indigo-800",
  furniture: "bg-amber-100 text-amber-800", renovation: "bg-orange-100 text-orange-800",
  tools: "bg-teal-100 text-teal-800", intangible: "bg-pink-100 text-pink-800",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depreciating, setDepreciating] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [form, setForm] = useState({
    name: "", category: "it_hardware", acquisitionDate: new Date().toISOString().split("T")[0],
    acquisitionCost: "", residualValue: "0", usefulLifeMonths: "60",
    depreciationMethod: "linear", degressiveRate: "",
    assetAccount: "1500", depreciationAccount: "6800",
    location: "", serialNumber: "", licensePlate: "", privateUsePercent: "",
  });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set("category", catFilter);
      const res = await fetch(`/api/assets?${params}`);
      if (res.ok) setAssets(await res.json());
    } catch {} finally { setLoading(false); }
  }, [catFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(de.journal.saveSuccess);
      setDialogOpen(false);
      fetchAssets();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDepreciate() {
    setDepreciating(true);
    try {
      const res = await fetch("/api/assets/depreciate", { method: "POST" });
      const data = await res.json();
      toast.success(`${data.depreciated} ${de.assets.depreciated} (CHF ${data.totalAmount})`);
      fetchAssets();
    } catch (err: any) { toast.error(err.message); }
    finally { setDepreciating(false); }
  }

  function bookValueColor(asset: any): string {
    const ratio = Number(asset.bookValue) / Number(asset.acquisitionCost);
    if (ratio > 0.5) return "text-green-600";
    if (ratio > 0.2) return "text-amber-600";
    return "text-red-600";
  }

  function monthlyDepr(asset: any): number {
    const cost = Number(asset.acquisitionCost);
    const rv = Number(asset.residualValue);
    if (asset.depreciationMethod === "degressive" && asset.degressiveRate) {
      return Math.round(Number(asset.bookValue) * (asset.degressiveRate / 100 / 12) * 100) / 100;
    }
    return Math.round((cost - rv) / asset.usefulLifeMonths * 100) / 100;
  }

  const totalCost = assets.reduce((s, a) => s + Number(a.acquisitionCost), 0);
  const totalBook = assets.reduce((s, a) => s + Number(a.bookValue), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.assets.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDepreciate} disabled={depreciating}>
            {depreciating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            {de.assets.depreciate}
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{de.assets.newAsset}</Button>
        </div>
      </div>

      <select className="border rounded-md px-3 py-1.5 text-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
        <option value="">Alle Kategorien</option>
        {Object.entries(de.assets.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12"><Landmark className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{de.assets.noAssets}</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{de.assets.name}</TableHead>
                <TableHead>{de.assets.category}</TableHead>
                <TableHead>{de.assets.acquisitionDate}</TableHead>
                <TableHead>{de.assets.acquisitionCost}</TableHead>
                <TableHead>{de.assets.bookValue}</TableHead>
                <TableHead>{de.assets.monthlyDepreciation}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {assets.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-xs ${CAT_COLORS[a.category] || ""}`}>{de.assets.categories[a.category] || a.category}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDate(a.acquisitionDate)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatCurrency(a.acquisitionCost, "CHF")}</TableCell>
                    <TableCell className={`text-xs font-medium whitespace-nowrap ${bookValueColor(a)}`}>{formatCurrency(a.bookValue, "CHF")}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatCurrency(monthlyDepr(a), "CHF")}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-xs ${a.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>{a.status === "active" ? de.rules.active : de.assets.disposed}</Badge></TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3}>{de.journal.total}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(totalCost, "CHF")}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(totalBook, "CHF")}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New asset dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{de.assets.newAsset}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{de.assets.name} *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.assets.category}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {Object.entries(de.assets.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label className="text-xs">{de.assets.acquisitionDate}</Label><Input type="date" value={form.acquisitionDate} onChange={(e) => set("acquisitionDate", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">{de.assets.acquisitionCost} *</Label><Input type="number" step="0.01" value={form.acquisitionCost} onChange={(e) => set("acquisitionCost", e.target.value)} /></div>
              <div><Label className="text-xs">{de.assets.residualValue}</Label><Input type="number" step="0.01" value={form.residualValue} onChange={(e) => set("residualValue", e.target.value)} /></div>
              <div><Label className="text-xs">{de.assets.usefulLife}</Label><Input type="number" value={form.usefulLifeMonths} onChange={(e) => set("usefulLifeMonths", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.assets.depreciationMethod}</Label>
                <select className="w-full border rounded-md px-3 py-1.5 text-sm" value={form.depreciationMethod} onChange={(e) => set("depreciationMethod", e.target.value)}>
                  <option value="linear">{de.assets.linear}</option><option value="degressive">{de.assets.degressive}</option>
                </select></div>
              {form.depreciationMethod === "degressive" && (
                <div><Label className="text-xs">{de.assets.degressiveRate}</Label><Input type="number" step="0.1" value={form.degressiveRate} onChange={(e) => set("degressiveRate", e.target.value)} /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.assets.assetAccount}</Label><Input value={form.assetAccount} onChange={(e) => set("assetAccount", e.target.value)} /></div>
              <div><Label className="text-xs">{de.assets.depreciationAccount}</Label><Input value={form.depreciationAccount} onChange={(e) => set("depreciationAccount", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.assets.location}</Label><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
              <div><Label className="text-xs">{de.assets.serialNumber}</Label><Input value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></div>
            </div>
            {form.category === "vehicles" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{de.assets.licensePlate}</Label><Input value={form.licensePlate} onChange={(e) => set("licensePlate", e.target.value)} /></div>
                <div><Label className="text-xs">{de.assets.privateUse}</Label><Input type="number" step="1" value={form.privateUsePercent} onChange={(e) => set("privateUsePercent", e.target.value)} placeholder="z.B. 30" /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.acquisitionCost}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{de.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
