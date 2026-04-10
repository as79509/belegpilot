import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { markAllAsRead } from "@/lib/services/notifications/notification-service";

export async function POST(_request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  await markAllAsRead(ctx.companyId, ctx.session.user.id);

  return NextResponse.json({ success: true });
}
