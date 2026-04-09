"use client";

import { useEffect, useState } from "react";
import { Clock, User } from "lucide-react";
import { formatRelativeTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  user: { name: string } | null;
  changes: Record<string, { before: any; after: any }> | null;
}

export interface AuditPanelProps {
  entityType: string;
  entityId: string;
  maxEntries?: number;
  className?: string;
}

export function AuditPanel({
  entityType,
  entityId,
  maxEntries = 10,
  className,
}: AuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/audit-log/entity?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
    )
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const visible = entries.slice(0, maxEntries);

  if (loading) {
    return (
      <div className={cn("text-xs text-muted-foreground py-3", className)}>
        Verlauf wird geladen…
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground py-3", className)}>
        Noch keine Verlaufseinträge.
      </div>
    );
  }

  return (
    <ol className={cn("space-y-2", className)}>
      {visible.map((entry) => {
        const changedFields = entry.changes ? Object.keys(entry.changes) : [];
        return (
          <li
            key={entry.id}
            className="flex items-start gap-2 text-xs border-l-2 border-border pl-3 py-1"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{entry.action}</span>
                {entry.user?.name && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    {entry.user.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
              {changedFields.length > 0 && (
                <div className="mt-0.5 text-muted-foreground truncate">
                  {changedFields.join(", ")}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
