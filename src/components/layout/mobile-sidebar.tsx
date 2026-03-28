"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Building2,
  Download,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";

const navItems = [
  { href: "/dashboard", label: de.nav.dashboard, icon: LayoutDashboard },
  { href: "/documents", label: de.nav.documents, icon: FileText },
  { href: "/suppliers", label: de.nav.suppliers, icon: Building2 },
  { href: "/exports", label: de.nav.exports, icon: Download },
  { href: "/settings", label: de.nav.settings, icon: Settings },
  { href: "/audit-log", label: de.nav.auditLog, icon: ScrollText },
];

export function MobileSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-[#1B2A4A] text-white">
      <div className="flex items-center h-14 px-4 border-b border-white/10">
        <span className="text-lg font-semibold tracking-tight">BelegPilot</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
