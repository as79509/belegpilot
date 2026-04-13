"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu, Bell, Settings, ChevronRight, HelpCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileSidebar } from "./mobile-sidebar";
import { NotificationCenter } from "@/components/shared/notification-center";
import { ExplainButton } from "@/components/shared/explain-button";
import { de } from "@/lib/i18n/de";

interface HeaderProps {
  userName: string;
  userRole: string;
}

const roleBadgeVariant: Record<string, string> = {
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  trustee: "bg-indigo-50 text-indigo-700 border-indigo-200",
  reviewer: "bg-amber-50 text-amber-700 border-amber-200",
  accounting: "bg-emerald-50 text-emerald-700 border-emerald-200",
  readonly: "bg-slate-50 text-slate-600 border-slate-200",
  viewer: "bg-slate-50 text-slate-600 border-slate-200",
};

const routeLabels: Record<string, string> = {
  "/dashboard": de.nav.dashboard,
  "/documents": de.nav.documents,
  "/suppliers": de.nav.suppliers,
  "/exports": de.nav.exports,
  "/rules": de.nav.rules,
  "/settings": de.nav.settings,
  "/audit-log": de.nav.auditLog,
  "/journal": de.journal.title,
  "/bank": de.bank.title,
  "/vat": de.vatReturn.title,
  "/tasks": de.tasksMgmt.title,
  "/periods": de.periods.title,
  "/trustee": de.trustee.overview,
  "/reports": de.reports.title,
};

export function Header({ userName, userRole }: HeaderProps) {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => setReviewCount(d.needs_review || 0))
      .catch(() => {});
  }, [pathname]);

  // Build breadcrumbs
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  if (parts[0]) {
    const base = `/${parts[0]}`;
    crumbs.push({ label: routeLabels[base] || parts[0].charAt(0).toUpperCase() + parts[0].slice(1), href: base });
  }
  if (parts[1] && parts[0] !== "dashboard") {
    // Sub-page (document detail, supplier detail, etc.)
    const subLabel = parts[1].length > 16 ? parts[1].slice(0, 12) + "..." : parts[1];
    crumbs.push({ label: subLabel });
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-[var(--border-default)] bg-white px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger className="md:hidden mr-3 inline-flex items-center justify-center rounded-lg p-2 hover:bg-[var(--surface-secondary)] transition-colors">
          <Menu className="h-5 w-5 text-[var(--text-secondary)]" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          Home
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)]">/</span>
            {crumb.href && i < crumbs.length - 1 ? (
              <Link href={crumb.href} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Explain button */}
        <ExplainButton />

        {/* Help */}
        <Button variant="ghost" size="icon-sm" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <HelpCircle className="h-[18px] w-[18px]" />
        </Button>

        {/* Notification center */}
        <NotificationCenter />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-[var(--surface-secondary)] transition-colors ml-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium text-[var(--text-primary)]">{userName}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {de.role[userRole as keyof typeof de.role] || userRole}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] rotate-90 hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-3 border-b border-[var(--border-default)]">
              <p className="text-sm font-medium text-[var(--text-primary)]">{userName}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">demo@belegpilot.ch</p>
              <Badge 
                variant="outline" 
                className={`text-xs mt-2 border ${roleBadgeVariant[userRole] || "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                {de.role[userRole as keyof typeof de.role] || userRole}
              </Badge>
            </div>
            <div className="py-1">
              <DropdownMenuItem 
                onClick={() => window.location.href = "/settings"}
                className="cursor-pointer px-3 py-2"
              >
                <Settings className="h-4 w-4 mr-2.5 text-[var(--text-muted)]" />
                <span>{de.nav.settings}</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => window.location.href = "/audit-log"}
                className="cursor-pointer px-3 py-2"
              >
                <User className="h-4 w-4 mr-2.5 text-[var(--text-muted)]" />
                <span>Profil</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer px-3 py-2 text-red-600 focus:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2.5" />
              <span>{de.auth.signOut}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
