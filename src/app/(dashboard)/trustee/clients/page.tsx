"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Building2 } from "lucide-react";
import { de } from "@/lib/i18n/de";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trustee/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{de.clients.title}</h1>
        <Button onClick={() => router.push("/trustee/onboarding")}>
          <Plus className="h-4 w-4 mr-2" />{de.clients.newClient}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{de.clients.noClients}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>{de.onboarding.legalForm}</TableHead>
                  <TableHead>{de.onboarding.industry}</TableHead>
                  <TableHead>Währung</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/trustee/clients/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs">{de.onboarding.legalForms[c.legalForm] || c.legalForm || "—"}</TableCell>
                    <TableCell className="text-xs">{de.onboarding.industries[c.industry] || c.industry || "—"}</TableCell>
                    <TableCell>{c.currency || "CHF"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100"}>
                        {c.status || "active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
