"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "./document-status-badge";
import { StatusBadge, ConfidenceBadge, EmptyState } from "@/components/ds";
import { de } from "@/lib/i18n/de";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatConfidence,
  getConfidenceColor,
} from "@/lib/i18n/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw, FileText, Loader2, CheckCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  documentNumber: string | null;
  status: string;
  supplierNameRaw: string | null;
  supplierNameNormalized: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  grossAmount: string | null;
  currency: string | null;
  confidenceScore: number | null;
  exportStatus: string | null;
  createdAt: string;
  file?: { fileName: string; mimeType: string } | null;
  bookingSuggestions?: Array<{ confidenceLevel: string; suggestedAccount: string | null; confidenceScore: number; status: string }>;
}

interface DocumentTableProps {
  refreshKey?: number;
  initialStatus?: string;
  extraParams?: Record<string, string>;
}

export function DocumentTable({ refreshKey, initialStatus, extraParams }: DocumentTableProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "");
  const [sortBy, setSortBy] = useState(initialStatus === "needs_review" ? "confidenceScore" : "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialStatus === "needs_review" ? "asc" : "desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sortBy,
      sortOrder,
    });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }

    const res = await fetch(`/api/documents?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    }
    setLoading(false);
  }, [page, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  }

  const SortHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => toggleSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder={de.documents.search}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">{de.documents.allStatuses}</option>
          {Object.entries(de.status).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-md border border-blue-200">
          <span className="text-sm font-medium">{selected.size} {de.bulk.selected}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/documents/bulk-approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentIds: Array.from(selected) }),
              });
              if (res.ok) {
                const r = await res.json();
                toast.success(`${r.approved} ${de.bulk.approveSubmitted}${r.skipped ? `, ${r.skipped} ${de.bulk.approveSkipped}` : ""}`);
                setSelected(new Set());
                fetchDocuments();
              } else {
                const err = await res.json().catch(() => null);
                toast.error(err?.error || "Fehler bei Bulk-Genehmigung");
              }
            }}
          >
            <CheckCircle className="h-3 w-3 mr-1" />{de.bulk.approve}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const ids = Array.from(selected);
              router.push(`/tasks/new?documentIds=${ids.join(",")}`);
            }}
          >
            <ClipboardList className="h-3 w-3 mr-1" />{de.bulk.createTask}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/documents/bulk-reprocess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentIds: Array.from(selected) }),
              });
              if (res.ok) {
                const r = await res.json();
                toast.success(`${r.submitted} ${de.bulk.reprocessSubmitted}`);
                setSelected(new Set());
                fetchDocuments();
              }
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />{de.bulk.reprocess}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/bexio/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentIds: Array.from(selected) }),
              });
              if (res.ok) {
                const r = await res.json();
                toast.success(`${r.successCount} an Bexio gesendet`);
                setSelected(new Set());
                fetchDocuments();
              } else { toast.error("Export fehlgeschlagen"); }
            }}
          >
            {de.bexio.exportToBexio}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {de.bulk.reset}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={documents.length > 0 && selected.size === documents.length}
                  onCheckedChange={(c) => {
                    if (c) setSelected(new Set(documents.map((d) => d.id)));
                    else setSelected(new Set());
                  }}
                />
              </TableHead>
              <TableHead className="whitespace-nowrap">Belegnr.</TableHead>
              <SortHeader column="status">{de.documents.status}</SortHeader>
              <SortHeader column="supplierNameRaw">
                {de.documents.supplier}
              </SortHeader>
              <TableHead className="whitespace-nowrap">
                {de.documents.invoiceNumber}
              </TableHead>
              <SortHeader column="invoiceDate">{de.documents.date}</SortHeader>
              <SortHeader column="grossAmount">
                {de.documents.amount}
              </SortHeader>
              <SortHeader column="confidenceScore">
                {de.documents.confidence}
              </SortHeader>
              <TableHead className="whitespace-nowrap">Export</TableHead>
              <TableHead className="whitespace-nowrap">{de.suggestions.title}</TableHead>
              <SortHeader column="createdAt">
                {de.documents.uploadedAt}
              </SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <EmptyState
                    icon={FileText}
                    title={de.documents.noDocuments}
                    description="Laden Sie Belege hoch oder passen Sie die Filter an"
                  />
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(doc.id)}
                      onCheckedChange={(c) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (c) next.add(doc.id);
                          else next.delete(doc.id);
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {doc.documentNumber || de.common.noData}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="document" value={doc.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {doc.supplierNameNormalized ||
                      doc.supplierNameRaw ||
                      de.common.noData}
                  </TableCell>
                  <TableCell>{doc.invoiceNumber || de.common.noData}</TableCell>
                  <TableCell>{formatDate(doc.invoiceDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatCurrency(doc.grossAmount, doc.currency || "CHF")}
                  </TableCell>
                  <TableCell>
                    <span className={getConfidenceColor(doc.confidenceScore)}>
                      {formatConfidence(doc.confidenceScore)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {doc.exportStatus === "exported" ? (
                      <span className="text-green-600">✓</span>
                    ) : doc.exportStatus === "export_failed" ? (
                      <span className="text-red-600">✗</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      const s = doc.bookingSuggestions?.[0];
                      if (!s) return <span className="text-muted-foreground">—</span>;
                      if (s.status !== "pending") return <span className="text-green-600">✓</span>;
                      return (
                        <span title={`${de.suggestions.title}: ${de.suggestions.panel.account} ${s.suggestedAccount || "—"} (${Math.round(s.confidenceScore * 100)}%)`}>
                          <ConfidenceBadge level={s.confidenceLevel as "high" | "medium" | "low"} compact />
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(doc.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {de.documents.showing} {(page - 1) * 20 + 1}–
            {Math.min(page * 20, total)} {de.documents.of} {total}{" "}
            {de.documents.entries}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {de.documents.page} {page} {de.documents.of} {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
