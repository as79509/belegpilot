"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { de } from "@/lib/i18n/de";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  { key: "", label: "Alle" },
  { key: "needs_review", label: de.status.needs_review, color: "bg-orange-100 text-orange-800" },
  { key: "ready", label: de.status.ready, color: "bg-green-100 text-green-800" },
  { key: "failed", label: de.status.failed, color: "bg-red-100 text-red-800" },
];

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Read filters from URL
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [amountFrom, setAmountFrom] = useState(searchParams.get("amountFrom") || "");
  const [amountTo, setAmountTo] = useState(searchParams.get("amountTo") || "");
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") || "");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "");
  const [exportStatus, setExportStatus] = useState(searchParams.get("exportStatus") || "");
  const [confidence, setConfidence] = useState(searchParams.get("confidence") || "");
  const [documentType, setDocumentType] = useState(searchParams.get("documentType") || "");

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setCounts).catch(() => {});
    fetch("/api/suppliers?pageSize=100").then((r) => r.json()).then((d) => setSuppliers(d.suppliers || [])).catch(() => {});
  }, [refreshKey]);

  // Persist filters in URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (amountFrom) params.set("amountFrom", amountFrom);
    if (amountTo) params.set("amountTo", amountTo);
    if (supplierId) params.set("supplierId", supplierId);
    if (currency) params.set("currency", currency);
    if (exportStatus) params.set("exportStatus", exportStatus);
    if (confidence) params.set("confidence", confidence);
    if (documentType) params.set("documentType", documentType);
    const qs = params.toString();
    router.replace(`/documents${qs ? "?" + qs : ""}`, { scroll: false });
  }, [statusFilter, dateFrom, dateTo, amountFrom, amountTo, supplierId, currency, exportStatus, confidence, documentType, router]);

  function clearFilters() {
    setStatusFilter(""); setDateFrom(""); setDateTo(""); setAmountFrom("");
    setAmountTo(""); setSupplierId(""); setCurrency(""); setExportStatus("");
    setConfidence(""); setDocumentType("");
  }

  const hasAdvancedFilters = dateFrom || dateTo || amountFrom || amountTo || supplierId || currency || exportStatus || confidence || documentType;

  // Build query params for DocumentTable
  const extraParams: Record<string, string> = {};
  if (dateFrom) extraParams.dateFrom = dateFrom;
  if (dateTo) extraParams.dateTo = dateTo;
  if (amountFrom) extraParams.amountFrom = amountFrom;
  if (amountTo) extraParams.amountTo = amountTo;
  if (supplierId) extraParams.supplierId = supplierId;
  if (currency) extraParams.currency = currency;
  if (exportStatus) extraParams.exportStatus = exportStatus;
  if (documentType) extraParams.documentType = documentType;
  if (confidence === "high") { extraParams.confidenceMin = "0.8"; }
  if (confidence === "medium") { extraParams.confidenceMin = "0.5"; extraParams.confidenceMax = "0.8"; }
  if (confidence === "low") { extraParams.confidenceMax = "0.5"; }

  console.log("[Documents] Filters loaded from URL");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.documents.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />Filter
            {hasAdvancedFilters && <Badge variant="secondary" className="ml-1 text-xs px-1">!</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />{de.documents.upload}
          </Button>
        </div>
      </div>

      {showUpload && <UploadZone onUploadComplete={() => setRefreshKey((k) => k + 1)} />}

      {/* Quick filter buttons */}
      <div className="flex gap-2">
        {QUICK_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={statusFilter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(f.key)}
            className={cn(statusFilter === f.key ? "" : "text-muted-foreground")}
          >
            {f.label}
            {f.key && counts[f.key] != null && (
              <Badge variant="secondary" className={cn("ml-1.5 text-xs px-1.5", f.color)}>{counts[f.key]}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="border rounded-md p-4 bg-white space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{de.filters.dateFrom}</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.filters.dateTo}</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.filters.amountFrom}</label>
              <Input type="number" step="0.01" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.filters.amountTo}</label>
              <Input type="number" step="0.01" value={amountTo} onChange={(e) => setAmountTo(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.documents.supplier}</label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Alle</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nameNormalized}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Währung</label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="">Alle</option>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Export-Status</label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
                <option value="">Alle</option>
                <option value="exported">Exportiert</option>
                <option value="not_exported">Nicht exportiert</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Konfidenz</label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
                <option value="">Alle</option>
                <option value="high">Hoch (&gt;80%)</option>
                <option value="medium">Mittel (50-80%)</option>
                <option value="low">Niedrig (&lt;50%)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Belegtyp</label>
              <select className="w-full border rounded-md px-3 py-1.5 text-sm bg-white" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option value="">Alle</option>
                {Object.entries(de.documentType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {hasAdvancedFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-4">
                <X className="h-3 w-3 mr-1" />{de.filters.clearAll}
              </Button>
            )}
          </div>
        </div>
      )}

      <DocumentTable
        refreshKey={refreshKey}
        initialStatus={statusFilter}
        extraParams={extraParams}
        key={`${statusFilter}-${JSON.stringify(extraParams)}`}
      />
    </div>
  );
}
