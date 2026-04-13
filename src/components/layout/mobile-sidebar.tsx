"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Building2, Download, Workflow, Mail, Home,
  Settings, ScrollText, ChevronDown, Users, ClipboardCheck, BookOpen,
  Repeat, Landmark, Brain, FileSignature, CalendarCheck, ListTodo, BarChart3,
  Zap, Activity, ClipboardList, Wallet, Receipt, FileBarChart, Plug, ArrowLeftRight, Wand2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";
import { useCompany } from "@/lib/contexts/company-context";

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: any }[];
  defaultOpen?: boolean;
}

const belegeGroup: NavGroup = {
  label: "Belege",
  defaultOpen: true,
  items: [
    { href: "/documents", label: de.nav.documents, icon: FileText },
    { href: "/email", label: de.emailImport.title, icon: Mail },
    { href: "/suppliers", label: de.nav.suppliers, icon: Building2 },
  ],
};

const buchhaltungGroup: NavGroup = {
  label: "Buchhaltung",
  defaultOpen: true,
  items: [
    { href: "/journal", label: de.journal.title, icon: BookOpen },
    { href: "/bank", label: de.bank.title, icon: Wallet },
    { href: "/vat", label: de.vatReturn.title, icon: Receipt },
    { href: "/exports", label: de.nav.exports, icon: Download },
  ],
};

const kontrolleGroup: NavGroup = {
  label: "Kontrolle",
  items: [
    { href: "/periods", label: de.periods.title, icon: CalendarCheck },
    { href: "/tasks", label: de.tasksMgmt.title, icon: ListTodo },
    { href: "/reports", label: de.reports.title, icon: BarChart3 },
  ],
};

const systemGroup: NavGroup = {
  label: "System",
  items: [
    { href: "/rules", label: de.nav.rules, icon: Workflow },
    { href: "/settings", label: de.nav.settings, icon: Settings },
  ],
};

export function MobileSidebar() {
  const pathname = usePathname();
  const { activeCompany } = useCompany();
  const navGroups = [belegeGroup, buchhaltungGroup, kontrolleGroup, systemGroup];
  
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navGroups.filter((g) => g.defaultOpen).map((g) => g.label))
  );

  function toggleGroup(label: string) {
    setOpenGroups((prev) => { 
      const n = new Set(prev); 
      if (n.has(label)) n.delete(label); 
      else n.add(label); 
      return n; 
    });
  }

  function isActive(href: string) {
    const clean = href.split("?")[0];
    return pathname === clean || (clean !== "/dashboard" && pathname.startsWith(clean));
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo & Company */}
      <div className="flex items-center h-14 px-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-white text-sm font-bold">BP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {activeCompany?.company?.name || "BelegPilot"}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-[var(--border-subtle)]">
        <button 
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-lg"
        >
          <Search className="h-4 w-4" />
          <span>Suche</span>
        </button>
      </div>

      {/* Dashboard */}
      <div className="px-3 pt-4 pb-1">
        <Link 
          href="/dashboard" 
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/dashboard" 
              ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]" 
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
          )}
        >
          <LayoutDashboard className="h-[18px] w-[18px]" />
          {de.nav.dashboard}
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {navGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          return (
            <div key={group.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-3 pt-4 pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider"
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
              </button>
              <div className={cn("overflow-hidden transition-all duration-200", isOpen ? "max-h-[500px]" : "max-h-0")}>
                {group.items.map((item) => { 
                  const Icon = item.icon; 
                  const active = isActive(item.href);
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href} 
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active 
                          ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]" 
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
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
    </div>
  );
}
