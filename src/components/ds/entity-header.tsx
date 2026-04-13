"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

export interface EntityHeaderAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
}

export interface EntityHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  primaryAction?: EntityHeaderAction;
  secondaryActions?: EntityHeaderAction[];
}

export function EntityHeader({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryActions,
}: EntityHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {(primaryAction || secondaryActions?.length) && (
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions?.map((action, i) => {
            const Icon = action.icon;
            return (
              <Button
                key={i}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              >
                {Icon && <Icon className="h-4 w-4 mr-1.5" />}
                {action.label}
              </Button>
            );
          })}
          {primaryAction && (
            <Button
              variant={primaryAction.variant || "default"}
              size="sm"
              onClick={primaryAction.onClick}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-1.5" />}
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
