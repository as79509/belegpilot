"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { de } from "@/lib/i18n/de";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Filter, X, RefreshCw, AlertTriangle, ShieldAlert, FileText, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

const QUICK_FILTERS = [
  { key: "", label: "Alle", color: "" },
  { key: "needs_review", label: de.status.needs_review, color: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "ready", label: de.status.ready, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "failed", label: de.status.failed, color: "bg-red-50 text-red-700 border-red-200" },
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
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "needs_review");
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

  // Page shortcuts
  usePageShortcuts([
    {
      key: "n",
      handler: () => setShowUpload((v) => !v),
      description: "Neuer Upload",
    },
    {
      key: "f",
      handler: () => {
        const el = document.querySelector<HTMLInputElement>("[data-search-input]");
        el?.focus();
      },
      description: "Suche fokussieren",
    },
  ]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">{de.documents.title}</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {counts.total != null ? `${counts.total} ${de.documentList.totalDocs}` : "Belege verwalten"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowUpload(!showUpload)}
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            {de.documents.upload}
          </Button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <Card className="border-[var(--border-default)] border-dashed">
          <CardContent className="pt-6">
            <UploadZone onUploadComplete={() => setRefreshKey((k) => k + 1)} />
          </CardContent>
        </Card>
      )}

      {/* Alert Panels */}
      {((counts.escalated ?? 0) > 0 || (counts.unverified_suppliers ?? 0) > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {(counts.escalated ?? 0) > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="p-2 rounded-lg bg-amber-100">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">{counts.escalated} {de.documentList.escalatedCount}</p>
                  <p className="text-xs text-amber-600">Belege mit niedrigem Vertrauen</p>
                </div>
              </CardContent>
            </Card>
          )}
          {(counts.unverified_suppliers ?? 0) > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="p-2 rounded-lg bg-amber-100">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">{counts.unverified_suppliers} {de.documentList.unverifiedCount}</p>
                  <p className="text-xs text-amber-600">Lieferanten nicht verifiziert</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                statusFilter === f.key
                  ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                  : "bg-white text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--surface-secondary)]"
              )}
            >
              {f.label}
              {f.key && counts[f.key] != null && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1 text-xs px-1.5",
                    statusFilter === f.key ? "bg-white/20 text-white" : f.color || "bg-slate-100"
                  )}
                >
                  {counts[f.key]}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Advanced Filter Toggle */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
            showFilters || hasAdvancedFilters
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-white text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--surface-secondary)]"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {hasAdvancedFilters && (
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFilters && "rotate-180")} />
        </button>

        {/* Clear Filters */}
        {hasAdvancedFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="h-3 w-3" />
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="border-[var(--border-default)]">
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">{de.filters.dateFrom}</label>
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)} 
                  className="h-9 border-[var(--border-default)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">{de.filters.dateTo}</label>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)} 
                  className="h-9 border-[var(--border-default)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">{de.filters.amountFrom}</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={amountFrom} 
                  onChange={(e) => setAmountFrom(e.target.value)} 
                  placeholder="0.00" 
                  className="h-9 border-[var(--border-default)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">{de.filters.amountTo}</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={amountTo} 
                  onChange={(e) => setAmountTo(e.target.value)} 
                  placeholder="0.00" 
                  className="h-9 border-[var(--border-default)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">{de.documents.supplier}</label>
                <select 
                  className="w-full h-9 border border-[var(--border-default)] rounded-lg px-3 text-sm bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors" 
                  value={supplierId} 
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Alle</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nameNormalized}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">Währung</label>
                <select 
                  className="w-full h-9 border border-[var(--border-default)] rounded-lg px-3 text-sm bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors" 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="">Alle</option>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">Export-Status</label>
                <select 
                  className="w-full h-9 border border-[var(--border-default)] rounded-lg px-3 text-sm bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors" 
                  value={exportStatus} 
                  onChange={(e) => setExportStatus(e.target.value)}
                >
                  <option value="">Alle</option>
                  <option value="exported">Exportiert</option>
                  <option value="not_exported">Nicht exportiert</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">Konfidenz</label>
                <select 
                  className="w-full h-9 border border-[var(--border-default)] rounded-lg px-3 text-sm bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors" 
                  value={confidence} 
                  onChange={(e) => setConfidence(e.target.value)}
                >
                  <option value="">Alle</option>
                  <option value="high">Hoch (&gt;80%)</option>
                  <option value="medium">Mittel (50-80%)</option>
                  <option value="low">Niedrig (&lt;50%)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-48">
                <label className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5 block">Belegtyp</label>
                <select 
                  className="w-full h-9 border border-[var(--border-default)] rounded-lg px-3 text-sm bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors" 
                  value={documentType} 
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="">Alle</option>
                  {Object.entries(de.documentType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Table */}
      <Card className="border-[var(--border-default)]">
        <CardContent className="p-0">
          <DocumentTable
            refreshKey={refreshKey}
            initialStatus={statusFilter}
            extraParams={extraParams}
            key={`${statusFilter}-${JSON.stringify(extraParams)}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
