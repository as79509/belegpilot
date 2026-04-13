import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";
import { parseCamt053 } from "@/lib/services/bank/camt053-parser";
import { autoMatchTransactions } from "@/lib/services/bank/matching-engine";
import { logAudit } from "@/lib/services/audit/audit-service";

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "bank:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const xml = await file.text();
    const statements = parseCamt053(xml);

    if (statements.length === 0) {
      return NextResponse.json({ error: "Keine Kontoauszüge in der Datei gefunden" }, { status: 400 });
    }

    const results = [];

    for (const stmt of statements) {
      let bankAccount = await prisma.bankAccount.findFirst({
        where: { companyId: ctx.companyId, iban: stmt.iban.replace(/\s/g, "") },
      });

      if (!bankAccount) {
        bankAccount = await prisma.bankAccount.create({
          data: {
            companyId: ctx.companyId,
            iban: stmt.iban.replace(/\s/g, ""),
            name: stmt.bankName || ("Konto " + stmt.iban.slice(-4)),
            bankName: stmt.bankName || null,
            currency: stmt.currency,
          },
        });
      }

      const bankStatement = await prisma.bankStatement.create({
        data: {
          companyId: ctx.companyId,
          bankAccountId: bankAccount.id,
          statementId: stmt.statementId || null,
          sequenceNumber: stmt.sequenceNumber || null,
          fromDate: stmt.fromDate,
          toDate: stmt.toDate,
          openingBalance: stmt.openingBalance,
          closingBalance: stmt.closingBalance,
          transactionCount: stmt.transactions.length,
          fileName: file.name,
        },
      });

      for (const tx of stmt.transactions) {
        await prisma.bankTransaction.create({
          data: {
            companyId: ctx.companyId,
            bankAccountId: bankAccount.id,
            statementId: bankStatement.id,
            bookingDate: tx.bookingDate,
            valueDate: tx.valueDate || null,
            amount: tx.amount,
            currency: tx.currency,
            isCredit: tx.isCredit,
            description: tx.description || null,
            counterpartyName: tx.counterpartyName || null,
            counterpartyIban: tx.counterpartyIban || null,
            endToEndId: tx.endToEndId || null,
            paymentReference: tx.paymentReference || null,
            remittanceInfo: tx.remittanceInfo || null,
            bankReference: tx.bankReference || null,
          },
        });
      }

      results.push({
        statementId: bankStatement.id,
        iban: stmt.iban,
        transactions: stmt.transactions.length,
      });
    }

    // Auto-match
    const matchResult = await autoMatchTransactions(ctx.companyId);

    // Task 4: Auto-task for unmatched transactions (>5)
    if (matchResult.unmatched > 5) {
      const existingTask = await prisma.task.findFirst({
        where: {
          companyId: ctx.companyId,
          taskType: "bank_reconciliation",
          status: { in: ["open", "in_progress"] },
        },
      });
      if (!existingTask) {
        await prisma.task.create({
          data: {
            companyId: ctx.companyId,
            title: matchResult.unmatched + " ungeklärte Banktransaktionen prüfen",
            taskType: "bank_reconciliation",
            priority: "medium",
            source: "system",
          },
        });
      }
    }

    await logAudit({
      companyId: ctx.companyId,
      userId: ctx.session.user.id,
      action: "bank_imported",
      entityType: "bank_import",
      entityId: results.map((result) => result.statementId).join(",") || file.name,
      changes: {
        imported: {
          before: null,
          after: {
            fileName: file.name,
            statements: results.length,
            transactions: results.reduce((sum, result) => sum + result.transactions, 0),
            matched: matchResult.matched,
            unmatched: matchResult.unmatched,
          },
        },
      },
    });

    return NextResponse.json({ statements: results, matching: matchResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Import fehlgeschlagen" }, { status: 400 });
  }
}
