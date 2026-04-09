"use client";

import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionBarAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "destructive";
}

export interface ActionBarProps {
  selectedCount: number;
  actions: ActionBarAction[];
  onClearSelection: () => void;
  className?: string;
}

export function ActionBar({
  selectedCount,
  actions,
  onClearSelection,
  className,
}: ActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 shadow-sm",
        className
      )}
    >
      <span className="text-sm font-medium text-blue-900">
        {selectedCount} ausgewählt
      </span>

      <div className="flex items-center gap-1.5 ml-auto">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <Button
              key={`${action.label}-${i}`}
              type="button"
              size="sm"
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              onClick={action.onClick}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="text-blue-700"
        >
          <X className="h-3.5 w-3.5" />
          Auswahl aufheben
        </Button>
      </div>
    </div>
  );
}
