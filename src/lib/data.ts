import { DocumentStatus } from "@/generated/prisma/enums";
import { ensureDatabase, prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

export async function getClients() {
  await ensureDatabase();
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          documents: true,
          accounts: true,
        },
      },
    },
  });
}

export async function getClientById(clientId: string) {
  await ensureDatabase();
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      accounts: {
        where: { isActive: true },
        orderBy: { accountNo: "asc" },
      },
      _count: {
        select: {
          documents: true,
        },
      },
    },
  });
}

export async function listDocuments(filters: {
  clientId?: string;
  status?: string;
  query?: string;
  from?: Date | null;
  to?: Date | null;
  sort?: "createdAt" | "documentDate";
}) {
  await ensureDatabase();
  return prisma.document.findMany({
    where: {
      clientId: filters.clientId || undefined,
      status:
        filters.status && filters.status !== "alle"
          ? (filters.status as DocumentStatus)
          : undefined,
      OR: filters.query
        ? [
            { supplierName: { contains: filters.query } },
            { invoiceNumber: { contains: filters.query } },
            { description: { contains: filters.query } },
          ]
        : undefined,
      createdAt:
        filters.from || filters.to
          ? {
              gte: filters.from ?? undefined,
              lte: filters.to ?? undefined,
            }
          : undefined,
    },
    include: {
      client: true,
    },
    orderBy:
      filters.sort === "documentDate"
        ? [{ documentDate: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
  });
}

export async function getDocumentById(documentId: string) {
  await ensureDatabase();
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      client: {
        include: {
          accounts: {
            where: { isActive: true },
            orderBy: { accountNo: "asc" },
          },
        },
      },
    },
  });
}

export async function getExportContext() {
  const [settings, clients] = await Promise.all([getAppSettings(), getClients()]);
  return { settings, clients };
}

export async function getDatabaseStatus() {
  await ensureDatabase();
  const [clientCount, documentCount, accountCount] = await Promise.all([
    prisma.client.count(),
    prisma.document.count(),
    prisma.account.count(),
  ]);

  return {
    clientCount,
    documentCount,
    accountCount,
  };
}
