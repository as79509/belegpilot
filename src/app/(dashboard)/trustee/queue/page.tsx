"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { CheckCircle2 } from "lucide-react";
import { de } from "@/lib/i18n/de";
import { formatCurrency, formatRelativeTime, formatConfidence, getConfidenceColor } from "@/lib/i18n/format";
import { useCompany } from "@/lib/contexts/company-context";

const COMPANY_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-800",
  "bg-teal-100 text-teal-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
];

export default function TrusteeQueuePage() {
  const router = useRouter();
  const { switchCompany } = useCompany();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trustee/queue")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64" />
    </div>
  );

  const documents = data?.documents || [];
  const companyCounts = data?.companyCounts || {};
  const companyNames = Object.keys(companyCounts);

  function getCompanyColor(name: string) {
    const idx = companyNames.indexOf(name) % COMPANY_COLORS.length;
    return COMPANY_COLORS[idx];
  }

  function handleRowClick(doc: any) {
    // Switch to the document's company and navigate
    switchCompany(doc.companyId);
    setTimeout(() => router.push(`/documents/${doc.id}`), 100);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Treuhänder", href: "/trustee" }, { label: de.trustee.queue }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{de.trustee.queue}</h1>
        <Badge variant="secondary">{data?.total || 0} {de.trustee.documentsAcrossClients}</Badge>
      </div>

      {/* Company breakdown */}
      {companyNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {companyNames.map((name) => (
            <Badge key={name} variant="secondary" className={getCompanyColor(name)}>
              {name}: {companyCounts[name]}
            </Badge>
          ))}
        </div>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium">{de.trustee.allReviewed}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Belegnr.</TableHead>
                  <TableHead>{de.documents.supplier}</TableHead>
                  <TableHead>{de.documents.amount}</TableHead>
                  <TableHead>{de.documents.confidence}</TableHead>
                  <TableHead>{de.documents.uploadedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(doc)}>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${getCompanyColor(doc.company?.name || "")}`}>
                        {doc.company?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{doc.documentNumber || "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[150px]">{doc.supplierNameNormalized || doc.supplierNameRaw || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatCurrency(doc.grossAmount, doc.currency || "CHF")}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${getConfidenceColor(doc.confidenceScore)}`}>{formatConfidence(doc.confidenceScore)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelativeTime(doc.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
