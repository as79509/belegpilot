import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { createNotification, NotificationTemplates } from "@/lib/services/notifications/notification-service";

export async function GET(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const where: Record<string, any> = { companyId: ctx.companyId };
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const tasks = await prisma.task.findMany({
    where: where as any,
    include: { assignee: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    const body = await request.json();
    const task = await prisma.task.create({
      data: {
        companyId: ctx.companyId, title: body.title, description: body.description || null,
        taskType: body.taskType || "custom", priority: body.priority || "medium",
        relatedDocumentId: body.relatedDocumentId || null, relatedAssetId: body.relatedAssetId || null,
        relatedContractId: body.relatedContractId || null, dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    // Notify assigned user
    if (body.assignedTo) {
      const tmpl = NotificationTemplates.taskAssigned(body.title);
      await createNotification({
        companyId: ctx.companyId,
        userId: body.assignedTo,
        type: tmpl.type,
        title: tmpl.title,
        body: tmpl.body,
        severity: tmpl.severity,
        link: `/tasks`,
        metadata: { taskId: task.id },
      }).catch(() => {}); // Non-blocking
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
