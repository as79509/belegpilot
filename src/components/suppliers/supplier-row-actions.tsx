"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, ExternalLink, CheckCircle2, Sparkles, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { de } from "@/lib/i18n/de";

export interface SupplierRowActionsItem {
  id: string;
  nameNormalized?: string | null;
  isVerified?: boolean | null;
}

interface Props {
  supplier: SupplierRowActionsItem;
  canMutate: boolean;
  onChanged?: () => void;
}

export function SupplierRowActions({ supplier, canMutate, onChanged }: Props) {
  const router = useRouter();

  async function verify() {
    const res = await fetch(`/api/suppliers/${supplier.id}/verify`, { method: "POST" });
    if (res.ok) {
      toast.success(de.quickActions.verify + " ✓");
      onChanged?.();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.inlineEdit.error);
    }
  }

  function openSupplier() {
    router.push(`/suppliers/${supplier.id}`);
  }

  function suggestDefaults() {
    router.push(`/suppliers/${supplier.id}#patterns`);
  }

  function showSupplierDocs() {
    const name = supplier.nameNormalized || "";
    router.push(`/documents?supplier=${encodeURIComponent(name)}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={de.quickActions.title}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={openSupplier}>
          <ExternalLink className="h-3.5 w-3.5" />
          {de.quickActions.open}
        </DropdownMenuItem>
        {canMutate && !supplier.isVerified && (
          <DropdownMenuItem onClick={verify}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {de.quickActions.verify}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={suggestDefaults}>
          <Sparkles className="h-3.5 w-3.5" />
          {de.quickActions.suggestDefaults}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={showSupplierDocs}>
          <FileText className="h-3.5 w-3.5" />
          {de.quickActions.supplierDocs}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
