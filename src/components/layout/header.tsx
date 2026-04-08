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
import { LogOut, User, Menu, Bell, Settings, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileSidebar } from "./mobile-sidebar";
import { de } from "@/lib/i18n/de";

interface HeaderProps {
  userName: string;
  userRole: string;
}

const roleBadgeVariant: Record<string, string> = {
  admin: "bg-blue-100 text-blue-800",
  reviewer: "bg-amber-100 text-amber-800",
  accounting: "bg-green-100 text-green-800",
  readonly: "bg-gray-100 text-gray-800",
};

const routeLabels: Record<string, string> = {
  "/dashboard": de.nav.dashboard,
  "/documents": de.nav.documents,
  "/suppliers": de.nav.suppliers,
  "/exports": de.nav.exports,
  "/rules": de.nav.rules,
  "/settings": de.nav.settings,
  "/audit-log": de.nav.auditLog,
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
    crumbs.push({ label: routeLabels[base] || parts[0], href: base });
  }
  if (parts[1] && parts[0] !== "dashboard") {
    // Sub-page (document detail, supplier detail, etc.)
    crumbs.push({ label: parts[1].length > 12 ? parts[1].slice(0, 8) + "..." : parts[1] });
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-[var(--surface-primary)] px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger className="md:hidden mr-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-accent">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60">
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />}
            {crumb.href ? (
              <Link href={crumb.href} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Notification bell */}
      <Link href="/documents?status=needs_review" className="relative mr-3 p-1.5 rounded-md hover:bg-accent transition-colors">
        <Bell className="h-4 w-4 text-[var(--text-secondary)]" />
        {reviewCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--brand-danger)] text-white text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
            {reviewCount}
          </span>
        )}
      </Link>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
          <div className="h-7 w-7 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline">{userName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{userName}</p>
            <Badge variant="secondary" className={`text-xs mt-1 ${roleBadgeVariant[userRole] || ""}`}>
              {de.role[userRole as keyof typeof de.role] || userRole}
            </Badge>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.href = "/settings"}>
            <Settings className="h-4 w-4 mr-2" />{de.nav.settings}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4 mr-2" />{de.auth.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
