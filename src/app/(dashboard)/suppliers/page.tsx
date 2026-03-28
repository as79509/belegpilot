import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { de } from "@/lib/i18n/de";

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {de.suppliers.title}
        </h1>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            {de.suppliers.noSuppliers}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
