"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime } from "@/lib/i18n/format";

interface RecentDoc {
  id: string;
  status: string;
  supplierNameRaw: string | null;
  supplierNameNormalized: string | null;
  grossAmount: string | null;
  currency: string | null;
  createdAt: string;
}

export function RecentDocuments() {
  const router = useRouter();
  const [docs, setDocs] = useState<RecentDoc[]>([]);

  useEffect(() => {
    fetch("/api/documents?pageSize=10&sortBy=createdAt&sortOrder=desc")
      .then((r) => r.json())
      .then((data) => setDocs(data.documents || []))
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {de.dashboard.recentDocuments}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {de.dashboard.noDocuments}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{de.documents.status}</TableHead>
                <TableHead>{de.documents.supplier}</TableHead>
                <TableHead>{de.documents.amount}</TableHead>
                <TableHead>{de.documents.uploadedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <TableCell>
                    <DocumentStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {doc.supplierNameNormalized ||
                      doc.supplierNameRaw ||
                      de.common.noData}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatCurrency(doc.grossAmount, doc.currency || "CHF")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(doc.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
