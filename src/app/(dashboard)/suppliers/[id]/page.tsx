"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, Save, Sparkles } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatDate } from "@/lib/i18n/format";
import { toast } from "sonner";
import { useRecentItems } from "@/lib/hooks/use-recent-items";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addRecent } = useRecentItems();
  const [supplier, setSupplier] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({
    nameNormalized: "", vatNumber: "", iban: "", country: "",
    email: "", phone: "", website: "", contactPerson: "",
    street: "", zip: "", city: "",
    bankName: "", bic: "", paymentTermDays: "",
    defaultCategory: "", defaultAccountCode: "",
    defaultCostCenter: "", defaultVatCode: "", notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [patternData, setPatternData] = useState<any>(null);
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [acceptAccount, setAcceptAccount] = useState(true);
  const [acceptCategory, setAcceptCategory] = useState(true);

  useEffect(() => {
    fetch(`/api/suppliers/${params.id}/suggest-defaults`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPatternData(d); })
      .catch(() => {});

    fetch(`/api/suppliers/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setSupplier(data);
        setForm({
          nameNormalized: data.nameNormalized || "",
          vatNumber: data.vatNumber || "",
          iban: data.iban || "",
          country: data.country || "",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
          contactPerson: data.contactPerson || "",
          street: data.street || "",
          zip: data.zip || "",
          city: data.city || "",
          bankName: data.bankName || "",
          bic: data.bic || "",
          paymentTermDays: data.paymentTermDays ?? "",
          defaultCategory: data.defaultCategory || "",
          defaultAccountCode: data.defaultAccountCode || "",
          defaultCostCenter: data.defaultCostCenter || "",
          defaultVatCode: data.defaultVatCode || "",
          notes: data.notes || "",
        });
      })
      .catch((err) => console.error("[SupplierDetail] Fetch error:", err))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (supplier?.id) {
      addRecent(
        "supplier",
        supplier.id,
        supplier.nameNormalized || "Lieferant",
        `/suppliers/${supplier.id}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier?.id]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    const payload = { ...form };
    if (payload.paymentTermDays === "") payload.paymentTermDays = null;
    else payload.paymentTermDays = parseInt(payload.paymentTermDays);

    const res = await fetch(`/api/suppliers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSupplier(await res.json());
      toast.success(de.suppliers.saveSuccess);
    } else toast.error(de.common.error);
  }

  async function handleVerify() {
    const res = await fetch(`/api/suppliers/${params.id}/verify`, { method: "POST" });
    if (res.ok) {
      setSupplier(await res.json());
      toast.success(de.suppliers.verifySuccess);
    }
  }

  async function handleAcceptDefaults() {
    const res = await fetch(`/api/suppliers/${params.id}/suggest-defaults`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptAccount, acceptCategory }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSupplier(updated);
      setForm((f) => ({
        ...f,
        defaultAccountCode: updated.defaultAccountCode || "",
        defaultCategory: updated.defaultCategory || "",
      }));
      toast.success(de.supplierPatterns.defaultsUpdated);
      setDefaultsDialogOpen(false);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.common.error);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-64" />
      <div className="space-y-4">
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-3">
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" />
        </CardContent></Card>
      </div>
    </div>
  );
  if (!supplier) return <p className="py-20 text-center text-muted-foreground">{de.errors.notFound}</p>;

  return (
    <div className="space-y-4">
      <Link href="/suppliers" className="text-sm text-muted-foreground hover:text-foreground">← {de.suppliers.title}</Link>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{supplier.nameNormalized}</h1>
        {supplier.isVerified ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />{de.suppliers.verified}
          </Badge>
        ) : (
          <>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" />{de.suppliers.unverified}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleVerify}>{de.suppliers.verify}</Button>
          </>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">{de.suppliers.documentCount} ({supplier.documentCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          {/* Stammdaten */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Stammdaten</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.name}</Label>
                <Input value={form.nameNormalized} onChange={(e) => set("nameNormalized", e.target.value)} /></div>
              <div><Label className="text-xs">{de.detail.vatNumber}</Label>
                <Input value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.country}</Label>
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="CH" /></div>
            </CardContent>
          </Card>

          {/* Kontakt */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Kontakt</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">E-Mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label className="text-xs">Telefon</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label className="text-xs">Webseite</Label>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
              <div><Label className="text-xs">Ansprechpartner</Label>
                <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{de.suppliers.address}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3"><Label className="text-xs">Strasse</Label>
                <Input value={form.street} onChange={(e) => set("street", e.target.value)} /></div>
              <div><Label className="text-xs">PLZ</Label>
                <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></div>
              <div className="md:col-span-2"><Label className="text-xs">Ort</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Bankverbindung */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bankverbindung</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">IBAN</Label>
                <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} /></div>
              <div><Label className="text-xs">BIC</Label>
                <Input value={form.bic} onChange={(e) => set("bic", e.target.value)} /></div>
              <div><Label className="text-xs">Bank</Label>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
              <div><Label className="text-xs">Zahlungsfrist (Tage)</Label>
                <Input type="number" value={form.paymentTermDays} onChange={(e) => set("paymentTermDays", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Standardwerte */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Standardwerte für Belege</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs">{de.suppliers.defaultCategory}</Label>
                <Input value={form.defaultCategory} onChange={(e) => set("defaultCategory", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultAccount}</Label>
                <Input value={form.defaultAccountCode} onChange={(e) => set("defaultAccountCode", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultCostCenter}</Label>
                <Input value={form.defaultCostCenter} onChange={(e) => set("defaultCostCenter", e.target.value)} /></div>
              <div><Label className="text-xs">{de.suppliers.defaultVatCode}</Label>
                <Input value={form.defaultVatCode} onChange={(e) => set("defaultVatCode", e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Buchungsmuster */}
          {patternData && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{de.supplierPatterns.title}</CardTitle>
                {patternData.eligible && (
                  <Button variant="outline" size="sm" onClick={() => setDefaultsDialogOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />{de.supplierPatterns.suggestDefaults}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {!patternData.pattern ? (
                  <p className="text-xs text-muted-foreground">{de.supplierPatterns.notEligible}</p>
                ) : (
                  <>
                    {/* Konto */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.dominantAccount}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{patternData.pattern.dominantAccount || "—"}</span>
                        {patternData.pattern.dominantAccount && (
                          <Badge className={patternData.pattern.accountStability >= 0.8 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                            {Math.round(patternData.pattern.accountStability * 100)}% von {patternData.pattern.totalApprovedDocs}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Betrag */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.typicalAmount}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {patternData.pattern.typicalAmount != null
                            ? formatCurrency(patternData.pattern.typicalAmount, "CHF")
                            : "—"}
                          {patternData.pattern.amountStdDeviation != null && patternData.pattern.typicalAmount != null && (
                            <span className="text-xs text-muted-foreground"> ± {formatCurrency(patternData.pattern.amountStdDeviation, "CHF")}</span>
                          )}
                        </span>
                        {patternData.pattern.isAmountStable ? (
                          <Badge className="bg-green-100 text-green-800">{de.supplierPatterns.amountStable}</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">{de.supplierPatterns.amountUnstable}</Badge>
                        )}
                      </div>
                    </div>
                    {/* MwSt */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{de.supplierPatterns.dominantVat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {patternData.pattern.dominantVatRate != null ? `${patternData.pattern.dominantVatRate}%` : "—"}
                        </span>
                        {patternData.pattern.vatStability >= 0.8 ? (
                          <Badge className="bg-green-100 text-green-800">{de.supplierPatterns.vatConsistent} ({Math.round(patternData.pattern.vatStability * 100)}%)</Badge>
                        ) : patternData.pattern.dominantVatRate != null ? (
                          <Badge className="bg-amber-100 text-amber-800">{de.supplierPatterns.vatInconsistent}</Badge>
                        ) : null}
                      </div>
                    </div>
                    {!patternData.eligible && (
                      <p className="text-xs text-muted-foreground italic">{patternData.reason}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Defaults dialog */}
          <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{de.supplierPatterns.suggestDefaults}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {patternData?.suggestions?.defaultAccountCode && (
                  <div className="flex items-start gap-2">
                    <Checkbox checked={acceptAccount} onCheckedChange={(c) => setAcceptAccount(!!c)} />
                    <div className="text-sm">
                      <div>{de.supplierPatterns.dominantAccount}: <strong>{patternData.suggestions.defaultAccountCode}</strong></div>
                      <p className="text-xs text-muted-foreground">{de.supplierPatterns.setAsDefault}</p>
                    </div>
                  </div>
                )}
                {patternData?.suggestions?.defaultCategory && (
                  <div className="flex items-start gap-2">
                    <Checkbox checked={acceptCategory} onCheckedChange={(c) => setAcceptCategory(!!c)} />
                    <div className="text-sm">
                      <div>Kategorie: <strong>{patternData.suggestions.defaultCategory}</strong></div>
                      <p className="text-xs text-muted-foreground">{de.supplierPatterns.setAsDefault}</p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose><Button variant="outline">{de.common.cancel}</Button></DialogClose>
                <Button onClick={handleAcceptDefaults} disabled={!acceptAccount && !acceptCategory}>
                  {de.common.save}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notizen */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Notizen</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Interne Anmerkungen..." />
            </CardContent>
          </Card>

          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{de.suppliers.save}</Button>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {supplier.documents?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Belegnr.</TableHead>
                      <TableHead>{de.documents.status}</TableHead>
                      <TableHead>{de.documents.invoiceNumber}</TableHead>
                      <TableHead>{de.documents.date}</TableHead>
                      <TableHead>{de.documents.amount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.documents.map((doc: any) => (
                      <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/documents/${doc.id}`)}>
                        <TableCell className="font-mono text-xs">{doc.documentNumber || de.common.noData}</TableCell>
                        <TableCell><DocumentStatusBadge status={doc.status} /></TableCell>
                        <TableCell>{doc.invoiceNumber || de.common.noData}</TableCell>
                        <TableCell>{formatDate(doc.invoiceDate)}</TableCell>
                        <TableCell>{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Keine Belege</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
