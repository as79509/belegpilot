import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!vatReturn) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return NextResponse.json(vatReturn);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!hasPermission(ctx.session.user.role, "vat:write")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.vatReturn.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const body = await request.json();

  // Handle status transitions
  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      draft: ["validated"],
      validated: ["approved", "draft"],
      approved: ["submitted", "validated"],
    };
    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `Ungültiger Statuswechsel: ${existing.status} → ${body.status}` }, { status: 400 });
    }

    const statusData: Record<string, any> = { status: body.status };
    if (body.status === "validated") {
      statusData.validatedAt = new Date();
      statusData.validatedBy = ctx.session.user.id;
      // Re-validate
      statusData.warnings = validateVatReturn(existing);
    }
    if (body.status === "approved") {
      statusData.approvedAt = new Date();
      statusData.approvedBy = ctx.session.user.id;
    }
    if (body.status === "submitted") {
      statusData.submittedAt = new Date();
    }

    const updated = await prisma.vatReturn.update({ where: { id }, data: statusData });
    return NextResponse.json(updated);
  }

  // Update Ziffern (only in draft)
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Nur Entwürfe können bearbeitet werden" }, { status: 400 });
  }

  const zifferFields = [
    "ziffer200", "ziffer205", "ziffer220", "ziffer221", "ziffer225", "ziffer230", "ziffer235",
    "ziffer302", "ziffer312", "ziffer342", "ziffer382",
    "steuer302", "steuer312", "steuer342", "steuer382",
    "ziffer400", "ziffer405", "ziffer410", "ziffer415", "ziffer420",
    "notes",
  ];

  const data: Record<string, any> = {};
  for (const field of zifferFields) {
    if (body[field] !== undefined) {
      data[field] = field === "notes" ? body[field] : parseFloat(body[field]) || 0;
    }
  }

  // Re-validate after edit
  const merged = { ...existing, ...data };
  data.warnings = validateVatReturn(merged);

  const updated = await prisma.vatReturn.update({ where: { id }, data });
  return NextResponse.json(updated);
}

function validateVatReturn(vr: any): Array<{ ziffer: string; message: string; severity: string }> {
  const warnings: Array<{ ziffer: string; message: string; severity: string }> = [];

  const z200 = Number(vr.ziffer200 || 0);
  const z205 = Number(vr.ziffer205 || 0);
  const z220 = Number(vr.ziffer220 || 0);
  const z221 = Number(vr.ziffer221 || 0);
  const z225 = Number(vr.ziffer225 || 0);
  const z230 = Number(vr.ziffer230 || 0);
  const z235 = Number(vr.ziffer235 || 0);

  const taxableRevenue = z200 - z205 - z220 - z221 - z225 - z230 - z235;
  const z302 = Number(vr.ziffer302 || 0);
  const z312 = Number(vr.ziffer312 || 0);
  const z342 = Number(vr.ziffer342 || 0);
  const z382 = Number(vr.ziffer382 || 0);
  const taxBase = z302 + z312 + z342 + z382;

  if (taxableRevenue > 0 && Math.abs(taxableRevenue - taxBase) > 1) {
    warnings.push({
      ziffer: "302-382",
      message: `Steuerbarer Umsatz (${taxableRevenue.toFixed(2)}) stimmt nicht mit Steuerberechnungsbasis (${taxBase.toFixed(2)}) überein`,
      severity: "warning",
    });
  }

  // Check tax rates
  const s302 = Number(vr.steuer302 || 0);
  if (z302 > 0 && Math.abs(s302 - z302 * 0.081) > 1) {
    warnings.push({ ziffer: "302", message: `Steuer Normalsatz: erwartet ${(z302 * 0.081).toFixed(2)}, ist ${s302.toFixed(2)}`, severity: "warning" });
  }
  const s312 = Number(vr.steuer312 || 0);
  if (z312 > 0 && Math.abs(s312 - z312 * 0.026) > 1) {
    warnings.push({ ziffer: "312", message: `Steuer red. Satz: erwartet ${(z312 * 0.026).toFixed(2)}, ist ${s312.toFixed(2)}`, severity: "warning" });
  }
  const s342 = Number(vr.steuer342 || 0);
  if (z342 > 0 && Math.abs(s342 - z342 * 0.038) > 1) {
    warnings.push({ ziffer: "342", message: `Steuer Sondersatz: erwartet ${(z342 * 0.038).toFixed(2)}, ist ${s342.toFixed(2)}`, severity: "warning" });
  }

  if (z200 === 0 && (z302 > 0 || z312 > 0 || z342 > 0)) {
    warnings.push({ ziffer: "200", message: "Gesamtumsatz ist 0, aber Steuerberechnung enthält Werte", severity: "error" });
  }

  return warnings;
}
