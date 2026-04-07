"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { de } from "@/lib/i18n/de";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, ScrollText } from "lucide-react";

export default function AuditLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (actionFilter) params.set("action", actionFilter);
    if (userFilter) params.set("userId", userFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotalPages(data.pagination.totalPages);
      if (data.users) setUsers(data.users);
    }
    setLoading(false);
  }, [page, actionFilter, userFilter, dateFrom, dateTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  function clearFilters() {
    setActionFilter(""); setUserFilter(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  const hasFilters = actionFilter || userFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{de.auditLog.title}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Von</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Bis</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-36" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{de.auditLog.user}</label>
          <select value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }} className="border rounded-md px-3 py-1.5 text-sm bg-white w-36">
            <option value="">Alle</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{de.auditLog.action}</label>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="border rounded-md px-3 py-1.5 text-sm bg-white w-48">
            <option value="">Alle Aktionen</option>
            {Object.entries(de.auditLog.actions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" />{de.filters.clearAll}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <Table><TableHeader><TableRow>
              <TableHead>{de.auditLog.timestamp}</TableHead><TableHead>Belegnr.</TableHead>
              <TableHead>{de.auditLog.user}</TableHead><TableHead>{de.auditLog.action}</TableHead>
              <TableHead>{de.auditLog.details}</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{de.auditLog.noEntries}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.auditLog.timestamp}</TableHead>
                  <TableHead>Belegnr.</TableHead>
                  <TableHead>{de.auditLog.user}</TableHead>
                  <TableHead>{de.auditLog.action}</TableHead>
                  <TableHead>{de.auditLog.details}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatTimestamp(entry.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {entry.documentNumber ? (
                        <button className="text-blue-600 hover:underline" onClick={() => router.push(`/documents/${entry.entityId}`)}>
                          {entry.documentNumber}
                        </button>
                      ) : de.common.noData}
                    </TableCell>
                    <TableCell className="text-xs">{entry.user?.name || "System"}</TableCell>
                    <TableCell className="text-xs">{de.auditLog.actions[entry.action] || entry.action}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {entry.changes ? `${Object.keys(entry.changes).length} Felder` : ""}
                    </TableCell>
                    <TableCell>
                      {entry.changes && (
                        <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                          {expandedId === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Expanded details rendered after each expanded row */}
                {entries.filter((e) => expandedId === e.id && e.changes).map((entry) => (
                  <TableRow key={`${entry.id}-detail`}>
                    <TableCell colSpan={6} className="bg-muted/30">
                      <div className="p-2 space-y-1">
                        {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                          <div key={field} className="flex gap-4 text-xs">
                            <span className="font-medium w-40">{field}</span>
                            <span className="text-red-600">{de.auditLog.before}: {JSON.stringify(change.before)}</span>
                            <span className="text-green-600">{de.auditLog.after}: {JSON.stringify(change.after)}</span>
                          </div>
                        ))}
                      </div>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{de.documents.page} {page} {de.documents.of} {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
