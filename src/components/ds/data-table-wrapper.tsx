"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
}

export interface DataTableWrapperProps<T> {
  columns: DataTableColumn[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  children: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function DataTableWrapper<T>({
  columns,
  data,
  loading = false,
  emptyMessage = "Keine Einträge gefunden",
  emptyIcon,
  page,
  totalPages,
  onPageChange,
  sortBy,
  sortDir,
  onSort,
  children,
  className,
}: DataTableWrapperProps<T>) {
  const showPagination =
    typeof page === "number" && typeof totalPages === "number" && totalPages > 1;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const isSorted = sortBy === col.key;
              const clickable = col.sortable && onSort;
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.className,
                    clickable && "cursor-pointer select-none hover:text-foreground"
                  )}
                  onClick={clickable ? () => onSort!(col.key) : undefined}
                  aria-sort={
                    isSorted
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {isSorted &&
                      (sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, rowIdx) => (
              <TableRow key={`skeleton-${rowIdx}`}>
                {columns.map((col, colIdx) => (
                  <TableCell key={`${rowIdx}-${colIdx}`} className={col.className}>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState icon={emptyIcon} title={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, i) => children(item, i))
          )}
        </TableBody>
      </Table>

      {showPagination && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            Seite {page} von {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.((page ?? 1) - 1)}
            disabled={(page ?? 1) <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Zurück
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.((page ?? 1) + 1)}
            disabled={(page ?? 1) >= (totalPages ?? 1)}
          >
            Weiter
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
