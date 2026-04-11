import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const messages = await prisma.task.findMany({
    where: { companyId: ctx.companyId, messageBody: { not: null } },
    include: { assignee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages);
}

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  missing_document: {
    subject: "Fehlender Beleg",
    body: "Guten Tag, für den Monat {monat} fehlt uns noch die Rechnung von {lieferant}. Könnten Sie diese bitte hochladen?",
  },
  unclear_receipt: {
    subject: "Unklarer Beleg",
    body: "Guten Tag, der Beleg {belegnr} von {lieferant} ist unklar. Bitte prüfen Sie: {grund}",
  },
  missing_contract: {
    subject: "Fehlender Vertrag",
    body: "Guten Tag, uns fehlt der Vertrag zu {lieferant}. Bitte laden Sie diesen hoch.",
  },
  check_private_use: {
    subject: "Privatanteil prüfen",
    body: "Guten Tag, bitte bestätigen Sie den Privatanteil für {beschreibung}.",
  },
  confirmation_needed: {
    subject: "Bestätigung nötig",
    body: "Guten Tag, bitte bestätigen Sie die Buchung {beschreibung} über {betrag}.",
  },
  custom: {
    subject: "",
    body: "",
  },
};

export async function POST(request: NextRequest) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    if (!hasPermission(ctx.session.user.role, "documents:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { templateType, recipientEmail, subject, body: messageBody, relatedDocumentId, relatedContractId } = body;

    if (!templateType || !messageBody) {
      return NextResponse.json({ error: "Template-Typ und Nachricht sind erforderlich" }, { status: 400 });
    }

    const template = TEMPLATES[templateType];
    if (!template) {
      return NextResponse.json({ error: "Unbekannter Template-Typ" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        companyId: ctx.companyId,
        title: subject || template.subject || "Nachricht",
        description: recipientEmail ? `An: ${recipientEmail}` : null,
        taskType: "message",
        priority: "medium",
        messageBody: messageBody,
        messageSentAt: new Date(),
        relatedDocumentId: relatedDocumentId || null,
        relatedContractId: relatedContractId || null,
        source: "manual",
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
