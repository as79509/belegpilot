import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { prisma } from "@/lib/db";
import { BexioClient } from "@/lib/services/bexio/bexio-client";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const integration = await prisma.integration.findFirst({
    where: { companyId: ctx.companyId, providerType: "export", providerName: "bexio", isEnabled: true },
  });

  if (!integration?.credentials) {
    return NextResponse.json({ error: "Bexio nicht konfiguriert" }, { status: 400 });
  }

  const creds = integration.credentials as Record<string, any>;
  const client = new BexioClient(creds.accessToken);

  try {
    const accounts = await client.getAccounts();
    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
