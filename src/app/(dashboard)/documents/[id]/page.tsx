import { Card, CardContent } from "@/components/ui/card";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Document Detail
        </h1>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Document review interface coming in Phase 3. (ID: {id})
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
