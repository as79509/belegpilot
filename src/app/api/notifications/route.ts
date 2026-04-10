import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { getUnreadCount } from "@/lib/services/notifications/notification-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { companyId, session } = ctx;
  const userId = session.user.id;

  const { searchParams } = request.nextUrl;
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const type = searchParams.get("type");
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

  const where: Record<string, any> = {
    companyId,
    OR: [
      { userId },
      { userId: null },
    ],
  };

  if (unreadOnly) where.isRead = false;
  if (type) where.type = type;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    getUnreadCount(companyId, userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
