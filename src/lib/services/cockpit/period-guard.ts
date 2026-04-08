import { prisma } from "@/lib/db";

export async function checkPeriodLock(
  companyId: string,
  date: Date
): Promise<{ locked: boolean; message?: string }> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const period = await prisma.monthlyPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (period?.status === "locked") {
    return { locked: true, message: `Periode ${month}/${year} ist gesperrt` };
  }
  return { locked: false };
}
