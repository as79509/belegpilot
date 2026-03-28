"use client";

import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu } from "lucide-react";
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

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-white px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger className="md:hidden mr-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-accent">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60">
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      {/* User info */}
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className={roleBadgeVariant[userRole] || roleBadgeVariant.readonly}
        >
          {de.role[userRole as keyof typeof de.role] || userRole}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent">
            <User className="h-4 w-4" />
            {userName}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">
                {de.auth.signedInAs} {userName}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4 mr-2" />
              {de.auth.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
