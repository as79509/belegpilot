import { de } from "@/lib/i18n/de";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentDocuments } from "@/components/dashboard/recent-documents";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {de.dashboard.title}
        </h1>
      </div>

      <StatsCards />
      <RecentDocuments />
    </div>
  );
}
