"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  onClear?: () => void;
  rightExtra?: React.ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Suchen...",
  filters = [],
  onClear,
  rightExtra,
}: FilterBarProps) {
  const hasActiveFilters =
    (searchValue && searchValue.length > 0) ||
    filters.some((f) => f.value && f.value.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange && (
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 h-9 text-sm"
          />
        </div>
      )}
      {filters.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="h-9 border rounded-md px-2 text-sm bg-white"
          aria-label={f.label}
        >
          <option value="">{f.label}</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {hasActiveFilters && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
          <X className="h-3 w-3 mr-1" />
          Filter zurücksetzen
        </Button>
      )}
      {rightExtra && <div className="ml-auto">{rightExtra}</div>}
    </div>
  );
}
