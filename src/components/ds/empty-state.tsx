"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className || ""}`}
    >
      {Icon && <Icon className="h-10 w-10 text-[var(--text-muted)] opacity-50 mb-3" />}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
