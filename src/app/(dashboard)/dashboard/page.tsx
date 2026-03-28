import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
} from "lucide-react";

const statCards = [
  {
    label: "Uploaded",
    count: 0,
    icon: Upload,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Processing",
    count: 0,
    icon: Loader2,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    label: "Needs Review",
    count: 0,
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    label: "Ready",
    count: 0,
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "Failed",
    count: 0,
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    label: "Exported",
    count: 0,
    icon: FileCheck,
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div className={`rounded-md p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No documents yet. Upload your first invoice to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
