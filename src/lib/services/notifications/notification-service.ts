import { prisma } from "@/lib/db";

// -- Notification CRUD --

export async function createNotification(params: {
  companyId: string;
  userId?: string;
  type: string;
  title: string;
  body: string;
  severity?: "info" | "warning" | "error" | "success";
  link?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      companyId: params.companyId,
      userId: params.userId || null,
      type: params.type,
      title: params.title,
      body: params.body,
      severity: params.severity || "info",
      link: params.link || null,
      metadata: params.metadata as any || null,
      expiresAt: params.expiresAt || null,
    },
  });
}

export async function getUnreadCount(
  companyId: string,
  userId: string
): Promise<number> {
  return prisma.notification.count({
    where: {
      companyId,
      isRead: false,
      OR: [
        { userId },
        { userId: null }, // Company-wide notifications
      ],
    },
  });
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId },
  });

  if (!notification) return;

  // Only mark if the notification belongs to this user or is company-wide
  if (notification.userId && notification.userId !== userId) return;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(
  companyId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      companyId,
      isRead: false,
      OR: [
        { userId },
        { userId: null },
      ],
    },
    data: { isRead: true, readAt: new Date() },
  });
}

// -- Notification Templates --

export const NotificationTemplates = {
  emailDocumentReceived: (count: number, senderEmail: string) => ({
    type: "document_uploaded" as const,
    title: count + " Beleg(e) per E-Mail empfangen",
    body: "Von " + senderEmail + ": " + count + " Anhang/Anhaenge automatisch importiert",
    severity: "success" as const,
  }),

  periodClosingReminder: (month: string, year: number) => ({
    type: "period_closing" as const,
    title: "Periodenabschluss " + month + " " + year,
    body: "Der Abschluss fuer " + month + " " + year + " steht an. Offene Belege pruefen.",
    severity: "warning" as const,
  }),

  overdueInvoice: (supplierName: string, amount: string, daysPastDue: number) => ({
    type: "overdue_invoice" as const,
    title: "Ueberfaellige Rechnung: " + supplierName,
    body: "CHF " + amount + " seit " + daysPastDue + " Tagen ueberfaellig",
    severity: "warning" as const,
  }),

  vatReminder: (quarter: number, year: number) => ({
    type: "vat_reminder" as const,
    title: "MwSt-Abrechnung Q" + quarter + "/" + year,
    body: "Die MwSt-Abrechnung fuer Q" + quarter + "/" + year + " muss erstellt werden",
    severity: "warning" as const,
  }),

  taskAssigned: (taskTitle: string) => ({
    type: "task_assigned" as const,
    title: "Neue Aufgabe zugewiesen",
    body: taskTitle,
    severity: "info" as const,
  }),

  missingDocumentReminder: (docDescription: string, daysPastDue: number) => ({
    type: "document_uploaded" as const,
    title: "Fehlendes Dokument: " + docDescription,
    body: docDescription + " ist seit " + daysPastDue + " Tagen überfällig",
    severity: "warning" as const,
  }),
};

// TODO Phase 9.4.3: Überfällige Rechnungen — Cron-Job oder Inngest-Scheduled-Function
// die täglich prüft ob Dokumente mit dueDate < heute && paymentStatus != "paid"
// existieren und dann overdueInvoice Notifications erstellt.

// TODO Phase 9.4.3: Fehlende Dokumente — Wöchentlicher Cron-Job:
// Prüfe ExpectedDocuments ohne passendes Document und sende
// missingDocumentReminder Notification an viewer-User der Company.
