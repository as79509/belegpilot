import { NextRequest, NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { logAudit } from "@/lib/services/audit/audit-service";
import { hasPermission } from "@/lib/permissions";

const ALLOWED_TYPES = [
  "suggestion_good",
  "suggestion_wrong",
  "rule_missing",
  "knowledge_missing",
  "special_case",
] as const;

type FeedbackType = (typeof ALLOWED_TYPES)[number];

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "telemetry:feedback")) {
    return NextResponse.json(
      { error: "Keine Berechtigung für Telemetrie-Feedback" },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const type = body?.type as FeedbackType | undefined;
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Ungültiger Feedback-Typ (erlaubt: ${ALLOWED_TYPES.join(", ")})` },
      { status: 400 }
    );
  }

  const documentId = typeof body?.documentId === "string" ? body.documentId : undefined;
  const note = typeof body?.note === "string" ? body.note : undefined;

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "telemetry_feedback",
    entityType: documentId ? "document" : "telemetry",
    entityId: documentId || ctx.companyId,
    changes: {
      type: { before: null, after: type },
      ...(note ? { note: { before: null, after: note } } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
