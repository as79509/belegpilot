"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, FilterBar, StatusBadge, EmptyState } from "@/components/ds";
import { SupplierRowActions } from "@/components/suppliers/supplier-row-actions";
import { useCompany } from "@/lib/contexts/company-context";

export default function SuppliersPage() {
  const router = useRouter();
  const { activeCompany } = useCompany();
  const role = activeCompany?.role || "";
  const canMutate = role === "admin" || role === "reviewer";
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/suppliers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error("[Suppliers] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  return (
    <div className="space-y-6">
      <EntityHeader title={de.suppliers.title} />

      <FilterBar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={de.documents.search}
      />

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <Table><TableHeader><TableRow>
              <TableHead>{de.suppliers.name}</TableHead><TableHead>Status</TableHead>
              <TableHead>{de.detail.vatNumber}</TableHead><TableHead>IBAN</TableHead>
              <TableHead>{de.suppliers.documentCount}</TableHead><TableHead>{de.suppliers.defaultCategory}</TableHead>
            </TableRow></TableHeader><TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          ) : suppliers.length === 0 ? (
            <EmptyState icon={Building2} title={de.suppliers.noSuppliers} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.suppliers.name}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{de.detail.vatNumber}</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>{de.suppliers.documentCount}</TableHead>
                  <TableHead>{de.suppliers.defaultCategory}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/suppliers/${s.id}`)}>
                    <TableCell className="font-medium">{s.nameNormalized}</TableCell>
                    <TableCell>
                      <StatusBadge type="supplier" value={!!s.isVerified} />
                    </TableCell>
                    <TableCell className="text-xs">{s.vatNumber || de.common.noData}</TableCell>
                    <TableCell className="text-xs">{s.iban || de.common.noData}</TableCell>
                    <TableCell>{s.documentCount}</TableCell>
                    <TableCell className="text-xs">{s.defaultCategory || de.common.noData}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <SupplierRowActions
                        supplier={s}
                        canMutate={canMutate}
                        onChanged={fetchSuppliers}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{de.documents.page} {page} {de.documents.of} {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
