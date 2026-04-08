import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function getActiveCompany(): Promise<{
  session: any;
  companyId: string;
} | null> {
  const session = await auth();
  if (!session?.user) return null;

  const cookieStore = await cookies();
  const overrideCompanyId = cookieStore.get("belegpilot-company")?.value;

  if (overrideCompanyId && overrideCompanyId !== session.user.companyId) {
    const access = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: session.user.id,
          companyId: overrideCompanyId,
        },
      },
    });
    if (access) {
      return { session, companyId: overrideCompanyId };
    }
  }

  return { session, companyId: session.user.companyId };
}
