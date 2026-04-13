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
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className || ""}`}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-slate-400" />
        </div>
      )}
      <h3 className="text-base font-medium text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-5 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300" 
          onClick={action.onClick}
        >
          {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
