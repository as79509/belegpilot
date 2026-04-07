import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BexioClient } from "@/lib/services/bexio/bexio-client";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const integration = await prisma.integration.findFirst({
    where: { companyId: session.user.companyId, providerType: "export", providerName: "bexio" },
  });

  if (!integration?.credentials) {
    return NextResponse.json({ connected: false, error: "Nicht konfiguriert" });
  }

  const creds = integration.credentials as Record<string, any>;
  const client = new BexioClient(creds.accessToken);
  const connected = await client.testConnection();

  await prisma.integration.update({
    where: { id: integration.id },
    data: { lastTestedAt: new Date(), lastTestStatus: connected ? "connected" : "failed" },
  });

  return NextResponse.json({ connected });
}
