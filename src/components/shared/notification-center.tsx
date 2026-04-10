"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, FileText, CalendarCheck, AlertTriangle, Receipt, ListTodo, Activity, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { de } from "@/lib/i18n/de";
import { formatRelativeTime } from "@/lib/i18n/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

const typeIcons: Record<string, { icon: typeof FileText; className: string }> = {
  document_uploaded: { icon: FileText, className: "text-green-600" },
  period_closing: { icon: CalendarCheck, className: "text-amber-600" },
  overdue_invoice: { icon: AlertTriangle, className: "text-red-600" },
  vat_reminder: { icon: Receipt, className: "text-amber-600" },
  task_assigned: { icon: ListTodo, className: "text-blue-600" },
  system_alert: { icon: Activity, className: "text-slate-500" },
};

export function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function handleClick(notification: Notification) {
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id ? { ...n, isRead: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-1.5 rounded-md hover:bg-accent transition-colors">
        <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--brand-danger)] text-white text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">{de.notifications.title}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              {de.notifications.markAllRead}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {de.notifications.noNotifications}
            </div>
          ) : (
            notifications.map((n) => {
              const typeConfig = typeIcons[n.type] || typeIcons.system_alert;
              const Icon = typeConfig.icon;
              return (
                <button
                  key={n.id}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex gap-3 ${
                    !n.isRead ? "bg-blue-50/50" : ""
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <div className="shrink-0 mt-0.5">
                    <Icon className={`h-4 w-4 ${typeConfig.className}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</span>
                      {!n.isRead && (
                        <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
