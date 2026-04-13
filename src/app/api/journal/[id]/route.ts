import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { checkPeriodLock } from "@/lib/services/cockpit/period-guard";
import { computeChanges, logAudit } from "@/lib/services/audit/audit-service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  const entry = await prisma.journalEntry.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getActiveCompany();
    if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    if (!hasPermission(ctx.session.user.role, "journal:write")) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const fields = ["entryDate", "debitAccount", "creditAccount", "amount", "vatAmount", "vatRate", "description", "reference", "entryType"];
    const data: Record<string, any> = {};
    for (const f of fields) { if (body[f] !== undefined) data[f] = f === "entryDate" ? new Date(body[f]) : body[f]; }

    // Validate accounts against chart of accounts
    const existing = await prisma.journalEntry.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const debitAccount = data.debitAccount || existing.debitAccount;
    const creditAccount = data.creditAccount || existing.creditAccount;
    const warnings: string[] = [];

    const accounts = await prisma.account.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      select: { accountNumber: true, aiGovernance: true },
    });

    if (accounts.length > 0) {
      const accountMap = new Map(accounts.map((a) => [a.accountNumber, a.aiGovernance]));
      for (const [label, code] of [["Soll", debitAccount], ["Haben", creditAccount]] as const) {
        if (!code) continue;
        const governance = accountMap.get(code);
        if (governance === undefined) {
          warnings.push(`${label}-Konto ${code} ist nicht im Kontenplan`);
        } else if (governance === "locked") {
          return NextResponse.json({ error: `Konto ${code} ist gesperrt` }, { status: 400 });
        }
      }
    }

    if (existing.entryDate) {
      const lock = await checkPeriodLock(ctx.companyId, new Date(existing.entryDate));
      if (lock.locked) {
        return NextResponse.json({ error: lock.message }, { status: 409 });
      }
    }

    const changes = computeChanges(existing as any, data, fields);

    const updateResult = await prisma.journalEntry.updateMany({
      where: { id, companyId: ctx.companyId },
      data,
    });
    if (updateResult.count === 0) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updated = await prisma.journalEntry.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (changes) {
      await logAudit({
        companyId: ctx.companyId,
        userId: ctx.session.user.id,
        action: "journal_entry_updated",
        entityType: "journal_entry",
        entityId: id,
        changes,
      });
    }

    return NextResponse.json({ entry: updated, warnings });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!hasPermission(ctx.session.user.role, "journal:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.journalEntry.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const lock = await checkPeriodLock(ctx.companyId, new Date(existing.entryDate));
  if (lock.locked) {
    return NextResponse.json({ error: lock.message }, { status: 409 });
  }

  const deleted = await prisma.journalEntry.deleteMany({ where: { id, companyId: ctx.companyId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await logAudit({
    companyId: ctx.companyId,
    userId: ctx.session.user.id,
    action: "journal_entry_deleted",
    entityType: "journal_entry",
    entityId: id,
    changes: {
      deleted: {
        before: existing,
        after: null,
      },
    },
  });

  return NextResponse.json({ success: true });
}
