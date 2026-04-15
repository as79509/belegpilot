"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { de } from "@/lib/i18n/de";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentTable } from "@/components/documents/document-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Filter, X, RefreshCw, AlertTriangle, ShieldAlert, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityHeader, InfoPanel, SectionCard } from "@/components/ds";
import { usePageShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { statusColors } from "@/lib/design-tokens";
import { useRole } from "@/lib/hooks/use-role";
import { hasPermission } from "@/lib/permissions";

const QUICK_FILTERS = [
  { key: "", label: de.common.all },
  { key: "needs_review", label: de.status.needs_review, color: `${statusColors.warning.bg} ${statusColors.warning.text}` },
  { key: "ready", label: de.status.ready, color: `${statusColors.success.bg} ${statusColors.success.text}` },
  { key: "failed", label: de.status.failed, color: `${statusColors.error.bg} ${statusColors.error.text}` },
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

  // Seiten-spezifische Shortcuts
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

  const { role, isViewer } = useRole();
  const canUpload = hasPermission(role, "documents:write");

  const hasAdvancedFilters = dateFrom || dateTo || amountFrom || amountTo || supplierId || currency || exportStatus || confidence || documentType;

  // Viewer: simplified view — upload + basic list
  if (isViewer) {
    return (
      <div className="space-y-4">
        <EntityHeader
          title={de.documents.title}
          primaryAction={canUpload ? {
            label: de.documents.upload,
            icon: Upload,
            onClick: () => setShowUpload(!showUpload),
          } : undefined}
        />
        {canUpload && showUpload && <UploadZone onUploadComplete={() => setRefreshKey((k) => k + 1)} />}
        <DocumentTable
          refreshKey={refreshKey}
          initialStatus=""
          extraParams={{}}
          key={`viewer-${refreshKey}`}
        />
      </div>
    );
  }

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
    <div className="space-y-4">
      <EntityHeader
        title={de.documents.title}
        badge={
          counts.total != null ? (
            <Badge variant="secondary" className="text-xs">
              {counts.total} {de.documentList.totalDocs}
            </Badge>
          ) : undefined
        }
        primaryAction={canUpload ? {
          label: de.documents.upload,
          icon: Upload,
          onClick: () => setShowUpload(!showUpload),
        } : undefined}
        secondaryActions={[
          {
            label: de.documents.filterButton,
            icon: Filter,
            onClick: () => setShowFilters(!showFilters),
          },
          {
            label: de.documents.refreshButton,
            icon: RefreshCw,
            variant: "ghost",
            onClick: () => setRefreshKey((k) => k + 1),
          },
        ]}
      />

      {canUpload && showUpload && (
        <SectionCard
          title={de.documents.uploadZoneTitle}
          icon={Upload}
          iconColor="text-blue-600"
          bodyClassName="space-y-3"
        >
          <UploadZone onUploadComplete={() => setRefreshKey((k) => k + 1)} />
          <p className="text-xs text-muted-foreground">{de.documents.uploadZone.dropHint}</p>
        </SectionCard>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <FileText className="h-3.5 w-3.5" />
                {counts.total != null ? `${counts.total} ${de.documentList.totalDocs}` : de.documents.title}
              </div>
              {(counts.needs_review ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {(counts.uploaded
                    ? de.documents.reviewSummaryWithUploaded
                    : de.documents.reviewSummary)
                    .replace("{count}", String(counts.needs_review))
                    .replace("{uploaded}", String(counts.uploaded ?? 0))}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={statusFilter === f.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "rounded-full",
                    statusFilter === f.key ? "" : "text-muted-foreground"
                  )}
                >
                  {f.label}
                  {f.key && counts[f.key] != null && (
                    <Badge variant="secondary" className={cn("ml-1.5 text-xs px-1.5", f.color)}>
                      {counts[f.key]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {((counts.escalated ?? 0) > 0 || (counts.unverified_suppliers ?? 0) > 0) && (
            <div className="grid gap-2 md:grid-cols-2">
              {(counts.escalated ?? 0) > 0 && (
                <InfoPanel tone="warning" icon={AlertTriangle}>
                  <span className="font-medium">{counts.escalated}</span> {de.documentList.escalatedCount}
                </InfoPanel>
              )}
              {(counts.unverified_suppliers ?? 0) > 0 && (
                <InfoPanel tone="warning" icon={ShieldAlert}>
                  <span className="font-medium">{counts.unverified_suppliers}</span> {de.documentList.unverifiedCount}
                </InfoPanel>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <SectionCard
          title={de.documents.filterButton}
          icon={Filter}
          action={
            hasAdvancedFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" />
                {de.filters.clearAll}
              </Button>
            ) : undefined
          }
          bodyClassName="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <select className="w-full rounded-md border bg-white px-3 py-1.5 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">{de.common.all}</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nameNormalized}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.documents.filtersExtended.currency}</label>
              <select className="w-full rounded-md border bg-white px-3 py-1.5 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="">{de.common.all}</option>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.documents.filtersExtended.exportStatus}</label>
              <select className="w-full rounded-md border bg-white px-3 py-1.5 text-sm" value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
                <option value="">{de.common.all}</option>
                <option value="exported">{de.documents.filtersExtended.exportDone}</option>
                <option value="not_exported">{de.documents.filtersExtended.exportPending}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{de.documents.filtersExtended.confidence}</label>
              <select className="w-full rounded-md border bg-white px-3 py-1.5 text-sm" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
                <option value="">{de.common.all}</option>
                <option value="high">{de.documents.filtersExtended.confidenceHigh}</option>
                <option value="medium">{de.documents.filtersExtended.confidenceMedium}</option>
                <option value="low">{de.documents.filtersExtended.confidenceLow}</option>
              </select>
            </div>
          </div>
          <div className="max-w-xs">
            <label className="text-xs text-muted-foreground">{de.documents.filtersExtended.documentType}</label>
            <select className="w-full rounded-md border bg-white px-3 py-1.5 text-sm" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              <option value="">{de.common.all}</option>
              {Object.entries(de.documentType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </SectionCard>
      )}

      <DocumentTable
        refreshKey={refreshKey}
        initialStatus={statusFilter}
        extraParams={extraParams}
        showStatusFilter={false}
        key={`${statusFilter}-${JSON.stringify(extraParams)}`}
      />
    </div>
  );
}
