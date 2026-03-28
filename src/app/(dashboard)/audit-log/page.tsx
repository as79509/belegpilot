import { Card, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import { de } from "@/lib/i18n/de";

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {de.auditLog.title}
      </h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ScrollText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            {de.auditLog.noEntries}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
