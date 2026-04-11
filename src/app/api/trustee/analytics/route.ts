import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { computeCrossClientAnalytics } from "@/lib/services/analytics/cross-client-analytics";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(session.user.role, "system:health")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const summary = await computeCrossClientAnalytics(session.user.id);
  return NextResponse.json(summary);
}
