"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { de } from "@/lib/i18n/de";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, { before: any; after: any }> | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (actionFilter) params.set("action", actionFilter);
    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotalPages(data.pagination.totalPages);
    }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function formatTimestamp(ts: string) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${mins}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {de.auditLog.title}
      </h1>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Alle Aktionen</option>
          {Object.entries(de.auditLog.actions).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">{de.common.loading}</p>
          ) : entries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{de.auditLog.noEntries}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{de.auditLog.timestamp}</TableHead>
                  <TableHead>{de.auditLog.user}</TableHead>
                  <TableHead>{de.auditLog.action}</TableHead>
                  <TableHead>{de.auditLog.entityType}</TableHead>
                  <TableHead>{de.auditLog.details}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <>
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                      <TableCell className="text-xs whitespace-nowrap">{formatTimestamp(entry.createdAt)}</TableCell>
                      <TableCell className="text-xs">{entry.user?.name || de.common.noData}</TableCell>
                      <TableCell className="text-xs">
                        {de.auditLog.actions[entry.action] || entry.action}
                      </TableCell>
                      <TableCell className="text-xs">{entry.entityType}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {entry.changes ? `${Object.keys(entry.changes).length} Felder` : ""}
                      </TableCell>
                      <TableCell>
                        {entry.changes && (
                          expandedId === entry.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === entry.id && entry.changes && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="p-2 space-y-1">
                            {Object.entries(entry.changes).map(([field, change]) => (
                              <div key={field} className="flex gap-4 text-xs">
                                <span className="font-medium w-40">{field}</span>
                                <span className="text-red-600">{de.auditLog.before}: {JSON.stringify(change.before)}</span>
                                <span className="text-green-600">{de.auditLog.after}: {JSON.stringify(change.after)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
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
