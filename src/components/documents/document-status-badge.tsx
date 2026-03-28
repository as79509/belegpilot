import { Badge } from "@/components/ui/badge";
import { de } from "@/lib/i18n/de";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  uploaded: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  extracted: "bg-cyan-100 text-cyan-800",
  validated: "bg-teal-100 text-teal-800",
  needs_review: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  exported: "bg-slate-100 text-slate-800",
  export_failed: "bg-red-100 text-red-800",
  rejected: "bg-rose-100 text-rose-800",
  failed: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

export function DocumentStatusBadge({ status }: { status: string }) {
  const label = de.status[status as keyof typeof de.status] || status;
  const style = statusStyles[status] || statusStyles.archived;

  return (
    <Badge variant="secondary" className={cn("text-xs font-medium", style)}>
      {label}
    </Badge>
  );
}
