import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const inboxes = await prisma.emailInbox.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ inboxes });
}

export async function POST(request: NextRequest) {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Permission check: admin or trustee
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  });

  if (!user || !["admin", "trustee"].includes(user.role)) {
    return NextResponse.json(
      { error: "Nur Administratoren und Treuhänder können E-Mail-Eingänge erstellen" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { label, autoProcess, allowedSenders } = body;

  // Generate inbox address from company name
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { name: true },
  });

  const slug = company.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  const inboxAddress = slug + "-" + suffix + "@belege.belegpilot.ch";

  const inbox = await prisma.emailInbox.create({
    data: {
      companyId: ctx.companyId,
      inboxAddress,
      label: label || null,
      autoProcess: autoProcess !== false,
      allowedSenders: allowedSenders || null,
    },
  });

  return NextResponse.json({ inbox }, { status: 201 });
}
