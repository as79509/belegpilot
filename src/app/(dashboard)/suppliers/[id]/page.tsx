import { Card, CardContent } from "@/components/ui/card";
import { de } from "@/lib/i18n/de";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {de.suppliers.title}
      </h1>
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Lieferantendetails kommen in Phase 4. (ID: {id})
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
