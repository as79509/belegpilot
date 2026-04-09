"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  icon: Icon,
  iconColor = "text-blue-600",
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
              {title}
            </CardTitle>
            {action}
          </div>
        </CardHeader>
      )}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}
