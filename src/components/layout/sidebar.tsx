"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Building2, Download, Workflow, Mail, Home,
  Settings, ScrollText, ChevronDown, Users, ClipboardCheck, BookOpen,
  Repeat, Landmark, Brain, FileSignature, CalendarCheck, ListTodo, BarChart3,
  Zap, Activity, ClipboardList, Wallet, Receipt, FileBarChart, Plug, ArrowLeftRight, Wand2,
  Search, Command, Inbox,
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
  label: "Treuhänder",
  defaultOpen: true,
  items: [
    { href: "/trustee", label: de.trustee.overview, icon: Users },
    { href: "/trustee/queue", label: de.trustee.queue, icon: ClipboardCheck },
    { href: "/trustee/clients", label: de.clients.title, icon: Building2 },
    { href: "/trustee/onboarding/analysis", label: de.onboardingAnalysis.title, icon: Brain },
    { href: "/onboarding/wizard", label: de.onboardingWizard.title, icon: Wand2 },
  ],
};

const belegeGroup: NavGroup = {
  label: "Belege",
  defaultOpen: true,
  items: [
    { href: "/documents", label: de.nav.documents, icon: FileText },
    { href: "/email", label: de.emailImport.title, icon: Mail },
    { href: "/expected-documents", label: de.expectedDocs.title, icon: ClipboardCheck },
    { href: "/suppliers", label: de.nav.suppliers, icon: Building2 },
  ],
};

const buchhaltungGroup: NavGroup = {
  label: "Buchhaltung",
  defaultOpen: true,
  items: [
    { href: "/journal", label: de.journal.title, icon: BookOpen },
    { href: "/accounts", label: de.accounts.title, icon: ClipboardList },
    { href: "/bank", label: de.bank.title, icon: Wallet },
    { href: "/vat", label: de.vatReturn.title, icon: Receipt },
    { href: "/assets", label: de.assets.title, icon: Landmark },
    { href: "/journal/recurring", label: de.recurring.title, icon: Repeat },
    { href: "/exports", label: de.nav.exports, icon: Download },
  ],
};

const kontrolleGroup: NavGroup = {
  label: "Kontrolle",
  items: [
    { href: "/periods", label: de.periods.title, icon: CalendarCheck },
    { href: "/tasks", label: de.tasksMgmt.title, icon: ListTodo },
    { href: "/reports", label: de.reports.title, icon: BarChart3 },
    { href: "/reports/monthly-summary", label: de.monthlySummary.title, icon: FileBarChart },
    { href: "/contracts", label: de.contracts.title, icon: FileSignature },
  ],
};

const systemGroup: NavGroup = {
  label: "System",
  items: [
    { href: "/rules", label: de.nav.rules, icon: Workflow },
    { href: "/settings/autopilot", label: de.autopilot.title, icon: Zap },
    { href: "/settings/control-center", label: de.controlCenter.title, icon: Activity },
    { href: "/integrations", label: de.integrations.title, icon: Plug },
    { href: "/banana", label: de.banana.title, icon: ArrowLeftRight },
    { href: "/settings", label: de.nav.settings, icon: Settings },
    { href: "/audit-log", label: de.nav.auditLog, icon: ScrollText },
  ],
};

const clientGroup: NavGroup = {
  label: de.clientPortal.title,
  defaultOpen: true,
  items: [
    { href: "/client", label: de.clientPortal.title, icon: Home },
    { href: "/documents", label: de.nav.documents, icon: FileText },
    { href: "/tasks", label: de.tasksMgmt.title, icon: ListTodo },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { companies, activeCompany, switchCompany, isMultiCompany } = useCompany();
  const role = activeCompany?.role || "";
  const isViewer = role === "viewer" || role === "readonly";
  const isReviewer = role === "reviewer";
  const isAdminOrTrustee = role === "admin" || role === "trustee";

  const navGroups: NavGroup[] = isViewer
    ? [clientGroup]
    : (() => {
        const groups: NavGroup[] = [];
        if (isMultiCompany && isAdminOrTrustee) groups.push(trusteeGroup);
        groups.push(belegeGroup, buchhaltungGroup, kontrolleGroup);
        if (!isReviewer) groups.push(systemGroup);
        return groups;
      })();
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
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-50 border-r border-[var(--border-default)] bg-white">
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Logo & Company */}
        <div className="flex items-center h-14 px-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
              <span className="text-white text-sm font-bold">BP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {activeCompany?.company?.name || "BelegPilot"}
              </span>
              {activeCompany?.company?.name && (
                <span className="text-xs text-[var(--text-muted)]">belegpilot.ch</span>
              )}
            </div>
          </div>
          {isMultiCompany && (
            <ChevronDown className="h-4 w-4 ml-auto text-[var(--text-muted)]" />
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-3 border-b border-[var(--border-subtle)]">
          <button 
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-lg hover:bg-[var(--surface-tertiary)] transition-colors"
          >
            <Search className="h-4 w-4" />
            <span>Suche</span>
            <kbd className="ml-auto text-xs bg-white px-1.5 py-0.5 rounded border border-[var(--border-default)]">
              <Command className="h-3 w-3 inline" />K
            </kbd>
          </button>
        </div>

        {/* Company switcher (if multi-company) */}
        {isMultiCompany && companies.length > 1 && (
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <select
              value={activeCompany?.companyId || ""}
              onChange={(e) => switchCompany(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 border border-[var(--border-default)] bg-white text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-colors"
            >
              {companies.map((c) => (
                <option key={c.companyId} value={c.companyId}>
                  {c.company.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dashboard (standalone) */}
        <div className="px-3 pt-4 pb-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              pathname === "/dashboard" 
                ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]" 
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <LayoutDashboard className="h-[18px] w-[18px]" />
            {de.nav.dashboard}
          </Link>
        </div>

        {/* Grouped navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            return (
              <div key={group.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-3 pt-4 pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hover:text-[var(--text-secondary)] transition-colors"
                >
                  {group.label}
                  <ChevronDown 
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200", 
                      isOpen ? "" : "-rotate-90"
                    )} 
                  />
                </button>
                <div className={cn(
                  "overflow-hidden transition-all duration-200", 
                  isOpen ? "max-h-[500px]" : "max-h-0"
                )}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          active 
                            ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
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
        <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] rounded-lg transition-colors"
          >
            <Inbox className="h-[18px] w-[18px]" />
            <span>Inbox</span>
            <span className="ml-auto text-xs bg-[var(--brand-accent)] text-white px-2 py-0.5 rounded-full font-medium">4</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
