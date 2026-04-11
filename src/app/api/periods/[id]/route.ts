import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/services/audit/audit-service";
import { createNotification, NotificationTemplates } from "@/lib/services/notifications/notification-service";
import { generateQualityReport } from "@/lib/services/quality/period-quality";

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["incomplete", "review_ready"],
  incomplete: ["open", "review_ready"],
  review_ready: ["closing", "incomplete"],
  closing: ["closed", "review_ready"],
  closed: ["locked"],
  locked: ["closed"],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "periods:lock")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const { id } = await params;

    const period = await prisma.monthlyPeriod.findFirst({
      where: { id, companyId: ctx.companyId },
    });
    if (!period) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};

    // Handle status transition
    if (body.status && body.status !== period.status) {
      const currentStatus = period.status;
      const newStatus = body.status;

      // Check if transition is valid
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Ungültiger Status-Übergang: ${currentStatus} → ${newStatus}` },
          { status: 400 }
        );
      }

      // locked/closed transitions require admin/trustee
      if (currentStatus === "locked" || newStatus === "locked" || newStatus === "closed") {
        if (!["admin", "trustee"].includes(ctx.session.user.role)) {
          return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
        }
      }

      data.status = newStatus;

      // Quality gate: check before closing/locking
      if (newStatus === "closed" || newStatus === "locked") {
        const forceClose = body.forceClose === true;
        try {
          const qualityReport = await generateQualityReport(ctx.companyId, period.year, period.month);
          if (qualityReport.errorCount > 0 && !forceClose) {
            return NextResponse.json({
              error: `Periode kann nicht geschlossen werden: ${qualityReport.errorCount} kritische Probleme`,
              qualityReport,
            }, { status: 422 });
          }
          // Attach warnings to response metadata
          if (qualityReport.warningCount > 0) {
            data.notes = (period.notes || "") +
              (period.notes ? "\n" : "") +
              `[Auto] Geschlossen mit ${qualityReport.warningCount} Warnung(en), Score: ${qualityReport.score}/100`;
          }
        } catch {
          // Quality check failed — allow close but log
        }

        data.closedAt = new Date();
        data.closedBy = ctx.session.user.id;
      }

      // Audit log for status change
      const action = newStatus === "locked"
        ? "period_locked"
        : currentStatus === "locked"
          ? "period_unlocked"
          : "period_status_changed";

      await logAudit({
        companyId: ctx.companyId,
        userId: ctx.session.user.id,
        action,
        entityType: "monthly_period",
        entityId: id,
        changes: { status: { before: currentStatus, after: newStatus } },
      });
    }

    // Allow updating other fields
    const otherFields = ["documentsExpected", "recurringGenerated", "depreciationGenerated", "vatChecked", "exportCompleted", "notes"];
    for (const f of otherFields) {
      if (body[f] !== undefined) data[f] = body[f];
    }

    const updated = await prisma.monthlyPeriod.update({ where: { id }, data });

    // Notification on period close/lock
    if (data.status === "closed" || data.status === "locked") {
      const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
      const tmpl = NotificationTemplates.periodClosingReminder(months[period.month - 1], period.year);
      await createNotification({
        companyId: ctx.companyId,
        type: tmpl.type,
        title: tmpl.title,
        body: tmpl.body,
        severity: tmpl.severity,
        link: "/periods",
        metadata: { periodId: id, month: period.month, year: period.year },
      }).catch(() => {}); // Non-blocking
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
