import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveCompany } from "@/lib/get-active-company";
import "@/lib/services/integrations/providers/csv-provider";
import "@/lib/services/integrations/providers/bexio-provider";
import { getAllProviders } from "@/lib/services/integrations/provider-registry";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const providers = getAllProviders();

  const integrations = await prisma.integration.findMany({
    where: { companyId: ctx.companyId },
    select: { providerName: true, isEnabled: true },
  });
  const configuredMap = new Map(integrations.map((i) => [i.providerName, i.isEnabled]));

  const result = providers.map((p) => ({
    ...p,
    isConfigured: configuredMap.has(p.id),
    isEnabled: configuredMap.get(p.id) || false,
  }));

  return NextResponse.json({ providers: result });
}
