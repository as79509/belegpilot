import { Card, CardContent } from "@/components/ui/card";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Supplier Detail
        </h1>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Supplier detail page coming in Phase 4. (ID: {id})
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
