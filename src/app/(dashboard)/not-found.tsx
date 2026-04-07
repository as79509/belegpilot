import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold mb-2">Seite nicht gefunden</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Die gewünschte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link href="/dashboard"><Button>Zur Übersicht</Button></Link>
    </div>
  );
}
