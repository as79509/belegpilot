"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, ExternalLink, CheckCircle2, XCircle, Sparkles, Building2, FilePlus2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { de } from "@/lib/i18n/de";

export interface DocumentRowActionsDoc {
  id: string;
  supplierId?: string | null;
  supplierNameNormalized?: string | null;
  supplierNameRaw?: string | null;
  bookingSuggestions?: Array<{ status: string }>;
}

interface Props {
  doc: DocumentRowActionsDoc;
  canMutate: boolean;
  onChanged?: () => void;
}

export function DocumentRowActions({ doc, canMutate, onChanged }: Props) {
  const router = useRouter();

  async function approve() {
    if (!confirm(de.quickActions.confirmApprove)) return;
    const res = await fetch(`/api/documents/${doc.id}/approve`, { method: "POST" });
    if (res.ok) {
      toast.success(de.quickActions.approve);
      onChanged?.();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.inlineEdit.error);
    }
  }

  async function reject() {
    const reason = window.prompt(de.quickActions.rejectReasonPrompt);
    if (!reason || !reason.trim()) return;
    const res = await fetch(`/api/documents/${doc.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast.success(de.quickActions.reject);
      onChanged?.();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.inlineEdit.error);
    }
  }

  async function acceptSuggestion() {
    const res = await fetch(`/api/documents/${doc.id}/suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accepted" }),
    });
    if (res.ok) {
      toast.success(de.quickActions.acceptSuggestion);
      onChanged?.();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.inlineEdit.error);
    }
  }

  async function reprocess() {
    const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
    if (res.ok) {
      toast.success(de.quickActions.reprocess);
      onChanged?.();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || de.inlineEdit.error);
    }
  }

  function openSupplier() {
    if (doc.supplierId) {
      router.push(`/suppliers/${doc.supplierId}`);
    } else {
      toast.error(de.quickActions.supplierMissing);
    }
  }

  function createRule() {
    const supplierName = doc.supplierNameNormalized || doc.supplierNameRaw || "";
    const params = new URLSearchParams();
    if (supplierName) params.set("supplier", supplierName);
    params.set("documentId", doc.id);
    router.push(`/rules?${params.toString()}`);
  }

  const hasPendingSuggestion = doc.bookingSuggestions?.some((s) => s.status === "pending");

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
        <DropdownMenuItem onClick={() => router.push(`/documents/${doc.id}`)}>
          <ExternalLink className="h-3.5 w-3.5" />
          {de.quickActions.review}
        </DropdownMenuItem>
        {canMutate && (
          <>
            <DropdownMenuItem onClick={approve}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {de.quickActions.approve}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={reject} variant="destructive">
              <XCircle className="h-3.5 w-3.5" />
              {de.quickActions.reject}
            </DropdownMenuItem>
            {hasPendingSuggestion && (
              <DropdownMenuItem onClick={acceptSuggestion}>
                <Sparkles className="h-3.5 w-3.5" />
                {de.quickActions.acceptSuggestion}
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openSupplier}>
          <Building2 className="h-3.5 w-3.5" />
          {de.quickActions.openSupplier}
        </DropdownMenuItem>
        {canMutate && (
          <>
            <DropdownMenuItem onClick={createRule}>
              <FilePlus2 className="h-3.5 w-3.5" />
              {de.quickActions.createRule}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={reprocess}>
              <RefreshCw className="h-3.5 w-3.5" />
              {de.quickActions.reprocess}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
