import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

// Dashboard Skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="pt-5">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent></Card>
        ))}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2"><CardContent className="pt-5 space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
        <Card><CardContent className="pt-5 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent></Card>
      </div>
    </div>
  );
}

// Tabellen-Seite Skeleton (Documents, Suppliers, Rules, etc.)
export function TablePageSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      {/* Filter bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
      </div>
      {/* Table */}
      <Card>
        <div className="p-4 space-y-2">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => <Skeleton key={i} className="h-4" />)}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid gap-3 py-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, j) => <Skeleton key={j} className="h-5" />)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Detail-Seite Skeleton (Document Detail, Supplier Detail)
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="pt-5 space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardContent className="pt-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-full" />)}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

// Wizard Skeleton
export function WizardSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-8 w-24 rounded" />)}
      </div>
      <Card><CardContent className="pt-5 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent></Card>
      <div className="flex justify-between">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
