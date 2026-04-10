import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseInboundEmail, processEmailAttachments } from "@/lib/services/email/email-parser";
import { createNotification, NotificationTemplates } from "@/lib/services/notifications/notification-service";

const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const authHeader = request.headers.get("authorization") || "";
    const webhookHeader = request.headers.get("x-webhook-secret") || "";

    const token = authHeader.replace("Bearer ", "");
    if (token !== WEBHOOK_SECRET && webhookHeader !== WEBHOOK_SECRET) {
      console.error("[EmailWebhook] Invalid webhook secret");
      // Still return 200 to prevent retries
      return NextResponse.json({ error: "Unauthorized" }, { status: 200 });
    }
  }

  try {
    const payload = await request.json();

    // Parse the email
    const email = parseInboundEmail(payload);

    if (!email.to) {
      console.error("[EmailWebhook] No recipient address found");
      return NextResponse.json({ status: "ok", message: "No recipient" });
    }

    // Extract the inbox address (handle "Name <address>" format)
    const toAddress = email.to.includes("<")
      ? email.to.match(/<([^>]+)>/)?.[1] || email.to
      : email.to;

    // Find the inbox by address
    const inbox = await prisma.emailInbox.findUnique({
      where: { inboxAddress: toAddress.toLowerCase().trim() },
    });

    if (!inbox) {
      console.warn("[EmailWebhook] No inbox found for:", toAddress);
      return NextResponse.json({ status: "ok", message: "Inbox not found" });
    }

    if (!inbox.isActive) {
      console.warn("[EmailWebhook] Inbox is deactivated:", toAddress);
      return NextResponse.json({ status: "ok", message: "Inbox deactivated" });
    }

    // Check allowed senders
    if (inbox.allowedSenders) {
      const allowed = inbox.allowedSenders as string[];
      const senderAddress = email.from.includes("<")
        ? email.from.match(/<([^>]+)>/)?.[1] || email.from
        : email.from;

      if (allowed.length > 0 && !allowed.some(
        (a) => a.toLowerCase() === senderAddress.toLowerCase()
      )) {
        console.warn("[EmailWebhook] Sender not allowed:", senderAddress);
        return NextResponse.json({ status: "ok", message: "Sender not allowed" });
      }
    }

    // Check for attachments
    if (email.attachments.length === 0) {
      console.info("[EmailWebhook] No attachments in email from:", email.from);
      return NextResponse.json({ status: "ok", message: "No attachments", processed: 0 });
    }

    // Process attachments
    const documentIds = await processEmailAttachments(inbox.companyId, email);

    // Update inbox stats
    await prisma.emailInbox.update({
      where: { id: inbox.id },
      data: {
        processedCount: { increment: 1 },
        lastReceivedAt: new Date(),
      },
    });

    // Create notification
    if (documentIds.length > 0) {
      const tmpl = NotificationTemplates.emailDocumentReceived(
        documentIds.length,
        email.from
      );
      await createNotification({
        companyId: inbox.companyId,
        type: tmpl.type,
        title: tmpl.title,
        body: tmpl.body,
        severity: tmpl.severity,
        link: "/documents",
        metadata: {
          documentIds,
          emailFrom: email.from,
          emailSubject: email.subject,
        },
      });
    }

    return NextResponse.json({
      status: "ok",
      processed: documentIds.length,
      documentIds,
    });
  } catch (err: any) {
    console.error("[EmailWebhook] Error:", err);
    // Always return 200 for webhooks to prevent retries
    return NextResponse.json({ status: "error", message: err.message });
  }
}
