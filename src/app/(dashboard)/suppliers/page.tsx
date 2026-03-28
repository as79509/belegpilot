import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No suppliers yet. Suppliers are auto-created when documents are
            processed. Coming in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
