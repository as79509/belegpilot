import { Card, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ScrollText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No audit entries yet. All actions will be logged here. Coming in
            Phase 5.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
