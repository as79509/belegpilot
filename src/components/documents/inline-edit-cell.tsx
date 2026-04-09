"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { de } from "@/lib/i18n/de";

export interface InlineEditCellProps {
  value: string | null | undefined;
  onSave: (newValue: string | null) => Promise<void>;
  /**
   * If false, the cell renders as static text and is never editable.
   * Used for read-only roles.
   */
  editable?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

type State = "idle" | "editing" | "saving" | "success" | "error";

export function InlineEditCell({
  value,
  onSave,
  editable = true,
  placeholder,
  className,
  inputClassName,
}: InlineEditCellProps) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState<string>(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (state === "editing" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [state]);

  // Clear success flash after 1.2s
  useEffect(() => {
    if (state === "success" || state === "error") {
      const t = setTimeout(() => setState("idle"), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);

  function startEdit(e: React.MouseEvent) {
    if (!editable) return;
    e.stopPropagation();
    setDraft(value ?? "");
    setState("editing");
  }

  async function commit() {
    const trimmed = draft.trim();
    const original = (value ?? "").trim();
    if (trimmed === original) {
      setState("idle");
      return;
    }
    setState("saving");
    try {
      await onSave(trimmed === "" ? null : trimmed);
      setState("success");
    } catch {
      setState("error");
    }
  }

  function cancel() {
    setDraft(value ?? "");
    setState("idle");
  }

  if (state === "editing") {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={commit}
        className={cn(
          "w-full min-w-[60px] px-1.5 py-0.5 text-xs border border-blue-400 rounded bg-white outline-none ring-1 ring-blue-200",
          inputClassName
        )}
      />
    );
  }

  if (state === "saving") {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {de.inlineEdit.saving}
      </span>
    );
  }

  const displayValue = value && value.trim() !== "" ? value : (placeholder ?? de.inlineEdit.placeholder);
  const isEmpty = !value || value.trim() === "";

  return (
    <span
      onClick={startEdit}
      title={editable ? de.inlineEdit.edit : undefined}
      className={cn(
        "inline-block w-full px-1.5 py-0.5 rounded text-xs transition-colors",
        editable && "cursor-text hover:bg-blue-50",
        isEmpty && "text-muted-foreground",
        state === "success" && "bg-green-100 text-green-800",
        state === "error" && "bg-red-100 text-red-800",
        className
      )}
    >
      {state === "error" ? de.inlineEdit.error : displayValue}
    </span>
  );
}
