import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Exports</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Download className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No exports yet. CSV export coming in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
