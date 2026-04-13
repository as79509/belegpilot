"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { interact } from "@/lib/interaction-classes";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { EntityHeader, FilterBar, StatusBadge, EmptyState } from "@/components/ds";
import { SupplierRowActions } from "@/components/suppliers/supplier-row-actions";
import { useCompany } from "@/lib/contexts/company-context";
import { typo, statusColors } from "@/lib/design-tokens";
import { useRole } from "@/lib/hooks/use-role";
import { toast } from "sonner";

export default function SuppliersPage() {
  const router = useRouter();
  const { activeCompany, capabilities } = useCompany();
  const role = activeCompany?.role || "";
  const canMutate = capabilities?.canMutate?.suppliers ?? (role === "admin" || role === "trustee");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [trustScores, setTrustScores] = useState<Record<string, { trustScore: number; riskLevel: string }>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nameNormalized: "",
    vatNumber: "",
    iban: "",
    defaultCategory: "",
    defaultAccountCode: "",
    paymentTermDays: "",
  });

  useEffect(() => {
    fetch("/api/suppliers/trust-scores")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.scores) {
          const map: Record<string, { trustScore: number; riskLevel: string }> = {};
          for (const s of data.scores) map[s.supplierId] = { trustScore: s.trustScore, riskLevel: s.riskLevel };
          setTrustScores(map);
        }
      })
      .catch(() => {});
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20", sortBy: "isVerified", sortOrder: "asc" });
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

  const { isViewer } = useRole();

  async function handleCreateSupplier() {
    setCreating(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || de.suppliers.createError);
      }

      toast.success(de.suppliers.createSuccess);
      setCreateOpen(false);
      setCreateForm({
        nameNormalized: "",
        vatNumber: "",
        iban: "",
        defaultCategory: "",
        defaultAccountCode: "",
        paymentTermDays: "",
      });
      setPage(1);
      await fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message || de.suppliers.createError);
    } finally {
      setCreating(false);
    }
  }

  // Viewer: simplified read-only list
  if (isViewer) {
    return (
      <div className="space-y-6">
        <EntityHeader title={de.suppliers.title} />
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : suppliers.length === 0 ? (
              <EmptyState icon={Building2} title={de.emptyStates.suppliers.title} description={de.emptyStates.suppliers.description} action={{ label: de.emptyStates.suppliers.action!, onClick: () => router.push("/documents") }} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={typo("tableHeader")}>{de.suppliers.name}</TableHead>
                    <TableHead className={typo("tableHeader")}>Status</TableHead>
                    <TableHead className={typo("tableHeader")}>{de.suppliers.documentCount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nameNormalized}</TableCell>
                      <TableCell><StatusBadge type="supplier" value={!!s.isVerified} /></TableCell>
                      <TableCell>{s.documentCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EntityHeader
        title={de.suppliers.title}
        primaryAction={canMutate ? {
          label: de.suppliers.create,
          icon: Plus,
          onClick: () => setCreateOpen(true),
        } : undefined}
      />

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
              <TableHead>{de.supplierTrust.trustScore}</TableHead>
            </TableRow></TableHeader><TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={de.suppliers.noSuppliers}
              action={canMutate ? {
                label: de.suppliers.create,
                onClick: () => setCreateOpen(true),
              } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={typo("tableHeader")}>{de.suppliers.name}</TableHead>
                  <TableHead className={typo("tableHeader")}>Status</TableHead>
                  <TableHead className={typo("tableHeader")}>{de.detail.vatNumber}</TableHead>
                  <TableHead className={typo("tableHeader")}>IBAN</TableHead>
                  <TableHead className={typo("tableHeader")}>{de.suppliers.documentCount}</TableHead>
                  <TableHead className={typo("tableHeader")}>{de.suppliers.defaultCategory}</TableHead>
                  <TableHead className={typo("tableHeader")}>{de.supplierTrust.trustScore}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => {
                  const trust = trustScores[s.id];
                  return (
                    <TableRow key={s.id} className={interact.tableRow} onClick={() => router.push(`/suppliers/${s.id}`)}>
                      <TableCell className="font-medium">{s.nameNormalized}</TableCell>
                      <TableCell>
                        <StatusBadge type="supplier" value={!!s.isVerified} />
                      </TableCell>
                      <TableCell className="text-xs">{s.vatNumber || de.common.noData}</TableCell>
                      <TableCell className="text-xs">{s.iban || de.common.noData}</TableCell>
                      <TableCell>{s.documentCount}</TableCell>
                      <TableCell className="text-xs">{s.defaultCategory || de.common.noData}</TableCell>
                      <TableCell>
                        {trust ? (
                          <Badge className={trust.riskLevel === "low" ? `${statusColors.success.bg} ${statusColors.success.text}` : trust.riskLevel === "medium" ? `${statusColors.warning.bg} ${statusColors.warning.text}` : `${statusColors.error.bg} ${statusColors.error.text}`}>
                            {trust.trustScore}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <SupplierRowActions
                          supplier={s}
                          canMutate={canMutate}
                          onChanged={fetchSuppliers}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{de.suppliers.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">{de.suppliers.name}</Label>
              <Input
                id="supplier-name"
                value={createForm.nameNormalized}
                onChange={(event) => setCreateForm((current) => ({ ...current, nameNormalized: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier-vat">{de.detail.vatNumber}</Label>
                <Input
                  id="supplier-vat"
                  value={createForm.vatNumber}
                  onChange={(event) => setCreateForm((current) => ({ ...current, vatNumber: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-iban">{de.detail.iban}</Label>
                <Input
                  id="supplier-iban"
                  value={createForm.iban}
                  onChange={(event) => setCreateForm((current) => ({ ...current, iban: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-category">{de.suppliers.defaultCategory}</Label>
                <Input
                  id="supplier-category"
                  value={createForm.defaultCategory}
                  onChange={(event) => setCreateForm((current) => ({ ...current, defaultCategory: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-account">{de.suppliers.defaultAccount}</Label>
                <Input
                  id="supplier-account"
                  value={createForm.defaultAccountCode}
                  onChange={(event) => setCreateForm((current) => ({ ...current, defaultAccountCode: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-term">{de.suppliers.paymentTermDays}</Label>
              <Input
                id="supplier-payment-term"
                inputMode="numeric"
                value={createForm.paymentTermDays}
                onChange={(event) => setCreateForm((current) => ({ ...current, paymentTermDays: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {de.common.cancel}
            </Button>
            <Button onClick={handleCreateSupplier} disabled={creating}>
              {creating ? de.suppliers.creating : de.suppliers.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
