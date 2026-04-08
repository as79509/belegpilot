"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Upload, Building2, Download, Workflow,
  Settings, ScrollText, ChevronDown, Link2, Users, ClipboardCheck, BookOpen, Repeat, Landmark, Brain, FileSignature, CalendarCheck, ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";
import { useCompany } from "@/lib/contexts/company-context";

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: any }[];
  defaultOpen?: boolean;
}

const trusteeGroup: NavGroup = {
  label: de.trustee.group,
  defaultOpen: true,
  items: [
    { href: "/trustee", label: de.trustee.overview, icon: Users },
    { href: "/trustee/queue", label: de.trustee.queue, icon: ClipboardCheck },
    { href: "/trustee/clients", label: de.clients.title, icon: Building2 },
  ],
};

const baseNavGroups: NavGroup[] = [
  {
    label: de.nav.documentsGroup,
    defaultOpen: true,
    items: [
      { href: "/documents", label: de.nav.documents, icon: FileText },
      { href: "/documents?upload=true", label: de.nav.upload, icon: Upload },
    ],
  },
  {
    label: de.nav.accountingGroup,
    defaultOpen: true,
    items: [
      { href: "/journal", label: de.journal.title, icon: BookOpen },
      { href: "/journal/recurring", label: de.recurring.title, icon: Repeat },
      { href: "/assets", label: de.assets.title, icon: Landmark },
      { href: "/contracts", label: de.contracts.title, icon: FileSignature },
      { href: "/exports", label: de.nav.exports, icon: Download },
      { href: "/rules", label: de.nav.rules, icon: Workflow },
      { href: "/settings?tab=integrations", label: de.nav.bexio, icon: Link2 },
    ],
  },
  {
    label: "Kontrolle",
    items: [
      { href: "/periods", label: de.periods.title, icon: CalendarCheck },
      { href: "/tasks", label: de.tasksMgmt.title, icon: ListTodo },
    ],
  },
  {
    label: de.nav.masterData,
    items: [
      { href: "/suppliers", label: de.nav.suppliers, icon: Building2 },
    ],
  },
  {
    label: de.nav.system,
    items: [
      { href: "/settings", label: de.nav.settings, icon: Settings },
      { href: "/settings/ai", label: "KI-Einstellungen", icon: Brain },
      { href: "/audit-log", label: de.nav.auditLog, icon: ScrollText },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { companies, activeCompany, switchCompany, isMultiCompany } = useCompany();
  const navGroups = isMultiCompany ? [trusteeGroup, ...baseNavGroups] : baseNavGroups;
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navGroups.filter((g) => g.defaultOpen).map((g) => g.label))
  );

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isActive(href: string) {
    const cleanHref = href.split("?")[0];
    return pathname === cleanHref || (cleanHref !== "/dashboard" && pathname.startsWith(cleanHref));
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-50">
      <div className="flex flex-col flex-grow bg-[var(--brand-primary)] text-white overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-white/10">
          <span className="text-lg font-semibold tracking-tight">BelegPilot</span>
        </div>

        {/* Company switcher */}
        {isMultiCompany && (
          <div className="px-3 py-2 border-b border-white/10">
            <select
              value={activeCompany?.companyId || ""}
              onChange={(e) => switchCompany(e.target.value)}
              className="w-full bg-white/10 text-white text-xs rounded px-2 py-1.5 border border-white/20"
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId} className="text-black">
                  {c.company.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dashboard (standalone) */}
        <div className="px-2 pt-3 pb-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard" ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {de.nav.dashboard}
          </Link>
        </div>

        {/* Grouped navigation */}
        <nav className="flex-1 px-2 py-1 space-y-1">
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
                >
                  {group.label}
                  <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
                </button>
                <div className={cn("overflow-hidden transition-all duration-200", isOpen ? "max-h-96" : "max-h-0")}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ml-1",
                          active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-xs text-white/40">BelegPilot v1.0</p>
        </div>
      </div>
    </aside>
  );
}
